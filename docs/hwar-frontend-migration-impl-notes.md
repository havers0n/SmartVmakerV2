# HWAR Frontend Migration Implementation Notes

## Overview
This document provides detailed implementation notes for the HWAR frontend migration from the standalone HelloWhoAreYou application to the Scrimspec monorepo's Next.js dashboard.

## Copied Files

### UI Components
- **shadcn/ui Components**: All 50+ components copied from `HelloWhoAreYou/client/src/components/ui/` to `apps/dashboard/src/components/ui/`
  - Includes: button, card, dialog, form, input, select, toast, tooltip, etc.
  - Custom components: status-badge, empty-state, sidebar

### Layout Components
- **HWAR Layout**: Copied from `HelloWhoAreYou/client/src/components/layout/` to `apps/dashboard/src/components/hwar/layout/`
  - `app-header.tsx` - Top navigation bar
  - `factory-sidebar.tsx` - Factory section navigation
  - `library-sidebar.tsx` - Library section navigation

### Utility Files
- **Hooks**: Copied from `HelloWhoAreYou/client/src/hooks/` to `apps/dashboard/src/hooks/`
  - `use-toast.ts` - Toast notification system
  - `use-mobile.tsx` - Mobile detection hook
- **Lib Utilities**: Copied from `HelloWhoAreYou/client/src/lib/` to `apps/dashboard/src/lib/`
  - `utils.ts` - Contains `cn()` helper function
  - `api.ts` - API request helper (not currently used, using @project/api-client instead)
  - `queryClient.ts` - TanStack Query client configuration (not currently used, using dashboard provider instead)

### Page Files
- **Create Section**: Copied from `HelloWhoAreYou/client/src/pages/create/` to `apps/dashboard/app/hwar/create/`
  - `index.tsx` → `page.tsx` - Projects list
  - `new-project.tsx` → `new/page.tsx` - New project wizard
  - `project-detail.tsx` → `[id]/page.tsx` - Project detail view
- **Home Page**: Copied from `HelloWhoAreYou/client/src/pages/home.tsx` to `apps/dashboard/app/hwar/page.tsx`

## Updated Imports

### Router Conversion
- **Wouter Imports**: Replaced `import { useLocation } from "wouter"` with Next.js equivalents
- **Navigation Hooks**: 
  - `useLocation()` → `useRouter()` and `usePathname()` from `next/navigation`
  - `setLocation(path)` → `router.push(path)`
- **Link Components**: 
  - `<Link>` from `wouter` → `<Link>` from `next/link`
  - Updated all href paths to include `/hwar/` prefix

### Component Imports
- **UI Components**: Updated import paths to use dashboard aliases
  - Before: `import { Button } from "@/components/ui/button"`
  - After: `import { Button } from "@/components/ui/button"` (same, but now points to dashboard)
- **Layout Components**: Updated import paths for sidebar components
  - Before: Relative paths in HelloWhoAreYou
  - After: `import { FactorySidebar } from "@/components/hwar/layout/factory-sidebar"`

## Added API Client Methods

Extended `@project/api-client` with methods needed by the Create pages:

```typescript
hwar: {
  // Existing methods
  createScenario: (body: unknown) => fetcher(`/hwar/scenarios`, { ... }),
  listHarvests: () => fetcher(`/hwar/harvests`),
  
  // Newly added methods
  listProjects: () => fetcher(`/hwar/projects`),
  getProject: (id: string) => fetcher(`/hwar/projects/${id}`),
  createProject: (body: unknown) => fetcher(`/hwar/projects`, { ... }),
  updateProject: (id: string, body: unknown) => fetcher(`/hwar/projects/${id}`, { ... }),
  generateScenarios: (projectId: string, body: unknown) => fetcher(`/hwar/projects/${projectId}/scenarios/generate`, { ... })
}
```

## Temporary Placeholders

### API Implementation
- **Mock Data**: Current implementation uses mock data instead of actual API calls
- **TODO Comments**: Added TODO comments where actual API integration is needed
- **Error Handling**: Basic error handling implemented but needs refinement

### Backend Endpoints
- **Missing Endpoints**: Backend API routes need to be implemented for all new methods
- **Placeholder Responses**: Current API client methods return mock responses

### Database Schema
- **Type Definitions**: Using temporary TypeScript types instead of actual database schema types
- **Schema Alignment**: Need to align with `@scrimspec/db` schema when ready

## Path Alias Issues

During implementation, we encountered issues with path aliases not resolving correctly:
- **Problem**: TypeScript could not resolve `@/components/*` imports
- **Solution**: Used relative imports as workaround
- **Future Work**: Need to fix tsconfig path mappings for proper alias resolution

## Feature Flag Implementation

Added environment-based feature flagging:
- **Environment Variable**: `ENABLE_HWAR_NEW_UI=true` in `.env.example`
- **Conditional Rendering**: HWAR link in main navigation only shows when flag is enabled
- **Default Behavior**: Feature enabled by default in example config

## Testing

### E2E Smoke Test
- **Test File**: `apps/dashboard/tests/hwar-smoke.spec.ts`
- **Test Coverage**: 
  - HWAR home page loads
  - Navigation to create section works
  - Basic interaction testing

### Manual Testing
- **Create Flow**: Verified new project creation wizard
- **Navigation**: Tested all navigation paths within HWAR section
- **Responsive Design**: Basic mobile responsiveness verified

## Known Issues

1. **Path Alias Resolution**: TypeScript path aliases not working correctly, using relative imports
2. **API Integration**: All API calls currently use mock data
3. **Type Safety**: Using temporary types instead of actual database schema types
4. **Backend Implementation**: Missing backend API route handlers for new endpoints

## Next Steps

1. **Factory Section Migration**: Migrate all factory pages and components
2. **Library Section Migration**: Migrate all library pages and components
3. **Backend Implementation**: Implement actual API endpoints for all methods
4. **Database Schema Alignment**: Align with `@scrimspec/db` schema
5. **Path Alias Fix**: Resolve TypeScript path alias issues
6. **Comprehensive Testing**: Add more extensive E2E and unit tests
7. **Documentation**: Create user guides and developer documentation