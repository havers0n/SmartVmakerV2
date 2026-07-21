/// <reference types="vitest" />

import { describe, it, expect, vi } from 'vitest';
import { createHwarCore, HwarDeps } from './index';

const makeDeps = (loggerOverrides: Partial<HwarDeps['logger']> = {}): HwarDeps => {
    const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        ...loggerOverrides,
    };

    // disabled ветки не трогают БД, поэтому минимальные заглушки
    return {
        db: {} as any,
        logger,
        aiRouter: {} as any,
        storage: {} as any,
    };
};

describe('createHwarCore disabled stubs', () => {
    it('ingest заглушки не бросают и логируют warn/debug', async () => {
        const deps = makeDeps();
        const core = createHwarCore(deps, {
            enableIngest: false,
            enableGeneration: false,
            enableAnimation: false,
            enableAssets: false,
        });

        const enqueueRes = await core.ingest.enqueueJob();
        expect(enqueueRes).toEqual({ status: 'disabled' });
        expect(deps.logger?.warn).toHaveBeenCalledWith(
            expect.stringContaining('[ingest.enqueueJob] disabled'),
        );

        const tickRes = await core.ingest.runTick();
        expect(tickRes).toEqual({ status: 'disabled', processed: 0 });
        expect(deps.logger?.debug).toHaveBeenCalledWith(
            expect.stringContaining('[ingest.runTick] no-op'),
        );

        const statusRes = await core.ingest.getJobStatus();
        expect(statusRes).toEqual({ status: 'disabled' });
    });

    it('generation/animation/assets возвращают disabled без исключений', async () => {
        const deps = makeDeps();
        const core = createHwarCore(deps, {
            enableIngest: false,
            enableGeneration: false,
            enableAnimation: false,
            enableAssets: false,
        });

        expect(await core.generation.createProjectFromAnalysis()).toEqual({
            status: 'disabled',
        });
        expect(await core.generation.runTick()).toEqual({
            status: 'disabled',
            processed: 0,
        });
        expect(await core.generation.getProjectStatus()).toEqual({
            status: 'disabled',
        });

        expect(await core.animation.enqueueForProject()).toEqual({
            status: 'disabled',
        });
        expect(await core.animation.runTick()).toEqual({
            status: 'disabled',
            processed: 0,
        });
        expect(await core.animation.getJobStatus()).toEqual({
            status: 'disabled',
        });

        expect(await core.assets.listForProject()).toEqual({
            status: 'disabled',
        });
        expect(await core.assets.getById()).toEqual({
            status: 'disabled',
        });
    });

    it('analysis/keyframes можно отключить конфигом и получить безопасные заглушки', async () => {
        const deps = makeDeps();
        const core = createHwarCore(deps, {
            enableAnalysis: false,
            enableKeyframes: false,
        });

        expect(await core.analysis.enqueueForVideos([])).toEqual({
            status: 'disabled',
        });
        expect(await core.analysis.runTick()).toEqual({
            status: 'disabled',
            processed: 0,
        });
        expect(await core.analysis.getJobStatus('id')).toEqual({
            status: 'disabled',
        });
        expect(await core.analysis.getLatestResultForVideo('vid')).toEqual({
            status: 'disabled',
        });

        expect(await core.keyframes.enqueueForProject('', 0, 'first', '', '')).toEqual({
            status: 'disabled',
        });
        expect(await core.keyframes.runTick()).toEqual({
            status: 'disabled',
            processed: 0,
        });
        expect(await core.keyframes.getJobStatus('id')).toEqual({
            status: 'disabled',
        });
    });
});

