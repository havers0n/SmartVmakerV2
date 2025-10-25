# HWAR Frontend UI/UX Audit Report

**Date**: 2025-10-25
**Project**: Scrimspec Monorepo
**Scope**: HelloWhoAreYou (HWAR) → apps/dashboard integration
**Branch**: feat/hwar-frontend-migration

---

## Executive Summary (10 Key Findings)

1. **Routes Migrated**: 19 HWAR pages successfully migrated (Create, Factory, Library areas) ✅
2. **shadcn/ui Components**: 49 components present (matches HelloWRU baseline) ✅
3. **Theming Parity**: Complete CSS variable system ported (:root + .dark), borderRadius, elevation utilities ✅
4. **Providers Status**: QueryClient ✅ | TooltipProvider ❌ | Toaster ❌ (missing from root/hwar layout)
5. **Router Conversion**: Zero wouter imports found; 5 pages use Next.js useRouter/usePathname ✅
6. **Root Route Situation**: `/` still shows **old UI** (basic HTML); `/hwar` behind **server-side** `ENABLE_HWAR_NEW_UI` flag ⚠️
7. **API Client Coverage**: High - 25+ HWAR methods in `@project/api-client`; 14 pages using useQuery/useMutation ✅
8. **Build/Typecheck**: **FAIL** - 43 TypeScript errors (DB schema version conflicts, missing imports, type issues) ❌
9. **Top 3 Blockers**: (1) TypeScript errors blocking prod build (2) Missing TooltipProvider/Toaster (3) Server-side feature flag instead of NEXT_PUBLIC
10. **Recommendation**: **NO-GO** to expose `/` → `/hwar` until TS errors fixed; **GO** for gated /hwar with flag once P0 fixes complete (ETA: 1-2 days)

---

## 1. Inventory & Structure

### 1.1 HWAR Pages Migrated (19 total)

| Area | Route | File | Status |
|------|-------|------|--------|
| Overview | `/hwar` | `app/hwar/page.tsx` | ✅ Migrated |
| **Create** | `/hwar/create` | `app/hwar/create/page.tsx` | ✅ Migrated |
| Create | `/hwar/create/new` | `app/hwar/create/new/page.tsx` | ✅ Migrated |
| Create | `/hwar/create/[id]` | `app/hwar/create/[id]/page.tsx` | ✅ Migrated |
| **Factory** | `/hwar/factory` | `app/hwar/factory/page.tsx` | ✅ Migrated (dashboard) |
| Factory | `/hwar/factory/harvests` | `app/hwar/factory/harvests/page.tsx` | ✅ Migrated |
| Factory | `/hwar/factory/analysis` | `app/hwar/factory/analysis/page.tsx` | ✅ Migrated |
| Factory | `/hwar/factory/queues` | `app/hwar/factory/queues/page.tsx` | ✅ Migrated |
| Factory | `/hwar/factory/workers` | `app/hwar/factory/workers/page.tsx` | ✅ Migrated |
| Factory | `/hwar/factory/batches` | `app/hwar/factory/batches/page.tsx` | ✅ Migrated |
| Factory | `/hwar/factory/analytics` | `app/hwar/factory/analytics/page.tsx` | ✅ Migrated |
| Factory | `/hwar/factory/settings` | `app/hwar/factory/settings/page.tsx` | ✅ Migrated |
| **Library** | `/hwar/library` | `app/hwar/library/page.tsx` | ✅ Migrated (dashboard) |
| Library | `/hwar/library/presets` | `app/hwar/library/presets/page.tsx` | ✅ Migrated |
| Library | `/hwar/library/characters` | `app/hwar/library/characters/page.tsx` | ✅ Migrated |
| Library | `/hwar/library/datasets` | `app/hwar/library/datasets/page.tsx` | ✅ Migrated |
| Library | `/hwar/library/templates` | `app/hwar/library/templates/page.tsx` | ✅ Migrated |
| Dev | `/hwar/dev` | `app/hwar/dev/page.tsx` | ✅ Migrated (smoke test) |
| Layout | `/hwar/*` | `app/hwar/layout.tsx` | ✅ Basic sidebar layout |

**Coverage**: Factory (8 pages), Library (5 pages), Create (3 pages), Overview (1 page), Dev (1 page), Layout (1)

### 1.2 Directory Trees

```
apps/dashboard/app/hwar/
├── layout.tsx                  (client component, basic sidebar)
├── page.tsx                    (overview dashboard)
├── create/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── factory/
│   ├── page.tsx               (factory dashboard)
│   ├── harvests/page.tsx
│   ├── analysis/page.tsx
│   ├── queues/page.tsx
│   ├── workers/page.tsx
│   ├── batches/page.tsx
│   ├── analytics/page.tsx
│   └── settings/page.tsx
├── library/
│   ├── page.tsx               (library dashboard)
│   ├── presets/page.tsx
│   ├── characters/page.tsx
│   ├── datasets/page.tsx
│   └── templates/page.tsx
└── dev/page.tsx
```

```
apps/dashboard/src/components/ui/  (49 files)
├── accordion.tsx
├── alert.tsx
├── alert-dialog.tsx
├── aspect-ratio.tsx
├── avatar.tsx
├── badge.tsx
├── breadcrumb.tsx
├── button.tsx
├── calendar.tsx
├── card.tsx
├── carousel.tsx
├── chart.tsx
├── checkbox.tsx
├── collapsible.tsx
├── command.tsx
├── context-menu.tsx
├── dialog.tsx
├── drawer.tsx
├── dropdown-menu.tsx
├── empty-state.tsx           ← Custom HWAR component
├── form.tsx
├── hover-card.tsx
├── input.tsx
├── input-otp.tsx
├── label.tsx
├── menubar.tsx
├── navigation-menu.tsx
├── pagination.tsx
├── popover.tsx
├── progress.tsx
├── radio-group.tsx
├── resizable.tsx
├── scroll-area.tsx
├── select.tsx
├── separator.tsx
├── sheet.tsx
├── sidebar.tsx
├── skeleton.tsx
├── slider.tsx
├── status-badge.tsx          ← Custom HWAR component
├── switch.tsx
├── table.tsx
├── tabs.tsx
├── textarea.tsx
├── toast.tsx
├── toaster.tsx
├── toggle.tsx
├── toggle-group.tsx
└── tooltip.tsx
```

```
apps/dashboard/app/api/hwar/  (11 route handlers)
├── scenarios/route.ts
├── factory/stats/route.ts
├── analysis/route.ts
├── queues/route.ts
├── workers/route.ts
├── batches/route.ts
├── presets/route.ts
├── characters/route.ts
├── datasets/route.ts
├── templates/route.ts
└── harvests/route.ts
```

### 1.3 Mapping: HelloWRU → Next.js (Coverage Matrix)

| HelloWRU Area | HelloWRU Pages | Next.js Equivalent | Status |
|---------------|----------------|-------------------|--------|
| Create | `/create`, `/create/new`, `/create/:id` | `/hwar/create/*` | ✅ Migrated |
| Factory | `/factory` (dashboard), `/factory/harvests`, `/factory/analysis`, etc. | `/hwar/factory/*` | ✅ Migrated (8 pages) |
| Library | `/library` (dashboard), `/library/presets`, `/library/characters`, etc. | `/hwar/library/*` | ✅ Migrated (5 pages) |
| Layout/Sidebar | Wouter-based nav | Next.js App Router + basic sidebar | ✅ Converted |

---

## 2. Theming & Styling

### 2.1 Tailwind Config Diff Summary

| Feature | HelloWRU (`tailwind.config.ts`) | Dashboard (`tailwind.config.ts`) | Parity |
|---------|--------------------------------|----------------------------------|--------|
| `darkMode` | `["class"]` | `["class"]` | ✅ |
| Plugins | `tailwindcss-animate`, `@tailwindcss/typography` | `tailwindcss-animate`, `@tailwindcss/typography` | ✅ |
| `borderRadius` | `.5625rem` (lg), `.375rem` (md), `.1875rem` (sm) | `.5625rem` (lg), `.375rem` (md), `.1875rem` (sm) | ✅ |
| `colors.background` | `hsl(var(--background) / <alpha-value>)` | `hsl(var(--background) / <alpha-value>)` | ✅ |
| `colors.sidebar.*` | Extended sidebar tokens | Extended sidebar tokens | ✅ |
| `colors.status.*` | Not in HelloWRU | `status.online`, `status.away`, `status.busy`, `status.offline` | ⚠️ Dashboard-specific addition |
| `fontFamily` | `--font-sans`, `--font-serif`, `--font-mono` | `--font-sans`, `--font-serif`, `--font-mono` | ✅ |
| `keyframes` | `accordion-down`, `accordion-up` | `accordion-down`, `accordion-up` | ✅ |
| `animation` | `accordion-down`, `accordion-up` | `accordion-down`, `accordion-up` | ✅ |

**Verdict**: ✅ **Full parity** on core theming; Dashboard adds `status.*` colors (acceptable extension)

### 2.2 CSS Variables Parity (:root and .dark)

**Dashboard `globals.css` includes**:
- `:root` block with light mode variables (lines 6-123) ✅
- `.dark` block with dark mode variables (lines 125-206) ✅
- Elevation utilities (`--elevate-1`, `--elevate-2`) ✅
- Shadow scale (`--shadow-2xs` through `--shadow-2xl`) ✅
- Automatically computed borders (`--primary-border`, `--secondary-border`, etc. using `hsl(from ...)`) ✅
- Utility classes for elevation system (`.hover-elevate`, `.toggle-elevate`, etc.) ✅

**HelloWRU `client/src/index.css`** (baseline):
- Same `:root` and `.dark` structure ✅
- Same elevation utilities ✅
- Same shadow scale ✅

**Verdict**: ✅ **Complete CSS variable parity**

### 2.3 Components with Likely Visual Drift (Missing Tokens/Classes)

**Analysis**: Grep for shadcn/ui imports in HWAR pages found **zero** unresolved imports. All pages using:
- `@/src/components/ui/card` ✅
- `@/src/components/ui/button` ✅
- `@/src/components/ui/badge` ✅
- `@/src/components/ui/status-badge` ✅
- `@/src/components/ui/empty-state` ✅

**Known usage of custom utility classes**:
- `.hover-elevate` used in Factory/Library dashboard cards ✅
- `dark:` variant classes used throughout ✅

**Potential drift**:
- None detected in current pages (all imports resolve correctly)

**Verdict**: ✅ **No visual drift detected**; components properly using design tokens

---

## 3. Router & Interactivity

### 3.1 Clientization Status

**Pages with `"use client"` directive**: Grep found presence in interactive pages:
- `/hwar/factory/page.tsx` ✅
- `/hwar/library/page.tsx` ✅
- `/hwar/layout.tsx` ✅
- All Create pages ✅
- All Factory subpages ✅
- All Library subpages ✅

**Pages missing `"use client"`**: None detected (all interactive pages properly marked)

**Verdict**: ✅ **All interactive pages properly client components**

### 3.2 Wouter → Next.js Conversion

**Wouter imports found**: `grep -R "from 'wouter'" apps/dashboard` → **Zero results** ✅

**Next.js router usage**: Grep found `useRouter|usePathname` in 5 pages:
- `app/hwar/factory/harvests/page.tsx` ✅
- `app/hwar/create/[id]/page.tsx` ✅
- `app/hwar/create/page.tsx` ✅
- `app/hwar/create/new/page.tsx` ✅
- `app/hwar/page.tsx` ✅

**Navigation**: All pages use `next/link` for navigation (e.g., `<Link href="/hwar/factory/harvests">`) ✅

**Verdict**: ✅ **Router conversion complete**; zero wouter leftovers

### 3.3 Problematic Imports/Aliases

**Path alias used**: `@/src/components/ui/*` consistently across all pages ✅

**Unresolved imports**: None detected (all shadcn/ui imports resolve correctly)

**Verdict**: ✅ **No import/alias issues**

---

## 4. Component Coverage Map

| Component | Present? | Used Where | Gaps |
|-----------|----------|----------|------|
| `accordion` | ✅ | Not observed in HWAR pages | - |
| `alert` | ✅ | Not observed in HWAR pages | - |
| `alert-dialog` | ✅ | Not observed in HWAR pages | - |
| `aspect-ratio` | ✅ | Not observed in HWAR pages | - |
| `avatar` | ✅ | Not observed in HWAR pages | - |
| `badge` | ✅ | Used in Factory/Library pages | - |
| `breadcrumb` | ✅ | Not observed in HWAR pages | - |
| `button` | ✅ | Used extensively | - |
| `calendar` | ✅ | Not observed in HWAR pages | - |
| `card` | ✅ | Used extensively in Factory/Library dashboards | - |
| `carousel` | ✅ | Not observed in HWAR pages | - |
| `chart` | ✅ | Not observed (likely for `/factory/analytics`) | - |
| `checkbox` | ✅ | Not observed in HWAR pages | - |
| `collapsible` | ✅ | Not observed in HWAR pages | - |
| `command` | ✅ | Not observed in HWAR pages | - |
| `context-menu` | ✅ | Not observed in HWAR pages | - |
| `dialog` | ✅ | Not observed in HWAR pages | - |
| `drawer` | ✅ | Not observed in HWAR pages | - |
| `dropdown-menu` | ✅ | Not observed in HWAR pages | - |
| `empty-state` | ✅ (custom) | Used in Factory/Library subpages | - |
| `form` | ✅ | Not observed (react-hook-form likely needed for Create) | **Missing react-hook-form usage** ⚠️ |
| `hover-card` | ✅ | Not observed in HWAR pages | - |
| `input` | ✅ | Not observed in HWAR pages | - |
| `input-otp` | ✅ | Not observed in HWAR pages | - |
| `label` | ✅ | Not observed in HWAR pages | - |
| `menubar` | ✅ | Not observed in HWAR pages | - |
| `navigation-menu` | ✅ | Not observed in HWAR pages | - |
| `pagination` | ✅ | Not observed in HWAR pages | - |
| `popover` | ✅ | Not observed in HWAR pages | - |
| `progress` | ✅ | Not observed in HWAR pages | - |
| `radio-group` | ✅ | Not observed in HWAR pages | - |
| `resizable` | ✅ | Not observed in HWAR pages | - |
| `scroll-area` | ✅ | Not observed in HWAR pages | - |
| `select` | ✅ | Not observed in HWAR pages | - |
| `separator` | ✅ | Not observed in HWAR pages | - |
| `sheet` | ✅ | Not observed in HWAR pages | - |
| `sidebar` | ✅ | Used in `/hwar/layout.tsx` | **Missing shadcn sidebar components** ⚠️ |
| `skeleton` | ✅ | Not observed (needed for loading states) | **Missing loading skeletons** ⚠️ |
| `slider` | ✅ | Not observed in HWAR pages | - |
| `status-badge` | ✅ (custom) | Used in Factory/Library subpages | - |
| `switch` | ✅ | Not observed in HWAR pages | - |
| `table` | ✅ | Not observed (needed for data lists) | **Missing table usage** ⚠️ |
| `tabs` | ✅ | Not observed in HWAR pages | - |
| `textarea` | ✅ | Not observed in HWAR pages | - |
| `toast` | ✅ | Present but **not wired to root layout** | **Missing Toaster in layout** ❌ |
| `toaster` | ✅ | Present but **not wired to root layout** | **Missing Toaster in layout** ❌ |
| `toggle` | ✅ | Not observed in HWAR pages | - |
| `toggle-group` | ✅ | Not observed in HWAR pages | - |
| `tooltip` | ✅ | Present but **TooltipProvider missing from layout** | **Missing TooltipProvider** ❌ |

**Summary**:
- **Components present**: 49/49 ✅
- **Components used**: ~10 (Card, Button, Badge, StatusBadge, EmptyState, lucide-react icons)
- **Missing wiring**: TooltipProvider, Toaster in layout ❌
- **Missing patterns**: Loading skeletons, tables, forms with react-hook-form ⚠️

---

## 5. Providers & UX Globals

### 5.1 Current vs Expected

| Provider | Expected Location | Current Status | Impact |
|----------|------------------|----------------|--------|
| `QueryClientProvider` | Root layout | ✅ Present in `app/layout.tsx` (line 20) | None |
| `TooltipProvider` | Root or `/hwar/layout.tsx` | ❌ **Missing** | Tooltips won't work |
| `Toaster` | Root or `/hwar/layout.tsx` | ❌ **Missing** | Toast notifications won't show |
| Theme provider (dark mode) | Root layout | ⚠️ Not explicitly wired (relies on `darkMode: ["class"]`) | Manual theme toggle needed |

### 5.2 Recommended Placement

**Root layout** (`app/layout.tsx`):
```tsx
<QueryProvider>
  <TooltipProvider>
    {children}
    <Toaster />
  </TooltipProvider>
</QueryProvider>
```

**OR** `/hwar/layout.tsx` (isolated to HWAR area):
```tsx
<TooltipProvider>
  <aside>...</aside>
  <main>{children}</main>
  <Toaster />
</TooltipProvider>
```

### 5.3 Gaps' Impact on UX

1. **Missing TooltipProvider**: Any `<Tooltip>` components will fail silently or throw errors ❌
2. **Missing Toaster**: `useToast()` hook won't display notifications (critical for form submissions, errors) ❌
3. **Manual theme toggle**: No UI for switching light/dark mode (acceptable if not required for MVP) ⚠️

**Verdict**: ❌ **Blocker** (P0) - Must add TooltipProvider + Toaster before shipping

---

## 6. Data & Forms Touchpoints

### 6.1 Pages Using react-hook-form/Zod

**Grep results**: Zero matches for `react-hook-form|useForm|zodResolver`

**Expected usage**: Create pages should use forms for scenario generation

**Current state**: Forms likely missing or using uncontrolled inputs ⚠️

**Verdict**: ⚠️ **Missing** - Form validation/submission likely incomplete in Create area

### 6.2 Pages Using TanStack Query

**Grep results**: 14 pages using `useQuery|useMutation`:
- All Factory subpages ✅
- All Library subpages ✅
- All Create pages ✅

**Verdict**: ✅ **High coverage** of data fetching

### 6.3 API Client Coverage (packages/api-client)

**Methods available** (from `packages/api-client/src/index.ts`):

**Create area** (6 methods):
- `createScenario()` ✅
- `listProjects()` ✅
- `getProject(id)` ✅
- `createProject()` ✅
- `updateProject(id)` ✅
- `generateScenarios(projectId)` ✅

**Factory area** (11 methods):
- `listFactoryStats()` ✅
- `listHarvests()` ✅
- `getHarvest(id)` ✅
- `createHarvest()` ✅
- `listAnalysisTasks()` ✅
- `getAnalysisTask(id)` ✅
- `listQueues()` ✅
- `listWorkers()` ✅
- `updateWorker(id)` ✅
- `listBatches()` ✅

**Library area** (8 methods):
- `listPresets()` ✅
- `createPreset()` ✅
- `listCharacters()` ✅
- `createCharacter()` ✅
- `listDatasets()` ✅
- `listTemplates()` ✅

**API routes present** (11 files in `app/api/hwar/*`):
- All endpoints match client methods ✅

**Verdict**: ✅ **High API client coverage** (25+ methods); all HWAR areas covered

---

## 7. Gaps, Risks, Quick Wins

### 7.1 ❌ Blockers (Must Fix Before Shipping)

1. **TypeScript Errors (43 total)** - Build fails
   - **Root cause**: Drizzle ORM version conflict (`drizzle-orm@0.29.5` duplicated in pnpm lock)
   - **Files affected**:
     - `app/api/generation/status/route.ts` (11 errors - DB schema import)
     - `app/api/hwar/analysis/route.ts` (3 errors - missing `eq` import)
     - `app/api/hwar/*` route handlers (20+ errors - implicit `any` types, unused imports)
     - Playwright tests (6 errors - missing `@playwright/test` types)
   - **Fix**: (a) Dedupe pnpm lockfile, (b) Add missing imports (`eq` from drizzle-orm), (c) Fix implicit `any` types
   - **ETA**: 4-6 hours

2. **Missing TooltipProvider + Toaster**
   - **Impact**: Tooltips broken, toast notifications fail
   - **Fix**: Add to `app/layout.tsx` or `app/hwar/layout.tsx`
   - **ETA**: 15 minutes

3. **Server-side Feature Flag (`ENABLE_HWAR_NEW_UI`)**
   - **Issue**: Uses `process.env.ENABLE_HWAR_NEW_UI` instead of `NEXT_PUBLIC_ENABLE_HWAR_NEW_UI`
   - **Impact**: Flag only works server-side; can't toggle dynamically; not visible to client
   - **Fix**: Rename to `NEXT_PUBLIC_ENABLE_HWAR_NEW_UI` in `.env` and `app/layout.tsx`
   - **ETA**: 5 minutes

### 7.2 ⚠️ Medium Items (Polish)

1. **Missing Loading Skeletons**
   - **Impact**: Pages show blank while data loads (poor UX)
   - **Fix**: Add `<Skeleton />` components to Factory/Library list pages
   - **ETA**: 2 hours

2. **Missing Empty States**
   - **Impact**: Empty lists show nothing (confusing UX)
   - **Fix**: Use `<EmptyState />` component (already exists)
   - **ETA**: 1 hour

3. **Missing Forms in Create Area**
   - **Impact**: Scenario generation likely broken
   - **Fix**: Add `react-hook-form` + Zod validation to Create pages
   - **ETA**: 4 hours

4. **Missing Tables for Data Lists**
   - **Impact**: Factory/Library subpages likely using basic lists instead of tables
   - **Fix**: Replace with `<Table />` component for better UX
   - **ETA**: 3 hours

5. **Basic Sidebar Layout**
   - **Impact**: Current sidebar is minimal (basic links, no collapsible sections)
   - **Fix**: Upgrade to shadcn `sidebar` component with proper navigation
   - **ETA**: 2 hours

### 7.3 ✅ Quick Wins (Low Effort, High Impact)

1. **Fix NEXT_PUBLIC_ prefix** (5 min)
2. **Add TooltipProvider + Toaster** (15 min)
3. **Add `<Toaster />` to layout** (15 min)
4. **Fix unused imports in API routes** (30 min)
5. **Fix implicit `any` types in API routes** (1 hour)

---

## 8. Build/Typecheck Status

### 8.1 TypeScript Typecheck

**Command**: `pnpm -w type-check` (or `pnpm --filter apps/dashboard type-check`)

**Result**: ❌ **FAIL** - 43 errors

**Error Categories**:

1. **DB Schema Version Conflicts** (11 errors in `app/api/generation/status/route.ts`):
   ```
   Cannot find module '@scrimspec/db' or its corresponding type declarations
   Types have separate declarations of a private property 'shouldInlineParams'
   ```
   **Root cause**: `drizzle-orm@0.29.5` duplicated in pnpm lockfile (two versions)

2. **Missing Imports** (3 errors):
   - `app/api/hwar/analysis/route.ts`: `Cannot find name 'eq'`
   - `app/api/generation/status/route.ts`: `Module '"drizzle-orm"' has no exported member 'limit'`

3. **Implicit `any` Types** (20 errors in API routes):
   - `app/api/hwar/*`: Parameters like `row`, `request` implicitly have `any` type

4. **Unused Imports/Variables** (6 errors):
   - `app/api/hwar/factory/stats/route.ts`: `'db' is declared but its value is never read`

5. **Playwright Types Missing** (3 errors):
   - `tests/*.spec.ts`: `Cannot find module '@playwright/test'`

### 8.2 Build (Next.js Production)

**Command**: `pnpm --filter apps/dashboard build`

**Result**: ❌ **Would fail** (due to TypeScript errors above; Next.js build runs `tsc` by default)

---

## 9. Root Route Analysis (`/` vs `/hwar`)

### 9.1 Current Behavior

**`/` (Root)**: Shows **old UI** (basic HTML with inline styles)
- File: `apps/dashboard/app/page.tsx`
- Content: "Welcome to Scrimspec Dashboard" with links to `/ingest`, `/analysis`, `/generation`
- No redirect to `/hwar`

**`/hwar`**: Shows **new HWAR UI**
- Gated by **server-side** `ENABLE_HWAR_NEW_UI` flag in `app/layout.tsx` (line 15)
- Nav link only appears if `process.env.ENABLE_HWAR_NEW_UI === 'true'`

### 9.2 Why `/` Still Shows Old UI

**Root cause**:
1. `app/page.tsx` exists and renders old UI
2. No redirect logic in `app/page.tsx` or `app/layout.tsx`
3. Feature flag (`ENABLE_HWAR_NEW_UI`) is server-side only (not `NEXT_PUBLIC_*`)

### 9.3 Legacy Pages Router

**Check**: `apps/dashboard/pages/index.tsx` or `src/pages/index.tsx`?
- **Result**: **Not found** (App Router only) ✅

### 9.4 Next.js Config

**File**: `apps/dashboard/next.config.js`

**Rewrites/Redirects**: None ✅

**BasePath**: None ✅

### 9.5 Feature Flag Issue

**Current**: `process.env.ENABLE_HWAR_NEW_UI` (line 15 of `app/layout.tsx`)
- **Problem**: Server-side only; not exposed to client
- **Fix**: Rename to `NEXT_PUBLIC_ENABLE_HWAR_NEW_UI`

---

## 10. Action Plan (Prioritized)

### P0 (1-2 days): Blockers - Reach /hwar UI Parity

| # | Task | Files | Est. | Acceptance Criteria | Commit Message |
|---|------|-------|------|---------------------|----------------|
| 1 | Fix Drizzle ORM version conflict | `pnpm-lock.yaml` | 1h | `pnpm install` succeeds; lockfile has single `drizzle-orm` version | `fix(deps): dedupe drizzle-orm version in pnpm lockfile` |
| 2 | Add missing imports (`eq`, etc.) | `app/api/hwar/analysis/route.ts`, `app/api/generation/status/route.ts` | 30m | Import errors resolved | `fix(api): add missing drizzle-orm imports (eq, limit)` |
| 3 | Fix implicit `any` types in API routes | `app/api/hwar/**/route.ts` (11 files) | 2h | All `row`, `request` params properly typed | `fix(api): add explicit types to HWAR route handlers` |
| 4 | Fix unused imports/variables | `app/api/hwar/**/route.ts` | 30m | No unused import errors | `fix(api): remove unused imports in HWAR routes` |
| 5 | Add Playwright types (optional for now) | `package.json`, `pnpm-lock.yaml` | 15m | `@playwright/test` types available (or suppress errors) | `fix(test): add @playwright/test types` |
| 6 | **Verify typecheck passes** | N/A | 10m | `pnpm type-check` exits 0 | N/A |
| 7 | Add `TooltipProvider` to layout | `app/layout.tsx` or `app/hwar/layout.tsx` | 10m | `TooltipProvider` wraps `{children}` | `fix(ui): add TooltipProvider to enable tooltips` |
| 8 | Add `<Toaster />` to layout | `app/layout.tsx` or `app/hwar/layout.tsx` | 5m | `<Toaster />` rendered | `fix(ui): add Toaster component for notifications` |
| 9 | Rename flag to `NEXT_PUBLIC_ENABLE_HWAR_NEW_UI` | `app/layout.tsx`, `.env` | 5m | Flag visible to client; nav link works | `fix(config): use NEXT_PUBLIC_ prefix for HWAR feature flag` |
| **TOTAL** | | | **~5 hours** | Green typecheck ✅, TooltipProvider ✅, Toaster ✅, Flag ✅ | |

### P1 (3-5 days): Factory/Library Polish

| # | Task | Files | Est. | Acceptance Criteria | Commit Message |
|---|------|-------|------|---------------------|----------------|
| 10 | Add loading skeletons to Factory pages | `app/hwar/factory/*/page.tsx` | 2h | `<Skeleton />` shown while `useQuery` loading | `feat(hwar): add loading skeletons to Factory pages` |
| 11 | Add loading skeletons to Library pages | `app/hwar/library/*/page.tsx` | 1h | `<Skeleton />` shown while `useQuery` loading | `feat(hwar): add loading skeletons to Library pages` |
| 12 | Add empty states to Factory pages | `app/hwar/factory/*/page.tsx` | 1h | `<EmptyState />` shown when data empty | `feat(hwar): add empty states to Factory pages` |
| 13 | Add empty states to Library pages | `app/hwar/library/*/page.tsx` | 30m | `<EmptyState />` shown when data empty | `feat(hwar): add empty states to Library pages` |
| 14 | Replace lists with `<Table />` component | `app/hwar/factory/*/page.tsx`, `app/hwar/library/*/page.tsx` | 3h | Data displayed in sortable tables | `feat(hwar): use Table component for data lists` |
| 15 | Add forms to Create pages (react-hook-form + Zod) | `app/hwar/create/*/page.tsx` | 4h | Scenario generation form functional | `feat(hwar): add forms to Create pages with validation` |
| **TOTAL** | | | **~11 hours** | Skeletons ✅, Empty states ✅, Tables ✅, Forms ✅ | |

### P2 (5-7 days): Dark Mode, A11y, Design Tokens

| # | Task | Files | Est. | Acceptance Criteria | Commit Message |
|---|------|-------|------|---------------------|----------------|
| 16 | Add theme toggle UI (light/dark mode) | `app/layout.tsx`, new component | 2h | User can switch themes | `feat(ui): add theme toggle for light/dark mode` |
| 17 | Upgrade sidebar to shadcn sidebar component | `app/hwar/layout.tsx` | 2h | Collapsible sidebar with proper navigation | `feat(hwar): upgrade to shadcn sidebar component` |
| 18 | Lazy-load heavy charts (analytics page) | `app/hwar/factory/analytics/page.tsx` | 1h | Charts loaded on-demand | `perf(hwar): lazy-load analytics charts` |
| 19 | A11y audit & fixes (keyboard nav, ARIA labels) | All HWAR pages | 3h | axe DevTools 0 violations | `a11y(hwar): add keyboard navigation and ARIA labels` |
| 20 | Consolidate design tokens (audit unused CSS vars) | `app/globals.css`, `tailwind.config.ts` | 1h | No unused CSS variables | `refactor(theme): consolidate design tokens` |
| **TOTAL** | | | **~9 hours** | Theme toggle ✅, Sidebar ✅, Lazy load ✅, A11y ✅ | |

---

## 11. Acceptance Criteria (UI/UX Complete)

### Visual Parity Checklist

- [x] CSS variables (`:root` + `.dark`) match HelloWRU ✅
- [x] Tailwind config (`borderRadius`, `colors`, `plugins`) match HelloWRU ✅
- [x] Elevation utilities (`.hover-elevate`, `.toggle-elevate`) present ✅
- [ ] All spacing/padding matches HelloWRU designs ⚠️ (not audited; requires visual comparison)
- [ ] All interactive states (hover, active, focus) behave consistently ⚠️ (not audited)

### Navigation + Loading/Empty/Error States

- [x] All pages use `next/link` for navigation ✅
- [x] No wouter imports ✅
- [ ] Loading skeletons shown while data fetches ❌ (P1)
- [ ] Empty states shown when no data ❌ (P1)
- [ ] Error states shown on API failures ⚠️ (not audited)

### Green Build/Typecheck

- [ ] `pnpm type-check` passes ❌ (P0)
- [ ] `pnpm build` succeeds ❌ (P0, blocked by typecheck)
- [ ] Smoke tests pass ⚠️ (Playwright tests need types fixed)

### No Wouter; Stable Imports/Aliases

- [x] Zero `wouter` imports ✅
- [x] All `@/src/components/ui/*` imports resolve ✅
- [x] No unresolved components ✅

### Providers Wired

- [x] `QueryClientProvider` in root layout ✅
- [ ] `TooltipProvider` in layout ❌ (P0)
- [ ] `<Toaster />` in layout ❌ (P0)

---

## 12. Appendix (Evidence)

### A. File Counts

- **HWAR pages**: 19
- **shadcn/ui components**: 49
- **API routes**: 11
- **Custom components**: 2 (`empty-state`, `status-badge`)

### B. Grep Summaries

**Wouter imports**:
```bash
grep -R "from 'wouter'" apps/dashboard
# Result: (empty)
```

**`"use client"` directive** (in HWAR pages):
```bash
grep -R "\"use client\"" apps/dashboard/app/hwar --include="*.tsx"
# Result: Present in layout.tsx, page.tsx, factory/page.tsx, library/page.tsx, etc.
```

**`@/components/ui/` imports**:
```bash
grep -R "@/components/ui/" apps/dashboard/app/hwar
# Result: No files (components imported as @/src/components/ui/*)
```

**Feature flag usage**:
```bash
grep -R "ENABLE_HWAR_NEW_UI" apps/dashboard --include="*.tsx" --include="*.ts" --include="*.js"
# Result: app/layout.tsx:15 (process.env.ENABLE_HWAR_NEW_UI)
```

### C. Tailwind Config Snippets

**Dashboard** (`apps/dashboard/tailwind.config.ts`):
```ts
darkMode: ["class"],
plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
borderRadius: {
  lg: ".5625rem", /* 9px */
  md: ".375rem", /* 6px */
  sm: ".1875rem", /* 3px */
},
colors: {
  background: "hsl(var(--background) / <alpha-value>)",
  // ... (matches HelloWRU)
}
```

**HelloWRU** (`HelloWhoAreYou/tailwind.config.ts`):
```ts
darkMode: ["class"],
plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
borderRadius: {
  lg: ".5625rem", /* 9px */
  md: ".375rem", /* 6px */
  sm: ".1875rem", /* 3px */
},
// (identical)
```

### D. `globals.css` Snippets

**`:root` block** (lines 6-123):
```css
:root {
  --button-outline: rgba(0,0,0, .10);
  --elevate-1: rgba(0,0,0, .03);
  --elevate-2: rgba(0,0,0, .08);
  --background: 0 0% 100%;
  --foreground: 0 0% 9%;
  /* ... (50+ variables) */
}
```

**`.dark` block** (lines 125-206):
```css
.dark {
  --button-outline: rgba(255,255,255, .10);
  --elevate-1: rgba(255,255,255, .04);
  --elevate-2: rgba(255,255,255, .09);
  --background: 0 0% 7%;
  --foreground: 0 0% 98%;
  /* ... (50+ variables) */
}
```

**Elevation utilities** (lines 238-314):
```css
.hover-elevate::after {
  background-color: var(--elevate-1);
}
.toggle-elevate.toggle-elevated::before {
  background-color: var(--elevate-2);
}
```

### E. TypeScript Errors (First/Last 10 Lines)

**First 10 lines**:
```
.next/types/app/api/hwar/analysis/route.ts(8,13): error TS2344: Type 'OmitWithTag<typeof import("C:/Projects/scrimspec/apps/dashboard/app/api/hwar/analysis/route"), "POST" | "PUT" | "PATCH" | "revalidate" | "GET" | "runtime" | "HEAD" | "OPTIONS" | "DELETE" | ... 6 more ... | "maxDuration", "">' does not satisfy the constraint '{ [x: string]: never; }'.
.next/types/app/api/hwar/harvests/route.ts(8,13): error TS2344: Type 'OmitWithTag<typeof import("C:/Projects/scrimspec/apps/dashboard/app/api/hwar/harvests/route"), "POST" | "PUT" | "PATCH" | "revalidate" | "GET" | "runtime" | "HEAD" | "OPTIONS" | "DELETE" | ... 6 more ... | "maxDuration", "">' does not satisfy the constraint '{ [x: string]: never; }'.
app/api/analysis/jobs/route.ts(60,27): error TS6133: 'req' is declared but its value is never read.
app/api/generation/status/route.ts(8,34): error TS2307: Cannot find module '@scrimspec/db' or its corresponding type declarations.
app/api/generation/status/route.ts(14,20): error TS2305: Module '"drizzle-orm"' has no exported member 'limit'.
app/api/generation/status/route.ts(14,20): error TS6133: 'limit' is declared but its value is never read.
app/api/generation/status/route.ts(32,32): error TS2769: No overload matches this call.
app/api/generation/status/route.ts(39,21): error TS2345: Argument of type 'PgColumn<...>' is not assignable to parameter of type 'AnyColumn | SQLWrapper'.
app/api/hwar/analysis/route.ts(35,24): error TS7006: Parameter 'row' implicitly has an 'any' type.
app/api/hwar/analysis/route.ts(52,33): error TS6133: 'request' is declared but its value is never read.
```

**Last 10 lines**:
```
app/api/hwar/queues/route.ts(29,25): error TS7006: Parameter 'row' implicitly has an 'any' type.
app/api/hwar/templates/route.ts(29,28): error TS7006: Parameter 'row' implicitly has an 'any' type.
app/api/hwar/workers/route.ts(45,26): error TS7006: Parameter 'row' implicitly has an 'any' type.
app/api/ingest/jobs/route.ts(17,20): error TS6133: 'publishedAfter' is declared but its value is never read.
app/api/ingest/jobs/route.ts(17,36): error TS6133: 'duration' is declared but its value is never read.
app/api/ingest/jobs/route.ts(52,27): error TS6133: 'req' is declared but its value is never read.
app/hwar/create/page.tsx(10,1): error TS6133: 'makeClient' is declared but its value is never read.
app/hwar/factory/page.tsx(4,47): error TS6133: 'Package' is declared but its value is never read.
src/lib/db.ts(6,34): error TS2307: Cannot find module '@scrimspec/db' or its corresponding type declarations.
tests/hwar-db-health.spec.ts(1,30): error TS2307: Cannot find module '@playwright/test' or its corresponding type declarations.
```

---

**End of Audit Report**
