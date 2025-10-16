# Source Code Directory

This directory contains the NIFC MCP server implementation.

## Structure

### `/tools/`
MCP tool implementations. Each tool is a separate module that handles a specific wildfire data query:
- `get_active_fires.js` - Query currently active wildfires
- `get_fire_by_id.js` - Get detailed information about a specific fire
- `search_fires_by_location.js` - Find fires near coordinates
- `get_fire_history.js` - Retrieve historical fire data

### `/api/`
External API client modules for fetching data from various sources:
- `nifc_client.js` - NIFC ArcGIS REST API client
- `irwin_client.js` - IRWIN incident data client
- `inciweb_client.js` - InciWeb narrative scraper
- `errors.js` - Custom error classes for API operations

### `/schemas/`
Data validation and transformation modules:
- `validators.js` - Zod schemas for input validation
- `transformers.js` - Transform NIFC data to fire-behavior schema

### `/utils/`
Utility functions and helpers:
- `logger.js` - Winston logging configuration
- `config.js` - Environment configuration loader
- `cache.js` - In-memory caching layer
- `geospatial.js` - Geospatial calculations using @turf/turf
- `formatters.js` - Data formatting utilities
- `geography.js` - State/county reference data

## Entry Point

`index.js` - MCP server entry point that initializes the server and registers all tools
