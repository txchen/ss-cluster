import commander from 'commander'
import fs from 'fs'
import cluster from './cluster'

commander
  .option('-c, --config [configFile]', 'server config file')
  .parse(process.argv)

function extend (target) {
  var sources = [].slice.call(arguments, 1)
  sources.forEach(source => {
    for (var prop in source) {
      target[prop] = source[prop]
    }
  })
  return target
}

// callback (err, servers), err is an array, servers is an array
function validateConfig (configFile, callback) {
  fs.readFile(configFile, 'utf8', (err, data) => {
    if (err) {
      return callback([err], null)
    }
    let configObj = JSON.parse(data)
    if (!configObj.servers || !configObj.servers.length) {
      return callback(['No defined servers in config file'], null)
    }
    // apply default to each server config
    let servers = configObj.servers
    for (let i in servers) {
      servers[i] = extend({}, configObj.default, servers[i])
    }
    let errors = []
    // validate each servers
    let localAddrSet = new Set()
    for (let i in servers) {
      let curSrv = servers[i]
      if (!curSrv.serverAddr || !curSrv.serverPort) {
        errors.push(`server #${i} - serverAddr/serverPort not defined`)
        continue
      }
      if (!curSrv.localAddr || !curSrv.localPort) {
        errors.push(`server #${i} - localAddr/localPort not defined`)
        continue
      }
      if (!curSrv.method) {
        errors.push(`server #${i} - method not defined`)
        continue
      }
      if (!curSrv.password) {
        errors.push(`server #${i} - password not defined`)
        continue
      }
      if (!curSrv.timeout) {
        curSrv.timeout = 600
      }
      let localAddrUrl = curSrv.localAddr + ':' + curSrv.localPort
      if (localAddrSet.has(localAddrUrl)) {
        errors.push(`server #${i} - local address ${localAddrUrl} duplicated`)
        continue
      }
      localAddrSet.add(localAddrUrl)
    }
    return callback(errors.length ? errors : null, servers)
  })
}

export default function cli () {
  if (!commander.config) {
    commander.outputHelp()
    process.exit(1)
  } else {
    validateConfig(commander.config, (err, servers) => {
      if (err) {
        console.log('Failed to start ss-cluster, errors:')
        err.forEach(e => console.log('  * ' + e))
        process.exit(2)
      }
      // start the ss-local instances
      console.log(`Trying to start ${servers.length} ss-local instances`)
      cluster.start(servers)
    })
  }
}