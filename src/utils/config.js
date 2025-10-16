import dotenv from 'dotenv';
import logger from './logger.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Parse boolean environment variables
 * @param {string} value - Environment variable value
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse integer environment variables
 * @param {string} value - Environment variable value
 * @param {number} defaultValue - Default value if not set
 * @returns {number}
 */
function parseInteger(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float environment variables
 * @param {string} value - Environment variable value
 * @param {number} defaultValue - Default value if not set
 * @returns {number}
 */
function parseFloatValue(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const parsed = Number.parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Application configuration
 * Centralizes all environment variable loading with type coercion and defaults
 */
const config = {
  // Server Configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Cache Configuration
  cache: {
    ttlSeconds: parseInteger(process.env.CACHE_TTL_SECONDS, 300), // 5 minutes
    maxSize: parseInteger(process.env.CACHE_MAX_SIZE, 1000),
    cleanupInterval: parseInteger(process.env.CACHE_CLEANUP_INTERVAL, 600), // 10 minutes
  },

  // Data Source Configuration
  dataSources: {
    enablePerimeterData: parseBoolean(process.env.ENABLE_PERIMETER_DATA, true),
    enableInciwebIntegration: parseBoolean(process.env.ENABLE_INCIWEB_INTEGRATION, true),
    enableIrwinData: parseBoolean(process.env.ENABLE_IRWIN_DATA, true),
  },

  // Feature Flags
  features: {
    includeHistoricalFires: parseBoolean(process.env.INCLUDE_HISTORICAL_FIRES, true),
    maxFiresPerQuery: parseInteger(process.env.MAX_FIRES_PER_QUERY, 100),
    proximityAlertRadiusMiles: parseFloatValue(process.env.PROXIMITY_ALERT_RADIUS_MILES, 50),
  },

  // API Endpoints
  api: {
    nifcArcgisBaseUrl: process.env.NIFC_ARCGIS_BASE_URL ||
      'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services',
    inciwebApiUrl: process.env.INCIWEB_API_URL ||
      'https://inciweb.nwcg.gov',
    irwinApiUrl: process.env.IRWIN_API_URL ||
      'https://irwin.doi.gov',
  },

  // GeoJSON Processing
  geojson: {
    simplifyPerimeters: parseBoolean(process.env.SIMPLIFY_PERIMETERS, true),
    coordinatePrecision: parseInteger(process.env.COORDINATE_PRECISION, 4),
    simplificationTolerance: parseFloatValue(process.env.SIMPLIFICATION_TOLERANCE, 0.001),
  },

  // Rate Limiting (for external APIs)
  rateLimit: {
    maxRequestsPerMinute: parseInteger(process.env.MAX_REQUESTS_PER_MINUTE, 60),
    retryAttempts: parseInteger(process.env.RETRY_ATTEMPTS, 3),
    retryDelayMs: parseInteger(process.env.RETRY_DELAY_MS, 1000),
  },

  // Timeouts
  timeouts: {
    apiRequestTimeout: parseInteger(process.env.API_REQUEST_TIMEOUT, 10000), // 10 seconds
    toolExecutionTimeout: parseInteger(process.env.TOOL_EXECUTION_TIMEOUT, 30000), // 30 seconds
  },
};

/**
 * Validate configuration
 * Ensures required values are set and within acceptable ranges
 */
function validateConfig() {
  const errors = [];

  // Validate cache TTL
  if (config.cache.ttlSeconds < 0) {
    errors.push('CACHE_TTL_SECONDS must be >= 0');
  }

  // Validate max fires per query
  if (config.features.maxFiresPerQuery < 1 || config.features.maxFiresPerQuery > 1000) {
    errors.push('MAX_FIRES_PER_QUERY must be between 1 and 1000');
  }

  // Validate proximity alert radius
  if (config.features.proximityAlertRadiusMiles <= 0) {
    errors.push('PROXIMITY_ALERT_RADIUS_MILES must be > 0');
  }

  // Validate coordinate precision
  if (config.geojson.coordinatePrecision < 1 || config.geojson.coordinatePrecision > 10) {
    errors.push('COORDINATE_PRECISION must be between 1 and 10');
  }

  // Validate timeouts
  if (config.timeouts.apiRequestTimeout < 1000) {
    errors.push('API_REQUEST_TIMEOUT must be >= 1000ms');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Validate on load
try {
  validateConfig();
  logger.info('Configuration loaded successfully', {
    environment: config.nodeEnv,
    logLevel: config.logLevel,
    cacheTTL: config.cache.ttlSeconds,
  });
} catch (error) {
  logger.error('Configuration validation failed', { error: error.message });
  throw error;
}

export default config;
