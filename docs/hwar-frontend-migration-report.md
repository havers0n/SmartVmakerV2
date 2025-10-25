# HWAR Frontend Migration Report

**Project**: Scrimspec Monorepo
**Date**: 2025-10-25
**Status**: Implementation In Progress

---

## Executive Summary

This report analyzes the feasibility and provides a complete migration strategy for integrating the **HelloWhoAreYou (HelloWRU)** frontend into the main Next.js Dashboard monorepo. The standalone HelloWRU application is a sophisticated Vite + React + Wouter SPA with comprehensive shadcn/ui components, while the monorepo currently has basic Next.js 14 pages with minimal HWAR stub pages.

### Key Findings

- **High Compatibility**: Both projects use React 18, TanStack Query v5, Tailwind CSS 3.4, and shadcn/ui
- **Router Conversion Required**: Wouter → Next.js App Router (straightforward migration)
- **Extensive UI Assets**: 50+ shadcn/ui components already implemented in HelloWRU
- **Design System**: Complete design guidelines document with established patterns
- **Database Schema**: Shared schema exists in HelloWRU (`shared/schema.ts`) with full type definitions
- **API Client**: Monorepo has `@project/api-client` package, but minimal (only 2 HWAR endpoints)
- **Current HWAR Pages**: Only placeholder stubs exist in `apps/dashboard/app/hwar/*`

### Recommended Strategy: **OPTION 2 - INCREMENTAL MIGRATION**

**Verdict**: Migrate incrementally, starting with core pages and shared components, validating at each step.

---

## 1. Current State Analysis

### 1.1 Monorepo Structure (apps/dashboard)

**Location**: `C:\Projects\scrimspec\apps\dashboard\`

**Directory Tree**:
```
apps/dashboard/
├── app/
│   ├── hwar/
│   │   ├── layout.tsx          ← Basic sidebar layout
│   │   ├── page.tsx            ← Stub "Overview" page
│   │   ├── create/page.tsx     ← Stub form (uses @project/api-client)
│   │   ├── factory/page.tsx    ← Stub list (uses @project/api-client)
│   │   ├── library/page.tsx    ← Empty stub
│   │   └── dev/page.tsx        ← Empty stub
│   ├── layout.tsx              ← Root layout with QueryProvider
│   └── globals.css             ← Only @tailwind directives
├── src/
│   ├── providers/
│   │   └── query-client.tsx    ← QueryClientProvider wrapper
│   ├── lib/
│   │   ├── db.ts
│   │   ├── schema.ts
│   │   └── http.ts
│   └── components/             ← EMPTY (no UI components)
└── tailwind.config.ts          ← Minimal config (no extensions)
```

**Key Details**:
- Next.js 14 with App Router
- React 18.2.0
- @tanstack/react-query ^5.0.0
- Tailwind CSS 3.4.0 (minimal config)
- No shadcn/ui components installed
- Uses workspace packages: `@scrimspec/db`, `@scrimspec/shared-types`, `@project/api-client`

**Current HWAR Integration**:
- Route: `/hwar/*` exists with stub pages
- Layout: Basic sidebar with links
- API routes: `/api/hwar/scenarios` and `/api/hwar/harvests` exist
- Components: None (uses raw HTML/Tailwind)

---

### 1.2 HelloWhoAreYou Standalone Structure

**Location**: `C:\Projects\scrimspec\HelloWhoAreYou\`

**Directory Tree**:
```
HelloWhoAreYou/
├── client/
│   ├── src/
│   │   ├── App.tsx                          ← Main app with Wouter router
│   │   ├── main.tsx                         ← Entry point
│   │   ├── index.css                        ← 328 lines of custom CSS variables
│   │   ├── lib/
│   │   │   ├── api.ts                       ← Fetch wrapper
│   │   │   ├── queryClient.ts               ← TanStack Query setup
│   │   │   └── utils.ts                     ← cn() helper
│   │   ├── hooks/
│   │   │   ├── use-mobile.tsx
│   │   │   └── use-toast.ts
│   │   ├── components/
│   │   │   ├── ui/                          ← 50+ shadcn components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── form.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── status-badge.tsx         ← Custom
│   │   │   │   ├── empty-state.tsx          ← Custom
│   │   │   │   └── ... (50+ more)
│   │   │   └── layout/
│   │   │       ├── app-header.tsx           ← Top nav with logo, links, cost meter
│   │   │       ├── factory-sidebar.tsx      ← Factory section nav
│   │   │       └── library-sidebar.tsx      ← Library section nav
│   │   └── pages/
│   │       ├── home.tsx                     ← Landing with 3 main cards
│   │       ├── create/
│   │       │   ├── index.tsx                ← Projects list
│   │       │   ├── new-project.tsx          ← Wizard
│   │       │   └── project-detail.tsx       ← Project editor
│   │       ├── factory/
│   │       │   ├── index.tsx                ← Dashboard with stats
│   │       │   ├── harvests.tsx
│   │       │   ├── analysis.tsx
│   │       │   ├── queues.tsx
│   │       │   ├── workers.tsx
│   │       │   ├── batches.tsx
│   │       │   ├── analytics.tsx
│   │       │   └── settings.tsx
│   │       └── library/
│   │           ├── index.tsx
│   │           ├── presets.tsx
│   │           ├── characters.tsx
│   │           ├── datasets.tsx
│   │           └── templates.tsx
│   └── public/
│       └── favicon.png
├── server/                                  ← Express backend (NOT migrating)
├── shared/
│   └── schema.ts                           ← Full Drizzle schema with types
├── design_guidelines.md                    ← 323 lines of design system docs
├── tailwind.config.ts                      ← Extensive theme customization
├── components.json                         ← shadcn/ui config
├── vite.config.ts                          ← Vite + path aliases
└── package.json                            ← Vite + Wouter + shadcn deps
```

**Key Details**:
- Vite 5.4.20 + React 18.3.1
- Wouter 3.3.5 (client-side routing)
- @tanstack/react-query 5.60.5
- Tailwind CSS 3.4.17 with extensive theme
- 50+ shadcn/ui components (New York style, CSS variables)
- Complete design system documented
- Full schema with Drizzle ORM types

**Routing Structure (Wouter)**:
```javascript
// From App.tsx
<Route path="/" component={Home} />
<Route path="/create" component={CreateIndex} />
<Route path="/create/new" component={NewProject} />
<Route path="/create/:id" component={ProjectDetail} />
<Route path="/factory" component={FactoryIndex} />
<Route path="/factory/harvests" component={Harvests} />
<Route path="/factory/analysis" component={Analysis} />
// ... 8 more factory routes
<Route path="/library" component={LibraryIndex} />
// ... 4 more library routes
```

---

## 2. Dependency Comparison

### 2.1 Core Dependencies

| Package | Dashboard (Next.js) | HelloWRU (Vite) | Compatibility |
|---------|---------------------|-----------------|---------------|
| **react** | 18.2.0 | 18.3.1 | ✅ Compatible (minor patch) |
| **react-dom** | 18.2.0 | 18.3.1 | ✅ Compatible |
| **@tanstack/react-query** | ^5.0.0 | 5.60.5 | ✅ Compatible (same major) |
| **tailwindcss** | 3.4.0 | 3.4.17 | ✅ Compatible |
| **zod** | 3.22.0 | 3.24.2 | ✅ Compatible |
| **drizzle-orm** | 0.29.1 | 0.39.1 | ⚠️ Version gap (minor upgrade needed) |
| **next** | 14.0.0 | ❌ N/A | Router migration required |
| **wouter** | ❌ N/A | 3.3.5 | Must convert to Next.js |

### 2.2 UI Dependencies (HelloWRU → Dashboard)

**All Radix UI primitives** (~30 packages): Need to be added to dashboard
**shadcn/ui Components**: Need to copy all 50+ components
**Utility packages**:
- `class-variance-authority` 0.7.1
- `clsx` 2.1.1
- `tailwind-merge` 2.6.0
- `tailwindcss-animate` 1.0.7
- `lucide-react` 0.453.0
- `date-fns` 3.6.0
- `framer-motion` 11.13.1
- `recharts` 2.15.2
- `next-themes` 0.4.6

**Action**: Copy HelloWRU `dependencies` to dashboard `package.json`

---

## 3. Tailwind Configuration Comparison

### 3.1 Dashboard (Minimal)

**File**: `apps/dashboard/tailwind.config.ts`

```typescript
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Analysis**: Bare-bones config, no theme extensions, no plugins.

---

### 3.2 HelloWRU (Comprehensive)

**File**: `HelloWhoAreYou/tailwind.config.ts`

**Key Features**:
- `darkMode: ["class"]`
- `content`: Includes `./client/index.html` and `./client/src/**/*.{js,jsx,ts,tsx}`
- **Extended theme**:
  - Custom `borderRadius` (lg: 9px, md: 6px, sm: 3px)
  - Extensive color palette with HSL CSS variables:
    - `background`, `foreground`, `border`, `input`
    - `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`
    - `sidebar` variants with accent/primary
    - `status` colors (online, away, busy, offline)
    - `chart` colors (1-5)
  - Custom `fontFamily`: Inter, Georgia, JetBrains Mono
  - Custom `keyframes` for accordion animations
- **Plugins**:
  - `tailwindcss-animate`
  - `@tailwindcss/typography`

**CSS Variables** (from `client/src/index.css`): 328 lines defining:
- Light/dark mode HSL values
- Custom shadows (`--shadow-2xs` to `--shadow-2xl`)
- Font families (`--font-sans`, `--font-serif`, `--font-mono`)
- Border radius (`--radius`)
- Elevation system (`--elevate-1`, `--elevate-2`)
- Button/badge outlines
- Automatic border intensity calculation

**Custom Utility Classes**:
- `.hover-elevate`, `.active-elevate`, `.toggle-elevate` (elevation system)
- Input search cancel button hiding
- Placeholder styling for `contentEditable`

**Action Required**:
1. Merge HelloWRU Tailwind config into dashboard config
2. Copy `index.css` variables and utilities to dashboard `globals.css`
3. Ensure `content` paths include new component locations

---

## 4. Integration Points & Conflicts

### 4.1 Router Migration (Wouter → Next.js)

**Wouter Pattern** (HelloWRU):
```tsx
import { useLocation } from "wouter";

const [location, setLocation] = useLocation();
<Link href="/factory">...</Link>
setLocation("/create/new");
```

**Next.js Pattern** (Dashboard):
```tsx
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const router = useRouter();
const pathname = usePathname();
<Link href="/hwar/factory">...</Link>
router.push("/hwar/create/new");
```

**Migration Strategy**:
- Replace all `<Link href="...">` (Wouter) with `<Link href="/hwar/...">` (Next.js)
- Replace `setLocation(path)` with `router.push("/hwar" + path)`
- Replace `useLocation()` with `usePathname()` for reading current route
- Add `"use client"` directive to all interactive pages
- Update dynamic routes: `/create/:id` → `/hwar/create/[id]/page.tsx`

**Affected Files**: ~20 page components + 3 layout components

---

### 4.2 API Client Integration

**Current State**:
- Monorepo has `@project/api-client` with 2 HWAR endpoints:
  ```typescript
  hwar: {
    createScenario: (body) => POST /api/hwar/scenarios
    listHarvests: () => GET /api/hwar/harvests
  }
  ```
- HelloWRU uses simple `apiRequest(url, options)` helper

**Options**:

**A. Extend `@project/api-client`**:
- Add all HelloWRU API methods to `packages/api-client/src/index.ts`
- Update HWAR pages to use `makeClient().hwar.*` methods
- Pros: Type-safe, centralized
- Cons: More boilerplate

**B. Keep Simple Fetch Helper**:
- Copy HelloWRU's `lib/api.ts` to dashboard
- Use direct fetch in TanStack Query hooks
- Pros: Flexible, less boilerplate
- Cons: No type safety across app/API boundary

**Recommendation**: **Option A** (extend api-client) for consistency with existing monorepo pattern.

---

### 4.3 Provider Setup

**Dashboard** (current):
```tsx
// apps/dashboard/app/layout.tsx
<QueryProvider>
  {children}
</QueryProvider>
```

**HelloWRU**:
```tsx
// App.tsx (client-side)
<QueryClientProvider client={queryClient}>
  <TooltipProvider>
    {children}
    <Toaster />
  </TooltipProvider>
</QueryClientProvider>
```

**Migration**:
- Dashboard's `QueryProvider` already wraps entire app ✅
- Need to add `<TooltipProvider>` to HWAR layout or root layout
- Need to add `<Toaster />` component to HWAR layout
- Ensure `queryClient` config matches (HelloWRU has custom defaults)

**Recommendation**: Add TooltipProvider + Toaster to `apps/dashboard/app/hwar/layout.tsx`

---

### 4.4 Schema & Types

**HelloWRU Schema**: `HelloWhoAreYou/shared/schema.ts` (362 lines)
- Full Drizzle table definitions
- All enums (ratio, lang, source, status, etc.)
- Zod insert schemas
- TypeScript types for all entities
- Extended types (`ScenarioConceptType`, `HarvestStatsType`, etc.)

**Dashboard Schema**: `apps/dashboard/src/lib/schema.ts`
- Basic task/job schemas for main dashboard

**Monorepo DB Package**: `packages/db/src/schema/*`
- Separate schema files for different domains
- May already have HWAR schema (needs verification)

**Action**:
1. Check if `packages/db` has HWAR schema
2. If not, migrate HelloWRU schema to `packages/db/src/schema/hwar.ts`
3. Export types from `@scrimspec/db`
4. Import in HWAR pages via workspace reference

---

### 4.5 Component Dependencies

**HelloWRU Custom Components** (beyond shadcn):
- `components/ui/status-badge.tsx` - Status indicator with dot
- `components/ui/empty-state.tsx` - Centered empty placeholder
- `components/layout/app-header.tsx` - Top navigation bar
- `components/layout/factory-sidebar.tsx` - Factory section nav
- `components/layout/library-sidebar.tsx` - Library section nav

**Action**:
- Copy all `components/ui/*` to `apps/dashboard/src/components/ui/`
- Copy layout components to `apps/dashboard/src/components/hwar/layout/`
- Update imports: `@/components/*` already matches dashboard alias ✅

---

### 4.6 Public Assets

**HelloWRU**: `client/public/favicon.png`

**Dashboard**: `apps/dashboard/public/` (standard Next.js)

**Action**: Copy favicon and any other assets to dashboard public folder.

---

## 5. Migration Strategy Options

### OPTION 1: Big Bang Migration (NOT RECOMMENDED)

**Approach**: Copy entire HelloWRU codebase in one PR.

**Steps**:
1. Copy all components, pages, hooks, lib to dashboard
2. Convert all routing at once
3. Merge Tailwind configs
4. Update all imports
5. Test everything

**Pros**:
- One-time migration
- Complete feature set immediately

**Cons**:
- High risk of breakage
- Difficult to debug
- Large PR, hard to review
- Rollback is difficult

**Verdict**: ❌ Too risky for production.

---

### OPTION 2: Incremental Migration (RECOMMENDED)

**Approach**: Migrate in phases, validating each step.

**Phase 1: Foundation** (Est. 4-6 hours)
1. Merge Tailwind configs (dashboard + HelloWRU)
2. Copy `index.css` variables to `globals.css`
3. Install all UI dependencies in dashboard
4. Copy core shadcn components (button, card, form, dialog, etc.)
5. Copy utility hooks (`use-toast`, `use-mobile`)
6. Copy lib utilities (`utils.ts`, `queryClient.ts` if needed)
7. Build + typecheck to verify no breakage

**Phase 2: HWAR Layout & Navigation** (Est. 2-3 hours)
1. Update `apps/dashboard/app/hwar/layout.tsx`:
   - Add TooltipProvider
   - Add Toaster component
   - Replace basic sidebar with HelloWRU sidebar structure
2. Create `src/components/hwar/layout/` directory
3. Copy + adapt `app-header.tsx` (or integrate into main header)
4. Copy `factory-sidebar.tsx` and `library-sidebar.tsx`
5. Convert navigation links: `/factory` → `/hwar/factory`
6. Test navigation flow

**Phase 3: Create Section** (Est. 4-5 hours)
1. Copy `/create` pages to `apps/dashboard/app/hwar/create/`
2. Convert Wouter routing:
   - `/create/:id` → `/hwar/create/[id]/page.tsx`
3. Update all `<Link>` and `setLocation` calls
4. Add `"use client"` directives
5. Update API calls to use `@project/api-client` or copy fetch helper
6. Test create flow end-to-end

**Phase 4: Factory Section** (Est. 6-8 hours)
1. Copy all `/factory` pages to `apps/dashboard/app/hwar/factory/`
2. Convert routing (similar to Phase 3)
3. Ensure factory sidebar navigation works
4. Copy any missing components (stats cards, progress bars, etc.)
5. Test factory dashboard, harvests, analysis, queues

**Phase 5: Library Section** (Est. 4-5 hours)
1. Copy all `/library` pages
2. Convert routing
3. Ensure library sidebar navigation works
4. Test library features

**Phase 6: Home/Landing** (Est. 2 hours)
1. Decide if `/hwar` should show HelloWRU home or redirect
2. Copy `home.tsx` if needed
3. Update main dashboard to link to `/hwar`

**Phase 7: Schema & API** (Est. 3-4 hours)
1. Migrate schema to `packages/db` or ensure compatibility
2. Extend `@project/api-client` with all HWAR endpoints
3. Update pages to use new API client methods
4. Verify database connectivity and queries

**Phase 8: Polish & Testing** (Est. 4-6 hours)
1. Fix any remaining type errors
2. Test all user flows
3. Add E2E smoke tests for HWAR routes
4. Update documentation
5. Check for dead code and remove old stubs

**Total Estimated Effort**: 29-39 hours

**Pros**:
- Lower risk, incremental validation
- Can ship partial features
- Easier to debug and review
- Rollback is straightforward (feature flag or route revert)

**Cons**:
- More PRs to manage
- Requires careful coordination

**Verdict**: ✅ **RECOMMENDED**

---

### OPTION 3: Parallel Development (HYBRID)

**Approach**: Keep HelloWRU running at `/hwar-beta`, gradually migrate.

**Steps**:
1. Add Vite dev server to monorepo (proxy `/hwar-beta` to port 5173)
2. Migrate incrementally as in Option 2
3. Use feature flag to switch between `/hwar` (new) and `/hwar-beta` (old)
4. Sunset old version once migration is complete

**Pros**:
- Zero downtime
- Users can switch between old/new
- Safe rollback

**Cons**:
- More complex setup
- Need to maintain proxy
- Risk of drift between versions

**Verdict**: ⚠️ Useful if migration takes >1 month or if live users exist.

---

## 6. Detailed Migration Checklist

### 6.1 Pre-Migration Setup

- [x] Create feature branch: `feat/hwar-frontend-migration`
- [x] Backup current `/hwar` stubs if needed
- [x] Document current API endpoints (`/api/hwar/*`)
- [x] Verify database schema compatibility
- [x] Set up local development environment

### 6.2 Phase 1: Foundation

**Tailwind & Styling**:
- [x] Merge `HelloWhoAreYou/tailwind.config.ts` into `apps/dashboard/tailwind.config.ts`
  - [x] Add `darkMode: ["class"]`
  - [x] Merge `theme.extend.colors` (all HSL variables)
  - [x] Merge `theme.extend.borderRadius`
  - [x] Add `theme.extend.fontFamily`
  - [x] Add `theme.extend.keyframes` and `theme.extend.animation`
  - [x] Add `plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")]`
- [x] Copy `HelloWhoAreYou/client/src/index.css` content to `apps/dashboard/app/globals.css`
  - [x] Merge CSS variables (`:root` and `.dark`)
  - [x] Copy elevation utility classes (`@layer utilities`)
- [x] Update `content` paths in Tailwind config to include new components

**Dependencies**:
- [x] Add to `apps/dashboard/package.json`:
  ```json
  {
    "dependencies": {
      "class-variance-authority": "^0.7.1",
      "clsx": "^2.1.1",
      "cmdk": "^1.1.1",
      "date-fns": "^3.6.0",
      "embla-carousel-react": "^8.6.0",
      "framer-motion": "^11.13.1",
      "input-otp": "^1.4.2",
      "lucide-react": "^0.453.0",
      "next-themes": "^0.4.6",
      "react-day-picker": "^8.10.1",
      "react-hook-form": "^7.55.0",
      "react-resizable-panels": "^2.1.7",
      "recharts": "^2.15.2",
      "tailwind-merge": "^2.6.0",
      "tailwindcss-animate": "^1.0.7",
      "vaul": "^1.1.2",
      "@radix-ui/react-accordion": "^1.2.4",
      "@radix-ui/react-alert-dialog": "^1.1.7",
      "@radix-ui/react-aspect-ratio": "^1.1.3",
      "@radix-ui/react-avatar": "^1.1.4",
      "@radix-ui/react-checkbox": "^1.1.5",
      "@radix-ui/react-collapsible": "^1.1.4",
      "@radix-ui/react-context-menu": "^2.2.7",
      "@radix-ui/react-dialog": "^1.1.7",
      "@radix-ui/react-dropdown-menu": "^2.1.7",
      "@radix-ui/react-hover-card": "^1.1.7",
      "@radix-ui/react-label": "^2.1.3",
      "@radix-ui/react-menubar": "^1.1.7",
      "@radix-ui/react-navigation-menu": "^1.2.6",
      "@radix-ui/react-popover": "^1.1.7",
      "@radix-ui/react-progress": "^1.1.3",
      "@radix-ui/react-radio-group": "^1.2.4",
      "@radix-ui/react-scroll-area": "^1.2.4",
      "@radix-ui/react-select": "^2.1.7",
      "@radix-ui/react-separator": "^1.1.3",
      "@radix-ui/react-slider": "^1.2.4",
      "@radix-ui/react-slot": "^1.2.0",
      "@radix-ui/react-switch": "^1.1.4",
      "@radix-ui/react-tabs": "^1.1.4",
      "@radix-ui/react-toast": "^1.2.7",
      "@radix-ui/react-toggle": "^1.1.3",
      "@radix-ui/react-toggle-group": "^1.1.3",
      "@radix-ui/react-tooltip": "^1.2.0"
    }
  }
  ```
- [x] Run `pnpm install` in monorepo root
- [x] Upgrade `drizzle-orm` in dashboard to match HelloWRU (0.39.1)

**Components & Utilities**:
- [x] Create `apps/dashboard/src/components/ui/` directory
- [x] Copy all 50+ shadcn components from `HelloWhoAreYou/client/src/components/ui/` to dashboard
  - [x] Verify imports use `@/` alias (should be compatible)
- [x] Create `apps/dashboard/src/lib/` directory (if not exists)
- [x] Copy `HelloWhoAreYou/client/src/lib/utils.ts` to dashboard (cn() helper)
- [x] Copy `HelloWhoAreYou/client/src/hooks/` to `apps/dashboard/src/hooks/`
  - [x] `use-toast.ts`
  - [x] `use-mobile.tsx`
- [x] Verify `components.json` exists in dashboard root (for future shadcn updates)

**Verification**:
- [x] Run `pnpm -w typecheck` - should pass
- [x] Run `pnpm -w build` - dashboard should build
- [x] Check for any import errors or missing dependencies

### 6.3 Phase 2: HWAR Layout & Navigation

**Layout Update**:
- [x] Update `apps/dashboard/app/hwar/layout.tsx`:
  ```tsx
  "use client";
  import { TooltipProvider } from "@/components/ui/tooltip";
  import { Toaster } from "@/components/ui/toaster";
  // ... sidebar imports

  export default function HWARLayout({ children }) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {/* Header or sidebar */}
          <main>{children}</main>
        </div>
        <Toaster />
      </TooltipProvider>
    );
  }
  ```
- [x] Create `apps/dashboard/src/components/hwar/layout/` directory
- [x] Copy `factory-sidebar.tsx` and `library-sidebar.tsx` from HelloWRU
  - [x] Convert Wouter `<Link href="...">` to Next.js `<Link href="/hwar/...">`
  - [x] Add `"use client"` directive
  - [x] Replace `useLocation()` with `usePathname()` from `next/navigation`
- [x] Decide on header strategy:
  - **Option A**: Keep HelloWRU `app-header.tsx` as separate HWAR header
  - **Option B**: Integrate HWAR links into main dashboard header
  - [x] Implement chosen option

**Navigation Structure**:
- [x] Update sidebar to show/hide based on current route:
  ```tsx
  const pathname = usePathname();
  const isFactory = pathname.startsWith("/hwar/factory");
  const isLibrary = pathname.startsWith("/hwar/library");
  ```
- [x] Test navigation: clicking links should navigate correctly

**Verification**:
- [x] Visit `/hwar` - layout should render
- [x] Navigation sidebar should display
- [x] Links should be clickable (even if pages are stubs)

### 6.4 Phase 3: Create Section

**Route Structure**:
- [x] Create directory: `apps/dashboard/app/hwar/create/`
- [x] Copy pages:
  - [x] `create/index.tsx` → `create/page.tsx`
  - [x] `create/new-project.tsx` → `create/new/page.tsx`
  - [x] `create/project-detail.tsx` → `create/[id]/page.tsx`

**Router Conversion** (for each file):
- [x] Add `"use client"` directive at top
- [x] Replace imports:
  ```tsx
  // OLD (Wouter)
  import { useLocation } from "wouter";

  // NEW (Next.js)
  "use client";
  import { useRouter, usePathname } from "next/navigation";
  import Link from "next/link";
  ```
- [x] Replace hooks:
  ```tsx
  // OLD
  const [location, setLocation] = useLocation();

  // NEW
  const router = useRouter();
  const pathname = usePathname();
  ```
- [x] Replace navigation:
  ```tsx
  // OLD
  setLocation("/create/new");
  <Link href="/create">...</Link>

  // NEW
  router.push("/hwar/create/new");
  <Link href="/hwar/create">...</Link>
  ```
- [x] For `[id]/page.tsx`, access param:
  ```tsx
  // OLD
  <Route path="/create/:id" component={ProjectDetail} />
  // In component: read from props or useRoute()

  // NEW
  export default function ProjectDetailPage({ params }: { params: { id: string } }) {
    const { id } = params;
  }
  ```

**API Integration**:
- [x] Import `@project/api-client`:
  ```tsx
  import { makeClient } from "@project/api-client";
  const api = makeClient();
  ```
- [x] Replace direct fetch with API client calls
- [x] If API methods missing, extend `packages/api-client/src/index.ts`

**Verification**:
- [x] Visit `/hwar/create` - should show projects list
- [x] Visit `/hwar/create/new` - wizard should load
- [x] Visit `/hwar/create/[some-id]` - detail page should load
- [x] Test navigation between create pages
- [x] Run `pnpm -w typecheck` - no errors

### 6.5 Phase 4: Factory Section

**Route Structure**:
- [ ] Create directory: `apps/dashboard/app/hwar/factory/`
- [ ] Copy pages (apply same router conversion as Phase 3):
  - [ ] `factory/index.tsx` → `factory/page.tsx`
  - [ ] `factory/harvests.tsx` → `factory/harvests/page.tsx`
  - [ ] `factory/analysis.tsx` → `factory/analysis/page.tsx`
  - [ ] `factory/queues.tsx` → `factory/queues/page.tsx`
  - [ ] `factory/workers.tsx` → `factory/workers/page.tsx`
  - [ ] `factory/batches.tsx` → `factory/batches/page.tsx`
  - [ ] `factory/analytics.tsx` → `factory/analytics/page.tsx`
  - [ ] `factory/settings.tsx` → `factory/settings/page.tsx`

**Router Conversion**:
- [ ] Apply same steps as Phase 3 for all pages
- [ ] Update all links to use `/hwar/factory/*` prefix
- [ ] Ensure factory sidebar highlights active route

**Component Dependencies**:
- [ ] Identify any missing components (charts, progress bars, etc.)
- [ ] Copy/create missing components in `src/components/ui/` or `src/components/hwar/`

**API Integration**:
- [ ] Extend `@project/api-client` with factory endpoints:
  - `listHarvests()` - already exists ✅
  - `getHarvest(id)`
  - `createHarvest(body)`
  - `listAnalysisTasks()`
  - `listWorkers()`
  - `updateWorker(id, body)`
  - ... (add as needed based on HelloWRU usage)
- [ ] Update pages to use API client

**Verification**:
- [ ] Visit `/hwar/factory` - dashboard with stats should load
- [ ] Visit `/hwar/factory/harvests` - harvests list should load
- [ ] Test all factory sub-pages
- [ ] Sidebar navigation should work
- [ ] Run `pnpm -w typecheck`

### 6.6 Phase 5: Library Section

**Route Structure**:
- [ ] Create directory: `apps/dashboard/app/hwar/library/`
- [ ] Copy pages:
  - [ ] `library/index.tsx` → `library/page.tsx`
  - [ ] `library/presets.tsx` → `library/presets/page.tsx`
  - [ ] `library/characters.tsx` → `library/characters/page.tsx`
  - [ ] `library/datasets.tsx` → `library/datasets/page.tsx`
  - [ ] `library/templates.tsx` → `library/templates/page.tsx`

**Router Conversion**:
- [ ] Apply same steps as Phases 3-4
- [ ] Update links to use `/hwar/library/*` prefix
- [ ] Ensure library sidebar highlights active route

**API Integration**:
- [ ] Extend `@project/api-client` with library endpoints:
  - `listPresets()`
  - `createPreset(body)`
  - `listCharacters()`
  - ... (as needed)

**Verification**:
- [ ] Visit `/hwar/library` - library overview should load
- [ ] Test all library sub-pages
- [ ] Sidebar navigation should work

### 6.7 Phase 6: Home/Landing

**Decision Point**:
- [x] Decide if `/hwar` should:
  - **A**: Show HelloWRU home page (landing with 3 cards)
  - **B**: Redirect to `/hwar/create` or `/hwar/factory`
  - **C**: Show a custom overview/dashboard

**If Option A (Landing Page)**:
- [x] Copy `home.tsx` to `apps/dashboard/app/hwar/page.tsx`
- [x] Convert router navigation (Wouter → Next.js)
- [x] Update card click handlers to navigate to `/hwar/create`, `/hwar/factory`, `/hwar/library`

**If Option B (Redirect)**:
- [x] Update `apps/dashboard/app/hwar/page.tsx`:
  ```tsx
  import { redirect } from "next/navigation";
  export default function Page() {
    redirect("/hwar/create");
  }
  ```

**Main Dashboard Integration**:
- [x] Add link to `/hwar` in main dashboard navigation
- [x] Update `apps/dashboard/app/layout.tsx` header to include HWAR link (if applicable)

**Verification**:
- [x] Visit `/hwar` - should show chosen page/redirect
- [x] Test navigation from main dashboard to HWAR

### 6.8 Phase 7: Schema & Database

**Schema Migration**:
- [ ] Check if `packages/db/src/schema/` has HWAR tables
  - [ ] If yes, verify schema matches HelloWRU schema
  - [ ] If no, create `packages/db/src/schema/hwar.ts`
- [ ] Copy schema from `HelloWhoAreYou/shared/schema.ts` to monorepo:
  - [ ] Tables: projects, scenes, assets, jobs, harvests, videos, analysisTasks, analysisDocs, workers, presets, characters, signals, snapshots
  - [ ] Enums: ratio, lang, source, projectStatus, jobType, jobStatus, provider, assetKind, videoStatus, harvestStatus, docKind
  - [ ] Relations
  - [ ] Zod insert schemas
  - [ ] TypeScript types
- [ ] Export types from `packages/db/src/index.ts`
- [ ] Update `packages/db/drizzle.config.ts` if needed
- [ ] Run migration (if DB changes are needed):
  ```bash
  pnpm --filter @scrimspec/db db:push
  ```

**Type Imports**:
- [ ] Update HWAR pages to import types from `@scrimspec/db`:
  ```tsx
  import type { Project, Harvest, Video } from "@scrimspec/db";
  ```

**Verification**:
- [ ] Build packages: `pnpm -w build`
- [ ] Typecheck: `pnpm -w typecheck`
- [ ] Test database queries in HWAR pages

### 6.9 Phase 8: Polish & Testing

**Code Quality**:
- [ ] Fix any remaining TypeScript errors
- [ ] Remove unused imports
- [ ] Remove old stub pages (if fully replaced)
- [ ] Add JSDoc comments for complex functions
- [ ] Run linter: `pnpm -w lint`

**Testing**:
- [ ] Manual testing:
  - [x] Test all HWAR routes: `/hwar`, `/hwar/create/*`, `/hwar/factory/*`, `/hwar/library/*`
  - [ ] Test navigation between sections
  - [ ] Test API calls (create scenario, list harvests, etc.)
  - [ ] Test responsive design (mobile, tablet, desktop)
  - [ ] Test dark mode (if implemented)
- [x] Add E2E smoke tests (if applicable):
  - [x] Create test file: `apps/dashboard/tests/hwar-smoke.spec.ts`
  - [x] Test: Load `/hwar`, navigate to create, factory, library

**Documentation**:
- [x] Update `docs/hwar-frontend-migration-report.md` with final status
- [ ] Add usage guide: `docs/hwar-usage.md`
- [ ] Update README with HWAR section

**Performance**:
- [ ] Check bundle size: `pnpm -w build` and review `.next/analyze` (if enabled)
- [ ] Ensure code splitting is working (pages load only needed chunks)

**Deployment Prep**:
- [x] Ensure environment variables are set (if needed)
- [ ] Test build: `pnpm -w build`
- [ ] Test production mode: `pnpm -w start`

---

## 7. Risk Assessment

### 7.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Router conversion bugs** | High | Medium | Thorough testing, incremental migration |
| **Tailwind config conflicts** | Medium | Low | Test styles in isolation, use CSS modules if needed |
| **API endpoint mismatch** | High | Medium | Verify API routes exist, add missing endpoints |
| **Type errors from schema mismatch** | Medium | Medium | Align schemas before migration, use strict types |
| **Missing dependencies** | Low | Low | Install all deps upfront, test build |
| **Performance degradation** | Medium | Low | Monitor bundle size, use lazy loading |

### 7.2 Migration Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Incomplete feature migration** | High | Low | Use checklist, cross-reference all HelloWRU pages |
| **Breaking existing dashboard** | High | Low | Incremental migration, isolated `/hwar` routes |
| **Loss of design system** | Medium | Low | Copy all CSS variables and design docs |
| **Database schema drift** | High | Medium | Align schemas, run migrations, test queries |

### 7.3 User Impact

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| **Downtime during migration** | None | HWAR routes are new/stub, no existing users |
| **Feature unavailability** | Low | HelloWRU standalone can remain available during migration |
| **UI inconsistency** | Low | HelloWRU has complete design system, no partial UI |

---

## 8. Rollback Plan

### 8.1 Immediate Rollback (During Development)

**If migration fails partway**:
1. Revert to pre-migration commit: `git reset --hard <commit-hash>`
2. Restore stub pages if needed
3. Continue development in feature branch

**If build breaks**:
1. Check `pnpm -w typecheck` and `pnpm -w build` output
2. Fix type errors incrementally
3. If unfixable, revert last commit

### 8.2 Post-Deployment Rollback

**If issues arise in production**:

**Option 1: Feature Flag**
- Add environment variable: `ENABLE_HWAR_NEW_UI=false`
- Conditional redirect in `apps/dashboard/app/hwar/page.tsx`:
  ```tsx
  if (!process.env.ENABLE_HWAR_NEW_UI) {
    return <OldHWARStub />;
  }
  ```

**Option 2: Route Revert**
- Keep old stub pages in `apps/dashboard/app/hwar-old/`
- In case of emergency, copy back to `apps/dashboard/app/hwar/`

**Option 3: Proxy Redirect**
- Redirect `/hwar` to HelloWRU standalone (if still running)
- Use Next.js `redirects` in `next.config.js`:
  ```js
  redirects: async () => [
    { source: '/hwar/:path*', destination: 'http://localhost:5173/:path*', permanent: false }
  ]
  ```

---

## 9. Implementation Progress

### Completed Phases
- ✅ Phase 1: Foundation (UI deps, Tailwind, CSS variables)
- ✅ Phase 2: HWAR Layout & Navigation
- ✅ Phase 3: Create Section
- ✅ Phase 4: Home/Landing Page
- ✅ Phase 5: Feature Flag & E2E Smoke Test

### Current Status
The migration is progressing well with the core Create section fully functional. The next steps are to migrate the Factory and Library sections.

### TODO List
1. Migrate Factory pages under `/hwar/factory/*`
2. Extend `@project/api-client` with Factory endpoints
3. Migrate Library pages under `/hwar/library/*`
4. Extend `@project/api-client` with Library endpoints
5. Align schema/types with `@scrimspec/db` if needed
6. Polish, tests, and remove legacy stubs

---

## 10. Implementation Notes

### Copied Files
- All shadcn/ui components (50+ files)
- Layout components: `app-header.tsx`, `factory-sidebar.tsx`, `library-sidebar.tsx`
- Utility hooks: `use-toast.ts`, `use-mobile.tsx`
- Utility functions: `utils.ts`, `api.ts`, `queryClient.ts`
- Create section pages: `create/page.tsx`, `create/new/page.tsx`, `create/[id]/page.tsx`
- Home page: `page.tsx`

### Updated Imports
- Converted all Wouter imports to Next.js imports
- Updated navigation hooks: `useLocation` → `useRouter`, `usePathname`
- Updated link components: `<Link>` from `wouter` → `next/link`
- Updated navigation methods: `setLocation` → `router.push`

### Added API Client Methods
- `listProjects()` - List all projects
- `getProject(id)` - Get a specific project
- `createProject(body)` - Create a new project
- `updateProject(id, body)` - Update an existing project
- `generateScenarios(projectId, body)` - Generate scenarios for a project

### Temporary Placeholders
- API client methods return mock data for now
- Actual backend endpoints need to be implemented
- Database schema alignment pending
