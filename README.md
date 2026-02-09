# MultiversX MCP Server

The official **Model Context Protocol (MCP)** server for the MultiversX Blockchain. This server enables AI Agents (Claude, Gemini, etc.) to securely interact with the blockchain and allows products to be indexed by Google Shopping via specific feeds.

## 🚀 Features

- **14 Comprehensive Tools**: Cover everything from account queries to batch transfers and token issuance.
- **Relayed V3 Support**: Native support for gas-sponsored transactions.
- **Modular Architecture**: Easy to extend or integrate into custom agents.
- **Dual Mode**: Runs via Stdio (for desktop agents) or HTTP (for web services/Google Shopping feeds).
- **UCP Compliant**: Implements Universal Commerce Protocol for Agentic Commerce discovery.

## Quick Start

```bash
git clone https://github.com/sasurobert/multiversx-mcp-server.git
cd multiversx-mcp-server
chmod +x setup.sh && ./setup.sh
```

The setup script installs dependencies, creates a default `.env`, builds the project, and runs tests.

### Prerequisites

| Tool | Version | Required |
|------|---------|----------|
| Node.js | v18+ | Yes |
| npm | v9+ | Yes |

### Configuration

Create a `.env` file (or let `setup.sh` create one from `.env.example`):
```env
MVX_NETWORK=devnet
MVX_SIGNING_MODE=signed
MVX_WALLET_PEM=./wallets/my-wallet.pem
# OR for multi-shard Relayed V3 support:
MVX_WALLET_DIR=./wallets/
```

Configure Registry Addresses in `src/config.json`:
```json
{
  "registry_config": {
    "identity": "erd1...",
    "reputation": "erd1...",
    "validation": "erd1..."
  }
}
```

### 3. Usage
- **MCP Stdio**: Add to your MCP client config (e.g., `claude_desktop_config.json`).
- **HTTP Mode**: Run `npm start http` to enable web-native features:
  - **UCP Manifest**: `/.well-known/ucp` (Standard Discovery)
  - **Google Shopping Feed**: `/feed.json`
  - **ACP Products**: `/.well-known/acp/products.json`

## 🧩 UCP Discovery & Usage

This server is **UCP-compliant**. To allow AI agents to discover this connector:
1. Deploy the server to a public URL (e.g., `https://agent-payments.example.com`).
2. Ensure it is running in **HTTP Mode**.
3. Point ucp-compatible agents to `https://[your-domain]/.well-known/ucp`.

The manifest links UCP capabilities (like `dev.ucp.payment.process`) directly to our MCP tools.


## 🛠 Available Tools

| Category | Tools |
| --- | --- |
| **Account** | `get-balance`, `query-account` |
| **Transfers** | `send-egld`, `send-tokens`, `send-egld-to-multiple`, `send-tokens-to-multiple` |
| **Tokens** | `issue-fungible-token`, `issue-nft-collection`, `issue-sft-collection`, `create-nft` |
| **Advanced** | `create-relayed-v3`, `track-transaction`, `search-products` |

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design and data flow.
- [API Reference](docs/API_REFERENCE.md) - Detailed tool specifications and examples.
- [Integration Guide](docs/INTEGRATION_GUIDE.md) - Setup for Claude Desktop and custom clients.
- [RelayedV3 Spec](docs/specs/RELAYED_V3.md) - Technical deep-dive into gas-sponsored transactions.
- [E2E Testing Guide](docs/E2E_GUIDE.md) - How to run and verify the test suite.

## 🧪 Testing
```bash
# Run unit tests
npm test

# Run E2E tests (Playwright)
npx playwright test src/__tests__/e2e
```
