/**
 * Base class for MCP tool handlers
 * Provides standard error handling, logging, validation, and caching patterns
 */

import logger from '../utils/logger.js';
import cache from '../utils/cache.js';
import { validateParams } from '../schemas/validators.js';
import { APIError, ValidationError } from '../api/errors.js';

/**
 * Base Tool Class
 * All MCP tools should extend this class
 */
export class BaseTool {
  /**
   * @param {string} name - Tool name
   * @param {string} description - Tool description
   * @param {Object} schema - Zod validation schema for parameters
   */
  constructor(name, description, schema) {
    this.name = name;
    this.description = description;
    this.schema = schema;

    logger.debug(`Tool initialized: ${name}`);
  }

  /**
   * Execute the tool with full error handling and logging
   * This is the main entry point that MCP server will call
   *
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>} Tool response
   */
  async execute(params = {}) {
    const startTime = Date.now();

    logger.logRequest(this.name, params);

    try {
      // Validate parameters
      const validatedParams = this.validateParameters(params);

      // Execute the tool implementation
      const result = await this.run(validatedParams);

      // Format response
      const response = this.formatResponse(result);

      // Log success
      const duration = Date.now() - startTime;
      const responseSize = JSON.stringify(response).length;
      logger.logResponse(this.name, responseSize, duration);

      return response;
    } catch (error) {
      // Handle and format errors
      const duration = Date.now() - startTime;
      return this.handleError(error, params, duration);
    }
  }

  /**
   * Validate tool parameters against schema
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validated parameters
   * @throws {ValidationError}
   */
  validateParameters(params) {
    try {
      return validateParams(this.schema, params);
    } catch (error) {
      logger.warn(`Validation failed for ${this.name}`, {
        error: error.message,
        params,
      });
      throw new ValidationError(
        `Parameter validation failed: ${error.message}`,
        [error.message],
      );
    }
  }

  /**
   * Main tool implementation - must be overridden by subclasses
   * @param {Object} params - Validated parameters
   * @returns {Promise<Object>} Tool result
   */
  async run(params) {
    throw new Error(`Tool ${this.name} must implement run() method`);
  }

  /**
   * Format successful response
   * @param {Object} result - Tool execution result
   * @returns {Object} Formatted response
   */
  formatResponse(result) {
    return {
      success: true,
      data: result,
      metadata: {
        tool: this.name,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Handle errors and format error response
   * @param {Error} error - Error that occurred
   * @param {Object} params - Original parameters
   * @param {number} duration - Execution duration in ms
   * @returns {Object} Error response
   */
  handleError(error, params, duration) {
    // Log the error
    logger.logError(error, {
      tool: this.name,
      params,
      duration,
    });

    // Format error response based on error type
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: {
          type: 'ValidationError',
          message: error.message,
          details: error.details,
          code: error.errorCode,
        },
        metadata: {
          tool: this.name,
          timestamp: new Date().toISOString(),
        },
      };
    }

    if (error instanceof APIError) {
      return {
        success: false,
        error: {
          type: error.name,
          message: error.message,
          code: error.errorCode,
          statusCode: error.statusCode,
          details: error.details,
        },
        metadata: {
          tool: this.name,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Generic error
    return {
      success: false,
      error: {
        type: 'InternalError',
        message: error.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
      metadata: {
        tool: this.name,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get or compute cached value
   * Wrapper around cache.getOrSet with tool-specific key prefix
   *
   * @param {string} key - Cache key (will be prefixed with tool name)
   * @param {Function} computeFn - Async function to compute value if not cached
   * @param {number} ttl - Cache TTL in milliseconds (optional)
   * @returns {Promise<any>} Cached or computed value
   */
  async getCached(key, computeFn, ttl) {
    const cacheKey = `tool:${this.name}:${key}`;
    return cache.getOrSet(cacheKey, computeFn, ttl);
  }

  /**
   * Clear tool-specific cache entries
   * @param {string} key - Specific key to clear (optional)
   */
  clearCache(key = null) {
    if (key) {
      const cacheKey = `tool:${this.name}:${key}`;
      cache.delete(cacheKey);
      logger.debug(`Cleared cache for ${this.name}:${key}`);
    } else {
      // Clear all entries for this tool (not implemented in simple cache)
      logger.warn('Clear all cache entries not implemented for simple cache');
    }
  }

  /**
   * Get tool metadata for MCP server registration
   * @returns {Object} Tool metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      schema: this.schema,
    };
  }

  /**
   * Convert tool schema to MCP tool definition format
   * @returns {Object} MCP tool definition
   */
  toMCPToolDefinition() {
    // Convert Zod schema to JSON Schema (simplified)
    // In production, use zod-to-json-schema library
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.zodToJsonSchema(this.schema),
    };
  }

  /**
   * Convert Zod schema to JSON Schema (simplified version)
   * Note: For production use, install and use 'zod-to-json-schema' package
   * @param {Object} zodSchema - Zod schema
   * @returns {Object} JSON Schema
   */
  zodToJsonSchema(zodSchema) {
    // This is a simplified placeholder
    // In production, use the 'zod-to-json-schema' library
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }

  /**
   * Validate required dependencies (API clients, config, etc.)
   * Override in subclasses to check specific dependencies
   * @throws {Error} If dependencies are not available
   */
  async validateDependencies() {
    // Base implementation does nothing
    // Subclasses can override to check their specific requirements
  }

  /**
   * Lifecycle hook: called before tool execution
   * Override in subclasses for custom pre-execution logic
   * @param {Object} params - Validated parameters
   */
  async beforeExecute(params) {
    // Hook for subclasses
  }

  /**
   * Lifecycle hook: called after successful execution
   * Override in subclasses for custom post-execution logic
   * @param {Object} result - Execution result
   * @param {Object} params - Original parameters
   */
  async afterExecute(result, params) {
    // Hook for subclasses
  }

  /**
   * Create success response with data sources attribution
   * @param {Object} data - Response data
   * @param {Array} dataSources - Array of data source objects
   * @returns {Object} Response with data sources
   */
  createSuccessResponse(data, dataSources = []) {
    return {
      ...data,
      data_sources: dataSources.length > 0 ? dataSources : this.getDefaultDataSources(),
      query_timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get default data sources for this tool
   * Override in subclasses to provide specific data sources
   * @returns {Array} Data sources
   */
  getDefaultDataSources() {
    return [
      {
        name: 'NIFC Active Fire Mapping',
        type: 'wildfire',
        url: 'https://data-nifc.opendata.arcgis.com/',
        description: 'National Interagency Fire Center ArcGIS Services',
      },
    ];
  }

  /**
   * Helper: Extract error message from various error types
   * @param {Error} error - Error object
   * @returns {string} Error message
   */
  extractErrorMessage(error) {
    if (error instanceof APIError) {
      return error.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unknown error occurred';
  }

  /**
   * Helper: Check if error is user-facing (vs internal)
   * @param {Error} error - Error object
   * @returns {boolean} True if error should be shown to user
   */
  isUserFacingError(error) {
    return (
      error instanceof ValidationError ||
      error instanceof APIError
    );
  }
}

export default BaseTool;
