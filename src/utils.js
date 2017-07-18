const ip = require('ip')

module.exports.BufferFrom = (() => {
  try {
    Buffer.from('aa', 'hex')
  } catch (err) {
    return ((...args) => new Buffer(...args))
  }

  return Buffer.from
})()

module.exports.closeSilently = (server) => {
  if (server) {
    try {
      server.close()
    } catch (e) {
      // already closed
    }
  }
}

module.exports.sendDgram = function (socket, data, ...args) {
  socket.send(data, 0, data.length, ...args)
}

module.exports.writeOrPause = function (fromCon, toCon, data) {
  const res = toCon.write(data)

  if (!res) {
    fromCon.pause()
  }

  return res
}

function _getDstInfo(data, offset) {
  const atyp = data[offset]

  let dstAddr
  let dstPort
  let dstAddrLength
  let dstPortIndex
  let dstPortEnd
  // length of non-data field
  let totalLength

  switch (atyp) {
    case 0x01:
      dstAddrLength = 4
      dstAddr = data.slice(offset + 1, offset + 5)
      dstPort = data.slice(offset + 5, offset + 7)
      totalLength = offset + 7
      break
    case 0x04:
      dstAddrLength = 16
      dstAddr = data.slice(offset + 1, offset + 17)
      dstPort = data.slice(offset + 17, offset + 19)
      totalLength = offset + 19
      break
    case 0x03:
      dstAddrLength = data[offset + 1]
      dstPortIndex = 2 + offset + dstAddrLength
      dstAddr = data.slice(offset + 2, dstPortIndex)
      dstPortEnd = dstPortIndex + 2
      dstPort = data.slice(dstPortIndex, dstPortEnd)
      totalLength = dstPortEnd;
      break
    default:
      return null
  }

  if (data.length < totalLength) {
    return null
  }

  return {
    atyp, dstAddrLength, dstAddr, dstPort, totalLength,
  }
}

module.exports.getDstInfo = function (data, isServer) {
  // +----+-----+-------+------+----------+----------+
  // |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
  // +----+-----+-------+------+----------+----------+
  // | 1  |  1  | X'00' |  1   | Variable |    2     |
  // +----+-----+-------+------+----------+----------+
  // Yet shadowsocks begin with ATYP.

  const offset = isServer ? 0 : 3
  return _getDstInfo(data, offset)
}

module.exports.getDstInfoFromUDPMsg = function (data, isServer) {
  // +----+------+------+----------+----------+----------+
  // |RSV | FRAG | ATYP | DST.ADDR | DST.PORT |   DATA   |
  // +----+------+------+----------+----------+----------+
  // | 2  |  1   |  1   | Variable |    2     | Variable |
  // +----+------+------+----------+----------+----------+

  const offset = isServer ? 0 : 3

  return _getDstInfo(data, offset)
}

const formatKeyValues = {
  server: 'serverAddr',
  server_port: 'serverPort',
  local_addr: 'localAddr',
  local_port: 'localPort',
  local_addr_ipv6: 'localAddrIPv6',
  server_addr_ipv6: 'serverAddrIPv6',
}

module.exports.formatConfig = function (_config) {
  const formattedConfig = Object.assign({}, _config)

  Object.keys(formatKeyValues).forEach((key) => {
    if (formattedConfig.hasOwnProperty(key)) {
      formattedConfig[formatKeyValues[key]] = formattedConfig[key]
      delete formattedConfig[key]
    }
  })

  return formattedConfig
}

module.exports.getDstStr = function (dstInfo) {
  if (!dstInfo) {
    return null
  }

  switch (dstInfo.atyp) {
    case 1:
    case 4:
      return `${ip.toString(dstInfo.dstAddr)}:${dstInfo.dstPort.readUInt16BE()}`
    case 3:
      return `${dstInfo.dstAddr.toString('utf8')}:${dstInfo.dstPort.readUInt16BE()}`
    default:
      return 'WARN: invalid atyp'
  }
}
