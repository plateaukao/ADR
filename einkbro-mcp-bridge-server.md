# EinkBro - MCP Bridge HTTP Server

## Problem

There was no way for external tools (like Claude Code via MCP) to interact with EinkBro's browser capabilities programmatically — fetching pages, searching, or reading the current page content.

## Root Cause

EinkBro lacked any external API surface. All browser functionality was internal to the Android app with no IPC or HTTP interface.

## Solution

Added a NanoHTTPD-based local HTTP server (`McpBridgeServer`) that runs on port 8765 and exposes REST endpoints:

- `/status` — health check
- `/fetch?url=...` — load a URL in a temporary WebView, wait for SPA content to stabilize, extract with Readability.js
- `/search?q=...` — perform a DuckDuckGo search via WebView and parse results
- `/current` — extract content from the active browser WebView

The server starts in `BrowserActivity.onCreate()` and stops in `onDestroy()`. A `BrowserBridge` interface provides access to the active WebView. An `.mcp.json` config file was added to connect the external MCP Python tool to the server.

## Key Files

- `app/src/main/java/info/plateaukao/einkbro/mcp/McpBridgeServer.kt` — HTTP server with all endpoints
- `app/src/main/java/info/plateaukao/einkbro/activity/BrowserActivity.kt` — server lifecycle management
- `app/build.gradle.kts` / `gradle/libs.versions.toml` — NanoHTTPD dependency (v2.3.1)
- `.mcp.json` — MCP tool configuration

## Lessons Learned

- NanoHTTPD is thread-per-connection, but all WebView work must go through the main thread Handler, creating a natural serialization bottleneck.
- `runBlocking` inside `serve()` blocks NanoHTTPD threads; concurrent `/current` calls share the same WebView and could race.
- Temporary WebViews for `/fetch` and `/search` avoid interfering with the user's browsing session.
