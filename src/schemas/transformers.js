/**
 * Schema transformation utilities
 * Transforms NIFC API responses to fire-behavior wildfire_prompt_template.json schema
 */

import { formatDate, formatContainment, formatFireStatus, formatCause } from '../utils/formatters.js';

/**
 * Calculate risk level based on fire proximity and status
 * @param {number} distanceMiles - Distance to fire in miles
 * @param {string} status - Fire status
 * @param {number} containment - Containment percentage
 * @returns {string} Risk level: Low, Moderate, High, Extreme
 */
export function calculateRiskLevel(distanceMiles, status, containment) {
  // If fire is out or fully contained, risk is low
  if (status === 'Out' || containment >= 100) {
    return 'Low';
  }

  // Distance-based risk
  if (distanceMiles < 10) {
    return 'Extreme';
  } else if (distanceMiles < 25) {
    return 'High';
  } else if (distanceMiles < 50) {
    return 'Moderate';
  }

  return 'Low';
}

/**
 * Calculate risk points based on proximity
 * @param {number} distanceMiles - Distance to fire in miles
 * @returns {number} Risk points
 */
export function calculateRiskPoints(distanceMiles) {
  if (distanceMiles < 10) return 50;
  if (distanceMiles < 25) return 30;
  if (distanceMiles < 50) return 20;
  if (distanceMiles < 100) return 10;
  return 0;
}

/**
 * Generate risk assessment notes
 * @param {Array} fires - Array of nearby fires
 * @param {number} searchRadius - Search radius in miles
 * @returns {string} Risk notes
 */
export function generateRiskNotes(fires, searchRadius = null) {
  if (!fires || fires.length === 0) {
    return 'No active wildfires detected in the area.';
  }

  const notes = [];

  // Count active fires
  const activeFires = fires.filter(f => f.status === 'Active' || f.status === 'Growing');
  if (activeFires.length > 0) {
    notes.push(`${activeFires.length} active wildfire${activeFires.length > 1 ? 's' : ''} detected`);
  }

  // Closest fire
  if (fires[0] && fires[0].distance_miles !== undefined) {
    const closest = fires[0];
    notes.push(`Closest fire: ${closest.name} (${closest.distance_miles.toFixed(1)} miles ${closest.bearing || ''})`);
  }

  // Large fires
  const largeFires = fires.filter(f => f.size_acres > 10000);
  if (largeFires.length > 0) {
    notes.push(`${largeFires.length} large fire${largeFires.length > 1 ? 's' : ''} (>10,000 acres)`);
  }

  // Evacuations
  const evacuationFires = fires.filter(f => f.evacuations);
  if (evacuationFires.length > 0) {
    notes.push(`Evacuations ordered for ${evacuationFires.length} fire${evacuationFires.length > 1 ? 's' : ''}`);
  }

  // Proximity warning
  const nearbyFires = fires.filter(f => f.distance_miles !== undefined && f.distance_miles < 50);
  if (nearbyFires.length > 0) {
    notes.push('Monitor conditions and be prepared for potential evacuations');
  }

  return notes.join('. ') + '.';
}

/**
 * Transform NIFC fire incident to wildfire_status schema
 * @param {Object} nifcIncident - NIFC incident data
 * @returns {Object} Wildfire status object
 */
export function transformToWildfireStatus(nifcIncident) {
  return {
    incident_id: nifcIncident.incident_id || nifcIncident.IncidentID || null,
    name: nifcIncident.name || nifcIncident.IncidentName || 'Unknown',
    status: formatFireStatus(nifcIncident.status || nifcIncident.IncidentStatus || 'Unknown'),
    acres: nifcIncident.size_acres || nifcIncident.DailyAcres || nifcIncident.CalculatedAcres || 0,
    containment: formatContainment(nifcIncident.containment_percent || nifcIncident.PercentContained || 0),
    start_time: formatDate(nifcIncident.discovery_date || nifcIncident.FireDiscoveryDateTime || nifcIncident.CreateDate),
    expected_end: formatDate(nifcIncident.expected_containment_date || nifcIncident.EstimatedContainmentDate),
  };
}

/**
 * Transform NIFC incident to full fire-behavior schema
 * @param {Object} nifcIncident - NIFC incident data
 * @param {number} distanceMiles - Distance to fire (optional)
 * @param {Array} dataSources - Data sources array
 * @returns {Object} Complete fire-behavior schema object
 */
export function transformToFireBehaviorSchema(nifcIncident, distanceMiles = null, dataSources = []) {
  const wildfireStatus = transformToWildfireStatus(nifcIncident);

  // Calculate risk assessment
  const riskLevel = distanceMiles !== null
    ? calculateRiskLevel(distanceMiles, wildfireStatus.status, nifcIncident.containment_percent || 0)
    : 'Moderate';

  const riskNotes = distanceMiles !== null
    ? generateRiskNotes([{ ...nifcIncident, distance_miles: distanceMiles }])
    : 'Active wildfire incident';

  return {
    wildfire_status: wildfireStatus,
    risk_assessment: {
      overall_risk: riskLevel,
      notes: riskNotes,
    },
    data_sources: dataSources.length > 0 ? dataSources : [
      {
        name: 'NIFC Active Fire Mapping',
        type: 'wildfire',
        url: 'https://data-nifc.opendata.arcgis.com/',
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Transform array of fires to fire-behavior schema
 * @param {Array} fires - Array of NIFC incidents
 * @param {Object} searchLocation - { latitude, longitude } for proximity calc
 * @returns {Object} Fire-behavior response with multiple fires
 */
export function transformFireArray(fires, searchLocation = null) {
  if (!fires || fires.length === 0) {
    return {
      fires: [],
      total_fires: 0,
      wildfire_status: null,
      risk_assessment: {
        overall_risk: 'Low',
        notes: 'No active wildfires detected in the area.',
      },
      data_sources: [
        {
          name: 'NIFC Active Fire Mapping',
          type: 'wildfire',
          url: 'https://data-nifc.opendata.arcgis.com/',
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // Transform each fire
  const transformedFires = fires.map(fire => ({
    ...transformToWildfireStatus(fire),
    distance_miles: fire.distance_miles,
    bearing: fire.bearing,
    location: fire.location,
  }));

  // Calculate overall risk
  const maxRisk = fires.reduce((max, fire) => {
    if (!fire.distance_miles) return max;
    const points = calculateRiskPoints(fire.distance_miles);
    return Math.max(max, points);
  }, 0);

  let overallRisk = 'Low';
  if (maxRisk >= 50) overallRisk = 'Extreme';
  else if (maxRisk >= 30) overallRisk = 'High';
  else if (maxRisk >= 20) overallRisk = 'Moderate';

  return {
    fires: transformedFires,
    total_fires: fires.length,
    wildfire_status: transformedFires[0] || null, // Primary/closest fire
    risk_assessment: {
      overall_risk: overallRisk,
      notes: generateRiskNotes(fires),
    },
    query_timestamp: new Date().toISOString(),
    data_sources: [
      {
        name: 'NIFC Active Fire Mapping',
        type: 'wildfire',
        url: 'https://data-nifc.opendata.arcgis.com/',
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Transform NIFC location data to standard format
 * @param {Object} nifcLocation - NIFC location object
 * @returns {Object} Standardized location
 */
export function transformLocation(nifcLocation) {
  return {
    latitude: nifcLocation.POOLatitude || nifcLocation.InitialLatitude || nifcLocation.latitude,
    longitude: nifcLocation.POOLongitude || nifcLocation.InitialLongitude || nifcLocation.longitude,
    county: nifcLocation.POOCounty || nifcLocation.County || null,
    state: nifcLocation.POOState || nifcLocation.State || null,
    unit: nifcLocation.IncidentManagementOrganization || nifcLocation.Unit || null,
  };
}

/**
 * Transform resource data
 * @param {Object} nifcResources - NIFC resource data
 * @returns {Object} Standardized resources
 */
export function transformResources(nifcResources) {
  if (!nifcResources) {
    return {
      personnel: 0,
      engines: 0,
      helicopters: 0,
      air_tankers: 0,
    };
  }

  return {
    personnel: nifcResources.TotalPersonnel || nifcResources.personnel || 0,
    engines: nifcResources.Engines || nifcResources.engines || 0,
    helicopters: nifcResources.Helicopters || nifcResources.helicopters || 0,
    air_tankers: nifcResources.Airtankers || nifcResources.air_tankers || 0,
    crews: nifcResources.Crews || nifcResources.crews || 0,
  };
}

/**
 * Create data sources array
 * @param {Array} sources - Array of source identifiers
 * @returns {Array} Data sources array
 */
export function createDataSources(sources = ['nifc']) {
  const sourceMap = {
    nifc: {
      name: 'NIFC Active Fire Mapping',
      type: 'wildfire',
      url: 'https://data-nifc.opendata.arcgis.com/',
    },
    irwin: {
      name: 'IRWIN',
      type: 'wildfire',
      url: 'https://irwin.doi.gov/',
    },
    inciweb: {
      name: 'InciWeb',
      type: 'wildfire',
      url: 'https://inciweb.nwcg.gov/',
    },
  };

  return sources.map(source => ({
    ...sourceMap[source],
    timestamp: new Date().toISOString(),
  }));
}

export default {
  transformToWildfireStatus,
  transformToFireBehaviorSchema,
  transformFireArray,
  transformLocation,
  transformResources,
  calculateRiskLevel,
  calculateRiskPoints,
  generateRiskNotes,
  createDataSources,
};
