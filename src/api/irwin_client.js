/**
 * IRWIN API Client
 * Integrated Reporting of Wildland-Fire Information system
 * Provides enrichment data for fire incidents
 * Base URL: https://irwin.doi.gov
 */

import axios from 'axios';
import config from '../utils/config.js';
import cache from '../utils/cache.js';
import logger from '../utils/logger.js';
import {
  fromHttpError,
  isRetryableError,
  getRetryDelay,
  NotFoundError,
  ParseError,
} from './errors.js';

/**
 * IRWIN API Endpoints
 */
const ENDPOINTS = {
  // Base API path
  API_BASE: '/api/v1',
  // Incidents endpoint
  INCIDENTS: '/api/v1/incidents',
  // Resources endpoint
  RESOURCES: '/api/v1/resources',
};

/**
 * IRWIN API Client
 */
class IRWINClient {
  constructor() {
    this.baseURL = config.api.irwinApiUrl;
    this.timeout = config.timeouts.apiRequestTimeout;
    this.maxRetries = config.rateLimit.retryAttempts;
    this.retryDelay = config.rateLimit.retryDelayMs;

    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Rate limiting tracking
    this.requestsThisMinute = 0;
    this.lastRequestTime = 0;

    logger.debug('IRWIN Client initialized', {
      baseURL: this.baseURL,
      timeout: this.timeout,
    });
  }

  /**
   * Make request with retry logic and rate limiting
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Object>}
   */
  async request(endpoint, params = {}, retryCount = 0) {
    await this.checkRateLimit();

    const startTime = Date.now();

    logger.logAPICall('IRWIN', endpoint, 'GET');

    try {
      const response = await this.client.get(endpoint, { params });

      const duration = Date.now() - startTime;
      logger.logAPIResponse('IRWIN', response.status, duration);

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError = fromHttpError(error, `IRWIN ${endpoint}`);

      logger.logError(apiError, {
        endpoint,
        params,
        duration,
        retryCount,
      });

      // Retry logic
      if (retryCount < this.maxRetries && isRetryableError(apiError)) {
        const delay = getRetryDelay(apiError) || this.retryDelay * Math.pow(2, retryCount);
        logger.info(`Retrying IRWIN request after ${delay}ms`, {
          endpoint,
          retryCount: retryCount + 1,
          maxRetries: this.maxRetries,
        });

        await this.sleep(delay);
        return this.request(endpoint, params, retryCount + 1);
      }

      throw apiError;
    }
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    if (this.lastRequestTime < oneMinuteAgo) {
      this.requestsThisMinute = 0;
    }

    if (this.requestsThisMinute >= config.rateLimit.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.lastRequestTime);
      logger.warn(`IRWIN rate limit reached, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
      this.requestsThisMinute = 0;
    }

    this.requestsThisMinute++;
    this.lastRequestTime = now;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get detailed incident information from IRWIN
   * @param {string} incidentId - Incident identifier (IRWIN ID or incident name)
   * @returns {Promise<Object>} Incident details
   */
  async getIncidentDetails(incidentId) {
    const cacheKey = `irwin:incident:${incidentId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Try direct ID lookup first
      const endpoint = `${ENDPOINTS.INCIDENTS}/${incidentId}`;
      const data = await this.request(endpoint);

      if (!data || !data.incident) {
        throw new NotFoundError(
          `Incident not found in IRWIN: ${incidentId}`,
          'IRWIN Incident',
          incidentId,
        );
      }

      const incident = this.parseIncident(data.incident);

      // Cache for 10 minutes
      cache.set(cacheKey, incident, 10 * 60 * 1000);

      logger.info(`Retrieved IRWIN incident details for ${incidentId}`);

      return incident;
    } catch (error) {
      if (error instanceof NotFoundError) {
        // Try searching by name if direct lookup failed
        return this.searchIncidentByName(incidentId);
      }
      throw error;
    }
  }

  /**
   * Search for incident by name
   * @param {string} incidentName - Incident name
   * @returns {Promise<Object>} Incident details
   */
  async searchIncidentByName(incidentName) {
    const cacheKey = `irwin:search:${incidentName}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = {
      incidentName: incidentName,
      limit: 1,
    };

    const data = await this.request(ENDPOINTS.INCIDENTS, params);

    if (!data || !data.incidents || data.incidents.length === 0) {
      throw new NotFoundError(
        `Incident not found in IRWIN: ${incidentName}`,
        'IRWIN Incident',
        incidentName,
      );
    }

    const incident = this.parseIncident(data.incidents[0]);

    cache.set(cacheKey, incident, 10 * 60 * 1000);

    logger.info(`Found IRWIN incident by name: ${incidentName}`);

    return incident;
  }

  /**
   * Get incident resources
   * @param {string} incidentId - Incident identifier
   * @returns {Promise<Object>} Resource information
   */
  async getIncidentResources(incidentId) {
    const cacheKey = `irwin:resources:${incidentId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const endpoint = `${ENDPOINTS.INCIDENTS}/${incidentId}/resources`;
      const data = await this.request(endpoint);

      const resources = this.parseResources(data);

      // Cache for 15 minutes
      cache.set(cacheKey, resources, 15 * 60 * 1000);

      logger.info(`Retrieved IRWIN resources for ${incidentId}`);

      return resources;
    } catch (error) {
      // Resources might not be available for all incidents
      if (error instanceof NotFoundError) {
        logger.debug(`No resources found in IRWIN for ${incidentId}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Parse IRWIN incident to standardized format
   * @param {Object} incident - IRWIN incident data
   * @returns {Object} Parsed incident
   */
  parseIncident(incident) {
    return {
      // Identifiers
      irwin_id: incident.irwinID,
      incident_id: incident.incidentID || incident.irwinID,
      name: incident.incidentName,

      // Location
      location: {
        latitude: incident.pointOfOriginLatitude || incident.initialLatitude,
        longitude: incident.pointOfOriginLongitude || incident.initialLongitude,
        county: incident.poOCounty,
        state: incident.poOState,
        unit: incident.poOJurisdictionalUnit,
        legal_description: incident.legalDescription,
      },

      // Fire details
      size_acres: incident.calculatedAcres || incident.dailyAcres || 0,
      containment_percent: incident.percentContained || 0,

      // Dates
      discovery_date: incident.fireDiscoveryDateTime,
      last_update: incident.modifiedOnDateTime || incident.createdOnDateTime,
      expected_containment_date: incident.estimatedContainmentDate,

      // Classification
      status: this.mapIncidentStatus(incident.incidentStatusCategoryCode),
      cause: this.mapFireCause(incident.fireCauseGeneral),
      complexity_level: incident.incidentTypeKind,

      // Management
      incident_commander: incident.incidentCommanderName,
      management_organization: incident.incidentManagementOrganization,

      // Additional attributes
      fire_behavior: {
        fuel_model: incident.fuelModel,
        fire_behavior_general: incident.fireBehaviorGeneral,
        predominant_fuel_group: incident.predominantFuelGroup,
      },

      // Structures
      structures: {
        threatened: incident.structuresThreatened || 0,
        destroyed: incident.structuresDestroyed || 0,
        damaged: incident.structuresDamaged || 0,
      },

      // Raw data
      _raw: incident,
    };
  }

  /**
   * Parse IRWIN resources
   * @param {Object} data - IRWIN resources data
   * @returns {Object} Parsed resources
   */
  parseResources(data) {
    if (!data || !data.resources) {
      return {
        personnel: 0,
        engines: 0,
        helicopters: 0,
        crews: 0,
        bulldozers: 0,
        water_tenders: 0,
      };
    }

    const resources = data.resources;

    return {
      personnel: resources.totalPersonnel || 0,
      engines: resources.totalEngines || 0,
      helicopters: resources.totalHelicopters || 0,
      crews: resources.totalCrews || 0,
      bulldozers: resources.totalBulldozers || 0,
      water_tenders: resources.totalWaterTenders || 0,
      air_tankers: resources.totalAirTankers || 0,
      // Additional details
      overhead: resources.totalOverhead || 0,
      firefighters: resources.totalFirefighters || 0,
      last_updated: resources.resourcesUpdateDateTime,
    };
  }

  /**
   * Map IRWIN incident status codes
   * @param {string} statusCode - IRWIN status code
   * @returns {string} Standardized status
   */
  mapIncidentStatus(statusCode) {
    const statusMap = {
      'NEW': 'New',
      'ACTIVE': 'Active',
      'CONTAINED': 'Contained',
      'CONTROLLED': 'Controlled',
      'OUT': 'Out',
      'CANCELLED': 'Cancelled',
    };

    return statusMap[statusCode] || 'Unknown';
  }

  /**
   * Map IRWIN fire cause codes
   * @param {string} causeCode - IRWIN cause code
   * @returns {string} Standardized cause
   */
  mapFireCause(causeCode) {
    const causeMap = {
      'Human': 'Human',
      'Natural': 'Lightning',
      'Unknown': 'Unknown',
      'Under Investigation': 'Under Investigation',
    };

    return causeMap[causeCode] || causeCode || 'Unknown';
  }

  /**
   * Check if IRWIN integration is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return config.dataSources.enableIrwinData;
  }
}

// Create singleton instance
const irwinClient = new IRWINClient();

export default irwinClient;
export { IRWINClient };
