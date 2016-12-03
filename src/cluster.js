import { Logger } from './logger'
import { SSLocal } from './ssLocal'

// TODO: expose a web endpoint to view the status of the connections

const ssLocalInstances = []

export default {
  start (servers) {
    for (let i = 0; i < servers.length; i++) {
      let logger = new Logger('ssLocal_' + i)
      let config = servers[i]
      let ssLocal = new SSLocal(config, logger)
      ssLocal.startServer()
      ssLocalInstances.push(ssLocal)
    }
  }
}