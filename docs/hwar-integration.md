# 🎯 Goal

Integrate the standalone **HelloWhoAreYou** Vite React client into the monorepo’s **Next.js** app at `apps/dashboard`, without breaking existing dashboard features. Result: a single unified frontend.

---

## 🧱 Target Architecture

```
apps/
  dashboard/
    app/
      (marketing)/ ...
      hwar/                # ← mounted feature area (HelloWhoAreYou)
        create/
        factory/
        library/
        layout.tsx
        page.tsx
      api/
        hwar/
          [...routes]
    src/
      components/
      lib/
      providers/
    public/
packages/
  shared-types/            # ← zod/ts types shared by FE/BE
  api-client/              # ← fetch wrapper + typed SDK
```

---

## 🚦 Migration Strategy (Incremental, Safe)

1. **Mount as feature area** under `/hwar` inside `apps/dashboard/app/hwar`.
2. **Standardize on Next.js** (drop Vite for this app; keep code).
3. **Wrap external deps** (TanStack Query provider, Tailwind, shadcn) once at app root.
4. **Adapter layer** for APIs (create `packages/api-client` used by both legacy dashboard and HWAR pages).
5. **Gradually replace** Wouter routes with Next App Router segments.

Rollback: keep `apps/dashboard-backup` and a feature flag `NEXT_PUBLIC_HWAR_ENABLED` to hide `/hwar` if needed.

---

## ✅ Pre-flight Checks

* `node >= 20`, `pnpm >= 9`.
* Dashboard already uses Tailwind + shadcn.
* Confirm tanstack-query version parity (`^5.x`).

```bash
# backup
cp -r apps/dashboard apps/dashboard-backup
```

---

## 1) Create Mount Point `/hwar`

**Files**

* `apps/dashboard/app/hwar/layout.tsx`
* `apps/dashboard/app/hwar/page.tsx`

```tsx
// app/hwar/layout.tsx
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex">
      <aside className="w-64 shrink-0 border-r p-4">{/* HWAR nav */}</aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

// app/hwar/page.tsx
export default function Page() {
  return <div className="text-2xl font-semibold">HelloWhoAreYou · Overview</div>;
}
```

---

## 2) Providers at Root

Ensure **QueryClientProvider** exists once (app-wide) and re-use in HWAR.

**Files**

* `apps/dashboard/src/providers/query-client.tsx`
* `apps/dashboard/app/layout.tsx` (import provider)

```tsx
// src/providers/query-client.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

```tsx
// app/layout.tsx
import { QueryProvider } from "@/src/providers/query-client";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

---

## 3) Tailwind/shadcn Unification

* Merge `tailwind.config.ts` content from HWAR into dashboard.
* Copy any custom utilities to `globals.css`.
* If HWAR used `@/components/ui/*` from shadcn, ensure those exist under `apps/dashboard/src/components/ui`.

Checklist:

* [ ] Merge theme tokens
* [ ] Ensure `content` globs include `app/hwar/**/*.{ts,tsx}`
* [ ] Run `pnpm shadcn add button card input ...` for any missing primitives

---

## 4) API Client Package

Create a **typed** API client used by `/hwar` pages and the rest of dashboard.

**New package**: `packages/api-client`

```
packages/api-client/
  src/index.ts
  package.json
```

```ts
// packages/api-client/src/index.ts
export type Fetcher = (path: string, init?: RequestInit) => Promise<any>;
export const makeClient = (base = "/api") => {
  const fetcher: Fetcher = async (path, init) => {
    const res = await fetch(`${base}${path}`, { ...init, next: { revalidate: 0 } });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };
  return {
    hwar: {
      createScenario: (body: any) => fetcher(`/hwar/scenarios`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
      listHarvests: () => fetcher(`/hwar/harvests`),
      // ...extend
    },
  };
};
```

**Monorepo wiring**

```json
// packages/api-client/package.json
{
  "name": "@project/api-client",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts"
}
```

In `apps/dashboard`:

```ts
// usage inside a server component
import { makeClient } from "@project/api-client";
const api = makeClient();
```

---

## 5) Move HWAR Pages

From `HelloWhoAreYou/client/src/pages/{create,factory,library}` →
`apps/dashboard/app/hwar/{create,factory,library}/page.tsx`

**Routing conversion**

* Replace **Wouter** links with `next/link`.
* Replace `useLocation()` with `usePathname()` or `useRouter()` from `next/navigation`.

Example:

```tsx
// app/hwar/create/page.tsx
import Link from "next/link";
export default function CreatePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Create</h1>
      <Link className="underline" href="/hwar/create/scenario">New Scenario</Link>
    </div>
  );
}
```

---

## 6) Server Routes (API)

Mirror previous server endpoints under Next’s **route handlers**.

**Files**

* `apps/dashboard/app/api/hwar/scenarios/route.ts` (POST create)
* `apps/dashboard/app/api/hwar/harvests/route.ts` (GET list)

```ts
// app/api/hwar/scenarios/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db"; // drizzle instance
export async function POST(req: NextRequest) {
  const body = await req.json();
  // validate with zod here
  const scenario = await db.insert(/* ... */);
  return NextResponse.json({ ok: true, scenario });
}
```

**Proxying to existing Node server?**

* Option A: Re-implement minimal endpoints as route handlers (preferred for unification).
* Option B: Keep Node server and call it from Next (set `NEXT_PUBLIC_API_URL`).

---

## 7) Shared Types Package

Create `packages/shared-types` with **zod** schemas + `type` exports used by API and FE.

```
packages/shared-types/
  src/aes.ts
  src/hwar.ts
```

```ts
// packages/shared-types/src/hwar.ts
import { z } from "zod";
export const ScenarioCreate = z.object({
  topic: z.string().min(3),
  durationSec: z.number().int().min(5).max(90),
  tags: z.array(z.string()).max(12)
});
export type ScenarioCreate = z.infer<typeof ScenarioCreate>;
```

Wire in `tsconfig.json` path aliases:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@project/shared-types": ["packages/shared-types/src"],
      "@project/api-client": ["packages/api-client/src"]
    }
  }
}
```

---

## 8) Assets & Public

* Move `HelloWhoAreYou/client/public/*` → `apps/dashboard/public/hwar/*`.
* Update references to `/hwar/...`.

---

## 9) Env & Config

* Translate `.env` used by HWAR into `NEXT_PUBLIC_*` where needed.
* Example: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_HWAR_ENABLED`.

Feature flag in layout:

```tsx
if (process.env.NEXT_PUBLIC_HWAR_ENABLED !== "true") {
  // optionally redirect or hide nav
}
```

---

## 🔁 Verification Plan

* Unit: build pages compile, typecheck passes.
* Integration: API calls return expected shape (zod-safe).
* UX: nav flows among `/hwar/create|factory|library`.
* E2E (Playwright): smoke test scenario creation.

---

## 🧪 Minimal Playwright E2E

```ts
import { test, expect } from "@playwright/test";

test("hwar mounts", async ({ page }) => {
  await page.goto("/hwar");
  await expect(page.getByText("HelloWhoAreYou · Overview")).toBeVisible();
});
```

---

## 🧹 Cleanup (when stable)

* Remove `HelloWhoAreYou/client` from repo or archive it under `archive/`.
* Delete Vite config related files.

---

## 📋 Migration Checklist (track here)

* [ ] Create `/app/hwar` mount point
* [ ] Providers hooked (TanStack Query)
* [ ] Tailwind/shadcn unified
* [ ] `packages/api-client` shipped
* [ ] Routes moved: create/factory/library
* [ ] API route handlers wired
* [ ] Shared types package added
* [ ] Public assets copied
* [ ] Env flags added
* [ ] E2E smoke passes

---

## 🧭 Next Steps (suggested order)

1. Mount `/hwar` and push a branch (`feat/hwar-mount`).
2. Add api-client + shared-types packages.
3. Port **Create** module first (fastest feedback), then **Library**, then **Factory**.
4. Replace any remaining Wouter hooks.
5. Stand up route handlers for scenarios/harvests.
6. Run E2E smoke.

If you want, I can also generate a codemod to replace Wouter imports with Next equivalents and create boilerplate route handlers for your current endpoints.
