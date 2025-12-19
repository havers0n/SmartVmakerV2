/**
 * HWAR Workers Types
 * Type definitions for worker management system
 */

export type HwarWorkerType =
	| "ingest"
	| "analysis"
	| "keyframe"
	| "animation"
	| "enrichment"
	| "cleanup";

export type HwarWorkerStatus =
	| "idle"
	| "running"
	| "paused"
	| "error";

/**
 * Worker interface
 * Represents a worker instance in the system
 * 
 * Note: `isOnline` is a computed field, not stored in the database.
 * It is calculated based on `lastSeenAt` (typically if last heartbeat was < 5 minutes ago).
 */
export interface Worker {
	id: string;
	name: string;
	type: HwarWorkerType;
	status: HwarWorkerStatus;

	/**
	 * Computed field: true if worker sent heartbeat recently (e.g., < 5 minutes ago)
	 * This is calculated in the API, not stored in the database
	 */
	isOnline: boolean;

	isPaused: boolean;
	concurrency: number;
	dailyLimitUsd: number;

	lastSeenAt: string | null;
	updatedAt: string;

	/**
	 * Optional statistics about the worker
	 * e.g., { processed: 100, failed: 5, costToday: 12.50 }
	 */
	stats?: Record<string, unknown>;
}

