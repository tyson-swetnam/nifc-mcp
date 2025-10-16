/**
 * Tool stub implementations
 * These are placeholder implementations that will be replaced with full tool classes
 */

import logger from '../utils/logger.js';
import nifcClient from '../api/nifc_client.js';
import irwinClient from '../api/irwin_client.js';
import inciwebClient from '../api/inciweb_client.js';
import { calculateDistance, calculateBearing } from '../utils/geospatial.js';

/**
 * Create tool stub implementations
 * @returns {Array} Array of tool objects
 */
export function createToolStubs() {
  return [
    {
      name: 'get_active_fires',
      description: 'Get currently active wildfire incidents with optional filtering by state, location, or size',
      inputSchema: {
        state: {
          type: 'string',
          description: 'Two-letter state code (e.g., CA, CO)',
        },
        latitude: {
          type: 'number',
          description: 'Latitude for proximity search (-90 to 90)',
        },
        longitude: {
          type: 'number',
          description: 'Longitude for proximity search (-180 to 180)',
        },
        radius_miles: {
          type: 'number',
          description: 'Search radius in miles (default: 50)',
        },
        min_size_acres: {
          type: 'number',
          description: 'Minimum fire size in acres',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)',
        },
      },
      required: [],
      async execute(params) {
        logger.info('Executing get_active_fires', { params });

        try {
          // Get active incidents from NIFC
          const incidents = await nifcClient.getActiveIncidents({
            state: params.state,
            latitude: params.latitude,
            longitude: params.longitude,
            radiusMiles: params.radius_miles || 50,
            minSizeAcres: params.min_size_acres || 0,
            limit: params.limit || 50,
          });

          // Calculate distances if location provided
          if (params.latitude && params.longitude) {
            for (const incident of incidents) {
              if (incident.location.latitude && incident.location.longitude) {
                incident.distance_miles = calculateDistance(
                  params.latitude,
                  params.longitude,
                  incident.location.latitude,
                  incident.location.longitude,
                );
                incident.bearing = calculateBearing(
                  params.latitude,
                  params.longitude,
                  incident.location.latitude,
                  incident.location.longitude,
                );
              }
            }

            // Sort by distance
            incidents.sort((a, b) => (a.distance_miles || Infinity) - (b.distance_miles || Infinity));
          }

          return {
            success: true,
            fires: incidents,
            total_fires: incidents.length,
            query_timestamp: new Date().toISOString(),
            data_sources: [
              {
                name: 'NIFC Active Fire Mapping',
                type: 'wildfire',
                url: 'https://data-nifc.opendata.arcgis.com/',
              },
            ],
          };
        } catch (error) {
          logger.error('Error in get_active_fires', { error: error.message });
          throw error;
        }
      },
    },

    {
      name: 'get_fire_by_id',
      description: 'Get detailed information about a specific fire incident by ID',
      inputSchema: {
        incident_id: {
          type: 'string',
          description: 'NIFC incident identifier',
        },
        include_perimeter: {
          type: 'boolean',
          description: 'Include GeoJSON perimeter data (default: false)',
        },
        include_inciweb: {
          type: 'boolean',
          description: 'Include InciWeb narrative information (default: false)',
        },
      },
      required: ['incident_id'],
      async execute(params) {
        logger.info('Executing get_fire_by_id', { params });

        try {
          // Get incident from NIFC
          const incident = await nifcClient.getIncidentById(params.incident_id);

          // Enrich with IRWIN data if available
          if (irwinClient.isEnabled()) {
            try {
              const irwinData = await irwinClient.getIncidentDetails(params.incident_id);
              if (irwinData) {
                // Merge IRWIN data
                incident.irwin_data = irwinData;
                incident.resources = irwinData.resources || incident.resources;
              }
            } catch (error) {
              logger.debug('IRWIN data not available', { incidentId: params.incident_id });
            }
          }

          // Get perimeter if requested
          if (params.include_perimeter) {
            try {
              incident.perimeter = await nifcClient.getFirePerimeter(params.incident_id);
            } catch (error) {
              logger.debug('Perimeter data not available', { incidentId: params.incident_id });
              incident.perimeter = null;
            }
          }

          // Get InciWeb data if requested
          if (params.include_inciweb && inciwebClient.isEnabled()) {
            try {
              incident.inciweb = await inciwebClient.getIncidentSafe(params.incident_id);
            } catch (error) {
              logger.debug('InciWeb data not available', { incidentId: params.incident_id });
              incident.inciweb = null;
            }
          }

          return {
            success: true,
            ...incident,
            data_sources: [
              {
                name: 'NIFC Active Fire Mapping',
                type: 'wildfire',
                url: 'https://data-nifc.opendata.arcgis.com/',
              },
            ],
          };
        } catch (error) {
          logger.error('Error in get_fire_by_id', { error: error.message });
          throw error;
        }
      },
    },

    {
      name: 'search_fires_by_location',
      description: 'Find fires near a specific location within a given radius',
      inputSchema: {
        latitude: {
          type: 'number',
          description: 'Latitude (-90 to 90)',
        },
        longitude: {
          type: 'number',
          description: 'Longitude (-180 to 180)',
        },
        radius_miles: {
          type: 'number',
          description: 'Search radius in miles',
        },
        include_contained: {
          type: 'boolean',
          description: 'Include contained fires (default: false)',
        },
      },
      required: ['latitude', 'longitude', 'radius_miles'],
      async execute(params) {
        logger.info('Executing search_fires_by_location', { params });

        try {
          // Search for nearby fires
          const incidents = await nifcClient.searchNearLocation(
            params.latitude,
            params.longitude,
            params.radius_miles,
          );

          // Calculate distances and bearings
          for (const incident of incidents) {
            if (incident.location.latitude && incident.location.longitude) {
              incident.distance_miles = calculateDistance(
                params.latitude,
                params.longitude,
                incident.location.latitude,
                incident.location.longitude,
              );
              incident.bearing = calculateBearing(
                params.latitude,
                params.longitude,
                incident.location.latitude,
                incident.location.longitude,
              );
            }
          }

          // Filter contained fires if not requested
          let filteredIncidents = incidents;
          if (!params.include_contained) {
            filteredIncidents = incidents.filter(
              (incident) => incident.containment_percent < 100,
            );
          }

          // Sort by distance
          filteredIncidents.sort((a, b) => (a.distance_miles || Infinity) - (b.distance_miles || Infinity));

          // Generate warning if fires are very close
          let warning = null;
          const closestFire = filteredIncidents[0];
          if (closestFire && closestFire.distance_miles < 25) {
            warning = `Active fire within ${Math.round(closestFire.distance_miles)} miles of your location`;
          }

          return {
            success: true,
            location: {
              latitude: params.latitude,
              longitude: params.longitude,
              search_radius_miles: params.radius_miles,
            },
            fires_found: filteredIncidents.length,
            fires: filteredIncidents,
            warning,
            data_sources: [
              {
                name: 'NIFC Active Fire Mapping',
                type: 'wildfire',
                url: 'https://data-nifc.opendata.arcgis.com/',
              },
            ],
          };
        } catch (error) {
          logger.error('Error in search_fires_by_location', { error: error.message });
          throw error;
        }
      },
    },

    {
      name: 'get_fire_history',
      description: 'Retrieve historical fire data for an area or time period',
      inputSchema: {
        state: {
          type: 'string',
          description: 'Two-letter state code',
        },
        county: {
          type: 'string',
          description: 'County name',
        },
        year: {
          type: 'number',
          description: 'Specific year',
        },
        start_year: {
          type: 'number',
          description: 'Start year for range',
        },
        end_year: {
          type: 'number',
          description: 'End year for range',
        },
        min_size_acres: {
          type: 'number',
          description: 'Minimum fire size in acres',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 100)',
        },
      },
      required: [],
      async execute(params) {
        logger.info('Executing get_fire_history', { params });

        try {
          // Get historical fire data from NIFC
          const fires = await nifcClient.getHistoricalFires({
            state: params.state,
            county: params.county,
            year: params.year,
            startYear: params.start_year,
            endYear: params.end_year,
            minSizeAcres: params.min_size_acres || 0,
            limit: params.limit || 100,
          });

          // Calculate statistics
          const statistics = this.calculateHistoricalStatistics(fires);

          // Determine time period for response
          const timePeriod = {};
          if (params.year) {
            timePeriod.year = params.year;
          } else {
            timePeriod.start_year = params.start_year || fires.reduce((min, f) =>
              f.year && f.year < min ? f.year : min, Infinity);
            timePeriod.end_year = params.end_year || fires.reduce((max, f) =>
              f.year && f.year > max ? f.year : max, -Infinity);
          }

          // Build location description
          let locationDescription = 'all areas';
          if (params.state && params.county) {
            locationDescription = `${params.county} County, ${params.state}`;
          } else if (params.state) {
            locationDescription = params.state;
          } else if (params.county) {
            locationDescription = params.county;
          }

          return {
            success: true,
            location: locationDescription,
            time_period: timePeriod,
            total_fires: fires.length,
            total_acres_burned: statistics.totalAcres,
            fires: fires.map((fire) => ({
              incident_id: fire.incident_id,
              name: fire.name,
              year: fire.year,
              size_acres: fire.size_acres,
              cause: fire.cause,
              start_date: fire.start_date,
              contained_date: fire.contained_date,
              location: {
                county: fire.location.county,
                state: fire.location.state,
              },
            })),
            statistics: {
              largest_fire: statistics.largestFire,
              average_size: statistics.averageSize,
              fires_by_cause: statistics.firesByCause,
              fires_by_year: statistics.firesByYear,
            },
            query_timestamp: new Date().toISOString(),
            data_sources: [
              {
                name: 'NIFC Historical Fire Data',
                type: 'wildfire',
                url: 'https://data-nifc.opendata.arcgis.com/',
              },
              {
                name: 'WFIGS Historic Perimeters',
                type: 'wildfire',
                url: 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Historic_Perimeters/FeatureServer',
              },
            ],
          };
        } catch (error) {
          logger.error('Error in get_fire_history', { error: error.message });
          throw error;
        }
      },

      /**
       * Calculate statistics for historical fire data
       * @param {Array} fires - Array of fire incidents
       * @returns {Object} Statistics object
       */
      calculateHistoricalStatistics(fires) {
        if (!fires || fires.length === 0) {
          return {
            totalAcres: 0,
            averageSize: 0,
            largestFire: null,
            firesByCause: {},
            firesByYear: {},
          };
        }

        // Calculate totals
        const totalAcres = fires.reduce((sum, fire) => sum + (fire.size_acres || 0), 0);
        const averageSize = Math.round(totalAcres / fires.length);

        // Find largest fire
        const largestFire = fires.reduce((largest, fire) => {
          if (!largest || fire.size_acres > largest.size_acres) {
            return {
              name: fire.name,
              acres: fire.size_acres,
              year: fire.year,
            };
          }
          return largest;
        }, null);

        // Group by cause
        const firesByCause = {};
        fires.forEach((fire) => {
          const cause = fire.cause || 'Unknown';
          firesByCause[cause] = (firesByCause[cause] || 0) + 1;
        });

        // Group by year
        const firesByYear = {};
        fires.forEach((fire) => {
          if (fire.year) {
            firesByYear[fire.year] = (firesByYear[fire.year] || 0) + 1;
          }
        });

        return {
          totalAcres,
          averageSize,
          largestFire,
          firesByCause,
          firesByYear,
        };
      },
    },
  ];
}

export default createToolStubs;
