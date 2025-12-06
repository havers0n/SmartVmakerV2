import { pgTable, pgEnum, uuid, text, timestamp, integer, index, jsonb, numeric, bigint, unique, uniqueIndex, inet, primaryKey, boolean, pgSchema } from "drizzle-orm/pg-core"

// =================== SCHEMAS ===================
export const aesCore = pgSchema("aes_core");
export const analytics = pgSchema("analytics");
export const generationPipeline = pgSchema("generation_pipeline");
export const jobs = pgSchema("jobs");
export const studio = pgSchema("studio");

// =================== ENUMS ===================
export const factorType = pgEnum("factor_type", ['totp', 'webauthn', 'phone'])
export const factorStatus = pgEnum("factor_status", ['unverified', 'verified'])
export const aalLevel = pgEnum("aal_level", ['aal1', 'aal2', 'aal3'])
export const codeChallengeMethod = pgEnum("code_challenge_method", ['s256', 'plain'])
export const oneTimeTokenType = pgEnum("one_time_token_type", ['confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token'])
export const oauthRegistrationType = pgEnum("oauth_registration_type", ['dynamic', 'manual'])
export const oauthAuthorizationStatus = pgEnum("oauth_authorization_status", ['pending', 'approved', 'denied', 'expired'])
export const oauthResponseType = pgEnum("oauth_response_type", ['code'])
export const oauthClientType = pgEnum("oauth_client_type", ['public', 'confidential'])
export const buckettype = pgEnum("buckettype", ['STANDARD', 'ANALYTICS'])
export const equalityOp = pgEnum("equality_op", ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in'])
export const action = pgEnum("action", ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ERROR'])
export const phaseEnum = pgEnum("phase_enum", ['HOOK', 'BUILD', 'PAYOFF', 'RESOLUTION'])
export const emotionEnum = pgEnum("emotion_enum", ['joy', 'sadness', 'surprise', 'anticipation', 'tension', 'relief', 'empathy', 'curiosity', 'humor', 'awe'])
export const contrastEnum = pgEnum("contrast_enum", ['small_vs_big', 'slow_vs_fast', 'alone_vs_together', 'sad_vs_happy', 'problem_vs_solution', 'before_vs_after'])
export const appJobStatus = pgEnum("app_job_status", ['pending', 'processing', 'completed', 'failed'])
export const authType = pgEnum("auth_type", ['bearer_token', 'api_key_header', 'query_param'])
export const modelType = pgEnum("model_type", [
	'text-to-text',
	'text-to-image',
	'image-to-video',
	'text-to-video',
	'image-to-image',
	'audio-to-text',
	'text-to-audio',
	'multimodal'
])

export const jobStageEnum = pgEnum("job_stage", [
	'init',
	'checking_dupes',
	'submitting',
	'waiting_external',
	'downloading',
	'uploading',
	'completed',
	'failed'
]);


export const generationEvents = pgTable("generation_events", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	userId: text("user_id"),
	topic: text("topic"),
	durationCategory: text("duration_category"),
	scenario: jsonb("scenario"),
	candidates: jsonb("candidates"),
	chosenIndex: integer("chosen_index"),
	composeJobId: text("compose_job_id"),
	status: appJobStatus("status").default('pending').notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	chosenFirstAssetLegacyId: text("chosen_first_asset_legacy_id"),
	chosenLastAssetLegacyId: text("chosen_last_asset_legacy_id"),
	aesScore: numeric("aes_score"),
	hookStrength: numeric("hook_strength"),
	emotionalCurve: text("emotional_curve").array(),
	evaluator: text("evaluator"),
	chosenFirstAssetId: uuid("chosen_first_asset_id").references(() => assets.id, { onDelete: 'set null' }),
	chosenLastAssetId: uuid("chosen_last_asset_id").references(() => assets.id, { onDelete: 'set null' })
},
	(table) => {
		return {
			idxGenEventsScenarioGin: index("idx_gen_events_scenario_gin").on(table.scenario),
			idxGenEventsCandidatesGin: index("idx_gen_events_candidates_gin").on(table.candidates),
			idxGenEventsDeletedAt: index("idx_gen_events_deleted_at").on(table.deletedAt),
			idxGenerationEventsUser: index("idx_generation_events_user").on(table.userId),
			idxGenerationEventsStatus: index("idx_generation_events_status").on(table.status),
			idxGenerationEventsFirstAsset: index("idx_generation_events_first_asset").on(table.chosenFirstAssetId),
			idxGenerationEventsLastAsset: index("idx_generation_events_last_asset").on(table.chosenLastAssetId),
			idxGenerationEventsFirstAssetLegacy: index("idx_generation_events_first_asset_legacy").on(table.chosenFirstAssetLegacyId),
			idxGenerationEventsLastAssetLegacy: index("idx_generation_events_last_asset_legacy").on(table.chosenLastAssetLegacyId),
			idxGenerationEventsAssetIds: index("idx_generation_events_asset_ids").on(table.chosenFirstAssetId, table.chosenLastAssetId),
			idxGenerationEventsFirstAssetFk: index("idx_generation_events_first_asset_fk").on(table.chosenFirstAssetId),
			idxGenerationEventsLastAssetFk: index("idx_generation_events_last_asset_fk").on(table.chosenLastAssetId),
		}
	});

export const clipsWithLegacy = pgTable("clips_with_legacy", {
	id: uuid("id"),
	taskId: uuid("task_id"),
	taskLegacyId: text("task_legacy_id"),
	beatId: text("beat_id"),
	publicUrl: text("public_url"),
	durationS: integer("duration_s"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	taskTextId: text("task_text_id"),
});

export const legacyTasks = pgTable("legacy_tasks", {
	legacyId: text("legacy_id").notNull(),
	kind: text("kind").notNull(),
	prompt: text("prompt"),
	publicUrl: text("public_url"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	params: jsonb("params"),
	fileId: text("file_id"),
	error: text("error"),
	batchId: uuid("batch_id").references(() => batches.id, { onDelete: 'set null' }),
	topic: text("topic"),
	lang: text("lang"),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	status: appJobStatus("status").default('pending').notNull(),
},
	(table) => {
		return {
			idxTasksParamsGin: index("idx_tasks_params_gin").on(table.params),
			idxTasksDeletedAt: index("idx_tasks_deleted_at").on(table.deletedAt),
			idxTasksBatch: index("idx_tasks_batch").on(table.batchId),
			tasksLegacyIdUniq: unique("tasks_legacy_id_uniq").on(table.legacyId),
		}
	});

export const batches = pgTable("batches", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	planPath: text("plan_path"),
	total: integer("total").default(0).notNull(),
	ok: integer("ok").default(0).notNull(),
	fail: integer("fail").default(0).notNull(),
	avgTimeMs: integer("avg_time_ms"),
	qualityScore: integer("quality_score"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	status: appJobStatus("status").default('pending').notNull(),
},
	(table) => {
		return {
			idxBatchesDeletedAt: index("idx_batches_deleted_at").on(table.deletedAt),
		}
	});

export const clips = pgTable("clips", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	legacyTaskId: text("legacy_task_id").notNull(),
	beatId: text("beat_id"),
	publicUrl: text("public_url"),
	durationS: integer("duration_s"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	taskId: uuid("task_id").notNull().references(() => legacyTasks.id, { onDelete: 'cascade' }),
},
	(table) => {
		return {
			idxClipsTaskId: index("idx_clips_task_id").on(table.taskId),
			idxClipsTaskLegacyId: index("idx_clips_task_legacy_id").on(table.legacyTaskId),
			idxClipsTaskIdFk: index("idx_clips_task_id_fk").on(table.taskId),
			idxClipsTask: index("idx_clips_task").on(table.taskId),
		}
	});

export const youtubeVideos = pgTable("youtube_videos", {
	url: text("url").notNull(),
	title: text("title").notNull(),
	description: text("description"),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	channelTitle: text("channel_title"),
	durationSeconds: integer("duration_seconds"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	viewCount: bigint("view_count", { mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	likeCount: bigint("like_count", { mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	commentCount: bigint("comment_count", { mode: "number" }).default(0),
	tags: jsonb("tags").default([]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	youtubeId: text("youtube_id"),
	thumbnails: jsonb("thumbnails"),
	liveBroadcastContent: text("live_broadcast_content"),
	id: uuid("id").defaultRandom().primaryKey().notNull(),
},
	(table) => {
		return {
			urlUidx: uniqueIndex("youtube_videos_url_uidx").on(table.url),
			idxYoutubeVideosPublishedAt: index("idx_youtube_videos_published_at").on(table.publishedAt),
			idxYoutubeVideosCreatedAt: index("idx_youtube_videos_created_at").on(table.createdAt),
			youtubeIdPartialUidx: uniqueIndex("youtube_videos_youtube_id_partial_uidx").on(table.youtubeId),
			publishedAtIdx: index("youtube_videos_published_at_idx").on(table.publishedAt),
			channelTitleIdx: index("youtube_videos_channel_title_idx").on(table.channelTitle),
			youtubeIdUidx: uniqueIndex("youtube_videos_youtube_id_uidx").on(table.youtubeId),
		}
	});

export const analysisResults = pgTable("analysis_results", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	analyzer: text("analyzer").notNull(),
	analysisUrl: text("analysis_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	aesBreakdown: jsonb("aes_breakdown"),
	overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
	emotionalTags: jsonb("emotional_tags"),
	analyzerName: text("analyzer_name"),
	version: integer("version").default(1).notNull(),
	videoId: uuid("video_id").notNull().references(() => youtubeVideos.id, { onDelete: 'cascade' }),
},
	(table) => {
		return {
			idxVideoAnalysisAnalyzer: index("idx_video_analysis_analyzer").on(table.analyzer),
		}
	});

export const auditLog = pgTable("audit_log", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	tableName: text("table_name").notNull(),
	recordId: text("record_id").notNull(),
	action: text("action").notNull(),
	oldData: jsonb("old_data"),
	newData: jsonb("new_data"),
	changedFields: text("changed_fields").array(),
	userId: uuid("user_id"),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
	(table) => {
		return {
			idxAuditLogTableName: index("idx_audit_log_table_name").on(table.tableName),
			idxAuditLogRecordId: index("idx_audit_log_record_id").on(table.recordId),
			idxAuditLogAction: index("idx_audit_log_action").on(table.action),
			idxAuditLogUserId: index("idx_audit_log_user_id").on(table.userId),
			idxAuditLogCreatedAt: index("idx_audit_log_created_at").on(table.createdAt),
			idxAuditLogTableRecord: index("idx_audit_log_table_record").on(table.recordId, table.tableName),
		}
	});

export const vGenerationCostsByUser = pgTable("v_generation_costs_by_user", {
	ownerId: uuid("owner_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalShorts: bigint("total_shorts", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalAssets: bigint("total_assets", { mode: "number" }),
	totalShortsCost: numeric("total_shorts_cost"),
	totalAssetsCost: numeric("total_assets_cost"),
	totalCost: numeric("total_cost"),
	firstShortAt: timestamp("first_short_at", { withTimezone: true, mode: 'string' }),
	lastShortAt: timestamp("last_short_at", { withTimezone: true, mode: 'string' }),
});

export const jsonSchemas = pgTable("json_schemas", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	schemaName: text("schema_name").notNull(),
	schemaVersion: text("schema_version").default("1").notNull(),
	schemaDef: jsonb("schema_def").notNull(),
	description: text("description"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
	(table) => {
		return {
			idxJsonSchemasName: index("idx_json_schemas_name").on(table.schemaName),
			jsonSchemasSchemaNameKey: unique("json_schemas_schema_name_key").on(table.schemaName),
		}
	});

export const idUuidMapping = pgTable("id_uuid_mapping", {
	tableName: text("table_name").notNull(),
	legacyId: text("legacy_id").notNull(),
	uuidId: uuid("uuid_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
	(table) => {
		return {
			idxIdUuidMappingUuid: index("idx_id_uuid_mapping_uuid").on(table.tableName, table.uuidId),
			idUuidMappingPkey: primaryKey({ columns: [table.tableName, table.legacyId], name: "id_uuid_mapping_pkey" })
		}
	});

// =================== НОВЫЕ ТАБЛИЦЫ ===================

export const storyTemplates = aesCore.table("story_templates", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	name: text("name").notNull(),
	description: text("description"),
	tags: text("tags").array(),
	targetDurationSeconds: integer("target_duration_seconds").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const beats = aesCore.table("beats", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	templateId: uuid("template_id").notNull().references(() => storyTemplates.id, { onDelete: 'cascade' }),
	order: integer("order").notNull(),
	phase: phaseEnum("phase").notNull(),
	durationSeconds: numeric("duration_seconds").notNull(),
	description: text("description").notNull(),
	actionPrompt: text("action_prompt"),
	emotion: emotionEnum("emotion").notNull(),
	contrast: contrastEnum("contrast"),
	intendedImpact: text("intended_impact"),
	meta: jsonb("meta").default({}),
});

// ========== ВСТАВЬТЕ ЭТОТ КОД ЗДЕСЬ ==========

export const characters = aesCore.table("characters", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	// ownerId пока оставляем как uuid, позже можно будет связать с auth.users
	ownerId: uuid("owner_id"),
	name: text("name").notNull(),
	description: text("description"), // например, "Любопытный щенок корги, пушистый, с большими ушами"
	// Здесь мы будем хранить "визуальные пресеты" для промптов
	// например, { "base_prompt": "cute puppy, corgi, fluffy...", "negative_prompt": "blurry, ugly" }
	stylePresets: jsonb("style_presets").default({}),
	referenceImageUrls: text("reference_image_urls").array(), // Массив ссылок на референсные изображения
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

// ============================================
// AI PROVIDERS & MODELS
// ============================================

export const aiProviders = aesCore.table("ai_providers", {
	id: text("id").primaryKey().notNull(), // например: 'google_gemini', 'minimax', 'openai'
	name: text("name").notNull(), // например: "Google Gemini", "MiniMax", "OpenAI"
	apiBaseUrl: text("api_base_url"), // например: "https://api.minimax.io/v1"
	authenticationType: authType("authentication_type").notNull(), // 'bearer_token' | 'api_key_header' | 'query_param'
	apiKeyEnvVarName: text("api_key_env_var_name").notNull(), // например: 'GEMINI_API_KEY', 'MINIMAX_API_KEY'
	metadata: jsonb("metadata").default({}), // Любые дополнительные данные о провайдере
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const aiModels = aesCore.table("ai_models", {
	id: text("id").primaryKey().notNull(), // например: 'gemini-2.5-flash-image', 'minimax-m2'
	providerId: text("provider_id").notNull().references(() => aiProviders.id, { onDelete: 'cascade' }),
	name: text("name").notNull(), // например: "Gemini Flash Image", "MiniMax-M2"
	type: modelType("type").notNull(), // 'text-to-text' | 'text-to-image' | 'image-to-video' | ...
	costDetails: jsonb("cost_details").default({}), // { "input": 0.002, "output": 0.004, "unit": "per_1k_tokens" }
	capabilities: text("capabilities").array(), // ['function_calling', 'streaming', 'vision']
	isDefault: boolean("is_default").default(false).notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	metadata: jsonb("metadata").default({}), // Дополнительная информация о модели
	requestDefaults: jsonb("request_defaults"), // Шаблон запроса для модели
	responseAdapter: jsonb("response_adapter"), // Схема ответа для модели
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

// ============================================

export const generationProjects = generationPipeline.table("generation_projects", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	ownerId: uuid("owner_id"), // Ссылку на auth.users добавим позже, если понадобится
	templateId: uuid("template_id").references(() => storyTemplates.id, { onDelete: 'set null' }),
	status: appJobStatus("status").default('pending').notNull(),
	stage: text("stage").default('init').notNull(),
	finalVideoUrl: text("final_video_url"),
	apiCostUsd: numeric("api_cost_usd", { precision: 10, scale: 4 }).default("0").notNull(),
	channelId: text("channel_id"),
	errorMessage: text("error_message"),
	minimaxCost: numeric("minimax_cost"),
	uploadStatus: text("upload_status"),
	youtubeVideoId: text("youtube_video_id"),
	meta: jsonb("meta").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
});

export const assets = generationPipeline.table("assets", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	generationProjectId: uuid("generation_project_id").notNull().references(() => generationProjects.id, { onDelete: 'cascade' }),
	beatId: uuid("beat_id").references(() => beats.id, { onDelete: 'set null' }),
	assetType: text("asset_type").notNull(),
	status: appJobStatus("status").default('pending').notNull(),
	storageUrl: text("storage_url").notNull(),
	storageBucket: text("storage_bucket"),
	storagePath: text("storage_path"),
	minimaxJobId: text("minimax_job_id"),
	contentHash: text("content_hash"),
	apiCostUsd: numeric("api_cost_usd", { precision: 10, scale: 4 }).default("0"),
	meta: jsonb("meta").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => {
	return {
		contentHashIdx: uniqueIndex("content_hash_idx").on(table.contentHash),
	}
});

export const generationAnimationJobs = generationPipeline.table("generation_animation_jobs", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull().references(() => generationProjects.id, { onDelete: 'cascade' }),
	sceneIndex: integer("scene_index").notNull(),
	provider: text("provider").default('minimax').notNull(),
	model: text("model").notNull(),
	minimaxTaskId: text("minimax_task_id"),
	minimaxFileId: text("minimax_file_id"),
	status: text("status").default('queued').notNull(),
	resolution: text("resolution"),
	durationSec: integer("duration_sec"),
	videoUrl: text("video_url"),
	errorCode: text("error_code"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

// =================== JOB QUEUES ===================

export const ingestJobQueue = jobs.table("ingest_job_queue", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	query: text("query").notNull(),
	publishedAfter: timestamp("published_after", { withTimezone: true, mode: 'string' }),
	duration: integer("duration"),
	error: text("error"),
	errorMessage: text("error_message"),
	status: appJobStatus("status").default('pending').notNull(),
	retryCount: integer("retry_count").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),

	// YouTube API параметры поиска
	maxResults: integer("max_results").default(25),
	regionCode: text("region_code"),
	relevanceLanguage: text("relevance_language"),
	safeSearch: text("safe_search").default('moderate'),
	orderBy: text("order_by").default('date'),
	searchType: text("search_type").default('video'),
	videoDuration: text("video_duration"),
	videoDefinition: text("video_definition"),
	videoCaption: text("video_caption"),
	videoEmbeddable: boolean("video_embeddable"),
	videoLicense: text("video_license"),
	eventType: text("event_type"),

	// Поле для отслеживания последней проверки задачи
	lastCheckedAt: timestamp("last_checked_at", { withTimezone: true, mode: 'string' }),

	// === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
	stage: text("stage").default('init').notNull(),
	externalId: text("external_id"),
	idempotencyKey: text("idempotency_key"),
}, (table) => {
	return {
		uidxIngestQuery: uniqueIndex("uidx_ingest_query").on(table.query),
	}
});

export const analysisJobQueue = jobs.table("analysis_job_queue", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	videoId: uuid("video_id").notNull().references(() => youtubeVideos.id, { onDelete: 'cascade' }),
	analyzer: text("analyzer").notNull(),
	status: appJobStatus("status").default('pending').notNull(),
	retryCount: integer("retry_count").default(0).notNull(),
	error: text("error"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),

	// === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
	stage: text("stage").default('init').notNull(),
	externalId: text("external_id"),
	idempotencyKey: text("idempotency_key"),
}, (table) => {
	return {
		uidxAnalysisVideo: uniqueIndex("uidx_analysis_video").on(table.videoId, table.analyzer),
	}
});

export const generationJobQueue = jobs.table("generation_job_queue", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: 'cascade' }),
	provider: text("provider").notNull(),
	status: appJobStatus("status").default('pending').notNull(),
	retryCount: integer("retry_count").default(0).notNull(),
	error: text("error"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),

	// === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
	stage: text("stage").default('init').notNull(),
	externalId: text("external_id"),
	idempotencyKey: text("idempotency_key"),
}, (table) => {
	return {
		uidxGenerationAssetProvider: uniqueIndex("uidx_generation_asset_provider").on(table.assetId, table.provider),
	}
});

export const keyframeJobQueue = jobs.table("keyframe_job_queue", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull().references(() => generationProjects.id, { onDelete: 'cascade' }),
	sceneIndex: integer("scene_index").notNull(),
	frameType: text("frame_type").notNull(), // 'first' | 'last'
	prompt: text("prompt").notNull(),
	assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: 'cascade' }),
	modelId: text("model_id"), // AI model ID for keyframe generation (references ai_models.id)
	status: appJobStatus("status").default('pending').notNull(),
	retryCount: integer("retry_count").default(0).notNull(),
	error: text("error"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),

	// === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
	stage: text("stage").default('init').notNull(),
	externalId: text("external_id"),
	idempotencyKey: text("idempotency_key"),
}, (table) => {
	return {
		uidxKeyframeProjectScene: uniqueIndex("uidx_keyframe_project_scene").on(table.projectId, table.sceneIndex, table.frameType),
	}
});
export const animationJobQueue = jobs.table("animation_job_queue", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull().references(() => generationProjects.id, { onDelete: 'cascade' }),
	sceneIndex: integer("scene_index").notNull(),

	assetIdFirstFrame: uuid("asset_id_first_frame").notNull().references(() => assets.id, { onDelete: 'cascade' }),
	assetIdLastFrame: uuid("asset_id_last_frame").notNull().references(() => assets.id, { onDelete: 'cascade' }),
	sceneDescription: text("scene_description").notNull(),

	status: appJobStatus("status").default('pending').notNull(),

	// === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
	stage: text("stage").default('init').notNull(), // Используем text для простоты, в коде будем строго типизировать
	externalId: text("external_id"), // ID задачи в MiniMax. Храним ВЕЧНО, даже при ретраях.
	idempotencyKey: text("idempotency_key"), // hash(projectId + sceneIndex)

	// Legacy поле, можно оставить для совместимости или мигрировать в externalId
	haluTaskId: text("halu_task_id"),

	retryCount: integer("retry_count").default(0).notNull(),
	error: text("error"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => {
	return {
		// УНИКАЛЬНЫЙ ИНДЕКС. База физически не даст создать две задачи на одну и ту же сцену одного проекта.
		uniqueSceneGen: uniqueIndex("uidx_anim_project_scene").on(table.projectId, table.sceneIndex),
	}
});
