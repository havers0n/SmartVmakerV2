import { NextResponse } from 'next/server';
import { getDrizzleClient, eq } from '@scrimspec/db';
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

interface UpdateWorkerRequest {
	status?: Worker['status'];
	isPaused?: boolean;
	concurrency?: number;
	dailyLimitUsd?: number;
}

export async function PATCH(
	request: Request,
	{ params }: { params: { id: string } }
) {
	const userId = getTrustedUserId(request);
	if (!userId) return unauthorizedResponse();
	if (!isAdminUser(userId)) return forbiddenResponse('Admin access required');

	const db = getDrizzleClient();
	const workerId = params.id;

	try {
		// Parse request body
		const body: UpdateWorkerRequest = await request.json();

		// Validate input
		const updateData: Partial<typeof hwarWorkers.$inferInsert> = {};

		if (body.status !== undefined) {
			// Validate status is a valid enum value
			const validStatuses: Worker['status'][] = [
				'idle',
				'running',
				'paused',
				'error',
			];
			if (!validStatuses.includes(body.status)) {
				return NextResponse.json(
					{ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
					{ status: 400 }
				);
			}
			updateData.status = body.status;
		}

		if (body.isPaused !== undefined) {
			updateData.isPaused = body.isPaused;
		}

		if (body.concurrency !== undefined) {
			if (body.concurrency < 1 || body.concurrency > 100) {
				return NextResponse.json(
					{ error: 'Concurrency must be between 1 and 100' },
					{ status: 400 }
				);
			}
			updateData.concurrency = body.concurrency;
		}

		if (body.dailyLimitUsd !== undefined) {
			if (body.dailyLimitUsd < 0) {
				return NextResponse.json(
					{ error: 'Daily limit must be >= 0' },
					{ status: 400 }
				);
			}
			updateData.dailyLimitUsd = body.dailyLimitUsd.toString();
		}

		// Check if worker exists
		const existingWorker = await db
			.select()
			.from(hwarWorkers)
			.where(eq(hwarWorkers.id, workerId))
			.limit(1);

		if (existingWorker.length === 0) {
			return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
		}

		// Update worker
		const [updatedWorker] = await db
			.update(hwarWorkers)
			.set({
				...updateData,
				updatedAt: new Date(),
			})
			.where(eq(hwarWorkers.id, workerId))
			.returning();

		// Transform to Worker interface with computed isOnline
		const now = Date.now();
		const lastSeenAt = updatedWorker.lastSeenAt
			? new Date(updatedWorker.lastSeenAt).getTime()
			: null;
		const isOnline =
			lastSeenAt !== null && now - lastSeenAt < ONLINE_THRESHOLD_MS;

		const workerResponse: Worker = {
			id: updatedWorker.id,
			name: updatedWorker.name,
			type: updatedWorker.type as Worker['type'],
			status: updatedWorker.status as Worker['status'],
			isOnline,
			isPaused: updatedWorker.isPaused,
			concurrency: Number(updatedWorker.concurrency),
			dailyLimitUsd: Number(updatedWorker.dailyLimitUsd),
			lastSeenAt: updatedWorker.lastSeenAt?.toISOString() ?? null,
			updatedAt: updatedWorker.updatedAt.toISOString(),
		};

		return NextResponse.json(workerResponse);
	} catch (error) {
		console.error('Error updating worker:', error);
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 }
		);
	}
}

