// @flow

export const LogLevel = {
  Debug: 0,
  Info: 1,
  Warn: 2,
  Error: 3,
}

let logLevel = LogLevel.Debug

const logger = console

export const setLogLevel = (level: $Values<typeof LogLevel>) => {
  logLevel = level
}

export const Logger = {
  debug: (...args: any) => LogLevel.Debug >= logLevel && logger.debug(...args),
  info: (...args: any) => LogLevel.Info >= logLevel && logger.info(...args),
  warn: (...args: any) => LogLevel.Warn >= logLevel && logger.warn(...args),
  error: (...args: any) => LogLevel.Error >= logLevel && logger.error(...args),
  setLogLevel,
}