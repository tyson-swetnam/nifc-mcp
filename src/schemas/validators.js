/**
 * Zod schema validators for MCP tool inputs
 * Provides validation for all tool parameters
 */

import { z } from 'zod';
import { US_STATES } from '../utils/geography.js';

// Common validators

/**
 * State code validator (two-letter US state abbreviation)
 */
export const stateCodeSchema = z
  .string()
  .length(2)
  .transform((val) => val.toUpperCase())
  .refine(
    (val) => val in US_STATES,
    (val) => ({ message: `Invalid state code: ${val}` }),
  );

/**
 * Latitude validator (-90 to 90)
 */
export const latitudeSchema = z
  .number()
  .min(-90, 'Latitude must be >= -90')
  .max(90, 'Latitude must be <= 90');

/**
 * Longitude validator (-180 to 180)
 */
export const longitudeSchema = z
  .number()
  .min(-180, 'Longitude must be >= -180')
  .max(180, 'Longitude must be <= 180');

/**
 * Positive number validator
 */
export const positiveNumberSchema = z
  .number()
  .positive('Must be a positive number');

/**
 * Non-negative number validator
 */
export const nonNegativeNumberSchema = z
  .number()
  .nonnegative('Must be a non-negative number');

/**
 * Year validator (1900-2100)
 */
export const yearSchema = z
  .number()
  .int('Year must be an integer')
  .min(1900, 'Year must be >= 1900')
  .max(2100, 'Year must be <= 2100');

/**
 * Incident ID validator
 * Format: YYYY-XXYYY-NNNNNN (e.g., 2025-CASNF-001234)
 */
export const incidentIdSchema = z
  .string()
  .regex(
    /^\d{4}-[A-Z]{2,5}-\d{6}$/,
    'Incident ID must match format: YYYY-XXYYY-NNNNNN',
  );

// Tool-specific validators

/**
 * get_active_fires parameters
 */
export const getActiveFiresSchema = z.object({
  state: stateCodeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  radius_miles: positiveNumberSchema.optional().default(50),
  min_size_acres: nonNegativeNumberSchema.optional().default(0),
  limit: z.number().int().min(1).max(1000).optional().default(50),
}).refine(
  (data) => {
    // If latitude is provided, longitude must be too (and vice versa)
    if (data.latitude !== undefined && data.longitude === undefined) {
      return false;
    }
    if (data.longitude !== undefined && data.latitude === undefined) {
      return false;
    }
    return true;
  },
  {
    message: 'Latitude and longitude must both be provided if using location-based filtering',
    path: ['latitude', 'longitude'],
  },
);

/**
 * get_fire_by_id parameters
 */
export const getFireByIdSchema = z.object({
  incident_id: incidentIdSchema,
  include_perimeter: z.boolean().optional().default(false),
  include_inciweb: z.boolean().optional().default(false),
});

/**
 * search_fires_by_location parameters
 */
export const searchFiresByLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  radius_miles: positiveNumberSchema,
  include_contained: z.boolean().optional().default(false),
});

/**
 * get_fire_history parameters
 */
export const getFireHistorySchema = z.object({
  state: stateCodeSchema.optional(),
  county: z.string().optional(),
  year: yearSchema.optional(),
  start_year: yearSchema.optional(),
  end_year: yearSchema.optional(),
  min_size_acres: nonNegativeNumberSchema.optional().default(0),
}).refine(
  (data) => {
    // Cannot specify both year and start_year/end_year
    if (data.year !== undefined && (data.start_year !== undefined || data.end_year !== undefined)) {
      return false;
    }
    return true;
  },
  {
    message: 'Cannot specify both year and start_year/end_year',
    path: ['year'],
  },
).refine(
  (data) => {
    // If start_year and end_year are both provided, start_year must be <= end_year
    if (data.start_year !== undefined && data.end_year !== undefined) {
      return data.start_year <= data.end_year;
    }
    return true;
  },
  {
    message: 'start_year must be <= end_year',
    path: ['start_year', 'end_year'],
  },
);

/**
 * Validate tool parameters
 * @param {Object} schema - Zod schema
 * @param {Object} params - Parameters to validate
 * @returns {Object} Validated and transformed parameters
 * @throws {Error} If validation fails
 */
export function validateParams(schema, params) {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      throw new Error(`Validation failed: ${messages.join(', ')}`);
    }
    throw error;
  }
}

/**
 * Safely validate parameters without throwing
 * @param {Object} schema - Zod schema
 * @param {Object} params - Parameters to validate
 * @returns {Object} { success: boolean, data?: Object, error?: Error }
 */
export function safeValidateParams(schema, params) {
  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      return {
        success: false,
        error: new Error(`Validation failed: ${messages.join(', ')}`),
      };
    }
    return { success: false, error };
  }
}

// Export all schemas
export default {
  getActiveFiresSchema,
  getFireByIdSchema,
  searchFiresByLocationSchema,
  getFireHistorySchema,
  stateCodeSchema,
  latitudeSchema,
  longitudeSchema,
  yearSchema,
  incidentIdSchema,
  validateParams,
  safeValidateParams,
};
