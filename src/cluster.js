import { Logger } from './logger'
import { SSLocal } from './ssLocal'
import Koa from 'koa'

const app = new Koa()
const ssLocalInstances = []

app.use(async ctx => {
  let rows = ''
  ssLocalInstances.forEach(ssLocal => {
    const cfg = ssLocal.config
    rows += `<tr>
  <td>${cfg.serverAddr + ':' + cfg.serverPort}</td>
  <td>${cfg.localAddr + ':' + cfg.localPort}</td>
  <td>${cfg.method}</td>
  <td></td>
  <td></td>
</tr>`
  })
  ctx.body = `
<html>
  <head>
    <meta http-equiv="refresh" content="30">
  </head>
  <body>
    <h3>Total client number: ${ssLocalInstances.length}</h3>
    <table border="1">
      <tr>
        <th>ServerAddr</th>
        <th>LocalAddr</th>
        <th>Method</th>
        <th>IP</th>
        <th>Status</th>
      </tr>
      ${rows}
    </table>
    <h4>Rendered at ${new Date()}</h4>
  </body>
</html>
`
})

export default {
  start (servers) {
    for (let i = 0; i < servers.length; i++) {
      let logger = new Logger('ssLocal_' + i)
      let config = servers[i]
      let ssLocal = new SSLocal(config, logger)
      ssLocal.startServer()
      ssLocalInstances.push(ssLocal)
    }
  },

  startWeb (port) {
    app.listen(port, () => {
      console.log('clients\' status can be viewed via http://localhost:' + port)
    })
  }
}