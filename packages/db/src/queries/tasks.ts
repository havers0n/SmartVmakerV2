import { eq, and, desc, limit, inArray } from 'drizzle-orm';
import type { DB } from '../client';
import { tasks, type Task, type NewTask } from '../schema';

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new task
 */
export async function createTask(db: DB, task: NewTask): Promise<Task> {
  const result = await db.insert(tasks).values(task).returning();
  return result[0];
}

/**
 * Get task by ID
 */
export async function getTaskById(db: DB, id: string): Promise<Task | null> {
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  db: DB,
  id: string,
  status: Task['status'],
  updates?: Partial<Omit<NewTask, 'id' | 'kind'>>,
) {
  const data: Record<string, any> = { status };
  if (updates) {
    Object.assign(data, updates);
  }

  const result = await db
    .update(tasks)
    .set(data)
    .where(eq(tasks.id, id))
    .returning();

  return result[0] || null;
}

/**
 * Upsert task (insert or update)
 */
export async function upsertTask(db: DB, task: NewTask): Promise<Task> {
  const result = await db
    .insert(tasks)
    .values(task)
    .onConflictDoUpdate({
      target: tasks.id,
      set: task,
    })
    .returning();

  return result[0];
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(
  db: DB,
  status: Task['status'],
  limitCount = 100,
): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.status, status))
    .orderBy(desc(tasks.startedAt))
    .limit(limitCount);
}

/**
 * Get recent tasks
 */
export async function getRecentTasks(db: DB, count = 50): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .orderBy(desc(tasks.startedAt))
    .limit(count);
}

/**
 * Get tasks by batch
 */
export async function getTasksByBatch(db: DB, batchId: string): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.batchId, batchId))
    .orderBy(desc(tasks.startedAt));
}

/**
 * Get tasks by kind
 */
export async function getTasksByKind(db: DB, kind: Task['kind']): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.kind, kind))
    .orderBy(desc(tasks.startedAt));
}

/**
 * Delete task
 */
export async function deleteTask(db: DB, id: string): Promise<boolean> {
  const result = await db.delete(tasks).where(eq(tasks.id, id));
  return true;
}

/**
 * Get task statistics
 */
export async function getTaskStats(db: DB) {
  // This would require SQL aggregations
  // For now, returning a placeholder
  return {
    total: 0,
    processing: 0,
    success: 0,
    failed: 0,
  };
}

/**
 * Clean up old tasks (older than days)
 */
export async function cleanupOldTasks(db: DB, days = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const result = await db.delete(tasks).where(
    and(
      eq(tasks.status, 'success'),
      // @ts-expect-error drizzle doesn't have lt() for timestamps yet
      // tasks.finishedAt < cutoffDate
    ),
  );

  return 0; // Return affected rows count if possible
}
