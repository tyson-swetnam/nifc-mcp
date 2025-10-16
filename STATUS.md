# NIFC MCP Project Status

**Last Updated:** 2025-10-15

## Current Phase: API Clients & MCP Server Complete

This project has made significant progress with **Phase 3 (API Clients) and Phase 2 (MCP Server Core) now complete**. The foundation is solid and ready for tool implementation.

### Latest Accomplishments (Oct 15, 2025)
- ✅ Complete API client layer (NIFC, IRWIN, InciWeb)
- ✅ MCP server entry point with stdio transport
- ✅ Base tool class with error handling and validation
- ✅ Working tool stub implementations
- ✅ All dependencies installed
- ✅ Syntax validation passed for all modules

### Current Status
- **Phase 1 (Planning & Docs):** ✅ Complete
- **Phase 2 (MCP Server):** ✅ Complete
- **Phase 3 (API Clients):** ✅ Complete
- **Phase 4 (Utils & Schemas):** ✅ Complete
- **Phase 5 (MCP Tools):** 🚧 Next Priority
- **Phase 6 (Testing):** ⏳ Not Started
- **Phase 7 (Production):** ⏳ Not Started

## Completed ✓

### Core Files
- [x] **README.md** - Comprehensive overview (620+ lines)
  - NIFC explanation and data sources
  - 4 MCP tools fully specified
  - Installation and configuration
  - Usage examples and troubleshooting
- [x] **package.json** - Node.js project configuration
- [x] **.env.example** - Environment configuration template
- [x] **LICENSE** - Apache 2.0 license
- [x] **.gitignore** - Git ignore patterns

### Documentation (Phase 1 Complete)
- [x] **docs/implementation_plan.md** - Comprehensive 7-phase roadmap (350+ lines)
- [x] Project overview and features
- [x] MCP tool specifications (4 tools defined)
- [x] Data schema overview
- [x] Integration points with fire-behavior
- [x] Troubleshooting guide

### Project Structure (Phase 1 Complete)
- [x] `src/` directory structure created
  - `src/tools/` - MCP tool implementations
  - `src/api/` - External API clients
  - `src/schemas/` - Validation and transformation
  - `src/utils/` - Helper functions
- [x] `tests/` directory structure created
  - `tests/unit/` - Unit tests
  - `tests/integration/` - Integration tests
  - `tests/fixtures/` - Test data
- [x] Base configuration files
  - `.eslintrc.json` - Code quality rules
  - `jest.config.js` - Test configuration
  - `.editorconfig` - Editor consistency
  - `.nvmrc` - Node version specification

### Core Utilities (Phase 1 & 4 Complete)
- [x] **src/utils/logger.js** - Winston logging system
  - Structured JSON logging
  - Multiple log levels
  - Helper methods for common scenarios
  - Production file logging support
- [x] **src/utils/config.js** - Environment configuration loader
  - Type coercion and validation
  - Default values
  - Comprehensive error checking
- [x] **src/utils/cache.js** - In-memory caching system
  - TTL-based expiration
  - LRU eviction
  - Cache statistics tracking
  - getOrSet pattern support
- [x] **src/utils/geospatial.js** - Geospatial calculations
  - Distance calculations (miles/km)
  - Bearing calculations (8-direction compass)
  - Point-in-polygon testing
  - GeoJSON simplification
  - Area calculations (acres)
  - Buffer creation
- [x] **src/utils/geography.js** - US state/geography reference
  - State code validation
  - State name/code conversion
  - Coordinate validation
  - County normalization
- [x] **src/utils/formatters.js** - Data formatting utilities
  - Number formatting with commas
  - Date/time formatting (ISO 8601)
  - Coordinate precision control
  - HTML sanitization
  - Fire status/cause formatting

### Schema System (Phase 2 & 4 Complete)
- [x] **src/schemas/validators.js** - Zod input validation
  - All 4 MCP tool parameter schemas
  - Common validators (coordinates, states, years)
  - Incident ID validation
  - Cross-field validation
- [x] **src/schemas/transformers.js** - Data transformation
  - NIFC → fire-behavior schema conversion
  - Risk assessment calculations
  - Location/resource transformers
  - Data source array creation

## In Progress 🚧

### Phase 5: MCP Tools (Next Priority)
- [ ] **src/tools/get_active_fires.js** - Query active wildfires
- [ ] **src/tools/get_fire_by_id.js** - Get detailed fire info
- [ ] **src/tools/search_fires_by_location.js** - Proximity search
- [ ] **src/tools/get_fire_history.js** - Historical data

### Phase 2: MCP Server Infrastructure (COMPLETED ✓)
- [x] **src/index.js** - MCP server entry point with stdio transport
- [x] **src/tools/base_tool.js** - Base tool handler class with error handling
- [x] **src/tools/stubs.js** - Working tool implementations (placeholder for full classes)

### Phase 3: API Clients (COMPLETED ✓)
- [x] **src/api/errors.js** - Custom error classes (11 error types)
- [x] **src/api/nifc_client.js** - NIFC ArcGIS REST API client
  - Active incidents query with filters
  - Incident detail retrieval
  - Fire perimeter GeoJSON
  - Proximity search
  - Rate limiting and retry logic
  - Comprehensive caching
- [x] **src/api/irwin_client.js** - IRWIN API client
  - Incident details enrichment
  - Resource information
  - Fire behavior attributes
  - Graceful fallback handling
- [x] **src/api/inciweb_client.js** - InciWeb client
  - Narrative information
  - Evacuation status
  - Basic HTML parsing
  - Graceful not-found handling

### Remaining Documentation
- [ ] **docs/api_endpoints.md** - NIFC ArcGIS, IRWIN, InciWeb API documentation
- [ ] **docs/data_schema.md** - Schema mapping and transformation details
- [ ] **docs/architecture.md** - System architecture and design patterns
- [ ] **docs/fire_behavior_integration.md** - Integration guide with fire-behavior app
- [ ] **CONTRIBUTING.md** - Developer contribution guidelines

## Not Started ⏳

### Phase 6: Testing
- [ ] Unit test suite (target: 85% coverage)
- [ ] Integration test suite
- [ ] Test fixtures and mock data
- [ ] Test documentation

### Phase 7: Production Readiness
- [ ] Performance testing and optimization
- [ ] Security audit
- [ ] Production deployment guide
- [ ] CI/CD pipeline configuration

## MCP Tools Defined

The following 4 MCP tools are fully specified in the README:

1. **get_active_fires** - Get currently active wildfire incidents
   - Filter by state, location, size
   - Returns fire details with resources and status

2. **get_fire_by_id** - Get detailed information about a specific fire
   - Includes perimeter data (GeoJSON)
   - InciWeb narrative integration

3. **search_fires_by_location** - Find fires near coordinates
   - Proximity search with radius
   - Distance and bearing calculations

4. **get_fire_history** - Retrieve historical fire data
   - Query by state, county, year range
   - Statistical analysis and trends

## Key Design Decisions

### Data Sources
- **Primary**: NIFC ArcGIS Services (https://data-nifc.opendata.arcgis.com/)
- **Enrichment**: IRWIN (https://irwin.doi.gov/)
- **Narratives**: InciWeb (https://inciweb.nwcg.gov/)
- **Update Frequency**: Active fires update every 15-30 minutes

### Technology Stack
- **Runtime**: Node.js 18+
- **MCP SDK**: @modelcontextprotocol/sdk
- **HTTP Client**: axios
- **GeoJSON Processing**: @turf/turf (distance, bearing calculations)
- **Schema Validation**: zod
- **Testing**: jest

### Caching Strategy
- **Default TTL**: 5 minutes (active fire data changes frequently)
- **Perimeter Data**: 30 minutes (updated 2-3 times daily)
- **Historical Data**: 24 hours (doesn't change)
- **Type**: In-memory for development, Redis for production

### Integration Points
- Compatible with fire-behavior `wildfire_prompt_template.json` schema
- Populates `wildfire_status` section with incident data
- Provides proximity alerts for nearby fires
- Integrates with RAWS MCP (weather) and Drought MCP for comprehensive risk

## Fire Data Integration

### Wildfire Status Schema
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
  }
}
```

### Risk Contribution
- **Active fire < 10 miles**: +50 risk points (Extreme)
- **Active fire 10-25 miles**: +30 risk points (High)
- **Active fire 25-50 miles**: +20 risk points (Moderate)
- **Active fire 50-100 miles**: +10 risk points (Low)
- **No active fires**: 0 risk points

## Next Steps

### Immediate (Week 1)
1. Complete remaining documentation files:
   - implementation_plan.md
   - api_endpoints.md
   - data_schema.md

2. Research NIFC ArcGIS REST API endpoints in detail

3. Identify sample fire incidents for testing

### Short-term (Weeks 2-3)
1. Set up project structure (`src/`, `tests/` directories)
2. Implement basic MCP server skeleton
3. Create NIFC ArcGIS API client (mock initially)
4. Implement first tool: `get_active_fires`

### Medium-term (Weeks 4-6)
1. Implement remaining MCP tools
2. Add InciWeb and IRWIN integration
3. Implement GeoJSON perimeter processing
4. Create comprehensive test suite

### Long-term (Weeks 7-8)
1. Integration testing with fire-behavior application
2. Performance optimization (caching, spatial queries)
3. Documentation refinement
4. Production deployment preparation

## Questions & Decisions Needed

### API Access
- [ ] Confirm NIFC ArcGIS services are fully public (no authentication)
- [ ] Determine rate limits for ArcGIS REST services
- [ ] Identify backup data sources if NIFC unavailable

### Schema Integration
- [ ] Finalize wildfire_status schema extensions
- [ ] Define how fire data merges with weather and drought data
- [ ] Determine priority when multiple fires found

### Testing
- [ ] Identify active test fire incidents
- [ ] Define acceptable test coverage threshold (80%?)
- [ ] Plan for testing with historical fire data

## References

### Documentation
- README.md - Main project documentation
- .env.example - Configuration template
- package.json - Dependencies and scripts

### External Resources
- NIFC: https://www.nifc.gov/
- NIFC ArcGIS: https://data-nifc.opendata.arcgis.com/
- InciWeb: https://inciweb.nwcg.gov/
- IRWIN: https://irwin.doi.gov/
- fire-behavior repo: https://github.com/EliSchillinger/fire-behavior
- MCP Specification: https://github.com/anthropics/model-context-protocol

## How to Contribute

1. Review existing documentation (README.md)
2. Check this STATUS.md for current priorities
3. Choose a task from "In Progress" or "Not Started"
4. Create implementation following patterns from raws-mcp/drought-mcp
5. Submit PR with documentation updates

## Contact

For questions about this project:
- Open an issue on GitHub
- Review related raws-mcp and drought-mcp projects for implementation patterns
- Check fire-behavior integration requirements

---

**Note:** This is one of three companion MCP servers for the fire-behavior application:
- [raws-mcp](https://github.com/tyson-swetnam/raws-mcp) - Real-time weather data from RAWS stations
- [drought-mcp](https://github.com/tyson-swetnam/drought-mcp) - Drought severity data from US Drought Monitor
- **nifc-mcp** (this project) - Active wildfire incident data from NIFC

Together, these provide comprehensive wildfire risk assessment data.
