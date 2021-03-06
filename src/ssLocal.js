const ip = require('ip')
const { createServer, connect } = require('net')
const { getDstInfo, writeOrPause, getDstStr, closeSilently } = require('./utils')
const { createCipher, createDecipher } = require('./encryptor')
const request = require('superagent')
const SuperagentProxy = require('superagent-proxy')

SuperagentProxy(request)

function handleMethod (connection, data) {
  // +----+----------+----------+
  // |VER | NMETHODS | METHODS  |
  // +----+----------+----------+
  // | 1  |    1     | 1 to 255 |
  // +----+----------+----------+
  const buf = new Buffer(2)

  let method = -1

  if (data.indexOf(0x00, 2) >= 0) {
    method = 0
  }

  // allow `no authetication` or any usename/password
  if (method === -1) {
    // logger.warn(`unsupported method: ${data.toString('hex')}`);
    buf.writeUInt16BE(0x05FF)
    connection.write(buf)
    connection.end()
    return -1
  }

  buf.writeUInt16BE(0x0500)
  connection.write(buf)

  return method === 0 ? 1 : 3 // cannot be 3
}

SSLocal.prototype.handleRequest = function (
  connection, data,
  { serverAddr, serverPort, password, method, localAddr, localPort },
  dstInfo, onConnect, onDestroy, isClientConnected
) {
  const cmd = data[1]
  const clientOptions = {
    port: serverPort,
    host: serverAddr,
  }
  const isUDPRelay = (cmd === 0x03)

  let repBuf
  let tmp = null
  let decipher = null
  let decipheredData = null
  let cipher = null
  let cipheredData = null

  if (cmd !== 0x01 && !isUDPRelay) {
    this.logger.warn(`unsupported cmd: ${cmd}`)
    return {
      stage: -1,
    }
  }

  // prepare data

  // +----+-----+-------+------+----------+----------+
  // |VER | REP |  RSV  | ATYP | BND.ADDR | BND.PORT |
  // +----+-----+-------+------+----------+----------+
  // | 1  |  1  | X'00' |  1   | Variable |    2     |
  // +----+-----+-------+------+----------+----------+

  if (isUDPRelay) {
    const isUDP4 = dstInfo.atyp === 1

    repBuf = new Buffer(4)
    repBuf.writeUInt32BE(isUDP4 ? 0x05000001 : 0x05000004)
    tmp = new Buffer(2)
    tmp.writeUInt16BE(localPort)
    repBuf = Buffer.concat([repBuf, ip.toBuffer(isUDP4 ? localAddr : localAddrIPv6), tmp])

    connection.write(repBuf)

    return {
      stage: -1,
    }
  }

  this.logger.verbose(`connecting: ${ip.toString(dstInfo.dstAddr)}`
    + `:${dstInfo.dstPort.readUInt16BE()}`)

  repBuf = new Buffer(10)
  repBuf.writeUInt32BE(0x05000001)
  repBuf.writeUInt32BE(0x00000000, 4, 4)
  repBuf.writeUInt16BE(0, 8, 2)

  tmp = createCipher(password, method,
    data.slice(3)) // skip VER, CMD, RSV
  cipher = tmp.cipher
  cipheredData = tmp.data

  // connect
  const clientToRemote = connect(clientOptions, () => {
    onConnect()
  })

  clientToRemote.on('data', (remoteData) => {
    if (!decipher) {
      tmp = createDecipher(password, method, remoteData)
      if (!tmp) {
        this.logger.warn(`get invalid msg`)
        onDestroy()
        return
      }
      decipher = tmp.decipher
      decipheredData = tmp.data
    } else {
      decipheredData = decipher.update(remoteData)
    }

    if (isClientConnected()) {
      writeOrPause(clientToRemote, connection, decipheredData)
      this.rx += decipheredData.length
    } else {
      clientToRemote.destroy()
    }
  })

  clientToRemote.on('drain', () => {
    connection.resume()
  })

  clientToRemote.on('end', () => {
    connection.end()
  })

  clientToRemote.on('error', (e) => {
    this.logger.warn('ssLocal error happened in clientToRemote when'
      + ` connecting to ${getDstStr(dstInfo)}: ${e.message}`)

    onDestroy()
  })

  clientToRemote.on('close', (e) => {
    if (e) {
      connection.destroy()
    } else {
      connection.end()
    }
  })

  // write
  connection.write(repBuf)
  this.tx += repBuf.length

  writeOrPause(connection, clientToRemote, cipheredData)
  this.tx += cipheredData.length

  return {
    stage: 2,
    cipher,
    clientToRemote,
  }
}

SSLocal.prototype.handleConnection = function (config, connection) {
  let stage = 0
  let clientToRemote
  let tmp
  let cipher
  let dstInfo
  let remoteConnected = false
  let clientConnected = true
  let timer = null

  connection.on('data', (data) => {
    switch (stage) {
      case 0:
        stage = handleMethod(connection, data)

        break
      case 1:
        dstInfo = getDstInfo(data)

        if (!dstInfo) {
          this.logger.warn(`Failed to get 'dstInfo' from parsing data: ${data}`)
          connection.destroy()
          return
        }

        tmp = this.handleRequest(
          connection, data, config, dstInfo,
          () => { // after connected
            remoteConnected = true
          },
          () => { // get invalid msg or err happened
            if (remoteConnected) {
              remoteConnected = false
              clientToRemote.destroy()
            }

            if (clientConnected) {
              clientConnected = false
              connection.destroy()
            }
          },
          () => clientConnected
        )

        stage = tmp.stage

        if (stage === 2) {
          clientToRemote = tmp.clientToRemote
          cipher = tmp.cipher
        } else {
          // udp relay
          clientConnected = false
          connection.end()
        }

        break
      case 2:
        tmp = cipher.update(data)

        writeOrPause(connection, clientToRemote, tmp)

        break
      // case 3:
      //   // rfc 1929 username/password authetication
      //   stage = usernamePasswordAuthetication(connection, data, authInfo);
      //   break;
      default:
        return
    }
  });

  connection.on('drain', () => {
    if (remoteConnected) {
      clientToRemote.resume()
    }
  })

  connection.on('end', () => {
    clientConnected = false
    if (remoteConnected) {
      clientToRemote.end()
    }
  })

  connection.on('close', (e) => {
    if (timer) {
      clearTimeout(timer)
    }

    clientConnected = false

    if (remoteConnected) {
      if (e) {
        clientToRemote.destroy()
      } else {
        clientToRemote.end()
      }
    }
  })

  connection.on('error', (e) => {
    this.logger.warn(`error happened in client connection: ${e.message}`)
  })

  timer = setTimeout(() => {
    if (clientConnected) {
      connection.destroy()
    }

    if (remoteConnected) {
      clientToRemote.destroy()
    }
  }, config.timeout * 1000)
}

SSLocal.prototype.closeAll = function () {
  closeSilently(this.server)
}

SSLocal.prototype.startServer = function () {
  this.server = createServer(this.handleConnection.bind(this, this.config))

  this.server.on('close', () => {
    this.logger.warn(`server closed`)
  })

  this.server.on('error', (e) => {
    this.logger.error(`server error: ${e.message}`)
  })

  this.server.listen(this.config.localPort)

  this.logger.info(`listening on ${this.config.localAddr}:${this.config.localPort}`)

  this.checkHealth()
  setInterval(() => { this.checkHealth() }, 60 * 1000)

  return {
    server: this.server,
    closeAll: this.closeAll,
  }
}

SSLocal.prototype.checkHealth = function () {
  request.get('http://whatismyip.akamai.com/')
    .proxy('socks://127.0.0.1:' + this.config.localPort)
    .end((err, res) => {
      if (err) {
        this.logger.error(`failed to detect connectivity: ${err}`)
        this.lastStatus = 'Error'
      } else {
        this.logger.verbose(`connectivity is cool! -- ${res.text}`)
        this.lastStatus = 'OK'
        this.IP = res.text
      }
    })
}

function SSLocal (config, logger) {
  this.config = Object.assign({}, config)
  this.logger = logger
  this.tx = 0
  this.rx = 0
  this.lastStatus = 'Unknown'
  this.IP = ''
}

module.exports = {
  SSLocal
}