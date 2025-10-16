# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides access to National Interagency Fire Center (NIFC) wildfire incident data. The server is designed to integrate with the [fire-behavior](https://github.com/EliSchillinger/fire-behavior) application and follows the `wildfire_prompt_template.json` schema.

**Current Status:** Planning and documentation phase - the `src/` implementation directory has not been created yet. See STATUS.md for current progress.

## Development Commands

### Installation & Setup
```bash
npm install                  # Install dependencies
cp .env.example .env        # Create environment configuration
```

### Development
```bash
npm start                   # Start MCP server
npm run dev                 # Start with auto-reload (--watch flag)
```

### Testing
```bash
npm test                    # Run all tests with Jest
npm run test:unit          # Run only unit tests
npm run test:integration   # Run only integration tests
npm run test:coverage      # Run tests with coverage report
```

### Code Quality
```bash
npm run lint               # Run ESLint
npm run lint:fix          # Auto-fix linting issues
```

## Architecture

### MCP Tools Structure

The server implements 4 MCP tools for wildfire data access:

1. **get_active_fires** - Query currently active wildfires
   - Filter by state, coordinates, radius, minimum size
   - Returns: incident details, location, size, containment, resources

2. **get_fire_by_id** - Get detailed information about a specific fire
   - Optional: include GeoJSON perimeter data
   - Optional: include InciWeb narrative information

3. **search_fires_by_location** - Find fires near coordinates
   - Radius-based proximity search
   - Returns: distance and bearing calculations

4. **get_fire_history** - Retrieve historical fire data
   - Filter by state, county, year range, minimum size
   - Returns: statistics and historical trends

### Data Flow

```
Claude/MCP Client → MCP Server → API Clients → External Data Sources
                                     ↓
                              Schema Transformer
                                     ↓
                         Wildfire Status Response (fire-behavior schema)
```

### External Data Sources

- **NIFC ArcGIS Services** (primary): `https://data-nifc.opendata.arcgis.com/`
  - Active fire perimeters, incident points
  - Updates: every 15-30 minutes

- **IRWIN** (enrichment): `https://irwin.doi.gov/`
  - Official incident reporting and detailed attributes

- **InciWeb** (narratives): `https://inciweb.nwcg.gov/`
  - Public incident information, evacuation status

### Caching Strategy

- **Active fire data**: 5 minutes TTL (frequent updates)
- **Perimeter data**: 30 minutes TTL (updated 2-3x daily)
- **Historical data**: 24 hours TTL (static)
- In-memory cache for development, Redis for production

## Implementation Structure (Not Yet Created)

When implementing `src/`, use this structure:

```
src/
├── index.js              # MCP server entry point using @modelcontextprotocol/sdk
├── tools/                # MCP tool implementations
│   ├── get_active_fires.js
│   ├── get_fire_by_id.js
│   ├── search_fires_by_location.js
│   └── get_fire_history.js
├── api/                  # External API clients
│   ├── nifc_client.js    # ArcGIS REST API client
│   ├── irwin_client.js   # IRWIN API client
│   └── inciweb_client.js # InciWeb scraper/API
├── schemas/              # Data validation and transformation
│   ├── validators.js     # Zod schemas for input validation
│   └── transformers.js   # Transform NIFC data to fire-behavior schema
└── utils/                # Helper functions
    ├── geospatial.js     # @turf/turf distance/bearing calculations
    ├── cache.js          # Caching layer
    └── logger.js         # Winston logging configuration
```

## Key Technical Details

### GeoJSON Processing
- Use `@turf/turf` for distance and bearing calculations
- Simplify large perimeter polygons (set SIMPLIFY_PERIMETERS=true)
- Default coordinate precision: 4 decimal places

### Schema Transformation
All responses must conform to fire-behavior's `wildfire_status` schema:
```json
{
  "wildfire_status": {
    "incident_id": "2025-CASNF-001234",
    "name": "Creek Fire",
    "status": "Active",
    "acres": 12458,
    "containment": "25%",
    "start_time": "2025-08-15T14:30:00Z",
    "expected_end": null
  },
  "risk_assessment": {
    "overall_risk": "High",
    "notes": "Active wildfire within 50 miles..."
  },
  "data_sources": [...]
}
```

### Risk Scoring
- Active fire < 10 miles: +50 risk points (Extreme)
- 10-25 miles: +30 points (High)
- 25-50 miles: +20 points (Moderate)
- 50-100 miles: +10 points (Low)

### Fire Status Levels
- **New**: < 24 hours old
- **Growing**: Actively spreading, low containment
- **Active**: Burning but being managed
- **Contained**: Fire line established
- **Controlled**: No threat of escape

### Fire Complexity Types
- Type 5: Small fire, 1-2 resources
- Type 4: Moderate fire, several resources
- Type 3: Extended attack, full organization
- Type 2: High complexity, regional resources
- Type 1: Most complex, national resources

## Environment Configuration

Key `.env` variables (see `.env.example`):
- `LOG_LEVEL`: Logging level (default: info)
- `CACHE_TTL_SECONDS`: Cache duration (default: 300)
- `ENABLE_PERIMETER_DATA`: Include GeoJSON perimeters (default: true)
- `ENABLE_INCIWEB_INTEGRATION`: Fetch InciWeb narratives (default: true)
- `MAX_FIRES_PER_QUERY`: Limit results (default: 100)

## Testing Strategy

### Unit Tests
- Test each tool handler independently with mocked API responses
- Validate schema transformations
- Test geospatial calculations (distance, bearing)

### Integration Tests
- Use real NIFC API responses (with VCR/nock for recording)
- Test end-to-end MCP tool execution
- Validate caching behavior

### Test Data
- Use historical fire incidents for consistent testing
- Mock large perimeter GeoJSON files
- Test edge cases: no fires found, API failures, invalid coordinates

## Companion Projects

This MCP server is part of a three-server ecosystem for fire-behavior:
- **raws-mcp**: Real-time weather data from RAWS stations
- **drought-mcp**: Drought severity from US Drought Monitor
- **nifc-mcp** (this project): Active wildfire incidents

All three servers output data conforming to fire-behavior's prompt template schema.

## MCP Server Configuration

Users add this server to Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nifc": {
      "command": "node",
      "args": ["/absolute/path/to/nifc-mcp/src/index.js"]
    }
  }
}
```

## Dependencies

### Core
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `axios`: HTTP client for API requests
- `@turf/turf`: Geospatial calculations
- `zod`: Schema validation
- `winston`: Logging

### Development
- `jest`: Testing framework
- `eslint`: Code linting
- `node-mocks-http`: HTTP mocking for tests

## Important Notes

- All NIFC ArcGIS services are public (no API keys required)
- Node.js 18+ required (uses ES modules, `type: "module"`)
- Fire data updates vary by source: perimeters update 2-3x daily, incident points update every 15-30 minutes
- Not all fires have perimeter data (especially small fires < 100 acres)
- InciWeb narratives are manually updated by incident management teams
- Always include `data_sources` in responses with URLs and timestamps
