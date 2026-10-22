/* Simple, clean logger */

const timestamp = () => new Date().toISOString();

export const logger = {
  info: (...msg: unknown[]) => {
    console.log(`\x1b[36m[INFO]\x1b[0m ${timestamp()}:`, ...msg);
  },

  warn: (...msg: unknown[]) => {
    console.warn(`\x1b[33m[WARN]\x1b[0m ${timestamp()}:`, ...msg);
  },

  error: (...msg: unknown[]) => {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${timestamp()}:`, ...msg);
  },

  success: (...msg: unknown[]) => {
    console.log(`\x1b[32m[SUCCESS]\x1b[0m ${timestamp()}:`, ...msg);
  },
};
