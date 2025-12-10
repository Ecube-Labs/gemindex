# GemIndex

A file search and management platform powered by the Gemini File Search API.

## Project Structure

```
gemindex/
├── apps/
│   ├── dashboard/          # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/           # shadcn/ui components
│   │   │   │   ├── stores/       # Store management UI
│   │   │   │   ├── files/        # File management UI
│   │   │   │   └── search/       # Search UI
│   │   │   ├── hooks/            # React Query hooks
│   │   │   ├── lib/              # API client, utilities
│   │   │   └── types/            # TypeScript types
│   │   └── ...
│   └── api/                # Node.js backend
│       ├── src/
│       │   ├── lib/
│       │   │   └── gemini.ts     # Gemini REST API client
│       │   └── routes/
│       │       ├── stores.ts     # Store CRUD operations
│       │       ├── files.ts      # File upload/delete
│       │       ├── search.ts     # Semantic search
│       │       └── operations.ts # Operation status
│       └── ...
├── .husky/                 # Git hooks (pre-commit, commit-msg)
├── package.json            # Yarn Berry workspaces
└── tsconfig.json           # Shared TypeScript configuration
```

## Tech Stack

- **Monorepo**: Yarn Berry (v4) workspaces, nodeLinker: node-modules
- **Frontend**: React 18, Vite 6, TypeScript, TailwindCSS, shadcn/ui, React Query
- **Backend**: Node.js, Koa.js 3, TypeScript
- **Linting**: ESLint 8, Prettier
- **Git Hooks**: Husky 9, lint-staged, commitlint (conventional commits)

## API Endpoints

| Method | Endpoint                            | Description                         |
| ------ | ----------------------------------- | ----------------------------------- |
| GET    | `/api/health`                       | Health check                        |
| GET    | `/api/stores`                       | List all stores                     |
| POST   | `/api/stores`                       | Create a new store                  |
| GET    | `/api/stores/:name`                 | Get store details                   |
| DELETE | `/api/stores/:name`                 | Delete a store                      |
| GET    | `/api/stores/:name/files`           | List files in a store               |
| POST   | `/api/stores/:name/files`           | Upload a file (multipart/form-data) |
| DELETE | `/api/stores/:name/files/:fileName` | Delete a file                       |
| POST   | `/api/search`                       | Perform semantic search             |
| GET    | `/api/operations/:name`             | Get operation status                |

## Development Commands

```bash
# Install dependencies
yarn install

# Run all development servers
yarn dev

# Run individual apps
yarn workspace @gemindex/dashboard dev  # localhost:3000
yarn workspace @gemindex/api dev         # localhost:4000

# Build
yarn build

# Lint and format
yarn lint
yarn lint:fix
yarn format
```

## Environment Variables

```bash
# apps/api/.env
PORT=4000
GEMINI_API_KEY=your_api_key
```

## Gemini File Search API

- API Base: `https://generativelanguage.googleapis.com/v1beta`
- Store name format: `fileSearchStores/{id}`
- File upload: Uses resumable upload (`X-Goog-Upload-Protocol: resumable`)
- Search model: `gemini-2.5-flash` (default)

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code formatting
- `refactor:` Code refactoring
- `test:` Add or update tests
- `chore:` Build process or tooling changes

## Key Files

- `apps/api/src/lib/gemini.ts`: Gemini REST API client (stores/files/search)
- `apps/dashboard/src/lib/api.ts`: Frontend API client
- `apps/dashboard/src/hooks/`: React Query hooks (use-stores, use-files, use-search)
