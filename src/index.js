#!/usr/bin/env node

/**
 * NIFC MCP Server Entry Point
 * Provides access to National Interagency Fire Center wildfire data
 * through the Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import logger from './utils/logger.js';
import config from './utils/config.js';

// Import tool implementations (to be created in next phase)
// For now, we'll create stub implementations
import { createToolStubs } from './tools/stubs.js';

/**
 * NIFC MCP Server
 */
class NIFCMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'nifc-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.tools = new Map();

    logger.info('NIFC MCP Server initializing', {
      version: '1.0.0',
      nodeEnv: config.nodeEnv,
      logLevel: config.logLevel,
    });

    this.setupHandlers();
    this.registerTools();
  }

  /**
   * Setup MCP request handlers
   */
  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Listing available tools');

      const toolsList = Array.from(this.tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: tool.inputSchema || {},
          required: tool.required || [],
        },
      }));

      return {
        tools: toolsList,
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.info(`Tool call requested: ${name}`, { args });

      const tool = this.tools.get(name);

      if (!tool) {
        const error = `Unknown tool: ${name}`;
        logger.error(error);
        throw new Error(error);
      }

      try {
        // Execute the tool
        const result = await tool.execute(args || {});

        // Return MCP-formatted response
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.logError(error, {
          tool: name,
          args,
        });

        // Return error in MCP format
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: {
                    message: error.message,
                    type: error.name || 'Error',
                  },
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    });

    logger.debug('Request handlers configured');
  }

  /**
   * Register all MCP tools
   */
  registerTools() {
    logger.info('Registering MCP tools');

    // Create tool stubs (will be replaced with real implementations)
    const tools = createToolStubs();

    for (const tool of tools) {
      this.tools.set(tool.name, tool);
      logger.debug(`Registered tool: ${tool.name}`);
    }

    logger.info(`Registered ${this.tools.size} tools`, {
      tools: Array.from(this.tools.keys()),
    });
  }

  /**
   * Start the MCP server
   */
  async start() {
    try {
      logger.info('Starting NIFC MCP Server');

      // Create stdio transport
      const transport = new StdioServerTransport();

      // Connect server to transport
      await this.server.connect(transport);

      logger.info('NIFC MCP Server started successfully', {
        transport: 'stdio',
        tools: this.tools.size,
      });

      // Log server ready message
      logger.info('Server ready to accept requests');
    } catch (error) {
      logger.error('Failed to start server', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down NIFC MCP Server');

    try {
      await this.server.close();
      logger.info('Server closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error.message,
      });
      process.exit(1);
    }
  }
}

/**
 * Handle process signals for graceful shutdown
 */
function setupSignalHandlers(server) {
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await server.shutdown();
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await server.shutdown();
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
      reason,
      promise,
    });
    process.exit(1);
  });
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Create server instance
    const server = new NIFCMCPServer();

    // Setup signal handlers
    setupSignalHandlers(server);

    // Start the server
    await server.start();
  } catch (error) {
    logger.error('Fatal error during startup', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Start the server
main();

export default NIFCMCPServer;
