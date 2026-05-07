# Optional AI Plugin

## Status

Accepted

## Context

PG Compass is designed to be fast, minimal, and privacy-focused. Users requested an optional AI assistant that can translate natural language requests into SQL while honoring the app’s read-only safeguards. Any AI feature must remain opt-in, avoid background network traffic when disabled, and integrate with a Model Context Protocol (MCP) server for schema awareness.

## Decision

1. **Optional BYOAI feature flag:** The assistant is disabled by default and only activates when users explicitly enable it in Settings.
2. **Vercel AI SDK for providers:** Use the Vercel AI SDK core (`ai`) and UI (`@ai-sdk/react`) to standardize provider integrations (OpenAI, Anthropic, Gemini, OpenRouter, and local Ollama via OpenAI-compatible endpoints).
3. **MCP schema context layer:** Add an MCP client that can connect to a PostgreSQL MCP server over stdio and fall back to local schema introspection when MCP is unavailable.
4. **Safety-first execution:** AI-generated SQL is always shown to the user before execution. Read-only execution is the default, with explicit user override required for writes.

## Rationale

- Keeps PG Compass lightweight and privacy-respecting by default.
- Avoids provider lock-in by using the Vercel AI SDK abstraction.
- MCP integration ensures schema context stays standardized and pluggable for future tooling.
- Explicit user review preserves trust and aligns with existing read-only safeguards.

## Consequences

- Adds new settings UI and secure credential storage for AI provider configuration.
- Introduces additional optional dependencies for AI and MCP support.
- Requires ongoing testing coverage for AI IPC flows and execution safeguards.
