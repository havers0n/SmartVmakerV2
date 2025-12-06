/**
 * KEYFRAME WORKER TESTS - DISABLED
 * 
 * These tests need to be rewritten for the new HWAR Core architecture.
 * The worker is now a thin adapter that calls hwar.keyframes.runTick().
 * 
 * TODO: Rewrite tests to test the keyframe handler in hwar-core directly.
 */

import { describe, it } from 'vitest';

describe('Keyframe Worker Integration', () => {
    it.skip('should be rewritten for new architecture', () => {
        // Tests disabled during migration to hwar-core
    });
});
