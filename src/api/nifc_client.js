/**
 * NIFC ArcGIS REST API Client
 * Primary data source for active wildfire incidents
 * Base URL: https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services
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
 * NIFC ArcGIS Service Endpoints
 */
const ENDPOINTS = {
  // Active fire perimeters (primary incident data)
  ACTIVE_PERIMETERS: 'WFIGS_Interagency_Perimeters_Current/FeatureServer/0',
  // Incident points (point locations)
  INCIDENT_POINTS: 'WFIGS_Incident_Locations_Current/FeatureServer/0',
  // Historical perimeters (year-to-date and archived)
  HISTORICAL_PERIMETERS: 'WFIGS_Interagency_Perimeters_YearToDate/FeatureServer/0',
  // Historic perimeters (multi-year archive)
  HISTORIC_PERIMETERS: 'Historic_Perimeters/FeatureServer/0',
};

/**
 * NIFC ArcGIS REST API Client
 */
class NIFCClient {
  constructor() {
    this.baseURL = config.api.nifcArcgisBaseUrl;
    this.timeout = config.timeouts.apiRequestTimeout;
    this.maxRetries = config.rateLimit.retryAttempts;
    this.retryDelay = config.rateLimit.retryDelayMs;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Rate limiting tracking
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.requestsThisMinute = 0;

    logger.debug('NIFC Client initialized', {
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
    const url = `${endpoint}/query`;

    logger.logAPICall('NIFC', url, 'GET');

    try {
      // Default ArcGIS REST API parameters
      const defaultParams = {
        f: 'json', // Response format
        outFields: '*', // Return all fields
        returnGeometry: true,
        spatialRel: 'esriSpatialRelIntersects',
      };

      const response = await this.client.get(url, {
        params: {
          ...defaultParams,
          ...params,
        },
      });

      const duration = Date.now() - startTime;
      logger.logAPIResponse('NIFC', response.status, duration);

      // Validate ArcGIS response structure
      if (!response.data || response.data.error) {
        throw new ParseError(
          `Invalid ArcGIS response: ${response.data?.error?.message || 'Unknown error'}`,
          'ArcGIS',
          { responseData: response.data },
        );
      }

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError = fromHttpError(error, `NIFC ${endpoint}`);

      logger.logError(apiError, {
        endpoint,
        params,
        duration,
        retryCount,
      });

      // Retry logic
      if (retryCount < this.maxRetries && isRetryableError(apiError)) {
        const delay = getRetryDelay(apiError) || this.retryDelay * Math.pow(2, retryCount);
        logger.info(`Retrying NIFC request after ${delay}ms`, {
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
   * Ensures we don't exceed max requests per minute
   */
  async checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Reset counter if a minute has passed
    if (this.lastRequestTime < oneMinuteAgo) {
      this.requestsThisMinute = 0;
    }

    // Check if we've hit the limit
    if (this.requestsThisMinute >= config.rateLimit.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.lastRequestTime);
      logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
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
   * Get active fire incidents with optional filters
   * @param {Object} filters - Filter parameters
   * @param {string} filters.state - State code (e.g., "CA")
   * @param {number} filters.latitude - Latitude for proximity search
   * @param {number} filters.longitude - Longitude for proximity search
   * @param {number} filters.radiusMiles - Search radius in miles
   * @param {number} filters.minSizeAcres - Minimum fire size
   * @param {number} filters.limit - Maximum results
   * @returns {Promise<Array>} Array of fire incidents
   */
  async getActiveIncidents(filters = {}) {
    const cacheKey = `nifc:active:${JSON.stringify(filters)}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Build WHERE clause
    const whereClauses = [];

    // Filter by state
    if (filters.state) {
      whereClauses.push(`POOState = '${filters.state}'`);
    }

    // Filter by minimum size
    if (filters.minSizeAcres > 0) {
      whereClauses.push(`GISAcres >= ${filters.minSizeAcres}`);
    }

    // Active fires only (not contained/out)
    whereClauses.push("IncidentTypeCategory = 'WF'"); // Wildfire

    const whereClause = whereClauses.length > 0
      ? whereClauses.join(' AND ')
      : '1=1'; // Return all if no filters

    const params = {
      where: whereClause,
      outSR: 4326, // WGS84 coordinate system
      resultRecordCount: filters.limit || 100,
    };

    // Add spatial filter if coordinates provided
    if (filters.latitude && filters.longitude && filters.radiusMiles) {
      // Convert miles to meters (ArcGIS uses meters for distance)
      const radiusMeters = filters.radiusMiles * 1609.34;

      // Create point geometry
      const geometry = {
        x: filters.longitude,
        y: filters.latitude,
        spatialReference: { wkid: 4326 },
      };

      params.geometry = JSON.stringify(geometry);
      params.geometryType = 'esriGeometryPoint';
      params.distance = radiusMeters;
      params.units = 'esriSRUnit_Meter';
    }

    const response = await this.request(ENDPOINTS.ACTIVE_PERIMETERS, params);

    if (!response.features || !Array.isArray(response.features)) {
      throw new ParseError(
        'Invalid features array in ArcGIS response',
        'ArcGIS',
        { response },
      );
    }

    const incidents = response.features.map((feature) => this.parseIncident(feature));

    // Cache for 5 minutes (active data updates frequently)
    cache.set(cacheKey, incidents, 5 * 60 * 1000);

    logger.info(`Retrieved ${incidents.length} active incidents from NIFC`, {
      filters,
      cached: false,
    });

    return incidents;
  }

  /**
   * Get specific incident by ID
   * @param {string} incidentId - Incident identifier
   * @returns {Promise<Object>} Incident details
   */
  async getIncidentById(incidentId) {
    const cacheKey = `nifc:incident:${incidentId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = {
      where: `IncidentID = '${incidentId}' OR IncidentName = '${incidentId}'`,
      outSR: 4326,
      resultRecordCount: 1,
    };

    const response = await this.request(ENDPOINTS.ACTIVE_PERIMETERS, params);

    if (!response.features || response.features.length === 0) {
      // Try incident points if not found in perimeters
      const pointResponse = await this.request(ENDPOINTS.INCIDENT_POINTS, params);

      if (!pointResponse.features || pointResponse.features.length === 0) {
        throw new NotFoundError(
          `Incident not found: ${incidentId}`,
          'Fire Incident',
          incidentId,
        );
      }

      const incident = this.parseIncident(pointResponse.features[0]);
      cache.set(cacheKey, incident, 5 * 60 * 1000);
      return incident;
    }

    const incident = this.parseIncident(response.features[0]);
    cache.set(cacheKey, incident, 5 * 60 * 1000);

    logger.info(`Retrieved incident ${incidentId} from NIFC`);

    return incident;
  }

  /**
   * Get fire perimeter GeoJSON for specific incident
   * @param {string} incidentId - Incident identifier
   * @returns {Promise<Object>} GeoJSON Feature
   */
  async getFirePerimeter(incidentId) {
    const cacheKey = `nifc:perimeter:${incidentId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const params = {
      where: `IncidentID = '${incidentId}' OR IncidentName = '${incidentId}'`,
      outSR: 4326,
      returnGeometry: true,
    };

    const response = await this.request(ENDPOINTS.ACTIVE_PERIMETERS, params);

    if (!response.features || response.features.length === 0) {
      throw new NotFoundError(
        `Fire perimeter not found for incident: ${incidentId}`,
        'Fire Perimeter',
        incidentId,
      );
    }

    const feature = response.features[0];
    const geojson = this.convertToGeoJSON(feature);

    // Cache for 30 minutes (perimeters update 2-3x daily)
    cache.set(cacheKey, geojson, 30 * 60 * 1000);

    logger.info(`Retrieved fire perimeter for ${incidentId}`);

    return geojson;
  }

  /**
   * Search for fires near a location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} radiusMiles - Search radius in miles
   * @returns {Promise<Array>} Array of nearby incidents
   */
  async searchNearLocation(latitude, longitude, radiusMiles) {
    return this.getActiveIncidents({
      latitude,
      longitude,
      radiusMiles,
    });
  }

  /**
   * Get historical fire incidents with optional filters
   * @param {Object} filters - Filter parameters
   * @param {string} filters.state - State code (e.g., "CA")
   * @param {string} filters.county - County name
   * @param {number} filters.year - Specific year
   * @param {number} filters.startYear - Start year for range
   * @param {number} filters.endYear - End year for range
   * @param {number} filters.minSizeAcres - Minimum fire size
   * @param {number} filters.limit - Maximum results
   * @returns {Promise<Array>} Array of historical fire incidents
   */
  async getHistoricalFires(filters = {}) {
    const cacheKey = `nifc:historical:${JSON.stringify(filters)}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Build WHERE clause
    const whereClauses = [];

    // Filter by state
    if (filters.state) {
      whereClauses.push(`POOState = '${filters.state}'`);
    }

    // Filter by county
    if (filters.county) {
      whereClauses.push(`POOCounty = '${filters.county}'`);
    }

    // Filter by year or year range
    if (filters.year) {
      // Specific year
      whereClauses.push(`FireDiscoveryDateTime >= timestamp '${filters.year}-01-01 00:00:00' AND FireDiscoveryDateTime < timestamp '${filters.year + 1}-01-01 00:00:00'`);
    } else if (filters.startYear || filters.endYear) {
      // Year range
      const startYear = filters.startYear || 2000;
      const endYear = filters.endYear || new Date().getFullYear();
      whereClauses.push(`FireDiscoveryDateTime >= timestamp '${startYear}-01-01 00:00:00' AND FireDiscoveryDateTime < timestamp '${endYear + 1}-01-01 00:00:00'`);
    }

    // Filter by minimum size
    if (filters.minSizeAcres > 0) {
      whereClauses.push(`GISAcres >= ${filters.minSizeAcres}`);
    }

    // Wildfire only
    whereClauses.push("IncidentTypeCategory = 'WF'");

    const whereClause = whereClauses.length > 0
      ? whereClauses.join(' AND ')
      : '1=1';

    const params = {
      where: whereClause,
      outSR: 4326, // WGS84 coordinate system
      resultRecordCount: filters.limit || 1000,
      orderByFields: 'GISAcres DESC', // Order by size, largest first
    };

    // Try historic perimeters endpoint first (multi-year data)
    let response;
    try {
      response = await this.request(ENDPOINTS.HISTORIC_PERIMETERS, params);
    } catch (error) {
      // Fall back to year-to-date endpoint if historic endpoint fails
      logger.debug('Historic perimeters endpoint unavailable, trying year-to-date', {
        error: error.message,
      });
      response = await this.request(ENDPOINTS.HISTORICAL_PERIMETERS, params);
    }

    if (!response.features || !Array.isArray(response.features)) {
      throw new ParseError(
        'Invalid features array in ArcGIS response',
        'ArcGIS',
        { response },
      );
    }

    const incidents = response.features.map((feature) => this.parseHistoricalIncident(feature));

    // Cache for 24 hours (historical data doesn't change often)
    cache.set(cacheKey, incidents, 24 * 60 * 60 * 1000);

    logger.info(`Retrieved ${incidents.length} historical incidents from NIFC`, {
      filters,
      cached: false,
    });

    return incidents;
  }

  /**
   * Parse ArcGIS feature to standardized incident object
   * @param {Object} feature - ArcGIS feature
   * @returns {Object} Parsed incident
   */
  parseIncident(feature) {
    const attrs = feature.attributes;
    const geom = feature.geometry;

    // Extract location from geometry
    const location = {
      latitude: null,
      longitude: null,
    };

    if (geom) {
      if (geom.x && geom.y) {
        // Point geometry
        location.longitude = geom.x;
        location.latitude = geom.y;
      } else if (geom.rings && geom.rings.length > 0) {
        // Polygon - calculate centroid (simplified - use first point)
        const firstRing = geom.rings[0];
        if (firstRing.length > 0) {
          location.longitude = firstRing[0][0];
          location.latitude = firstRing[0][1];
        }
      }
    }

    return {
      // Identifiers
      incident_id: attrs.IncidentID || attrs.IrwinID || attrs.UniqueFireIdentifier,
      name: attrs.IncidentName || attrs.FireName,

      // Location
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        county: attrs.POOCounty,
        state: attrs.POOState,
        unit: attrs.POOProtectingUnit || attrs.UnitID,
      },

      // Fire details
      size_acres: attrs.GISAcres || attrs.DailyAcres || attrs.CalculatedAcres || 0,
      containment_percent: attrs.PercentContained || 0,

      // Dates
      discovery_date: attrs.FireDiscoveryDateTime || attrs.DiscoveryAcres,
      last_update: attrs.CreateDate || attrs.DateCurrent,

      // Classification
      status: this.mapFireStatus(attrs.IncidentTypeCategory, attrs.PercentContained),
      cause: attrs.FireCause || 'Unknown',
      complexity_level: attrs.IncidentTypeKind || null,

      // Resources (if available)
      resources: {
        personnel: attrs.TotalPersonnel || null,
        engines: attrs.TotalEngines || null,
        helicopters: attrs.TotalHelicopters || null,
        air_tankers: null, // Not always available
      },

      // Additional info
      evacuations: attrs.EvacuationStatus === 'Yes' || false,
      structures_threatened: attrs.StructuresThreatened || null,
      structures_destroyed: attrs.StructuresDestroyed || null,

      // Raw attributes for debugging
      _raw: attrs,
    };
  }

  /**
   * Parse ArcGIS feature to standardized historical incident object
   * @param {Object} feature - ArcGIS feature
   * @returns {Object} Parsed historical incident
   */
  parseHistoricalIncident(feature) {
    const attrs = feature.attributes;
    const geom = feature.geometry;

    // Extract location from geometry
    const location = {
      latitude: null,
      longitude: null,
    };

    if (geom) {
      if (geom.x && geom.y) {
        // Point geometry
        location.longitude = geom.x;
        location.latitude = geom.y;
      } else if (geom.rings && geom.rings.length > 0) {
        // Polygon - calculate centroid (simplified - use first point)
        const firstRing = geom.rings[0];
        if (firstRing.length > 0) {
          location.longitude = firstRing[0][0];
          location.latitude = firstRing[0][1];
        }
      }
    }

    // Parse dates
    const discoveryDate = this.parseArcGISDate(attrs.FireDiscoveryDateTime);
    const containedDate = this.parseArcGISDate(attrs.ContainmentDateTime || attrs.ControlDateTime);

    // Extract year from discovery date
    const year = discoveryDate ? new Date(discoveryDate).getFullYear() : null;

    return {
      // Identifiers
      incident_id: attrs.IncidentID || attrs.IrwinID || attrs.UniqueFireIdentifier,
      name: attrs.IncidentName || attrs.FireName,

      // Temporal data
      year,
      start_date: discoveryDate,
      contained_date: containedDate,

      // Location
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        county: attrs.POOCounty,
        state: attrs.POOState,
        unit: attrs.POOProtectingUnit || attrs.UnitID,
      },

      // Fire details
      size_acres: attrs.GISAcres || attrs.DailyAcres || attrs.CalculatedAcres || attrs.FinalAcres || 0,

      // Classification
      cause: attrs.FireCause || 'Unknown',
      complexity_level: attrs.IncidentTypeKind || null,

      // Additional info
      structures_destroyed: attrs.StructuresDestroyed || null,
      structures_damaged: attrs.StructuresDamaged || null,

      // Raw attributes for debugging
      _raw: attrs,
    };
  }

  /**
   * Parse ArcGIS timestamp to ISO string
   * @param {number} timestamp - ArcGIS timestamp (milliseconds since epoch)
   * @returns {string|null} ISO date string or null
   */
  parseArcGISDate(timestamp) {
    if (!timestamp) return null;
    try {
      return new Date(timestamp).toISOString();
    } catch (error) {
      return null;
    }
  }

  /**
   * Map fire status from ArcGIS attributes
   * @param {string} incidentType - Incident type category
   * @param {number} containment - Containment percentage
   * @returns {string} Standardized status
   */
  mapFireStatus(incidentType, containment) {
    if (containment >= 100) {
      return 'Controlled';
    }
    if (containment >= 75) {
      return 'Contained';
    }
    if (containment >= 25) {
      return 'Active';
    }
    return 'Growing';
  }

  /**
   * Convert ArcGIS feature to GeoJSON
   * @param {Object} feature - ArcGIS feature
   * @returns {Object} GeoJSON Feature
   */
  convertToGeoJSON(feature) {
    const geom = feature.geometry;
    const attrs = feature.attributes;

    let geometry = null;

    if (geom) {
      if (geom.x && geom.y) {
        // Point
        geometry = {
          type: 'Point',
          coordinates: [geom.x, geom.y],
        };
      } else if (geom.rings) {
        // Polygon
        geometry = {
          type: 'Polygon',
          coordinates: geom.rings,
        };
      }
    }

    return {
      type: 'Feature',
      geometry,
      properties: {
        incident_id: attrs.IncidentID,
        name: attrs.IncidentName,
        size_acres: attrs.GISAcres,
        containment: attrs.PercentContained,
        perimeter_date: attrs.CreateDate,
        source: 'NIFC ArcGIS',
      },
    };
  }
}

// Create singleton instance
const nifcClient = new NIFCClient();

export default nifcClient;
export { NIFCClient };
