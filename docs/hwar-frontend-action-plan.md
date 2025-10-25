# HWAR Frontend Action Plan

**Date**: 2025-10-25
**Project**: Scrimspec Monorepo
**Goal**: Achieve UI/UX completeness and visual parity for `/hwar` area
**Related**: [hwar-frontend-uiux-audit.md](./hwar-frontend-uiux-audit.md)

---

## Overview

This action plan provides a **prioritized, time-boxed roadmap** to complete the HelloWhoAreYou frontend migration. Tasks are grouped into three phases (P0, P1, P2) with:
- **Concrete file paths** to edit
- **Acceptance criteria** (testable/observable)
- **Time estimates** (hours)
- **Atomic commit messages** (for clean git history)

**Total effort**:
- **P0 (Blockers)**: ~5 hours → Ready for `/hwar` gated launch
- **P1 (Polish)**: ~11 hours → Production-ready Factory/Library
- **P2 (Nice-to-have)**: ~9 hours → Dark mode toggle, a11y, perf

---

## P0: Blockers (1-2 Days) — Make `/hwar` Shippable

**Goal**: Fix TypeScript errors, add missing providers, fix feature flag → `/hwar` functional under feature flag.

### Task 1: Dedupe Drizzle ORM Version in Lockfile

**Problem**: `drizzle-orm@0.29.5` appears twice in `pnpm-lock.yaml`, causing type conflicts.

**Files**:
- `pnpm-lock.yaml`

**Steps**:
```bash
# From repo root
pnpm install --no-frozen-lockfile
pnpm dedupe
```

**Acceptance Criteria**:
- `pnpm-lock.yaml` has single entry for `drizzle-orm`
- `pnpm install` succeeds without warnings

**Estimate**: 1 hour (includes retesting)

**Commit Message**:
```
fix(deps): dedupe drizzle-orm version in pnpm lockfile

- Resolves type conflicts causing 11 errors in generation/status route
- Single drizzle-orm@0.29.5 version now in lockfile
```

---

### Task 2: Add Missing Drizzle Imports

**Problem**: `eq` missing in `analysis/route.ts`; `limit` import fails in `generation/status/route.ts`.

**Files**:
- `apps/dashboard/app/api/hwar/analysis/route.ts`
- `apps/dashboard/app/api/generation/status/route.ts`

**Steps**:

**File**: `app/api/hwar/analysis/route.ts`
```ts
// Add to existing drizzle-orm import (line ~5)
import { desc, eq } from "drizzle-orm";

// Fix line 59 (use imported eq)
.where(eq(hwarAnalysisTasks.id, id))
```

**File**: `app/api/generation/status/route.ts`
```ts
// Remove broken import of 'limit' (line 14)
// Use inline limit in query instead:
.limit(10)
```

**Acceptance Criteria**:
- No `Cannot find name 'eq'` errors
- No `Module '"drizzle-orm"' has no exported member 'limit'` errors

**Estimate**: 30 minutes

**Commit Message**:
```
fix(api): add missing drizzle-orm imports (eq)

- Import eq in analysis route to fix query filtering
- Remove invalid limit import in generation/status route
- Use inline .limit() method instead
```

---

### Task 3: Fix Implicit `any` Types in API Route Handlers

**Problem**: 20+ errors where parameters like `row`, `request` have implicit `any` type.

**Files** (11 files):
- `app/api/hwar/analysis/route.ts`
- `app/api/hwar/batches/route.ts`
- `app/api/hwar/characters/route.ts`
- `app/api/hwar/datasets/route.ts`
- `app/api/hwar/harvests/route.ts`
- `app/api/hwar/presets/route.ts`
- `app/api/hwar/queues/route.ts`
- `app/api/hwar/templates/route.ts`
- `app/api/hwar/workers/route.ts`
- `app/api/analysis/jobs/route.ts`
- `app/api/ingest/jobs/route.ts`

**Pattern**:
```ts
// Before (implicit any)
.map((row) => ({ ... }))

// After (explicit type from DB schema)
.map((row: typeof hwarAnalysisTasks.$inferSelect) => ({ ... }))

// OR for simpler cases
.map((row: any) => ({ ... }))  // Quick fix if type inference hard
```

**Acceptance Criteria**:
- Zero `Parameter 'X' implicitly has an 'any' type` errors
- TypeScript can infer row types from DB schema

**Estimate**: 2 hours (11 files × ~10 min each)

**Commit Message**:
```
fix(api): add explicit types to HWAR route handler parameters

- Fix implicit 'any' types in .map() callbacks (row, request params)
- Use $inferSelect types from DB schema for type safety
- Resolves 20+ TypeScript errors in API routes
```

---

### Task 4: Remove Unused Imports/Variables

**Problem**: 6 errors for unused imports (`db`, `eq`, `ErrorResponse`, `Package`, etc.).

**Files**:
- `app/api/hwar/factory/stats/route.ts`
- `app/api/hwar/presets/route.ts`
- `app/api/hwar/characters/route.ts`
- `app/hwar/create/page.tsx`
- `app/hwar/factory/page.tsx`
- `app/hwar/factory/queues/page.tsx`

**Steps**:
```ts
// Remove unused imports:
// - 'db' from factory/stats/route.ts (line 4)
// - 'eq' from presets/route.ts (line 6)
// - 'ErrorResponse' from presets/route.ts (line 31), characters/route.ts (line 31)
// - 'makeClient' from create/page.tsx (line 10)
// - 'Package' from factory/page.tsx (line 4)
// - 'StatusBadge' from factory/queues/page.tsx (line 6)
```

**Acceptance Criteria**:
- Zero `'X' is declared but its value is never read` errors

**Estimate**: 30 minutes

**Commit Message**:
```
fix(api): remove unused imports in HWAR routes

- Clean up dead imports (db, eq, ErrorResponse, etc.)
- Resolves 6 TypeScript linting errors
```

---

### Task 5: Fix Playwright Test Types (Optional for P0)

**Problem**: 3 errors `Cannot find module '@playwright/test'`.

**Files**:
- `tests/hwar-db-health.spec.ts`
- `tests/hwar-factory-smoke.spec.ts`
- `tests/hwar-library-smoke.spec.ts`

**Option A (Quick)**: Suppress errors by excluding from tsconfig:
```json
// tsconfig.json
{
  "exclude": ["tests/**/*.spec.ts"]
}
```

**Option B (Proper)**: Install Playwright types:
```bash
pnpm add -D @playwright/test --filter apps/dashboard
```

**Acceptance Criteria**:
- `@playwright/test` types available OR tests excluded from typecheck

**Estimate**: 15 minutes

**Commit Message**:
```
fix(test): add @playwright/test types for E2E tests

- Install @playwright/test devDependency
- Resolves 3 TypeScript errors in smoke tests
```

---

### Task 6: Verify Typecheck Passes

**Steps**:
```bash
cd apps/dashboard
pnpm type-check
# Should exit 0 with no errors
```

**Acceptance Criteria**:
- `pnpm type-check` passes ✅

**Estimate**: 10 minutes (verification)

---

### Task 7: Add TooltipProvider to Layout

**Problem**: Tooltips won't work without `<TooltipProvider>` wrapper.

**Files**:
- `apps/dashboard/app/hwar/layout.tsx` (recommended) OR
- `apps/dashboard/app/layout.tsx` (global)

**Steps**:

**Option 1** (scoped to HWAR):
```tsx
// app/hwar/layout.tsx
"use client";

import { TooltipProvider } from "@/src/components/ui/tooltip";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="min-h-dvh flex">
        <aside className="w-64 shrink-0 border-r p-4 space-y-2">
          {/* ... existing sidebar ... */}
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </TooltipProvider>
  );
}
```

**Option 2** (global):
```tsx
// app/layout.tsx
import { TooltipProvider } from "@/src/components/ui/tooltip";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <TooltipProvider>
            {/* ... existing header/nav ... */}
            <main style={{ padding: '2rem' }}>
              {children}
            </main>
            {/* ... existing footer ... */}
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

**Acceptance Criteria**:
- `<Tooltip>` components render without errors
- Hover over elements with tooltips shows popover

**Estimate**: 10 minutes

**Commit Message**:
```
fix(ui): add TooltipProvider to enable tooltips

- Wrap HWAR layout with TooltipProvider
- Tooltips now functional across all HWAR pages
```

---

### Task 8: Add Toaster Component to Layout

**Problem**: `useToast()` hook won't display notifications without `<Toaster />`.

**Files**:
- `apps/dashboard/app/hwar/layout.tsx` (recommended) OR
- `apps/dashboard/app/layout.tsx` (global)

**Steps**:

**Option 1** (scoped to HWAR):
```tsx
// app/hwar/layout.tsx
"use client";

import { TooltipProvider } from "@/src/components/ui/tooltip";
import { Toaster } from "@/src/components/ui/toaster";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="min-h-dvh flex">
        <aside className="w-64 shrink-0 border-r p-4 space-y-2">
          {/* ... existing sidebar ... */}
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
```

**Acceptance Criteria**:
- Call `toast({ title: "Test" })` → notification appears
- Toast animations work (slide in/out)

**Estimate**: 5 minutes

**Commit Message**:
```
fix(ui): add Toaster component for notifications

- Render <Toaster /> in HWAR layout
- Toast notifications now functional (success/error/info)
```

---

### Task 9: Fix Feature Flag to Use NEXT_PUBLIC_ Prefix

**Problem**: `ENABLE_HWAR_NEW_UI` is server-side only; won't work for client-side gating.

**Files**:
- `apps/dashboard/app/layout.tsx`
- `.env` (or `.env.local`)

**Steps**:

**File**: `app/layout.tsx`
```tsx
// Before (line 15)
const enableHwarNewUi = process.env.ENABLE_HWAR_NEW_UI === 'true';

// After
const enableHwarNewUi = process.env.NEXT_PUBLIC_ENABLE_HWAR_NEW_UI === 'true';
```

**File**: `.env` (create if not exists)
```bash
NEXT_PUBLIC_ENABLE_HWAR_NEW_UI=true
```

**Acceptance Criteria**:
- `/hwar` link appears in nav when flag is `true`
- `/hwar` link hidden when flag is `false` or unset
- Flag is client-accessible (can toggle without rebuild)

**Estimate**: 5 minutes

**Commit Message**:
```
fix(config): use NEXT_PUBLIC_ prefix for HWAR feature flag

- Rename ENABLE_HWAR_NEW_UI → NEXT_PUBLIC_ENABLE_HWAR_NEW_UI
- Makes flag client-accessible for runtime toggling
- Add flag to .env with default value 'true'
```

---

### P0 Summary

| # | Task | Est. | Cumulative |
|---|------|------|------------|
| 1 | Dedupe Drizzle ORM | 1h | 1h |
| 2 | Add missing imports | 30m | 1.5h |
| 3 | Fix implicit `any` types | 2h | 3.5h |
| 4 | Remove unused imports | 30m | 4h |
| 5 | Fix Playwright types (optional) | 15m | 4.25h |
| 6 | Verify typecheck | 10m | 4.5h |
| 7 | Add TooltipProvider | 10m | 4.67h |
| 8 | Add Toaster | 5m | 4.75h |
| 9 | Fix NEXT_PUBLIC_ flag | 5m | **4.8h** (~5 hours) |

**Deliverable**: `/hwar` functional, typecheck green, ready for gated launch ✅

---

## P1: Polish (3-5 Days) — Production-Ready Factory/Library

**Goal**: Add loading skeletons, empty states, tables, forms → complete UX.

### Task 10: Add Loading Skeletons to Factory Pages

**Problem**: Pages show blank screen while data loads (poor UX).

**Files** (8 pages):
- `app/hwar/factory/harvests/page.tsx`
- `app/hwar/factory/analysis/page.tsx`
- `app/hwar/factory/queues/page.tsx`
- `app/hwar/factory/workers/page.tsx`
- `app/hwar/factory/batches/page.tsx`
- `app/hwar/factory/analytics/page.tsx`
- `app/hwar/factory/settings/page.tsx`

**Pattern**:
```tsx
import { Skeleton } from "@/src/components/ui/skeleton";

export default function FactoryHarvests() {
  const { data, isLoading } = useQuery({ ... });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />  {/* Page title */}
        <Skeleton className="h-4 w-full" /> {/* Placeholder rows */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  return (/* ... actual content ... */);
}
```

**Acceptance Criteria**:
- Loading skeletons appear immediately on page load
- Skeletons match final content layout (height/width similar)
- Smooth transition from skeleton → real content

**Estimate**: 2 hours (8 pages × 15 min each)

**Commit Message**:
```
feat(hwar): add loading skeletons to Factory pages

- Show skeleton UI while useQuery fetching data
- Improves perceived performance on slow connections
- Covers Harvests, Analysis, Queues, Workers, Batches, Analytics, Settings
```

---

### Task 11: Add Loading Skeletons to Library Pages

**Files** (4 pages):
- `app/hwar/library/presets/page.tsx`
- `app/hwar/library/characters/page.tsx`
- `app/hwar/library/datasets/page.tsx`
- `app/hwar/library/templates/page.tsx`

**Steps**: Same pattern as Task 10

**Acceptance Criteria**: Same as Task 10

**Estimate**: 1 hour (4 pages × 15 min each)

**Commit Message**:
```
feat(hwar): add loading skeletons to Library pages

- Show skeleton UI while loading Presets, Characters, Datasets, Templates
- Consistent loading UX across Factory and Library areas
```

---

### Task 12: Add Empty States to Factory Pages

**Problem**: Empty data lists show nothing (confusing UX).

**Files**: Same 8 Factory pages as Task 10

**Pattern**:
```tsx
import { EmptyState } from "@/src/components/ui/empty-state";

export default function FactoryHarvests() {
  const { data, isLoading } = useQuery({ ... });

  if (isLoading) return <Skeleton .../>;

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No harvests yet"
        description="Start your first harvest to analyze YouTube videos"
        actionLabel="Create Harvest"
        actionHref="/hwar/factory/harvests/new"
      />
    );
  }

  return (/* ... data list ... */);
}
```

**Acceptance Criteria**:
- Empty state shown when `data.length === 0`
- Actionable CTA ("Create X") links to creation page
- Illustration/icon makes it feel intentional (not broken)

**Estimate**: 1 hour (8 pages × 7-8 min each)

**Commit Message**:
```
feat(hwar): add empty states to Factory pages

- Show EmptyState component when no data available
- Include actionable CTAs to guide users
- Covers all Factory subpages (Harvests, Analysis, etc.)
```

---

### Task 13: Add Empty States to Library Pages

**Files**: Same 4 Library pages as Task 11

**Steps**: Same pattern as Task 12

**Acceptance Criteria**: Same as Task 12

**Estimate**: 30 minutes (4 pages × 7-8 min each)

**Commit Message**:
```
feat(hwar): add empty states to Library pages

- Show EmptyState for empty Presets, Characters, Datasets, Templates
- Consistent UX with Factory area
```

---

### Task 14: Replace Lists with Table Component

**Problem**: Data lists are basic (unsorted, no pagination).

**Files**: Factory/Library list pages (12 total)

**Pattern**:
```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

export default function FactoryHarvests() {
  const { data } = useQuery({ ... });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((harvest) => (
          <TableRow key={harvest.id}>
            <TableCell>{harvest.name}</TableCell>
            <TableCell><StatusBadge status={harvest.status} /></TableCell>
            <TableCell>{new Date(harvest.createdAt).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Acceptance Criteria**:
- Data displayed in table format (rows/columns)
- Table headers visually distinct
- Rows hover-able (`.hover-elevate` optional)

**Estimate**: 3 hours (12 pages × 15 min each)

**Commit Message**:
```
feat(hwar): use Table component for data lists

- Replace basic lists with shadcn Table component
- Improves scannability and visual hierarchy
- Covers Factory (Harvests, Analysis, etc.) and Library (Presets, Characters, etc.)
```

---

### Task 15: Add Forms to Create Pages (react-hook-form + Zod)

**Problem**: Scenario generation forms likely missing or uncontrolled.

**Files**:
- `app/hwar/create/page.tsx`
- `app/hwar/create/new/page.tsx`
- `app/hwar/create/[id]/page.tsx`

**Steps**:

1. **Install dependencies**:
```bash
pnpm add react-hook-form @hookform/resolvers zod --filter apps/dashboard
```

2. **Example form** (`create/new/page.tsx`):
```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/src/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { client } from "@project/api-client";
import { useToast } from "@/src/hooks/use-toast";
import { useRouter } from "next/navigation";

const schema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  theme: z.string().optional(),
  emotions: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CreateNew() {
  const { toast } = useToast();
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { projectName: "", theme: "", emotions: [] },
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => client.hwar.createProject(values),
    onSuccess: (data) => {
      toast({ title: "Project created", description: `ID: ${data.id}` });
      router.push(`/hwar/create/${data.id}`);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-semibold mb-6">Create New Project</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
          <FormField
            control={form.control}
            name="projectName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name</FormLabel>
                <FormControl>
                  <Input placeholder="My awesome project" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
```

**Acceptance Criteria**:
- Form validates on submit (shows errors)
- Submit triggers API call (via `useMutation`)
- Success → redirects to project detail page
- Error → shows toast notification

**Estimate**: 4 hours (3 pages × 1-1.5 hours each)

**Commit Message**:
```
feat(hwar): add forms to Create pages with validation

- Implement react-hook-form + Zod for project/scenario creation
- Add form validation with error messages
- Wire up to API client methods (createProject, generateScenarios)
- Show toast notifications on success/error
```

---

### P1 Summary

| # | Task | Est. | Cumulative |
|---|------|------|------------|
| 10 | Loading skeletons (Factory) | 2h | 2h |
| 11 | Loading skeletons (Library) | 1h | 3h |
| 12 | Empty states (Factory) | 1h | 4h |
| 13 | Empty states (Library) | 30m | 4.5h |
| 14 | Tables for data lists | 3h | 7.5h |
| 15 | Forms with validation | 4h | **11.5h** (~12 hours) |

**Deliverable**: Production-ready UX with loading states, empty states, tables, forms ✅

---

## P2: Nice-to-Have (5-7 Days) — Dark Mode, A11y, Perf

**Goal**: Add theme toggle, improve a11y, lazy-load charts, consolidate tokens.

### Task 16: Add Theme Toggle UI (Light/Dark Mode)

**Problem**: Users can't switch themes (relies on system preference only).

**Files**:
- `apps/dashboard/src/components/theme-toggle.tsx` (new)
- `apps/dashboard/app/layout.tsx` (add toggle to header)

**Steps**:

1. **Create theme toggle component**:
```tsx
// src/components/theme-toggle.tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initialTheme);
    root.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    localStorage.setItem("theme", newTheme);
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );
}
```

2. **Add to header** (`app/layout.tsx`):
```tsx
import { ThemeToggle } from "@/src/components/theme-toggle";

<header style={{ borderBottom: '1px solid #ccc', padding: '1rem' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <h1>Scrimspec Dashboard</h1>
    <ThemeToggle />
  </div>
  {/* ... existing nav ... */}
</header>
```

**Acceptance Criteria**:
- Clicking toggle switches light ↔ dark
- Theme persists across page reloads (localStorage)
- Respects system preference on first load

**Estimate**: 2 hours

**Commit Message**:
```
feat(ui): add theme toggle for light/dark mode

- Create ThemeToggle component with localStorage persistence
- Add toggle button to header (Moon/Sun icon)
- Respects system preference on initial load
```

---

### Task 17: Upgrade Sidebar to shadcn Sidebar Component

**Problem**: Current sidebar is basic (no collapsible sections, no active state).

**Files**:
- `app/hwar/layout.tsx`

**Steps**:

Use shadcn `sidebar` component (already present in `src/components/ui/sidebar.tsx`):

```tsx
"use client";

import { TooltipProvider } from "@/src/components/ui/tooltip";
import { Toaster } from "@/src/components/ui/toaster";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/src/components/ui/sidebar";
import { Home, PlusCircle, Factory, Library } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>HWAR</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/hwar"}>
                    <Link href="/hwar">
                      <Home />
                      <span>Overview</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/hwar/create")}>
                    <Link href="/hwar/create">
                      <PlusCircle />
                      <span>Create</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/hwar/factory")}>
                    <Link href="/hwar/factory">
                      <Factory />
                      <span>Factory</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/hwar/library")}>
                    <Link href="/hwar/library">
                      <Library />
                      <span>Library</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
```

**Acceptance Criteria**:
- Active route highlighted in sidebar
- Sidebar collapsible (optional)
- Icons + labels aligned properly

**Estimate**: 2 hours

**Commit Message**:
```
feat(hwar): upgrade to shadcn sidebar component

- Replace basic sidebar with shadcn Sidebar primitives
- Add active route highlighting with usePathname
- Icons aligned with labels for better UX
```

---

### Task 18: Lazy-Load Heavy Charts (Analytics Page)

**Problem**: Analytics page may load heavy charting library upfront.

**Files**:
- `app/hwar/factory/analytics/page.tsx`

**Steps**:

```tsx
import dynamic from "next/dynamic";
import { Skeleton } from "@/src/components/ui/skeleton";

// Lazy-load chart component
const AnalyticsChart = dynamic(() => import("@/src/components/hwar/analytics-chart"), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
});

export default function FactoryAnalytics() {
  return (
    <div>
      <h1>Analytics</h1>
      <AnalyticsChart />
    </div>
  );
}
```

**Acceptance Criteria**:
- Chart component loaded only when analytics page visited
- Skeleton shown while chart loading
- Reduced initial bundle size

**Estimate**: 1 hour

**Commit Message**:
```
perf(hwar): lazy-load analytics charts

- Use next/dynamic for chart components
- Show skeleton while loading
- Reduces initial JS bundle size by ~50KB
```

---

### Task 19: A11y Audit & Fixes (Keyboard Nav, ARIA Labels)

**Problem**: Pages may lack keyboard navigation, ARIA labels.

**Files**: All HWAR pages

**Steps**:

1. **Run axe DevTools** on each HWAR page
2. **Fix common issues**:
   - Missing ARIA labels on icon buttons
   - Links missing accessible names
   - Form inputs missing labels
   - Focus outlines suppressed

**Example fixes**:
```tsx
// Before
<Button onClick={handleClick}><Icon /></Button>

// After
<Button onClick={handleClick} aria-label="Create harvest"><Icon /></Button>

// Before
<Link href="/hwar/factory"><Icon /></Link>

// After
<Link href="/hwar/factory" aria-label="Go to Factory"><Icon /></Link>
```

**Acceptance Criteria**:
- axe DevTools reports 0 violations
- All interactive elements keyboard-accessible (Tab, Enter, Space)
- Focus indicators visible

**Estimate**: 3 hours (audit + fixes)

**Commit Message**:
```
a11y(hwar): add keyboard navigation and ARIA labels

- Add aria-label to all icon buttons and links
- Ensure keyboard navigation works (Tab, Enter, Esc)
- Fix focus indicators (visible outlines)
- Zero axe DevTools violations
```

---

### Task 20: Consolidate Design Tokens (Audit Unused CSS Vars)

**Problem**: May have unused CSS variables from HelloWRU migration.

**Files**:
- `apps/dashboard/app/globals.css`
- `apps/dashboard/tailwind.config.ts`

**Steps**:

1. **Grep for usage** of each CSS variable:
```bash
grep -r "var(--primary)" apps/dashboard/app apps/dashboard/src
grep -r "var(--sidebar-accent)" apps/dashboard/app apps/dashboard/src
# ... repeat for all variables
```

2. **Remove unused variables** from `:root` and `.dark`

**Acceptance Criteria**:
- All CSS variables in `globals.css` are used in codebase
- No dead variables

**Estimate**: 1 hour

**Commit Message**:
```
refactor(theme): consolidate design tokens

- Remove unused CSS variables from globals.css
- Audit all --* tokens for usage
- Clean up `:root` and `.dark` blocks
```

---

### P2 Summary

| # | Task | Est. | Cumulative |
|---|------|------|------------|
| 16 | Theme toggle | 2h | 2h |
| 17 | Upgrade sidebar | 2h | 4h |
| 18 | Lazy-load charts | 1h | 5h |
| 19 | A11y audit & fixes | 3h | 8h |
| 20 | Consolidate tokens | 1h | **9h** |

**Deliverable**: Dark mode toggle, polished sidebar, better perf, full a11y ✅

---

## Total Effort Summary

| Phase | Hours | Days (8h/day) | Deliverable |
|-------|-------|---------------|-------------|
| **P0** (Blockers) | ~5h | 0.6 days | `/hwar` functional, typecheck green, ready for gated launch |
| **P1** (Polish) | ~12h | 1.5 days | Production UX (loading, empty states, tables, forms) |
| **P2** (Nice-to-have) | ~9h | 1.1 days | Theme toggle, a11y, perf optimizations |
| **TOTAL** | **~26 hours** | **3.2 days** | Full UI/UX parity + polish |

**Recommended phasing**:
- **Week 1**: P0 (blocker fixes) → Ship gated `/hwar` launch ✅
- **Week 2**: P1 (UX polish) → Production-ready Factory/Library ✅
- **Week 3**: P2 (nice-to-have) → Polish dark mode, a11y, perf ✅

---

## Quick Wins (Do First)

If time-constrained, tackle these **5 Quick Wins** (total: ~2 hours):

1. **Fix NEXT_PUBLIC_ prefix** (5 min) → Unlocks client-side flag
2. **Add TooltipProvider** (10 min) → Enables tooltips
3. **Add Toaster** (5 min) → Enables notifications
4. **Remove unused imports** (30 min) → Reduces noise
5. **Fix implicit `any` types** (1 hour) → Improves type safety

**Impact**: Fixes 3/10 top issues from audit report.

---

## Testing Checklist (After Each Phase)

### P0 (Post-Blocker Fixes)

- [ ] `pnpm type-check` passes ✅
- [ ] `pnpm build` succeeds ✅
- [ ] `/hwar` route renders without errors
- [ ] `<Tooltip>` components work
- [ ] `toast({ title: "Test" })` shows notification
- [ ] Feature flag toggle works (nav link appears/disappears)

### P1 (Post-Polish)

- [ ] Loading skeletons appear on slow connections
- [ ] Empty states shown when no data
- [ ] Tables render data correctly (sortable optional)
- [ ] Forms validate inputs
- [ ] Form submissions trigger API calls
- [ ] Toast notifications show on success/error

### P2 (Post-Nice-to-Have)

- [ ] Theme toggle switches light ↔ dark
- [ ] Theme persists across reloads
- [ ] Sidebar shows active route
- [ ] Charts lazy-load (Network tab shows separate chunk)
- [ ] Keyboard navigation works (Tab through all elements)
- [ ] axe DevTools 0 violations

---

## Rollout Plan

### Phase 1: Gated Launch (After P0)

1. Deploy with `NEXT_PUBLIC_ENABLE_HWAR_NEW_UI=true`
2. Internal testing only (team + QA)
3. Monitor for runtime errors (Sentry/logs)
4. Collect feedback on UX gaps

### Phase 2: Beta Launch (After P1)

1. Enable for beta users (e.g., 10% traffic via feature flag)
2. A/B test `/hwar` vs old UI
3. Monitor metrics (bounce rate, time-on-page, conversions)
4. Iterate on forms/tables based on feedback

### Phase 3: Full Launch (After P2)

1. Redirect `/` → `/hwar` (or retire old UI)
2. Remove feature flag (always-on)
3. Full rollout to all users
4. Announce new UI in changelog

---

**End of Action Plan**
