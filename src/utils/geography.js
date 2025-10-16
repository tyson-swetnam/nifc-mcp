/**
 * US State and Geography Reference Data
 * Provides state code validation, normalization, and lookup utilities
 */

// US State codes and names
export const US_STATES = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
};

// Create reverse lookup (name -> code)
const STATE_NAME_TO_CODE = {};
for (const [code, name] of Object.entries(US_STATES)) {
  STATE_NAME_TO_CODE[name.toLowerCase()] = code;
}

/**
 * Validate state code
 * @param {string} stateCode - Two-letter state abbreviation
 * @returns {boolean} True if valid state code
 */
export function isValidStateCode(stateCode) {
  if (!stateCode || typeof stateCode !== 'string') {
    return false;
  }
  return stateCode.toUpperCase() in US_STATES;
}

/**
 * Get state name from code
 * @param {string} stateCode - Two-letter state abbreviation
 * @returns {string|null} State name or null if invalid
 */
export function getStateName(stateCode) {
  if (!stateCode || typeof stateCode !== 'string') {
    return null;
  }
  return US_STATES[stateCode.toUpperCase()] || null;
}

/**
 * Get state code from name (case-insensitive)
 * @param {string} stateName - State name
 * @returns {string|null} Two-letter state code or null if invalid
 */
export function getStateCode(stateName) {
  if (!stateName || typeof stateName !== 'string') {
    return null;
  }
  return STATE_NAME_TO_CODE[stateName.toLowerCase()] || null;
}

/**
 * Normalize state input to code
 * Accepts either code or name, returns standardized code
 * @param {string} state - State code or name
 * @returns {string|null} Normalized state code or null if invalid
 */
export function normalizeState(state) {
  if (!state || typeof state !== 'string') {
    return null;
  }

  const upper = state.toUpperCase();

  // Check if it's already a valid code
  if (upper in US_STATES) {
    return upper;
  }

  // Try to look up as name
  return getStateCode(state);
}

/**
 * Get all state codes
 * @returns {string[]} Array of all state codes
 */
export function getAllStateCodes() {
  return Object.keys(US_STATES);
}

/**
 * Get all state names
 * @returns {string[]} Array of all state names
 */
export function getAllStateNames() {
  return Object.values(US_STATES);
}

/**
 * Check if coordinates are valid
 * @param {number} latitude - Latitude (-90 to 90)
 * @param {number} longitude - Longitude (-180 to 180)
 * @returns {boolean} True if valid coordinates
 */
export function isValidCoordinates(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    return false;
  }

  return latitude >= -90 && latitude <= 90 &&
         longitude >= -180 && longitude <= 180;
}

/**
 * Format coordinates with precision
 * @param {number} coord - Coordinate value
 * @param {number} precision - Decimal places (default: 4)
 * @returns {number} Formatted coordinate
 */
export function formatCoordinate(coord, precision = 4) {
  return parseFloat(coord.toFixed(precision));
}

/**
 * Normalize county name
 * Removes "County" suffix, trims, and standardizes case
 * @param {string} county - County name
 * @returns {string} Normalized county name
 */
export function normalizeCounty(county) {
  if (!county || typeof county !== 'string') {
    return '';
  }

  return county
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
