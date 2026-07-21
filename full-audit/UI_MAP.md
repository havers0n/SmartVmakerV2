# UI Map - Scrimspec Video Generation System

## Overview

Scrimspec is a comprehensive video generation platform built with Next.js 14 (App Router) that combines YouTube video analysis with AI-powered video generation using the AES (Attention-Emotion-Solution) framework.

## Navigation Structure

### Main Entry Points

1. **Home Dashboard** (`/`)
   - Protected route requiring authentication
   - Quick access to Ingest and Analysis features
   - System overview cards

2. **HWAR Hub** (`/hwar`)
   - Main hub for video generation factory
   - Three primary sections: Create, Factory, Library

### HWAR Create Flow

**Purpose**: AI-powered video project creation with scenario generation and keyframe production

#### 1. Projects List (`/hwar/create`)
- **Data Source**: `/api/actions` (projects.list)
- **Features**:
  - Grid of existing projects (responsive: 1/2/3 columns)
  - Status badges (pending, processing, completed)
  - Empty state with CTA
  - Loading skeletons
- **Actions**:
  - "New Project" → `/hwar/create/new`
  - Click project card → `/hwar/create/[project_id]`

#### 2. New Project Wizard (`/hwar/create/new`)

**3-Step Wizard with Progress Indicator**

**Step 1: Project Details**
- Project title (text input)
- Aspect ratio selector (16:9, 9:16, 4:3, 3:4)
- Language selector (none, ru, en, he, es)
- Text Generation Model selector (ModelSelector component)
- Image Generation Model selector (ModelSelector component)
- Visual aspect ratio preview

**Step 2: Content Source (Tabs)**
- **Prompt Tab**: Free-form text description
  - Textarea with placeholder and tips
  - Hint: Include AES structure
- **Presets Tab**: Story templates from library
  - Data source: `storyTemplates.list` action
  - Selectable card grid
  - Shows: name, description, duration, tags
  - Empty state → "Go to Library"
- **Trends Tab**: YouTube trend-based generation
  - Data source: `/api/analytics/trends`
  - Selectable card list
  - Shows: title, description, insights badges

**Step 3: Review & Generate**
- Summary table of all selections
- Info card about next steps (AI will generate 5 scenarios)
- "Create Project" button

**On Submit**:
- Action: `generation.startProject`
- Calls MiniMax-M2 with function calling for scenario generation
- Redirects to `/hwar/create/[project_id]`

#### 3. Project Detail (`/hwar/create/[project_id]`)

**Data Sources**:
- Project: `/api/generation/projects/[project_id]` (polls every 5s when processing)
- Assets: `/api/generation/projects/[project_id]/assets` (polls every 3s when assets processing)

**Layout Sections**:

**Header**:
- Back button to projects list
- Project title (from meta.title)
- Badge: aspect ratio
- Badge: status (pending/processing/completed)
- Badge: Generation progress (e.g., "Generating 4/10") with spinner
- Badge: "Complete" with checkmark when done

**Scenario Selection** (visible when `!hasGeneratedKeyframes`):
- Grid of 3-5 AI-generated scenario cards (1/2/3 columns)
- Each card shows:
  - Sparkles icon (colored when selected)
  - Title and description
  - AES Score (0-100)
  - Hook Strength (0-100)
  - Emotional Curve badges (first 3 emotions)
- Selected scenario: ring-2 ring-primary
- Action button: "Generate Keyframes"
  - Disabled if no scenario selected
  - Shows "Creating Jobs..." when pending

**Keyframe Preview** (visible when `hasGeneratedKeyframes`):
- Title: "Generated Keyframes"
- For each scene:
  - Card with scene metadata (phase, duration, description)
  - Two-column grid:
    - **Opening Frame**: First frame of scene
    - **Closing Frame**: Last frame of scene
  - Image loading states:
    - Completed: R2Image component displays image
    - Pending/Processing: Loader2 spinner
    - Failed: Error text

**Real-time Updates**:
- Project status polling when `status=processing`
- Asset polling when any asset is pending/processing
- Auto-select first scenario on page load

### HWAR Factory

**Purpose**: Production pipeline orchestration and monitoring

Routes:
- `/hwar/factory` - Main dashboard
- `/hwar/factory/harvests` - YouTube video harvest management
- `/hwar/factory/analysis` - Analysis queue monitoring
- `/hwar/factory/queues` - Job queue status
- `/hwar/factory/workers` - Worker health monitoring
- `/hwar/factory/batches` - Batch job management
- `/hwar/factory/analytics` - Cost tracking and analytics
- `/hwar/factory/settings` - Factory configuration

### HWAR Library

**Purpose**: Reusable asset management

Routes:
- `/hwar/library` - Library hub
- `/hwar/library/presets` - Story Templates (CRUD)
  - Data: `storyTemplates.*` actions
  - Features: Create/edit dialog with beats editor
  - Beats: phase, duration, description, emotion, contrast, intendedImpact
- `/hwar/library/characters` - Characters (CRUD)
  - Data: `characters.*` actions
  - Features: Name, description, style presets, reference images
- `/hwar/library/templates` - Video templates
- `/hwar/library/datasets` - Training datasets

## Component Architecture

### Shared Components

**UI Components** (`apps/dashboard/src/shared/components/ui/`):
- Radix UI primitives (shadcn/ui style)
- Custom components:
  - `StatusBadge` - Status display with variants
  - `EmptyState` - Empty state with icon, title, description, action
  - `R2Image` - R2 image loader with download URL generation
  - `ModelSelector` - AI model selection dropdown

**Layout Components**:
- `Sidebar` - Main navigation sidebar
- `ProtectedRoute` - Authentication wrapper

### Feature Components

**HWAR Factory** (`apps/dashboard/src/features/hwar-factory/`):
- `factory-sidebar.tsx` - Factory navigation
- `app-header.tsx` - Factory header

**HWAR Library** (`apps/dashboard/src/features/hwar-library/`):
- `library-sidebar.tsx` - Library navigation

## API Integration

### Action System

**Universal Action Runner**: `/api/actions`
- Method: POST
- Body: `{action: string, payload: object}`
- Registry of action handlers

**Client Function**: `callAction<T>(action, payload)`
- File: `apps/dashboard/src/shared/api/actions.ts`
- Returns typed result or throws error
- Used with TanStack Query

### Data Fetching Patterns

**TanStack Query**:
- Used throughout for server state management
- Polling with `refetchInterval` based on status
- Mutations with `useMutation` for actions

**Examples**:
```typescript
// Fetch projects list
const { data: projects } = useQuery({
  queryKey: ["projects"],
  queryFn: async () => listProjects()
});

// Create project
const mutation = useMutation({
  mutationFn: startGenerationProject,
  onSuccess: (result) => router.push(`/hwar/create/${result.project.id}`)
});

// Polling project status
const { data: project } = useQuery({
  queryKey: ["project", projectId],
  queryFn: async () => fetch(`/api/generation/projects/${projectId}`),
  refetchInterval: (query) => {
    return query.state.data?.status === 'processing' ? 5000 : false;
  }
});
```

## Gaps and Risks

### 🔴 High Priority

1. **No animation generation UI**
   - File: `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx`
   - Issue: Step 6 (animation generation) from sequence diagram is not implemented in UI
   - Impact: Users cannot trigger video generation after keyframes complete
   - Recommendation: Add "Generate Animation" button after all keyframes completed

2. **Missing error boundary components**
   - Impact: Unhandled errors crash entire page instead of showing graceful fallback
   - Recommendation: Implement React Error Boundaries at route level

3. **No rate limiting on frontend**
   - File: `apps/dashboard/src/shared/api/actions.ts`
   - Issue: No client-side throttling or debouncing for action calls
   - Impact: Users can spam API with repeated clicks
   - Recommendation: Implement debounce on mutations, disable buttons during pending state

4. **Hardcoded polling intervals**
   - Files: All pages with useQuery refetchInterval
   - Issue: 3-5 second polling intervals may overload database at scale
   - Recommendation: Implement WebSocket or SSE for real-time updates

5. **No loading states for initial data**
   - Files: Multiple pages
   - Issue: Flash of unstyled content on page load
   - Recommendation: Add Suspense boundaries with skeleton loaders

### 🟡 Medium Priority

6. **Inconsistent empty states**
   - Issue: Some pages use `EmptyState` component, others have inline empty UI
   - Recommendation: Standardize on `EmptyState` component everywhere

7. **No pagination on projects list**
   - File: `apps/dashboard/src/app/hwar/create/page.tsx`
   - Issue: Fetches all projects at once
   - Impact: Performance degradation with large number of projects
   - Recommendation: Implement cursor-based pagination

8. **Missing accessibility attributes**
   - Issue: Many interactive elements lack aria-labels
   - Impact: Screen reader users cannot navigate effectively
   - Recommendation: Audit and add aria-labels, roles, keyboard navigation

9. **No offline state handling**
   - Issue: No indication when network is offline
   - Impact: User confusion when actions fail silently
   - Recommendation: Implement offline detector and show banner

10. **TypeScript `any` usage in project detail**
    - File: `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx:584`
    - Issue: `const meta = project.meta as any;`
    - Impact: Loss of type safety for project metadata
    - Recommendation: Define proper TypeScript types for project.meta structure

### 🟢 Low Priority

11. **No form validation feedback**
    - File: `apps/dashboard/src/app/hwar/create/new/page.tsx`
    - Issue: Button disable logic exists but no visual error messages
    - Recommendation: Add inline validation errors using react-hook-form

12. **Duplicate navigation logic**
    - Files: `factory-sidebar.tsx`, `library-sidebar.tsx`
    - Issue: Similar sidebar components with different navigation items
    - Recommendation: Create unified `NavigationSidebar` component

13. **No keyboard shortcuts**
    - Issue: Power users cannot use keyboard for common actions
    - Recommendation: Implement CMD+K command palette (cmdk component already installed)

14. **Missing test IDs on some components**
    - Issue: Not all interactive elements have data-testid attributes
    - Impact: Difficult to write E2E tests
    - Recommendation: Add test IDs systematically

15. **No dark mode support**
    - Issue: next-themes is installed but not configured
    - Recommendation: Complete dark mode implementation with theme toggle

## Testing Coverage

### Existing Tests

**Smoke Tests**:
- `tests/hwar-smoke.spec.ts` - Basic HWAR functionality
- `tests/hwar-factory-smoke.spec.ts` - Factory pages
- `tests/hwar-library-smoke.spec.ts` - Library pages
- `tests/hwar-db-health.spec.ts` - Database connectivity

**Unit Tests**:
- `apps/dashboard/src/app/api/actions/handlers/*.test.ts` - Handler tests

### Missing Tests

- ❌ No E2E test for complete project creation flow
- ❌ No integration tests for API action handlers
- ❌ No component unit tests
- ❌ No visual regression tests
- ❌ No performance tests (Core Web Vitals)

## Recommendations Summary

**Immediate Actions**:
1. Implement animation generation UI
2. Add error boundaries
3. Add rate limiting and button disabled states
4. Define TypeScript types for `project.meta`

**Short-term**:
5. Implement WebSocket for real-time updates (replace polling)
6. Add pagination to projects list
7. Complete E2E test coverage for critical paths

**Long-term**:
8. Implement command palette for power users
9. Complete dark mode support
10. Add comprehensive accessibility audit and fixes

---

*Last Updated: 2025-11-02*
*Audited by: Claude Code (FullStack Auditor)*
