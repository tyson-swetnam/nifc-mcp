/**
 * InciWeb API Client
 * Provides public incident information and narrative updates
 * Base URL: https://inciweb.nwcg.gov
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
} from './errors.js';

/**
 * InciWeb endpoints and URL patterns
 */
const ENDPOINTS = {
  // Incident page URL pattern
  INCIDENT_PAGE: '/incident',
  // API endpoints (if available)
  API_BASE: '/api/v1',
};

/**
 * InciWeb Client
 * Note: InciWeb doesn't have a full public API, so this client
 * handles both API requests and basic HTML parsing when needed
 */
class InciWebClient {
  constructor() {
    this.baseURL = config.api.inciwebApiUrl;
    this.timeout = config.timeouts.apiRequestTimeout;
    this.maxRetries = config.rateLimit.retryAttempts;
    this.retryDelay = config.rateLimit.retryDelayMs;

    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'NIFC-MCP-Server/1.0',
        'Accept': 'text/html,application/json',
      },
    });

    // Rate limiting
    this.requestsThisMinute = 0;
    this.lastRequestTime = 0;

    logger.debug('InciWeb Client initialized', {
      baseURL: this.baseURL,
      timeout: this.timeout,
    });
  }

  /**
   * Make request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Object>}
   */
  async request(endpoint, params = {}, retryCount = 0) {
    await this.checkRateLimit();

    const startTime = Date.now();

    logger.logAPICall('InciWeb', endpoint, 'GET');

    try {
      const response = await this.client.get(endpoint, { params });

      const duration = Date.now() - startTime;
      logger.logAPIResponse('InciWeb', response.status, duration);

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError = fromHttpError(error, `InciWeb ${endpoint}`);

      logger.logError(apiError, {
        endpoint,
        params,
        duration,
        retryCount,
      });

      // Retry logic
      if (retryCount < this.maxRetries && isRetryableError(apiError)) {
        const delay = getRetryDelay(apiError) || this.retryDelay * Math.pow(2, retryCount);
        logger.info(`Retrying InciWeb request after ${delay}ms`, {
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
      logger.warn(`InciWeb rate limit reached, waiting ${waitTime}ms`);
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
   * Get incident narrative and updates from InciWeb
   * @param {string} incidentId - Incident identifier or InciWeb ID
   * @returns {Promise<Object>} Incident narrative information
   */
  async getIncidentNarrative(incidentId) {
    const cacheKey = `inciweb:narrative:${incidentId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // InciWeb uses numeric IDs in URLs (e.g., /incident/8765/)
      // Try to extract numeric ID if provided
      const numericId = this.extractNumericId(incidentId);

      if (numericId) {
        const narrative = await this.fetchIncidentPage(numericId);

        // Cache for 1 hour (narratives update 1-2x daily)
        cache.set(cacheKey, narrative, 60 * 60 * 1000);

        logger.info(`Retrieved InciWeb narrative for ${incidentId}`);

        return narrative;
      } else {
        // Try searching by incident name
        return await this.searchIncidentByName(incidentId);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        logger.debug(`Incident not found on InciWeb: ${incidentId}`);
        // Return null instead of throwing - not all fires have InciWeb pages
        return null;
      }
      throw error;
    }
  }

  /**
   * Get evacuation information for an incident
   * @param {string} incidentId - Incident identifier
   * @returns {Promise<Object>} Evacuation information
   */
  async getEvacuationInfo(incidentId) {
    const narrative = await this.getIncidentNarrative(incidentId);

    if (!narrative) {
      return null;
    }

    // Extract evacuation-specific information from narrative
    return {
      has_evacuations: narrative.evacuations?.active || false,
      evacuation_status: narrative.evacuations?.status || 'Unknown',
      evacuation_zones: narrative.evacuations?.zones || [],
      road_closures: narrative.closures || [],
      last_updated: narrative.last_updated,
    };
  }

  /**
   * Fetch and parse InciWeb incident page
   * @param {string} inciwebId - InciWeb numeric ID
   * @returns {Promise<Object>} Parsed incident data
   */
  async fetchIncidentPage(inciwebId) {
    const endpoint = `${ENDPOINTS.INCIDENT_PAGE}/${inciwebId}/`;

    try {
      const html = await this.request(endpoint);

      // Parse HTML content (basic extraction)
      const parsed = this.parseIncidentHTML(html, inciwebId);

      return parsed;
    } catch (error) {
      if (error.statusCode === 404) {
        throw new NotFoundError(
          `InciWeb page not found for ID: ${inciwebId}`,
          'InciWeb Incident',
          inciwebId,
        );
      }
      throw error;
    }
  }

  /**
   * Parse InciWeb HTML page (basic extraction)
   * Note: This is a simplified parser. In production, consider using cheerio or jsdom
   * @param {string} html - HTML content
   * @param {string} inciwebId - InciWeb ID
   * @returns {Object} Parsed data
   */
  parseIncidentHTML(html, inciwebId) {
    // Basic text extraction patterns (simplified)
    // In a real implementation, use a proper HTML parser like cheerio

    const data = {
      inciweb_id: inciwebId,
      url: `${this.baseURL}${ENDPOINTS.INCIDENT_PAGE}/${inciwebId}/`,
      summary: null,
      updates: [],
      evacuations: {
        active: false,
        status: 'Unknown',
        zones: [],
      },
      closures: [],
      contacts: [],
      last_updated: new Date().toISOString(),
    };

    try {
      // Extract summary (look for common patterns)
      // This is a placeholder - real implementation would use proper HTML parsing
      if (typeof html === 'string') {
        // Check for evacuation keywords
        if (html.toLowerCase().includes('evacuation')) {
          data.evacuations.active = true;
          data.evacuations.status = 'Active evacuations reported';
        }

        // Check for closure keywords
        if (html.toLowerCase().includes('road closure') || html.toLowerCase().includes('area closure')) {
          data.closures.push('Road and area closures in effect');
        }

        // Extract any visible text as summary (simplified)
        // Remove HTML tags for basic summary
        const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (textContent.length > 0) {
          // Take first 500 characters as summary
          data.summary = textContent.substring(0, 500);
        }
      }
    } catch (error) {
      logger.warn('Error parsing InciWeb HTML', {
        inciwebId,
        error: error.message,
      });
    }

    return data;
  }

  /**
   * Search for incident by name (placeholder)
   * @param {string} incidentName - Incident name
   * @returns {Promise<Object>} Incident narrative
   */
  async searchIncidentByName(incidentName) {
    // InciWeb doesn't have a public search API
    // This is a placeholder that returns null
    logger.debug(`InciWeb search by name not implemented: ${incidentName}`);
    return null;
  }

  /**
   * Extract numeric ID from various incident ID formats
   * @param {string} incidentId - Incident identifier
   * @returns {string|null} Numeric ID or null
   */
  extractNumericId(incidentId) {
    // If already numeric, return as-is
    if (/^\d+$/.test(incidentId)) {
      return incidentId;
    }

    // Try to extract from URL patterns
    const urlMatch = incidentId.match(/\/incident\/(\d+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Try to extract trailing numbers from incident IDs
    const numMatch = incidentId.match(/(\d+)$/);
    if (numMatch) {
      return numMatch[1];
    }

    return null;
  }

  /**
   * Build InciWeb URL for an incident
   * @param {string} inciwebId - InciWeb numeric ID
   * @returns {string} Full URL
   */
  buildIncidentURL(inciwebId) {
    return `${this.baseURL}${ENDPOINTS.INCIDENT_PAGE}/${inciwebId}/`;
  }

  /**
   * Check if InciWeb integration is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return config.dataSources.enableInciwebIntegration;
  }

  /**
   * Get incident information with graceful fallback
   * Returns null if incident not found instead of throwing
   * @param {string} incidentId - Incident identifier
   * @returns {Promise<Object|null>} Incident data or null
   */
  async getIncidentSafe(incidentId) {
    try {
      return await this.getIncidentNarrative(incidentId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        logger.debug(`InciWeb incident not found (graceful): ${incidentId}`);
        return null;
      }
      // Re-throw other errors
      throw error;
    }
  }
}

// Create singleton instance
const inciwebClient = new InciWebClient();

export default inciwebClient;
export { InciWebClient };
