import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getDb } from "./db.js";
import { registerMcp } from "./mcp-server.js";
import { startHttpServer } from "./http-server.js";
import { events } from "./events.js";

const mode = process.argv[2] as "stdio" | "http" | undefined;

async function main(): Promise<void> {
  // Initialize database
  getDb();

  if (mode === "stdio" || !mode) {
    const mcpServer = new McpServer({
      name: "hiveops",
      version: "1.0.0",
    });
    registerMcp(mcpServer, events);
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("[HiveOps] MCP stdio server connected");
  }

  if (mode === "http" || !mode) {
    const port = parseInt(process.env.PORT || "4567");
    startHttpServer(port, events);
    console.error(`[HiveOps] HTTP server on http://localhost:${port}`);
  }
}

main().catch((err) => {
  console.error("[HiveOps] Fatal:", err);
  process.exit(1);
});
