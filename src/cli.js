import commander from 'commander'

commander
  .option('-c, --config [configFile]', 'server config file')
  .parse(process.argv)

export default function cli () {
  if (!commander.config) {
    commander.outputHelp()
    process.exit(1)
  } else {
    console.log('work')
  }
}