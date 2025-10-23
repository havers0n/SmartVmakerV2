# @scrimspec/db 🗄️

**Database layer** для Scrimspec — Drizzle ORM интеграция с PostgreSQL/Supabase.

## Features

- ✅ Type-safe queries с Drizzle ORM
- ✅ PostgreSQL + Supabase поддержка
- ✅ Миграции с Drizzle Kit
- ✅ CRUD операции для Tasks, Clips, Batches, Assets
- ✅ Индексы для production-ready performance

## Installation

```bash
pnpm add @scrimspec/db
```

## Quick Start

```typescript
import { getDrizzleClient } from '@scrimspec/db';
import { createTask, getTaskById } from '@scrimspec/db/queries';

// Initialize client
const db = getDrizzleClient();

// Create task
const task = await createTask(db, {
  id: 'task-123',
  kind: 't2v',
  status: 'processing',
  prompt: 'A beautiful sunset',
  startedAt: new Date(),
});

// Get task
const retrieved = await getTaskById(db, 'task-123');
console.log(retrieved);
// {
//   id: 'task-123',
//   kind: 't2v',
//   status: 'processing',
//   prompt: 'A beautiful sunset',
//   startedAt: Date,
//   ...
// }
```

## API Reference

### Clients

#### `getDrizzleClient(): DB`
Returns type-safe Drizzle client for PostgreSQL queries.

```typescript
const db = getDrizzleClient();
// Uses DATABASE_URL environment variable
```

#### `getSupabaseClient(): SupabaseClient`
Returns Supabase client for RLS-enabled queries.

```typescript
const supabase = getSupabaseClient();
// Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

### Queries

#### Tasks

```typescript
import {
  createTask,
  getTaskById,
  updateTaskStatus,
  upsertTask,
  getTasksByStatus,
  getRecentTasks,
  getTasksByBatch,
  getTasksByKind,
  deleteTask
} from '@scrimspec/db/queries';

// Create
const task = await createTask(db, { ... });

// Read
const task = await getTaskById(db, 'task-123');
const tasks = await getRecentTasks(db, 50);
const tasks = await getTasksByStatus(db, 'processing');

// Update
await updateTaskStatus(db, 'task-123', 'success', {
  fileId: 'file-456',
  publicUrl: 'https://...',
  finishedAt: new Date(),
});

// Upsert (insert or update)
const task = await upsertTask(db, { ... });

// Delete
await deleteTask(db, 'task-123');
```

### Schema

#### Tasks Table

```typescript
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),                           // Unique task ID
  kind: text('kind').$type<TaskKind>().notNull(),       // 't2v' | 'i2v' | ...
  status: text('status').$type<TaskStatus>().notNull(), // 'processing' | 'success' | ...
  prompt: text('prompt'),                                // Generation prompt
  params: jsonb('params'),                               // Request parameters
  fileId: text('file_id'),                               // MiniMax file_id
  publicUrl: text('public_url'),                         // Public download URL
  errorText: text('error'),                              // Error message
  batchId: text('batch_id'),                             // Batch group ID
  topic: text('topic'),                                  // Content topic
  lang: text('lang'),                                    // Language code
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});
```

**Indexes:**
- `idx_tasks_status` on `status` (for filtering by status)
- `idx_tasks_batch` on `batch_id` (for batch operations)

#### Clips Table

```typescript
export const clips = pgTable('clips', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: text('task_id').notNull(),              // Foreign key to tasks
  beatId: text('beat_id'),                         // Beat/scene identifier
  publicUrl: text('public_url'),                   // Clip download URL
  durationS: integer('duration_s'),                // Duration in seconds
  createdAt: timestamp('created_at', { ... }).defaultNow(),
});
```

#### Batches Table

```typescript
export const batches = pgTable('batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  planPath: text('plan_path'),                     // Path to batch plan file
  status: text('status').$type<TaskStatus>(),      // Overall batch status
  total: integer('total').notNull().default(0),    // Total items
  ok: integer('ok').notNull().default(0),          // Successful items
  fail: integer('fail').notNull().default(0),      // Failed items
  avgTimeMs: integer('avg_time_ms'),               // Average time per item
  qualityScore: integer('quality_score'),          // Quality metric (0-100)
  startedAt: timestamp('started_at', { ... }).defaultNow(),
  finishedAt: timestamp('finished_at', { ... }),
});
```

#### Assets Table

```typescript
export const assets = pgTable('assets', {
  id: text('id').primaryKey(),                     // sha256(prompt+ar+model)
  kind: text('kind').notNull(),                    // 'image' | 'video' | 'audio'
  prompt: text('prompt'),                          // Original prompt
  aspectRatio: text('aspect_ratio'),               // '16:9' | '9:16' | ...
  model: text('model'),                            // Model used
  url: text('url'),                                // Asset URL
  createdAt: timestamp('created_at', { ... }).defaultNow(),
});
```

## Environment Variables

```env
# Primary database
DATABASE_URL=postgresql://user:password@localhost:5432/scrimspec

# Supabase (optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

## Migrations

### Generate Migration

```bash
pnpm run generate
```

Это создаст SQL миграцию в `migrations/` папке.

### Run Migration

```bash
pnpm run migrate
```

Применит все pending миграции к БД.

### View in Drizzle Studio

```bash
pnpm run studio
```

Откроет web UI для просмотра и редактирования данных.

## Type Safety

Все типы автоматически генерируются из схем:

```typescript
import { Task, NewTask, Clip, Batch, Asset } from '@scrimspec/db';

// Drizzle infers types:
// Task = Select type from database
// NewTask = Insert type for creation

const newTask: NewTask = {
  id: 'task-123',
  kind: 't2v',
  status: 'queued',
  startedAt: new Date(),
};

const task: Task = await createTask(db, newTask);
// task has all fields: id, kind, status, prompt, params, fileId, ...
```

## Advanced Usage

### Raw Queries

If needed, use raw SQL via Drizzle:

```typescript
import { sql } from 'drizzle-orm';

const result = await db.execute(
  sql`SELECT COUNT(*) as count FROM tasks WHERE status = 'success'`
);
```

### Transactions

```typescript
import { db } from '@scrimspec/db';

await db.transaction(async (tx) => {
  const task = await createTask(tx, { ... });
  const clip = await createClip(tx, { taskId: task.id, ... });
  // Both operations commit or both rollback
});
```

### Custom Queries

Extend `packages/db/src/queries/` with custom helpers:

```typescript
// packages/db/src/queries/custom.ts
export async function getTaskStats(db: DB) {
  return db.select({
    total: count(),
    processing: count(gt(tasks.status, 'processing')),
    success: count(eq(tasks.status, 'success')),
  }).from(tasks);
}
```

## Troubleshooting

### "DATABASE_URL is not set"

```bash
# Add to .env
DATABASE_URL=postgresql://user:password@localhost/scrimspec
```

### Migration Fails

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Recreate from scratch (dev only!)
dropdb scrimspec
createdb scrimspec
pnpm run migrate
```

## Contributing

1. Modify `packages/db/src/schema/` for new tables
2. Run `pnpm run generate` to create migration
3. Run `pnpm run migrate` to apply
4. Add query helpers in `packages/db/src/queries/`
5. Export from `packages/db/src/queries/index.ts`

## License

MIT

## See Also

- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Architecture Guide](../../ARCHITECTURE.md)
- [@scrimspec/shared-types](../shared-types)
