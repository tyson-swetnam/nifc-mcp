/**
 * Geospatial calculation utilities using Turf.js
 * Handles distance, bearing, and GeoJSON operations
 */

import * as turf from '@turf/turf';
import config from './config.js';

/**
 * Calculate distance between two points in miles
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @returns {number} Distance in miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const from = turf.point([lon1, lat1]);
  const to = turf.point([lon2, lat2]);

  const distanceKm = turf.distance(from, to, { units: 'kilometers' });
  const distanceMiles = distanceKm * 0.621371; // Convert km to miles

  return distanceMiles;
}

/**
 * Calculate bearing between two points
 * Returns compass direction (N, NE, E, SE, S, SW, W, NW)
 * @param {number} lat1 - From latitude
 * @param {number} lon1 - From longitude
 * @param {number} lat2 - To latitude
 * @param {number} lon2 - To longitude
 * @returns {string} Compass bearing
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const from = turf.point([lon1, lat1]);
  const to = turf.point([lon2, lat2]);

  const bearingDegrees = turf.bearing(from, to);

  // Normalize to 0-360
  const normalized = (bearingDegrees + 360) % 360;

  // Convert to compass direction (8 directions)
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;

  return directions[index];
}

/**
 * Calculate numeric bearing in degrees
 * @param {number} lat1 - From latitude
 * @param {number} lon1 - From longitude
 * @param {number} lat2 - To latitude
 * @param {number} lon2 - To longitude
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateNumericBearing(lat1, lon1, lat2, lon2) {
  const from = turf.point([lon1, lat1]);
  const to = turf.point([lon2, lat2]);

  const bearingDegrees = turf.bearing(from, to);

  // Normalize to 0-360
  return (bearingDegrees + 360) % 360;
}

/**
 * Check if a point is within a polygon
 * @param {number} lat - Point latitude
 * @param {number} lon - Point longitude
 * @param {Object} polygon - GeoJSON polygon
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInPolygon(lat, lon, polygon) {
  const point = turf.point([lon, lat]);
  return turf.booleanPointInPolygon(point, polygon);
}

/**
 * Calculate area of a polygon in acres
 * @param {Object} polygon - GeoJSON polygon
 * @returns {number} Area in acres
 */
export function calculateArea(polygon) {
  const areaSquareMeters = turf.area(polygon);
  const acres = areaSquareMeters * 0.000247105; // Convert m² to acres
  return acres;
}

/**
 * Simplify a GeoJSON polygon
 * Reduces number of vertices while preserving shape
 * @param {Object} polygon - GeoJSON polygon
 * @param {number} tolerance - Simplification tolerance (default from config)
 * @returns {Object} Simplified GeoJSON polygon
 */
export function simplifyPolygon(polygon, tolerance = null) {
  if (!config.geojson.simplifyPerimeters && tolerance === null) {
    return polygon;
  }

  const tol = tolerance !== null ? tolerance : config.geojson.simplificationTolerance;

  try {
    const simplified = turf.simplify(polygon, {
      tolerance: tol,
      highQuality: true,
    });
    return simplified;
  } catch (error) {
    // If simplification fails, return original
    return polygon;
  }
}

/**
 * Get bounding box of a polygon
 * @param {Object} polygon - GeoJSON polygon
 * @returns {Array} Bounding box [minLon, minLat, maxLon, maxLat]
 */
export function getBoundingBox(polygon) {
  return turf.bbox(polygon);
}

/**
 * Create a buffer around a point
 * @param {number} lat - Point latitude
 * @param {number} lon - Point longitude
 * @param {number} radiusMiles - Buffer radius in miles
 * @returns {Object} GeoJSON polygon buffer
 */
export function createBuffer(lat, lon, radiusMiles) {
  const point = turf.point([lon, lat]);
  const radiusKm = radiusMiles * 1.60934; // Convert miles to km
  const buffer = turf.buffer(point, radiusKm, { units: 'kilometers' });
  return buffer;
}

/**
 * Round coordinates in GeoJSON to specified precision
 * @param {Object} geojson - GeoJSON object
 * @param {number} precision - Decimal places
 * @returns {Object} GeoJSON with rounded coordinates
 */
export function roundCoordinates(geojson, precision = null) {
  const p = precision !== null ? precision : config.geojson.coordinatePrecision;

  const rounded = turf.truncate(geojson, {
    precision: p,
    coordinates: 2,
  });

  return rounded;
}

/**
 * Calculate centroid of a polygon
 * @param {Object} polygon - GeoJSON polygon
 * @returns {Array} [longitude, latitude]
 */
export function getCentroid(polygon) {
  const centroid = turf.centroid(polygon);
  return centroid.geometry.coordinates;
}

/**
 * Find nearest point on a polygon to a given point
 * @param {number} lat - Point latitude
 * @param {number} lon - Point longitude
 * @param {Object} polygon - GeoJSON polygon
 * @returns {Array} [longitude, latitude] of nearest point
 */
export function nearestPointOnPolygon(lat, lon, polygon) {
  const point = turf.point([lon, lat]);
  const nearest = turf.nearestPointOnLine(polygon, point);
  return nearest.geometry.coordinates;
}

/**
 * Calculate the distance from a point to the edge of a polygon
 * @param {number} lat - Point latitude
 * @param {number} lon - Point longitude
 * @param {Object} polygon - GeoJSON polygon
 * @returns {number} Distance in miles
 */
export function distanceToPolygon(lat, lon, polygon) {
  const point = turf.point([lon, lat]);

  // If point is inside polygon, distance is 0
  if (turf.booleanPointInPolygon(point, polygon)) {
    return 0;
  }

  // Find nearest point on polygon edge
  const nearest = turf.nearestPointOnLine(polygon, point);

  // Calculate distance
  const distanceKm = turf.distance(point, nearest, { units: 'kilometers' });
  return distanceKm * 0.621371; // Convert to miles
}

/**
 * Sort points by distance from a reference point
 * @param {Array} points - Array of {lat, lon} objects
 * @param {number} refLat - Reference latitude
 * @param {number} refLon - Reference longitude
 * @returns {Array} Sorted points with distance added
 */
export function sortByDistance(points, refLat, refLon) {
  return points
    .map(point => ({
      ...point,
      distance: calculateDistance(refLat, refLon, point.lat, point.lon),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Filter points within radius
 * @param {Array} points - Array of {lat, lon} objects
 * @param {number} centerLat - Center latitude
 * @param {number} centerLon - Center longitude
 * @param {number} radiusMiles - Radius in miles
 * @returns {Array} Filtered points within radius
 */
export function filterWithinRadius(points, centerLat, centerLon, radiusMiles) {
  return points.filter(point => {
    const distance = calculateDistance(centerLat, centerLon, point.lat, point.lon);
    return distance <= radiusMiles;
  });
}

/**
 * Validate GeoJSON
 * @param {Object} geojson - GeoJSON object
 * @returns {boolean} True if valid
 */
export function isValidGeoJSON(geojson) {
  if (!geojson || typeof geojson !== 'object') {
    return false;
  }

  try {
    // Try to create a Turf object
    if (geojson.type === 'Point') {
      turf.point(geojson.coordinates);
    } else if (geojson.type === 'Polygon') {
      turf.polygon(geojson.coordinates);
    } else if (geojson.type === 'Feature') {
      // Validate feature
      return geojson.geometry && geojson.geometry.type;
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Convert polygon coordinates to human-readable format
 * @param {Object} polygon - GeoJSON polygon
 * @returns {string} Description of polygon
 */
export function describePolygon(polygon) {
  const area = calculateArea(polygon);
  const bbox = getBoundingBox(polygon);
  const [centroidLon, centroidLat] = getCentroid(polygon);

  return {
    area: `${Math.round(area)} acres`,
    centroid: { lat: centroidLat, lon: centroidLon },
    bounds: {
      north: bbox[3],
      south: bbox[1],
      east: bbox[2],
      west: bbox[0],
    },
  };
}
