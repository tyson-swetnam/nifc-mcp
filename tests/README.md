# Test Directory

This directory contains all test suites for the NIFC MCP server.

## Structure

### `/unit/`
Unit tests for individual modules with mocked dependencies:
- Fast execution (< 10 seconds total)
- No external API calls
- Test individual functions and classes in isolation
- Target coverage: ≥ 85%

### `/integration/`
Integration tests with real API calls:
- Tests interaction between components
- Real NIFC API requests
- End-to-end tool execution
- Slower execution but validates real-world behavior

### `/fixtures/`
Test data and mock responses:
- Sample fire incident data
- GeoJSON perimeter examples
- API response samples
- Historical fire records

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run with coverage report
npm run test:coverage
```

## Writing Tests

### Unit Test Example
```javascript
import { calculateDistance } from '../src/utils/geospatial.js';

describe('geospatial', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const distance = calculateDistance(
        40.0150, -105.2705,  // Boulder, CO
        39.7392, -104.9903   // Denver, CO
      );
      expect(distance).toBeCloseTo(24.6, 1); // ~24.6 miles
    });
  });
});
```

### Integration Test Example
```javascript
import { get_active_fires } from '../src/tools/get_active_fires.js';

describe('get_active_fires integration', () => {
  it('should fetch real active fires from NIFC', async () => {
    const result = await get_active_fires({ state: 'CA' });
    expect(result).toHaveProperty('fires');
    expect(Array.isArray(result.fires)).toBe(true);
    expect(result).toHaveProperty('data_sources');
  });
});
```

## Test Coverage

Target coverage levels:
- Overall: ≥ 80%
- Statements: ≥ 85%
- Branches: ≥ 75%
- Functions: ≥ 85%
- Lines: ≥ 85%

## Continuous Integration

Tests run automatically on:
- Every commit (if CI configured)
- Pull requests
- Before releases

All tests must pass before merging to main branch.
