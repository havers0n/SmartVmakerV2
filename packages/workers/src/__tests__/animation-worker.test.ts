import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processAnimationJob } from '../animation-worker';
import { getDrizzleClient, schema } from '@scrimspec/db';
import { eq } from 'drizzle-orm';

// --- MOCKS ---

// 1. Мокаем Halu Client (MiniMax API)
const mockCreateTask = vi.fn();
const mockPollTask = vi.fn();
const mockDownloadVideo = vi.fn();

vi.mock('@scrimspec/halu-client', () => ({
    createHaluClient: () => ({
        createFirstLastFrameTask: mockCreateTask,
        pollTask: mockPollTask,
        downloadVideo: mockDownloadVideo,
    }),
    HaluApiError: Error,
    MinimaxErrorCode: {},
}));

// 2. Мокаем Storage Client (R2)
vi.mock('@aec/storage-client', () => ({
    createDownloadUrl: vi.fn().mockResolvedValue('https://fake-url.com/image.png'),
    uploadLargeStream: vi.fn().mockResolvedValue('animations/test/video.mp4'),
    R2_BUCKET: 'test-bucket',
}));

// 3. Мокаем конфиг моделей (чтобы не лезть в БД за конфигом)
vi.mock('../lib/model-config', () => ({
    loadModelConfig: vi.fn().mockResolvedValue({
        apiKeyEnvVarName: 'TEST_API_KEY',
        apiBaseUrl: 'https://api.test.com',
    }),
}));

describe('Animation Worker Integration', () => {
    const db = getDrizzleClient();
    let projectId: string;
    let assetId1: string;
    let assetId2: string;

    // Подготовка данных перед каждым тестом
    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.TEST_API_KEY = 'fake-key';

        // Создаем тестовый проект и ассеты в реальной БД (или Docker контейнере)
        // ВАЖНО: Убедись, что тестовая БД чистая или используй уникальные ID
        const [proj] = await db.insert(schema.generationProjects).values({}).returning();
        projectId = proj.id;

        const [a1] = await db.insert(schema.assets).values({
            generationProjectId: projectId,
            assetType: 'image',
            status: 'completed',
            storageUrl: 'path/to/1.png'
        }).returning();

        const [a2] = await db.insert(schema.assets).values({
            generationProjectId: projectId,
            assetType: 'image',
            status: 'completed',
            storageUrl: 'path/to/2.png'
        }).returning();

        assetId1 = a1.id;
        assetId2 = a2.id;
    });

    // Чистим за собой
    afterEach(async () => {
        await db.delete(schema.generationProjects).where(eq(schema.generationProjects.id, projectId));
    });

    it('should SUBMIT a new job and save external_id', async () => {
        // 1. Arrange: Создаем задачу
        const [job] = await db.insert(schema.animationJobQueue).values({
            projectId: projectId,
            sceneIndex: 1,
            assetIdFirstFrame: assetId1,
            assetIdLastFrame: assetId2,
            sceneDescription: 'Test scene',
            status: 'pending'
        }).returning();

        // Настраиваем моки на успех
        mockCreateTask.mockResolvedValue({ task_id: 'task-new-123' });
        mockPollTask.mockResolvedValue({ status: 'success', file_id: 'vid-1' });
        mockDownloadVideo.mockResolvedValue(Buffer.from('fake-video'));

        // 2. Act: Запускаем воркер (один цикл)
        await processAnimationJob();

        // 3. Assert: Проверяем результат

        // А. API создания вызвалось? ДА.
        expect(mockCreateTask).toHaveBeenCalledTimes(1);

        // Б. В базе задача завершена?
        const [updatedJob] = await db.select().from(schema.animationJobQueue).where(eq(schema.animationJobQueue.id, job.id));
        expect(updatedJob.status).toBe('completed');
        expect(updatedJob.externalId).toBe('task-new-123'); // ID сохранился!
    });

    it('should RECOVER an existing job without paying again', async () => {
        // 1. Arrange: Создаем задачу, которая якобы "упала" после отправки
        // У нее статус 'pending', НО уже есть external_id
        const [job] = await db.insert(schema.animationJobQueue).values({
            projectId: projectId,
            sceneIndex: 2, // Другая сцена
            assetIdFirstFrame: assetId1,
            assetIdLastFrame: assetId2,
            sceneDescription: 'Recovery scene',
            status: 'pending',
            externalId: 'task-existing-999' // <--- ВАЖНО
        }).returning();

        // Настраиваем моки
        mockPollTask.mockResolvedValue({ status: 'success', file_id: 'vid-recovered' });
        mockDownloadVideo.mockResolvedValue(Buffer.from('fake-video'));

        // 2. Act
        await processAnimationJob();

        // 3. Assert

        // А. API создания вызвалось? НЕТ! (Экономия денег)
        expect(mockCreateTask).not.toHaveBeenCalled();

        // Б. Поллинг вызвался с правильным ID?
        expect(mockPollTask).toHaveBeenCalledWith('task-existing-999', expect.anything());

        // В. Задача завершилась?
        const [updatedJob] = await db.select().from(schema.animationJobQueue).where(eq(schema.animationJobQueue.id, job.id));
        expect(updatedJob.status).toBe('completed');
    });
});
