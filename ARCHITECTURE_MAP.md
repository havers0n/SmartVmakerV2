# Scrimspec Architecture Map

## Project Structure

```
scrimspec/
├── apps/
│   └── dashboard/              # Next.js UI application
├── packages/
│   ├── api-client/             # Shared API client for frontend/backend communication
│   ├── db/                     # Drizzle ORM layer for database interactions
│   └── shared-types/           # Shared TypeScript types across the monorepo
├── tools/
│   └── yt-orchestrator-python/ # Python tools for YouTube data collection and analysis
├── workers/                    # Background processing workers
├── HelloWhoAreYou/             # HWAR (HelloWhoAreYou) application
│   ├── client/                 # Vite-based frontend
│   ├── server/                 # Express-based backend
│   └── shared/                 # Shared schema definitions
└── supabase/                   # Database schema and migrations
```

## Core Packages and Responsibilities

### `apps/dashboard`
**Technology**: Next.js 14, React, TypeScript, Tailwind CSS
**Responsibilities**:
- User interface for video analysis and generation
- Dashboard for monitoring content performance
- HWAR-specific UI components (Create, Factory, Library)
- Real-time updates and data visualization

### `packages/api-client`
**Technology**: TypeScript
**Responsibilities**:
- Unified API client for all frontend/backend communication
- Type-safe API method definitions
- Consistent error handling and response formatting

### `packages/db`
**Technology**: Drizzle ORM, PostgreSQL/Supabase
**Responsibilities**:
- Database schema management
- Type-safe database queries
- Migration handling
- Connection pooling and performance optimization

### `packages/shared-types`
**Technology**: TypeScript, Zod
**Responsibilities**:
- Centralized type definitions
- Schema validation
- Shared interfaces between packages

### `HelloWhoAreYou/server`
**Technology**: Express.js, TypeScript
**Responsibilities**:
- Core business logic for HWAR features
- API endpoints for projects, scenes, assets
- Integration with AI providers (OpenAI, Gemini, Hailuo)
- Job queue management and background processing

### `tools/yt-orchestrator-python`
**Technology**: Python
**Responsibilities**:
- YouTube data collection and video analytics
- Large-scale data processing
- Integration with Google APIs

### `workers`
**Technology**: TypeScript
**Responsibilities**:
- Background task processing
- Video analysis and generation jobs
- Queue management

## Applied Architectural Patterns

### Feature-Sliced Design (FSD)
The project follows Feature-Sliced Design principles:
- **Pages**: High-level screens and routes
- **Features**: Business-capable slices (hwar-create, hwar-factory, hwar-library)
- **Entities**: Business domain objects (projects, scenes, assets)
- **Shared**: Reusable utilities, components, and types

### Layered Architecture
```
Frontend (Next.js) → API Client → Backend (Express) → Database (Drizzle ORM) → PostgreSQL/Supabase
```

### Microservices Pattern
- **Dashboard Service**: UI and user interactions
- **Orchestrator Service**: Business logic and AI integration
- **Analysis Workers**: Background processing
- **Python Tools**: Specialized data processing

### Event-Driven Architecture
- Job queues for async processing
- Webhook callbacks from AI providers
- Real-time updates through Supabase

## Key Dependencies and Integrations

### Internal Dependencies
- `@scrimspec/db` → `@scrimspec/shared-types`
- `@project/api-client` → `@scrimspec/shared-types`
- `apps/dashboard` → `@project/api-client`, `@scrimspec/db`, `@scrimspec/shared-types`
- `HelloWhoAreYou/server` → `@shared/schema` (internal)

### External Dependencies
- **Frontend**: React, Next.js, Tailwind CSS, Radix UI, Recharts
- **Backend**: Express.js, Drizzle ORM, Supabase
- **AI Providers**: OpenAI, Gemini, Hailuo
- **Database**: PostgreSQL/Supabase
- **Infrastructure**: TurboRepo, pnpm, TypeScript

## Data Flow

1. **User Request** → Next.js Dashboard
2. **API Call** → Express Backend via API Client
3. **Business Logic** → Database Operations (Drizzle ORM)
4. **AI Processing** → External Provider APIs (async)
5. **Webhook Callback** → Express Backend
6. **Database Update** → Result Storage
7. **Frontend Polling** → Status Updates

## Security Implementation

- **CORS**: Configured allowlist for cross-origin requests
- **Authentication**: Supabase authentication integration
- **Input Validation**: Zod schema validation
- **Rate Limiting**: API request throttling
- **Secure Headers**: Helmet.js for HTTP security headers

## Current Code Status

### Strengths
1. **Type Safety**: Comprehensive TypeScript coverage with shared types
2. **Modular Architecture**: Well-organized monorepo with clear package boundaries
3. **Database-First Approach**: Types generated directly from database schema
4. **Async Processing**: Robust job queue system for background tasks
5. **Modern Stack**: Current versions of Next.js, React, and related technologies

### Technical Debt
1. **Orchestrator Package**: Missing from packages directory but present in root
2. **Inconsistent Naming**: Some packages use `@scrimspec` namespace, others don't
3. **Duplicate Functionality**: Similar features exist in both dashboard and HWAR apps
4. **Documentation Gaps**: Limited inline documentation in some modules

### Risks
1. **AI Provider Dependencies**: Reliance on external APIs with potential rate limits
2. **Database Complexity**: Large schema with many tables and relationships
3. **Background Processing**: Complex async workflows with potential failure points
4. **Performance**: Potential bottlenecks in video processing and analysis

## API Versioning

Currently, the project uses a single API version with endpoint-based organization:
- `/api/projects/*` - Project management
- `/api/harvests/*` - YouTube data harvesting
- `/api/analysis/*` - Video analysis
- `/api/workers/*` - Worker management
- `/api/presets/*` - Content presets
- `/api/characters/*` - Character definitions

## TODO/FIXME Items

1. **Orchestrator Package**: Resolve missing package in packages directory
2. **API Consistency**: Standardize API client usage across frontend/backend
3. **Documentation**: Add comprehensive documentation for all modules
4. **Testing**: Implement comprehensive test coverage
5. **Error Handling**: Standardize error responses across all endpoints

## Testing and Documentation

### Testing Status
- Limited automated testing infrastructure
- Manual testing through dashboard UI
- End-to-end tests in dashboard app

### Documentation
- README files in each package
- Inline code comments
- Schema definitions in database files
- API endpoint documentation in route files

## Health Report

### Overall Health: ⚠️ Moderate

**Positives**:
- Strong architectural foundation with clear separation of concerns
- Modern technology stack with good community support
- Comprehensive type safety with TypeScript
- Well-organized monorepo structure

**Areas for Improvement**:
- Inconsistent package structure and naming
- Missing orchestrator package in expected location
- Limited automated testing coverage
- Documentation gaps in some modules
- Potential performance bottlenecks in video processing workflows

**Recommendations**:
1. Standardize package naming and structure
2. Implement comprehensive testing strategy
3. Improve documentation coverage
4. Optimize database queries and indexing
5. Add monitoring and observability tools