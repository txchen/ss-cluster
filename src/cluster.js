const { Logger } = require('./logger')
const { SSLocal } = require('./ssLocal')
const Koa = require('koa')
const http = require('http')

const app = new Koa()
const ssLocalInstances = []

function formatSizeUnits(bytes)
{
  if ( ( bytes >> 30 ) & 0x3FF )
    bytes = ( bytes >>> 30 ) + '.' + ( bytes & (3*0x3FF )) + 'GB'
  else if ( ( bytes >> 20 ) & 0x3FF )
    bytes = ( bytes >>> 20 ) + '.' + ( bytes & (2*0x3FF ) ) + 'MB'
  else if ( ( bytes >> 10 ) & 0x3FF )
    bytes = ( bytes >>> 10 ) + '.' + ( bytes & (0x3FF ) ) + 'KB'
  else if ( ( bytes >> 1 ) & 0x3FF )
    bytes = ( bytes >>> 1 ) + 'B'
  else
    bytes = bytes + 'B'
  return bytes
}

app.use(async ctx => {
  ipCounts = {}
  ssLocalInstances.forEach(ssLocal => {
    if (ipCounts[ssLocal.IP]) {
      ipCounts[ssLocal.IP]++
    } else {
      ipCounts[ssLocal.IP] = 1
    }
  })

  let rows = ''
  ssLocalInstances.forEach(ssLocal => {
    const cfg = ssLocal.config
    rows += `<tr>
  <td>${cfg.serverAddr + ':' + cfg.serverPort}</td>
  <td>${cfg.localAddr + ':' + cfg.localPort}</td>
  <td>${cfg.method}</td>
  <td>${formatSizeUnits(ssLocal.tx)}</td>
  <td>${formatSizeUnits(ssLocal.rx)}</td>
  <td>${ssLocal.IP} ${ ipCounts[ssLocal.IP] > 1 ? '(' + ipCounts[ssLocal.IP] + ')' : '' }</td>
  <td>${ssLocal.lastStatus}</td>
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
        <th>TX</th>
        <th>RX</th>
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

module.exports = {
  start (servers) {
    for (let i = 0; i < servers.length; i++) {
      let logger = new Logger('ssLocal_' + (i + 1))
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