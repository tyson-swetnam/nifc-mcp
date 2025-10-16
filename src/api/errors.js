/**
 * Custom error classes for API operations
 * Provides specific error types for different failure scenarios
 */

/**
 * Base class for all API errors
 */
export class APIError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} errorCode - Application-specific error code
   * @param {Object} details - Additional error details
   */
  constructor(message, statusCode = 500, errorCode = 'API_ERROR', details = {}) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging or API responses
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Network-related errors (connection failures, timeouts, DNS issues)
 */
export class NetworkError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   */
  constructor(message, details = {}) {
    super(message, 503, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

/**
 * Request timeout errors
 */
export class TimeoutError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {number} timeout - Timeout duration in milliseconds
   * @param {Object} details - Additional error details
   */
  constructor(message, timeout, details = {}) {
    super(message, 504, 'TIMEOUT_ERROR', {
      ...details,
      timeout,
    });
    this.name = 'TimeoutError';
  }
}

/**
 * Validation errors for request parameters
 */
export class ValidationError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {Array} validationErrors - Array of validation error details
   */
  constructor(message, validationErrors = []) {
    super(message, 400, 'VALIDATION_ERROR', {
      validationErrors,
    });
    this.name = 'ValidationError';
  }
}

/**
 * Rate limiting errors (too many requests)
 */
export class RateLimitError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {number} retryAfter - Seconds to wait before retrying
   * @param {Object} details - Additional error details
   */
  constructor(message, retryAfter = null, details = {}) {
    super(message, 429, 'RATE_LIMIT_ERROR', {
      ...details,
      retryAfter,
    });
    this.name = 'RateLimitError';
  }
}

/**
 * Resource not found errors (404)
 */
export class NotFoundError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {string} resourceType - Type of resource that wasn't found
   * @param {string} resourceId - ID of the resource that wasn't found
   */
  constructor(message, resourceType = null, resourceId = null) {
    super(message, 404, 'NOT_FOUND', {
      resourceType,
      resourceId,
    });
    this.name = 'NotFoundError';
  }
}

/**
 * Authentication errors (401)
 */
export class AuthenticationError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   */
  constructor(message, details = {}) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization/permission errors (403)
 */
export class AuthorizationError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   */
  constructor(message, details = {}) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Server errors (5xx)
 */
export class ServerError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} details - Additional error details
   */
  constructor(message, statusCode = 500, details = {}) {
    super(message, statusCode, 'SERVER_ERROR', details);
    this.name = 'ServerError';
  }
}

/**
 * Data parsing/format errors
 */
export class ParseError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {string} dataType - Type of data that failed to parse
   * @param {Object} details - Additional error details
   */
  constructor(message, dataType = null, details = {}) {
    super(message, 422, 'PARSE_ERROR', {
      ...details,
      dataType,
    });
    this.name = 'ParseError';
  }
}

/**
 * External service unavailable errors
 */
export class ServiceUnavailableError extends APIError {
  /**
   * @param {string} message - Error message
   * @param {string} serviceName - Name of the unavailable service
   * @param {Object} details - Additional error details
   */
  constructor(message, serviceName = null, details = {}) {
    super(message, 503, 'SERVICE_UNAVAILABLE', {
      ...details,
      serviceName,
    });
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Convert HTTP error to appropriate custom error type
 * @param {Error} error - Original error
 * @param {string} context - Context where error occurred
 * @returns {APIError}
 */
export function fromHttpError(error, context = '') {
  // If already an APIError, return as-is
  if (error instanceof APIError) {
    return error;
  }

  const details = { context, originalError: error.message };

  // Axios error
  if (error.response) {
    const { status, statusText, data } = error.response;
    details.statusText = statusText;
    details.responseData = data;

    switch (status) {
      case 400:
        return new ValidationError(
          `Bad Request: ${data?.message || statusText}`,
          data?.errors || [],
        );
      case 401:
        return new AuthenticationError(
          `Authentication failed: ${data?.message || statusText}`,
          details,
        );
      case 403:
        return new AuthorizationError(
          `Authorization failed: ${data?.message || statusText}`,
          details,
        );
      case 404:
        return new NotFoundError(
          `Resource not found: ${data?.message || statusText}`,
          details.resourceType,
          details.resourceId,
        );
      case 429:
        return new RateLimitError(
          `Rate limit exceeded: ${data?.message || statusText}`,
          error.response.headers?.['retry-after'],
          details,
        );
      case 503:
        return new ServiceUnavailableError(
          `Service unavailable: ${data?.message || statusText}`,
          context,
          details,
        );
      default:
        if (status >= 500) {
          return new ServerError(
            `Server error: ${data?.message || statusText}`,
            status,
            details,
          );
        }
        return new APIError(
          `HTTP error ${status}: ${data?.message || statusText}`,
          status,
          'HTTP_ERROR',
          details,
        );
    }
  }

  // Network error (no response received)
  if (error.request) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new TimeoutError(
        `Request timeout: ${error.message}`,
        error.timeout,
        details,
      );
    }

    return new NetworkError(
      `Network error: ${error.message}`,
      {
        ...details,
        errorCode: error.code,
      },
    );
  }

  // Generic error
  return new APIError(
    `Request error: ${error.message}`,
    500,
    'UNKNOWN_ERROR',
    details,
  );
}

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
export function isRetryableError(error) {
  if (!(error instanceof APIError)) {
    return false;
  }

  // Retry on network errors, timeouts, and 5xx errors
  return (
    error instanceof NetworkError ||
    error instanceof TimeoutError ||
    error instanceof ServiceUnavailableError ||
    (error instanceof ServerError && error.statusCode >= 500)
  );
}

/**
 * Get retry delay for rate limit errors
 * @param {RateLimitError} error - Rate limit error
 * @returns {number} Milliseconds to wait before retrying
 */
export function getRetryDelay(error) {
  if (error instanceof RateLimitError && error.details.retryAfter) {
    // retryAfter is in seconds, convert to milliseconds
    return error.details.retryAfter * 1000;
  }

  // Default exponential backoff: 1s, 2s, 4s, 8s, etc.
  return 1000;
}

export default {
  APIError,
  NetworkError,
  TimeoutError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ServerError,
  ParseError,
  ServiceUnavailableError,
  fromHttpError,
  isRetryableError,
  getRetryDelay,
};
