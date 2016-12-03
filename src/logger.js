export const LogLevel = {
  VERBOSE: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 2,
}

export class Logger {
  constructor(name) {
    this.name = name
    this.logLevel = LogLevel.INFO
  }

  setLogLevel(logLevel) {
    this.logLevel = logLevel
  }

  error (msg) {
    console.log(`[${this.name}] ERR - ${msg}`)
  }

  info (msg) {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(`[${this.name}] INF - ${msg}`)
    }
  }

  warning (msg) {
    if (this.logLevel <= LogLevel.WARNING) {
      console.log(`[${this.name}] WAR - ${msg}`)
    }
  }

  verbose (msg) {
    if (this.logLevel <= LogLevel.VERBOSE) {
      console.log(`[${this.name}] VER - ${msg}`)
    }
  }
}