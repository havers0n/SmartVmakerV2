import { NextResponse } from 'next/server';
import { getDrizzleClient } from '@scrimspec/db';
import { hwarWorkers } from '@scrimspec/db';
import type { Worker } from '@scrimspec/shared-types';
import {
	forbiddenResponse,
	getTrustedUserId,
	isAdminUser,
	unauthorizedResponse,
} from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

// Worker is considered online if last heartbeat was within last 5 minutes
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
	const userId = getTrustedUserId(request);
	if (!userId) return unauthorizedResponse();
	if (!isAdminUser(userId)) return forbiddenResponse('Admin access required');

	const db = getDrizzleClient();

	try {
		const workers = await db
			.select()
			.from(hwarWorkers);

		// Transform database records to Worker interface with computed isOnline
		const now = Date.now();
		const workersWithOnlineStatus: Worker[] = workers.map((worker) => {
			const lastSeenAt = worker.lastSeenAt
				? new Date(worker.lastSeenAt).getTime()
				: null;

			const isOnline =
				lastSeenAt !== null && now - lastSeenAt < ONLINE_THRESHOLD_MS;

			return {
				id: worker.id,
				name: worker.name,
				type: worker.type as Worker['type'],
				status: worker.status as Worker['status'],
				isOnline,
				isPaused: worker.isPaused,
				concurrency: Number(worker.concurrency),
				dailyLimitUsd: Number(worker.dailyLimitUsd),
				lastSeenAt: worker.lastSeenAt || null,
				updatedAt: worker.updatedAt,
				// stats can be added later if needed
			};
		});

		return NextResponse.json(workersWithOnlineStatus);
	} catch (error) {
		console.error('Error fetching workers:', error);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 }
		);
	}
}

