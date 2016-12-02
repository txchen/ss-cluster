import Logger from './logger'
import { SSLocal } from './ssLocal'

// TODO: expose a web endpoint to view the status of the connections

export default {
  start (servers) {
    console.log(servers)
    // create n * ssLocal instance
    let logger = new Logger('name1')
    let config = servers[0]
    let ssLocal = new SSLocal(config, logger)
    ssLocal.startServer()
  }
}