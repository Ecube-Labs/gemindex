# GemIndex

A file search and management platform powered by the Gemini File Search API.

## Tech Stack

- **Monorepo**: Yarn Berry (v4) workspaces
- **Frontend**: React, Vite, TypeScript, TailwindCSS, shadcn/ui, React Query
- **Backend**: Node.js, Koa.js, TypeScript, Axios
- **Linting**: ESLint, Prettier
- **Git Hooks**: Husky, lint-staged, commitlint

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn Berry (included in the project)
- Google AI API Key (obtain from [Google AI Studio](https://aistudio.google.com/apikey))

### Installation

```bash
# Clone the repository
git clone https://github.com/Ecube-Labs/gemindex.git
cd gemindex

# Install dependencies
yarn install
```

### Environment Variables

```bash
# Copy the example environment file
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` to set your API key:

```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key_here
```

### Running the Development Server

```bash
# Run all development servers (dashboard + api)
yarn dev

# Or run individually
yarn workspace @gemindex/api dev      # API: http://localhost:4000
yarn workspace @gemindex/dashboard dev # Dashboard: http://localhost:3000
```

## Project Structure

```
gemindex/
├── apps/
│   ├── dashboard/          # React frontend
│   │   ├── src/
│   │   │   ├── components/ # UI components
│   │   │   ├── hooks/      # React Query hooks
│   │   │   ├── lib/        # Utilities, API client
│   │   │   └── types/      # TypeScript types
│   │   └── ...
│   └── api/                # Koa.js backend
│       ├── src/
│       │   └── index.ts    # Server entry point
│       └── ...
├── .husky/                 # Git hooks
├── package.json            # Root workspace configuration
└── tsconfig.json           # Shared TypeScript configuration
```

## Scripts

```bash
# Development
yarn dev                    # Run all development servers
yarn workspace @gemindex/dashboard dev  # Run dashboard only
yarn workspace @gemindex/api dev        # Run API only

# Build
yarn build                  # Build all packages

# Lint & Format
yarn lint                   # Run ESLint
yarn lint:fix               # Auto-fix ESLint issues
yarn format                 # Run Prettier formatting
yarn format:check           # Check Prettier formatting
```

## Docker

### Build Images

```bash
# Build from the root directory
docker build -f apps/api/Dockerfile -t gemindex-api .
docker build -f apps/dashboard/Dockerfile -t gemindex-dashboard .
```

### Run Containers

```bash
# API server
docker run -d \
  -p 4000:4000 \
  -e GEMINI_API_KEY=your_api_key \
  --name gemindex-api \
  gemindex-api

# Dashboard (default API URL: http://api:4000)
docker run -d \
  -p 80:80 \
  --name gemindex-dashboard \
  gemindex-dashboard

# Dashboard with custom API URL
docker run -d \
  -p 80:80 \
  -e API_URL=http://localhost:4000 \
  --name gemindex-dashboard \
  gemindex-dashboard
# or use `host.docker.internal` on Windows/Mac
docker run -d \
  -p 80:80 \
  -e API_URL=http://host.docker.internal:4000 \
  --name gemindex-dashboard \
  gemindex-dashboard
```

### Environment Variables

| App       | Variable            | Default           | Description             |
| --------- | ------------------- | ----------------- | ----------------------- |
| api       | `PORT`              | `4000`            | Server port             |
| api       | `GEMINI_API_KEY`    | -                 | Google AI API key       |
| api       | `MCP_AUTH_ENABLED`  | `false`           | Enable MCP Basic Auth   |
| api       | `MCP_AUTH_USERNAME` | -                 | MCP Basic Auth username |
| api       | `MCP_AUTH_PASSWORD` | -                 | MCP Basic Auth password |
| dashboard | `API_URL`           | `http://api:4000` | Backend API URL         |

## Features

### File Search Store Management

- Create new stores
- List all stores
- Delete stores

### File Management

- Upload files (PDF, TXT, MD, etc.)
- List files in a store
- Delete files

### Semantic Search

- Query documents using natural language
- Get answers with citation information

## API Endpoints

| Method | Endpoint                            | Description             |
| ------ | ----------------------------------- | ----------------------- |
| GET    | `/api/health`                       | Health check            |
| GET    | `/api/stores`                       | List all stores         |
| POST   | `/api/stores`                       | Create a new store      |
| DELETE | `/api/stores/:name`                 | Delete a store          |
| GET    | `/api/stores/:name/files`           | List files in a store   |
| POST   | `/api/stores/:name/files`           | Upload a file           |
| DELETE | `/api/stores/:name/files/:fileName` | Delete a file           |
| POST   | `/api/search`                       | Perform semantic search |
| POST   | `/mcp`                              | MCP Server endpoint     |

## MCP Server

GemIndex provides a Remote MCP (Model Context Protocol) Server that allows AI clients like Claude Desktop and Claude Code to access Gemini File Search functionality.

### MCP Tools (Read-Only)

| Tool            | Description                  | Parameters                                                                          |
| --------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `list_stores`   | List all file search stores  | -                                                                                   |
| `get_store`     | Get store details            | `name`                                                                              |
| `list_files`    | List files in a store        | `storeName`                                                                         |
| `search`        | Semantic search with Gemini  | `storeName`, `query`, `systemPrompt?`, `model?`, `temperature?`, `maxOutputTokens?` |
| `get_operation` | Check async operation status | `operationName`                                                                     |

### Client Configuration

**Claude Code (`.mcp.json`)**:

```json
{
  "mcpServers": {
    "gemindex": {
      "type": "url",
      "url": "http://localhost:4000/mcp"
    }
  }
}
```

**Claude Desktop (`claude_desktop_config.json`)**:

```json
{
  "mcpServers": {
    "gemindex": {
      "url": "http://localhost:4000/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### Authentication (Optional)

MCP Server supports optional Basic Auth via environment variables. Useful for K8s Secret injection.

| Variable            | Description         | Default |
| ------------------- | ------------------- | ------- |
| `MCP_AUTH_ENABLED`  | Enable Basic Auth   | `false` |
| `MCP_AUTH_USERNAME` | Basic Auth username | -       |
| `MCP_AUTH_PASSWORD` | Basic Auth password | -       |

**Example (with auth)**:

```bash
MCP_AUTH_ENABLED=true
MCP_AUTH_USERNAME=gemindex
MCP_AUTH_PASSWORD=your_secret_password
```

**Client with auth**:

```json
{
  "mcpServers": {
    "gemindex": {
      "type": "url",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Basic Z2VtaW5kZXg6eW91cl9zZWNyZXRfcGFzc3dvcmQ="
      }
    }
  }
}
```

### Testing MCP Server

```bash
# Initialize
curl -X POST http://localhost:4000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0.0"},"capabilities":{}},"id":1}'

# List Tools
curl -X POST http://localhost:4000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'

# Call list_stores
curl -X POST http://localhost:4000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_stores","arguments":{}},"id":3}'
```

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: Add a new feature
fix: Fix a bug
docs: Update documentation
style: Code formatting (no functional changes)
refactor: Code refactoring
test: Add or update tests
chore: Build process or tooling changes
```

## License

MIT License
