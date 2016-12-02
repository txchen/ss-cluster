export default class Logger {
  constructor(name) {
    this.name = name
  }

  error (msg) {
    console.log(`[${this.name}] ERR - ${msg}`)
  }

  info (msg) {
    console.log(`[${this.name}] INF - ${msg}`)
  }

  warning (msg) {
    console.log(`[${this.name}] WAR - ${msg}`)
  }

  verbose (msg) {
    console.log(`[${this.name}] VER - ${msg}`)
  }
}