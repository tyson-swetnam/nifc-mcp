import winston from 'winston';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Define custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Console format for development (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }),
);

// Create logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'nifc-mcp' },
  transports: [
    // Console transport - write to stderr for MCP compatibility
    new winston.transports.Console({
      format: consoleFormat,
      stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'], // All levels to stderr
    }),
  ],
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Error log file
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }));

  // Combined log file
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }));
}

// Create a stream for Morgan HTTP logging (if needed)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Helper methods for common logging scenarios
logger.logRequest = (toolName, params) => {
  logger.info('MCP Tool Request', {
    tool: toolName,
    params,
    timestamp: new Date().toISOString(),
  });
};

logger.logResponse = (toolName, responseSize, duration) => {
  logger.info('MCP Tool Response', {
    tool: toolName,
    responseSize,
    durationMs: duration,
    timestamp: new Date().toISOString(),
  });
};

logger.logAPICall = (apiName, endpoint, method = 'GET') => {
  logger.debug('External API Call', {
    api: apiName,
    endpoint,
    method,
    timestamp: new Date().toISOString(),
  });
};

logger.logAPIResponse = (apiName, statusCode, duration) => {
  logger.debug('External API Response', {
    api: apiName,
    statusCode,
    durationMs: duration,
    timestamp: new Date().toISOString(),
  });
};

logger.logCacheHit = (key) => {
  logger.debug('Cache Hit', {
    key,
    timestamp: new Date().toISOString(),
  });
};

logger.logCacheMiss = (key) => {
  logger.debug('Cache Miss', {
    key,
    timestamp: new Date().toISOString(),
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString(),
  });
};

export default logger;
