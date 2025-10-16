/**
 * Data formatting utilities
 * Provides consistent formatting for various data types
 */

import config from './config.js';

/**
 * Format number with commas (e.g., 12458 -> "12,458")
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  return num.toLocaleString('en-US');
}

/**
 * Format acres with commas
 * @param {number} acres - Acres value
 * @returns {string} Formatted acres
 */
export function formatAcres(acres) {
  if (acres === null || acres === undefined || isNaN(acres)) {
    return '0 acres';
  }
  return `${formatNumber(Math.round(acres))} acres`;
}

/**
 * Format containment percentage
 * @param {number} percent - Containment percent (0-100)
 * @returns {string} Formatted percentage
 */
export function formatContainment(percent) {
  if (percent === null || percent === undefined || isNaN(percent)) {
    return '0%';
  }

  const rounded = Math.round(percent);
  return `${Math.min(100, Math.max(0, rounded))}%`;
}

/**
 * Format date to ISO 8601 string
 * @param {Date|string|number} date - Date to format
 * @returns {string|null} ISO 8601 date string or null
 */
export function formatDate(date) {
  if (!date) return null;

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch (error) {
    return null;
  }
}

/**
 * Format date for display (human-readable)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDisplayDate(date) {
  if (!date) return 'Unknown';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Unknown';

    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Format coordinate with precision
 * @param {number} coord - Coordinate value
 * @param {number} precision - Decimal places
 * @returns {number} Formatted coordinate
 */
export function formatCoordinate(coord, precision = null) {
  if (coord === null || coord === undefined || isNaN(coord)) {
    return 0;
  }

  const p = precision !== null ? precision : config.geojson.coordinatePrecision;
  return parseFloat(coord.toFixed(p));
}

/**
 * Format distance in miles
 * @param {number} miles - Distance in miles
 * @param {number} precision - Decimal places (default: 1)
 * @returns {string} Formatted distance
 */
export function formatDistance(miles, precision = 1) {
  if (miles === null || miles === undefined || isNaN(miles)) {
    return '0 miles';
  }

  const rounded = miles.toFixed(precision);
  return `${rounded} ${miles === 1 ? 'mile' : 'miles'}`;
}

/**
 * Truncate text to max length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix for truncated text (default: '...')
 * @returns {string} Truncated text
 */
export function truncate(text, maxLength, suffix = '...') {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Sanitize HTML content (remove tags)
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp;
    .replace(/&amp;/g, '&')  // Replace &amp;
    .replace(/&lt;/g, '<')   // Replace &lt;
    .replace(/&gt;/g, '>')   // Replace &gt;
    .replace(/&quot;/g, '"') // Replace &quot;
    .replace(/&#39;/g, "'")  // Replace &#39;
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim();
}

/**
 * Format fire status for display
 * @param {string} status - Raw status value
 * @returns {string} Formatted status
 */
export function formatFireStatus(status) {
  if (!status) return 'Unknown';

  const normalized = status.toString().toLowerCase();

  const statusMap = {
    'active': 'Active',
    'new': 'New',
    'growing': 'Growing',
    'contained': 'Contained',
    'controlled': 'Controlled',
    'out': 'Out',
    'prescribed': 'Prescribed',
  };

  return statusMap[normalized] || status;
}

/**
 * Format cause for display
 * @param {string} cause - Raw cause value
 * @returns {string} Formatted cause
 */
export function formatCause(cause) {
  if (!cause) return 'Unknown';

  const normalized = cause.toString().toLowerCase();

  const causeMap = {
    'lightning': 'Lightning',
    'human': 'Human',
    'unknown': 'Unknown',
    'undetermined': 'Undetermined',
    'natural': 'Natural',
    'arson': 'Arson',
    'debris': 'Debris Burning',
    'campfire': 'Campfire',
    'equipment': 'Equipment Use',
    'railroad': 'Railroad',
    'smoking': 'Smoking',
    'children': 'Children',
  };

  return causeMap[normalized] || cause;
}

/**
 * Format resource count
 * @param {number} count - Resource count
 * @param {string} type - Resource type (singular)
 * @returns {string} Formatted resource string
 */
export function formatResourceCount(count, type) {
  if (!count || count === 0) {
    return `0 ${type}s`;
  }

  return `${formatNumber(count)} ${count === 1 ? type : type + 's'}`;
}

/**
 * Format boolean as Yes/No
 * @param {boolean} value - Boolean value
 * @returns {string} "Yes" or "No"
 */
export function formatBoolean(value) {
  return value ? 'Yes' : 'No';
}

/**
 * Calculate and format percentage
 * @param {number} part - Part value
 * @param {number} total - Total value
 * @param {number} precision - Decimal places (default: 1)
 * @returns {string} Formatted percentage
 */
export function calculatePercentage(part, total, precision = 1) {
  if (!total || total === 0) return '0%';

  const percent = (part / total) * 100;
  return `${percent.toFixed(precision)}%`;
}
