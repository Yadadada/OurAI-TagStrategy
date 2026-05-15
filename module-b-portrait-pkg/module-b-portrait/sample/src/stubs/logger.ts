// Stub for the production logger (api/src/utils/logger.ts).
// Same surface, just routes to console.
//
// Why this exists: personaCard.ts is vendored verbatim from Ourai. It expects
// a default-exported logger with .log / .error / .warn / .info methods. We
// provide one here so the file compiles without touching its imports.

const noop = (): void => {};

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  log: isDev ? console.log.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: process.env.DEBUG ? console.debug.bind(console) : noop,
};

export default logger;
