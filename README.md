# NIFC MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![Status](https://img.shields.io/badge/status-planning-yellow)](docs/implementation_plan.md)

A Model Context Protocol (MCP) server that provides access to National Interagency Fire Center (NIFC) wildfire incident data for emergency response, fire management, and public awareness.

> **Note:** This project is currently in the planning and documentation phase. The implementation (`src/` directory) has not been created yet. See [Implementation Plan](docs/implementation_plan.md) for development roadmap.

## Overview

This MCP server integrates with NIFC data services to provide real-time and historical wildfire incident information. The server formats data to align with the wildfire information schema used by the [fire-behavior](https://github.com/EliSchillinger/fire-behavior) application.

### What is NIFC?

The National Interagency Fire Center (NIFC) is the nation's support center for wildland firefighting, located in Boise, Idaho. NIFC coordinates firefighting resources and provides data about active wildfires across the United States.

**NIFC provides:**
- **Active Fire Data**: Real-time information on all active wildfires
- **Incident Information**: Details on fire name, location, size, containment
- **Perimeter Data**: GIS fire perimeter polygons
- **InciWeb**: Public incident information portal
- **IRWIN**: Integrated Reporting of Wildland-Fire Information system
- **Historical Data**: Past fire incidents and statistics

**Key Data Points:**
- Fire location (coordinates, county, state)
- Fire size (acres)
- Percent contained
- Discovery date and time
- Incident status (Active, Contained, Out)
- Cause (if known)
- Resources assigned
- Evacuations and closures

## Features

- Fetch active wildfire incidents by location, state, or nationwide
- Get detailed incident information (size, containment, resources)
- Retrieve fire perimeter data (GeoJSON polygons)
- Search for fires within a radius of coordinates
- Access historical fire data
- Format data to match wildfire_prompt_template.json schema
- Real-time updates from NIFC data feeds
- Integration with InciWeb for detailed incident narratives

## How It Works

The NIFC MCP server acts as a bridge between Claude (or other MCP clients) and NIFC data services:

1. **Fire Query**: You ask Claude about wildfires in a specific area
2. **Data Retrieval**: Server fetches active incidents from NIFC APIs
3. **Location Filtering**: Filters fires by proximity or administrative boundaries
4. **Enrichment**: Adds perimeter data and InciWeb details if available
5. **Schema Transformation**: Formats data into standardized wildfire schema
6. **Response**: Returns structured fire incident information

## Installation

> **Prerequisites:** Node.js 18.0.0 or higher

```bash
# Clone the repository
git clone https://github.com/tyson-swetnam/nifc-mcp.git
cd nifc-mcp

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env if needed (most NIFC APIs are public)
```

## Configuration

### MCP Server Configuration

Add to your Claude Desktop configuration:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

**Important:** Use the absolute path to `src/index.js`, not a relative path.

### Optional Configuration

Create a `.env` file for advanced configuration:

```env
# Server Configuration
LOG_LEVEL=info
CACHE_TTL_SECONDS=300  # 5 minutes (active fire data updates frequently)

# Data Source Configuration
ENABLE_PERIMETER_DATA=true
ENABLE_INCIWEB_INTEGRATION=true

# Feature Flags
INCLUDE_HISTORICAL_FIRES=true
MAX_FIRES_PER_QUERY=100
```

## Usage

### Starting the Server

```bash
# Start the MCP server
npm start

# Or start with auto-reload for development
npm run dev
```

### Example Queries

Once configured with Claude Desktop, you can ask:

- "What wildfires are currently burning in California?"
- "Show me active fires within 50 miles of Boulder, Colorado"
- "Get details about the Creek Fire"
- "What's the containment status of fires in Oregon?"
- "Are there any fires near coordinates 40.0°N, 105.2°W?"
- "List all fires larger than 10,000 acres"

## Available Tools

### 1. get_active_fires

Get currently active wildfire incidents.

**Parameters:**
- `state` (string, optional): State abbreviation (e.g., "CA", "CO")
- `latitude` (number, optional): Latitude for proximity search
- `longitude` (number, optional): Longitude for proximity search
- `radius_miles` (number, optional): Search radius in miles (default: 50)
- `min_size_acres` (number, optional): Minimum fire size filter
- `limit` (number, optional): Maximum results (default: 50)

**Example Request:**
```json
{
  "state": "CA",
  "min_size_acres": 1000,
  "limit": 10
}
```

**Example Response:**
```json
{
  "fires": [
    {
      "incident_id": "2025-CASNF-001234",
      "name": "Creek Fire",
      "status": "Active",
      "location": {
        "latitude": 37.2345,
        "longitude": -119.5678,
        "county": "Fresno",
        "state": "CA",
        "unit": "Sierra National Forest"
      },
      "size_acres": 12458,
      "containment_percent": 25,
      "discovery_date": "2025-08-15T14:30:00Z",
      "cause": "Lightning",
      "resources": {
        "personnel": 850,
        "engines": 45,
        "helicopters": 8,
        "air_tankers": 3
      },
      "evacuations": true,
      "structures_threatened": 450
    }
  ],
  "total_fires": 1,
  "query_timestamp": "2025-08-29T14:00:00Z",
  "data_sources": [
    {
      "name": "NIFC Active Fire Mapping",
      "type": "wildfire",
      "url": "https://data-nifc.opendata.arcgis.com/"
    }
  ]
}
```

### 2. get_fire_by_id

Get detailed information about a specific fire incident.

**Parameters:**
- `incident_id` (string, required): NIFC incident identifier
- `include_perimeter` (boolean, optional): Include GeoJSON perimeter (default: false)
- `include_inciweb` (boolean, optional): Include InciWeb narrative (default: false)

**Example Request:**
```json
{
  "incident_id": "2025-CASNF-001234",
  "include_perimeter": true,
  "include_inciweb": true
}
```

**Example Response:**
```json
{
  "incident_id": "2025-CASNF-001234",
  "name": "Creek Fire",
  "status": "Active",
  "size_acres": 12458,
  "containment_percent": 25,
  "discovery_date": "2025-08-15T14:30:00Z",
  "last_update": "2025-08-29T12:00:00Z",
  "perimeter": {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[-119.5, 37.2], [-119.4, 37.2], ...]]
    },
    "properties": {
      "perimeter_date": "2025-08-29T08:00:00Z",
      "source": "IR Mapping"
    }
  },
  "inciweb": {
    "url": "https://inciweb.nwcg.gov/incident/8765/",
    "summary": "The Creek Fire is burning in steep, rugged terrain...",
    "last_updated": "2025-08-29T10:00:00Z"
  }
}
```

### 3. search_fires_by_location

Find fires near a specific location.

**Parameters:**
- `latitude` (number, required): Latitude (-90 to 90)
- `longitude` (number, required): Longitude (-180 to 180)
- `radius_miles` (number, required): Search radius in miles
- `include_contained` (boolean, optional): Include contained fires (default: false)

**Example Request:**
```json
{
  "latitude": 40.0150,
  "longitude": -105.2705,
  "radius_miles": 100,
  "include_contained": false
}
```

**Example Response:**
```json
{
  "location": {
    "latitude": 40.0150,
    "longitude": -105.2705,
    "search_radius_miles": 100
  },
  "fires_found": 3,
  "fires": [
    {
      "incident_id": "2025-COHDF-000123",
      "name": "Cameron Peak Fire",
      "distance_miles": 25.3,
      "bearing": "NW",
      "size_acres": 8542,
      "containment_percent": 45,
      "status": "Active"
    },
    {
      "incident_id": "2025-COHDF-000124",
      "name": "East Troublesome Fire",
      "distance_miles": 42.8,
      "bearing": "W",
      "size_acres": 15234,
      "containment_percent": 15,
      "status": "Active"
    }
  ],
  "warning": "Multiple active fires within 50 miles of your location"
}
```

### 4. get_fire_history

Retrieve historical fire data for an area.

**Parameters:**
- `state` (string, optional): State abbreviation
- `county` (string, optional): County name
- `year` (number, optional): Specific year
- `start_year` (number, optional): Start year for range
- `end_year` (number, optional): End year for range
- `min_size_acres` (number, optional): Minimum fire size

**Example Request:**
```json
{
  "state": "CA",
  "start_year": 2020,
  "end_year": 2025,
  "min_size_acres": 50000
}
```

**Example Response:**
```json
{
  "state": "California",
  "time_period": {
    "start_year": 2020,
    "end_year": 2025
  },
  "total_fires": 8,
  "total_acres_burned": 1245678,
  "fires": [
    {
      "incident_id": "2020-CABTF-000567",
      "name": "August Complex",
      "year": 2020,
      "size_acres": 1032648,
      "cause": "Lightning",
      "start_date": "2020-08-16",
      "contained_date": "2020-11-12"
    }
  ],
  "statistics": {
    "largest_fire": {
      "name": "August Complex",
      "acres": 1032648,
      "year": 2020
    },
    "average_size": 155709,
    "fires_by_cause": {
      "Lightning": 5,
      "Human": 2,
      "Unknown": 1
    }
  }
}
```

## Data Schema

The server outputs fire data conforming to the fire-behavior `wildfire_prompt_template.json` schema, specifically populating the `wildfire_status` section.

**Wildfire Status Schema:**
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
    "notes": "Active wildfire within 50 miles. Monitor conditions and be prepared for evacuations."
  },
  "data_sources": [
    {
      "name": "NIFC Active Fire Mapping",
      "type": "wildfire",
      "url": "https://data-nifc.opendata.arcgis.com/"
    }
  ]
}
```

See [Data Schema Documentation](docs/data_schema.md) for complete mapping details.

## Data Sources

This MCP server connects to:

1. **NIFC ArcGIS Services**
   - URL: https://data-nifc.opendata.arcgis.com/
   - Active fire perimeters
   - Incident points
   - Real-time updates

2. **IRWIN (Integrated Reporting System)**
   - URL: https://irwin.doi.gov/
   - Official incident reporting
   - Detailed fire attributes

3. **InciWeb**
   - URL: https://inciweb.nwcg.gov/
   - Public incident information
   - Narrative updates
   - Evacuation information

4. **NIFC Situation Reports**
   - Daily situation reports
   - National fire statistics
   - Resource allocation data

## Fire Status Levels

### Active Fires
- **New**: Recently discovered (< 24 hours)
- **Growing**: Actively spreading, low containment
- **Active**: Burning but being managed
- **Contained**: Fire line established around perimeter
- **Controlled**: No threat of escape, mop-up underway

### Fire Complexity Levels
- **Type 5**: Small fire, 1-2 resources
- **Type 4**: Moderate fire, several resources
- **Type 3**: Extended attack, full organization
- **Type 2**: High complexity, regional resources
- **Type 1**: Most complex, national resources

## Integration with fire-behavior

NIFC data is essential for wildfire risk assessments:

1. **Active Fire Detection**: Identifies nearby active fires
2. **Proximity Alerts**: Warns when fires are within specified radius
3. **Status Tracking**: Monitors fire growth and containment progress
4. **Evacuation Awareness**: Provides evacuation status and road closures
5. **Resource Information**: Shows firefighting resources deployed

See [Fire Behavior Integration Guide](docs/fire_behavior_integration.md) for detailed integration steps.

## Common Use Cases

### Emergency Awareness
```
Query: "Are there any active fires near Boulder, Colorado?"

Response includes:
- All fires within specified radius
- Distance and bearing to each fire
- Size, containment, and growth trend
- Evacuation status
- Air quality impacts
```

### Property Risk Assessment
```
Query: "What's the status of the fire threatening Yosemite?"

Response includes:
- Current fire size and containment
- Perimeter map data
- Structures threatened/destroyed
- Firefighting resources assigned
- Expected containment date
```

### Historical Analysis
```
Query: "Show me major California wildfires from the last 5 years"

Response includes:
- List of fires meeting criteria
- Total acres burned
- Causes and patterns
- Comparison to historical averages
```

## Troubleshooting

### No Fires Found

**Possible Reasons:**
- No active fires in the queried area (good news!)
- Search radius too small
- State abbreviation incorrect
- Filters too restrictive (min_size_acres too high)

**Solutions:**
- Increase search radius
- Check state code (use "CA" not "California")
- Remove or lower filters
- Try querying without filters first

### Stale Data

NIFC data updates vary by source:
- **Active fire locations**: Updated every 15-30 minutes
- **Perimeter data**: Updated daily (morning and evening)
- **InciWeb narratives**: Updated 1-2 times daily

Check the `last_update` field in responses to verify data currency.

### Missing Perimeter Data

Not all fires have perimeter data:
- Very small fires (< 100 acres) often lack perimeters
- Newly discovered fires may not have initial mapping
- Remote fires may have delayed perimeter mapping

Use `incident_point` location as fallback.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Run in development mode with auto-reload
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

## Project Structure

```
nifc-mcp/
├── src/
│   ├── index.js           # MCP server entry point
│   ├── tools/             # MCP tool implementations
│   ├── api/               # API client modules
│   ├── schemas/           # Data validation schemas
│   └── utils/             # Helper functions
├── docs/
│   ├── architecture.md    # System architecture
│   ├── implementation_plan.md
│   ├── data_schema.md     # Schema mapping details
│   └── api_endpoints.md   # External API documentation
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── package.json
├── CONTRIBUTING.md
└── README.md
```

## Contributing

We welcome contributions! Whether it's bug fixes, new features, documentation improvements, or examples, your help is appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

Apache 2.0 - See LICENSE file for details

## Documentation

- [Architecture](docs/architecture.md) - System design and components
- [Data Schema](docs/data_schema.md) - Schema mapping and transformations
- [API Endpoints](docs/api_endpoints.md) - External API documentation
- [Implementation Plan](docs/implementation_plan.md) - Development roadmap
- [Fire Behavior Integration](docs/fire_behavior_integration.md) - Integration guide

## Related Projects

- [fire-behavior](https://github.com/EliSchillinger/fire-behavior) - Wildfire information interface
- [raws-mcp](https://github.com/tyson-swetnam/raws-mcp) - RAWS weather data MCP server
- [drought-mcp](https://github.com/tyson-swetnam/drought-mcp) - US Drought Monitor MCP server
- [Model Context Protocol](https://github.com/anthropics/model-context-protocol) - MCP specification

## Acknowledgments

- **Data Source**: National Interagency Fire Center (NIFC)
- **Partners**: USDA Forest Service, DOI, NWCG
- **Schema**: Based on fire-behavior application's `wildfire_prompt_template.json`
- **Mapping Data**: ArcGIS Online, IRWIN, InciWeb

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/tyson-swetnam/nifc-mcp/issues)
- Check the [docs/](docs/) directory for detailed documentation
- Review [troubleshooting](#troubleshooting) section above

## Status

This project is currently in the **planning and documentation phase**. The core implementation is being developed. See the [Implementation Plan](docs/implementation_plan.md) for timeline and milestones.

## Data Update Frequency

NIFC data sources update at different intervals:

- **Active Fire Points**: Every 15-30 minutes
- **Fire Perimeters**: 2-3 times daily (morning/evening flights)
- **Incident Attributes**: Updated by incident management teams (varies)
- **InciWeb**: 1-2 times daily during active incidents
- **Situation Reports**: Daily (morning)

The MCP server caches data appropriately based on update frequency (5-15 minute TTL for active data).
