import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  index,
  jsonb,
  numeric,
  bigint,
  unique,
  uniqueIndex,
  inet,
  primaryKey,
  boolean,
  pgSchema,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// =================== SCHEMAS ===================
export const aesCore = pgSchema("aes_core");
export const analytics = pgSchema("analytics");
export const generationPipeline = pgSchema("generation_pipeline");
export const jobs = pgSchema("jobs");
export const studio = pgSchema("studio");

// =================== ENUMS ===================
export const factorType = pgEnum("factor_type", ["totp", "webauthn", "phone"]);
export const factorStatus = pgEnum("factor_status", ["unverified", "verified"]);
export const aalLevel = pgEnum("aal_level", ["aal1", "aal2", "aal3"]);
export const codeChallengeMethod = pgEnum("code_challenge_method", [
  "s256",
  "plain",
]);
export const oneTimeTokenType = pgEnum("one_time_token_type", [
  "confirmation_token",
  "reauthentication_token",
  "recovery_token",
  "email_change_token_new",
  "email_change_token_current",
  "phone_change_token",
]);
export const oauthRegistrationType = pgEnum("oauth_registration_type", [
  "dynamic",
  "manual",
]);
export const oauthAuthorizationStatus = pgEnum("oauth_authorization_status", [
  "pending",
  "approved",
  "denied",
  "expired",
]);
export const oauthResponseType = pgEnum("oauth_response_type", ["code"]);
export const oauthClientType = pgEnum("oauth_client_type", [
  "public",
  "confidential",
]);
export const buckettype = pgEnum("buckettype", ["STANDARD", "ANALYTICS"]);
export const equalityOp = pgEnum("equality_op", [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "in",
]);
export const action = pgEnum("action", [
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "ERROR",
]);
export const phaseEnum = pgEnum("phase_enum", [
  "HOOK",
  "BUILD",
  "PAYOFF",
  "RESOLUTION",
]);
export const emotionEnum = pgEnum("emotion_enum", [
  "joy",
  "sadness",
  "surprise",
  "anticipation",
  "tension",
  "relief",
  "empathy",
  "curiosity",
  "humor",
  "awe",
]);
export const contrastEnum = pgEnum("contrast_enum", [
  "small_vs_big",
  "slow_vs_fast",
  "alone_vs_together",
  "sad_vs_happy",
  "problem_vs_solution",
  "before_vs_after",
]);
export const appJobStatus = pgEnum("app_job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const authType = pgEnum("auth_type", [
  "bearer_token",
  "api_key_header",
  "query_param",
]);
export const modelType = pgEnum("model_type", [
  "text-to-text",
  "text-to-image",
  "image-to-video",
  "text-to-video",
  "image-to-image",
  "audio-to-text",
  "text-to-audio",
  "multimodal",
]);

export const jobStageEnum = pgEnum("job_stage", [
  "init",
  "checking_dupes",
  "submitting",
  "waiting_external",
  "downloading",
  "uploading",
  "completed",
  "failed",
]);

export const generationEvents = pgTable(
  "generation_events",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    userId: text("user_id"),
    topic: text("topic"),
    durationCategory: text("duration_category"),
    scenario: jsonb("scenario"),
    candidates: jsonb("candidates"),
    chosenIndex: integer("chosen_index"),
    composeJobId: text("compose_job_id"),
    status: appJobStatus("status").default("pending").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    chosenFirstAssetLegacyId: text("chosen_first_asset_legacy_id"),
    chosenLastAssetLegacyId: text("chosen_last_asset_legacy_id"),
    aesScore: numeric("aes_score"),
    hookStrength: numeric("hook_strength"),
    emotionalCurve: text("emotional_curve").array(),
    evaluator: text("evaluator"),
    chosenFirstAssetId: uuid("chosen_first_asset_id").references(
      () => assets.id,
      { onDelete: "set null" },
    ),
    chosenLastAssetId: uuid("chosen_last_asset_id").references(
      () => assets.id,
      { onDelete: "set null" },
    ),
  },
  (table) => {
    return {
      idxGenEventsScenarioGin: index("idx_gen_events_scenario_gin").on(
        table.scenario,
      ),
      idxGenEventsCandidatesGin: index("idx_gen_events_candidates_gin").on(
        table.candidates,
      ),
      idxGenEventsDeletedAt: index("idx_gen_events_deleted_at").on(
        table.deletedAt,
      ),
      idxGenerationEventsUser: index("idx_generation_events_user").on(
        table.userId,
      ),
      idxGenerationEventsStatus: index("idx_generation_events_status").on(
        table.status,
      ),
      idxGenerationEventsFirstAsset: index(
        "idx_generation_events_first_asset",
      ).on(table.chosenFirstAssetId),
      idxGenerationEventsLastAsset: index(
        "idx_generation_events_last_asset",
      ).on(table.chosenLastAssetId),
      idxGenerationEventsFirstAssetLegacy: index(
        "idx_generation_events_first_asset_legacy",
      ).on(table.chosenFirstAssetLegacyId),
      idxGenerationEventsLastAssetLegacy: index(
        "idx_generation_events_last_asset_legacy",
      ).on(table.chosenLastAssetLegacyId),
      idxGenerationEventsAssetIds: index("idx_generation_events_asset_ids").on(
        table.chosenFirstAssetId,
        table.chosenLastAssetId,
      ),
      idxGenerationEventsFirstAssetFk: index(
        "idx_generation_events_first_asset_fk",
      ).on(table.chosenFirstAssetId),
      idxGenerationEventsLastAssetFk: index(
        "idx_generation_events_last_asset_fk",
      ).on(table.chosenLastAssetId),
    };
  },
);

export const clipsWithLegacy = pgTable("clips_with_legacy", {
  id: uuid("id"),
  taskId: uuid("task_id"),
  taskLegacyId: text("task_legacy_id"),
  beatId: text("beat_id"),
  publicUrl: text("public_url"),
  durationS: integer("duration_s"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }),
  taskTextId: text("task_text_id"),
});

export const legacyTasks = pgTable(
  "legacy_tasks",
  {
    legacyId: text("legacy_id").notNull(),
    kind: text("kind").notNull(),
    prompt: text("prompt"),
    publicUrl: text("public_url"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    params: jsonb("params"),
    fileId: text("file_id"),
    error: text("error"),
    batchId: uuid("batch_id").references(() => batches.id, {
      onDelete: "set null",
    }),
    topic: text("topic"),
    lang: text("lang"),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    status: appJobStatus("status").default("pending").notNull(),
  },
  (table) => {
    return {
      idxTasksParamsGin: index("idx_tasks_params_gin").on(table.params),
      idxTasksDeletedAt: index("idx_tasks_deleted_at").on(table.deletedAt),
      idxTasksBatch: index("idx_tasks_batch").on(table.batchId),
      tasksLegacyIdUniq: unique("tasks_legacy_id_uniq").on(table.legacyId),
    };
  },
);

export const batches = pgTable(
  "batches",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    planPath: text("plan_path"),
    total: integer("total").default(0).notNull(),
    ok: integer("ok").default(0).notNull(),
    fail: integer("fail").default(0).notNull(),
    avgTimeMs: integer("avg_time_ms"),
    qualityScore: integer("quality_score"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
    status: appJobStatus("status").default("pending").notNull(),
  },
  (table) => {
    return {
      idxBatchesDeletedAt: index("idx_batches_deleted_at").on(table.deletedAt),
    };
  },
);

export const clips = pgTable(
  "clips",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    legacyTaskId: text("legacy_task_id").notNull(),
    beatId: text("beat_id"),
    publicUrl: text("public_url"),
    durationS: integer("duration_s"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => legacyTasks.id, { onDelete: "cascade" }),
  },
  (table) => {
    return {
      idxClipsTaskId: index("idx_clips_task_id").on(table.taskId),
      idxClipsTaskLegacyId: index("idx_clips_task_legacy_id").on(
        table.legacyTaskId,
      ),
      idxClipsTaskIdFk: index("idx_clips_task_id_fk").on(table.taskId),
      idxClipsTask: index("idx_clips_task").on(table.taskId),
    };
  },
);

export const youtubeVideos = pgTable(
  "youtube_videos",
  {
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    channelTitle: text("channel_title"),
    durationSeconds: integer("duration_seconds"),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    viewCount: bigint("view_count", { mode: "number" }).default(0),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    likeCount: bigint("like_count", { mode: "number" }).default(0),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    commentCount: bigint("comment_count", { mode: "number" }).default(0),
    tags: jsonb("tags").default([]),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    youtubeId: text("youtube_id"),
    thumbnails: jsonb("thumbnails"),
    liveBroadcastContent: text("live_broadcast_content"),
    channelId: uuid("channel_id").references(() => youtubeChannels.id, {
      onDelete: "set null",
    }),
    id: uuid("id").defaultRandom().primaryKey().notNull(),
  },
  (table) => {
    return {
      urlUidx: uniqueIndex("youtube_videos_url_uidx").on(table.url),
      idxYoutubeVideosPublishedAt: index("idx_youtube_videos_published_at").on(
        table.publishedAt,
      ),
      idxYoutubeVideosCreatedAt: index("idx_youtube_videos_created_at").on(
        table.createdAt,
      ),
      youtubeIdPartialUidx: uniqueIndex(
        "youtube_videos_youtube_id_partial_uidx",
      ).on(table.youtubeId),
      publishedAtIdx: index("youtube_videos_published_at_idx").on(
        table.publishedAt,
      ),
      channelTitleIdx: index("youtube_videos_channel_title_idx").on(
        table.channelTitle,
      ),
      youtubeIdUidx: uniqueIndex("youtube_videos_youtube_id_uidx").on(
        table.youtubeId,
      ),
      channelIdIdx: index("youtube_videos_channel_id_idx").on(table.channelId),
    };
  },
);

export const analysisResults = pgTable(
  "analysis_results",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    analyzer: text("analyzer").notNull(),
    analysisUrl: text("analysis_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    aesBreakdown: jsonb("aes_breakdown"),
    overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
    emotionalTags: jsonb("emotional_tags"),
    analyzerName: text("analyzer_name"),
    version: integer("version").default(1).notNull(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => youtubeVideos.id, { onDelete: "cascade" }),
  },
  (table) => {
    return {
      idxVideoAnalysisAnalyzer: index("idx_video_analysis_analyzer").on(
        table.analyzer,
      ),
    };
  },
);

export const auditLog = pgTable(
  "audit_log",
  {
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxAuditLogTableName: index("idx_audit_log_table_name").on(
        table.tableName,
      ),
      idxAuditLogRecordId: index("idx_audit_log_record_id").on(table.recordId),
      idxAuditLogAction: index("idx_audit_log_action").on(table.action),
      idxAuditLogUserId: index("idx_audit_log_user_id").on(table.userId),
      idxAuditLogCreatedAt: index("idx_audit_log_created_at").on(
        table.createdAt,
      ),
      idxAuditLogTableRecord: index("idx_audit_log_table_record").on(
        table.recordId,
        table.tableName,
      ),
    };
  },
);

export const vGenerationCostsByUser = pgTable("v_generation_costs_by_user", {
  ownerId: uuid("owner_id"),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  totalShorts: bigint("total_shorts", { mode: "number" }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  totalAssets: bigint("total_assets", { mode: "number" }),
  totalShortsCost: numeric("total_shorts_cost"),
  totalAssetsCost: numeric("total_assets_cost"),
  totalCost: numeric("total_cost"),
  firstShortAt: timestamp("first_short_at", {
    withTimezone: true,
    mode: "string",
  }),
  lastShortAt: timestamp("last_short_at", {
    withTimezone: true,
    mode: "string",
  }),
});

export const jsonSchemas = pgTable(
  "json_schemas",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    schemaName: text("schema_name").notNull(),
    schemaVersion: text("schema_version").default("1").notNull(),
    schemaDef: jsonb("schema_def").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxJsonSchemasName: index("idx_json_schemas_name").on(table.schemaName),
      jsonSchemasSchemaNameKey: unique("json_schemas_schema_name_key").on(
        table.schemaName,
      ),
    };
  },
);

export const idUuidMapping = pgTable(
  "id_uuid_mapping",
  {
    tableName: text("table_name").notNull(),
    legacyId: text("legacy_id").notNull(),
    uuidId: uuid("uuid_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => {
    return {
      idxIdUuidMappingUuid: index("idx_id_uuid_mapping_uuid").on(
        table.tableName,
        table.uuidId,
      ),
      idUuidMappingPkey: primaryKey({
        columns: [table.tableName, table.legacyId],
        name: "id_uuid_mapping_pkey",
      }),
    };
  },
);

// =================== НОВЫЕ ТАБЛИЦЫ ===================

export const storyTemplates = aesCore.table("story_templates", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").array(),
  targetDurationSeconds: integer("target_duration_seconds").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const beats = aesCore.table("beats", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => storyTemplates.id, { onDelete: "cascade" }),
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const aiModels = aesCore.table("ai_models", {
  id: text("id").primaryKey().notNull(), // например: 'gemini-2.5-flash-image', 'minimax-m2'
  providerId: text("provider_id")
    .notNull()
    .references(() => aiProviders.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // например: "Gemini Flash Image", "MiniMax-M2"
  type: modelType("type").notNull(), // 'text-to-text' | 'text-to-image' | 'image-to-video' | ...
  costDetails: jsonb("cost_details").default({}), // { "input": 0.002, "output": 0.004, "unit": "per_1k_tokens" }
  capabilities: text("capabilities").array(), // ['function_calling', 'streaming', 'vision']
  isDefault: boolean("is_default").default(false).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  metadata: jsonb("metadata").default({}), // Дополнительная информация о модели
  requestDefaults: jsonb("request_defaults"), // Шаблон запроса для модели
  responseAdapter: jsonb("response_adapter"), // Схема ответа для модели
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

// ============================================

export const generationProjects = generationPipeline.table(
  "generation_projects",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    ownerId: uuid("owner_id"), // Ссылку на auth.users добавим позже, если понадобится
    templateId: uuid("template_id").references(() => storyTemplates.id, {
      onDelete: "set null",
    }),
    contentFormatId: uuid("content_format_id").references(
      () => contentFormats.id,
      { onDelete: "restrict" },
    ),
    status: appJobStatus("status").default("pending").notNull(),
    stage: text("stage").default("init").notNull(),
    finalVideoUrl: text("final_video_url"),
    apiCostUsd: numeric("api_cost_usd", { precision: 10, scale: 4 })
      .default("0")
      .notNull(),
    channelId: text("channel_id"),
    errorMessage: text("error_message"),
    minimaxCost: numeric("minimax_cost"),
    uploadStatus: text("upload_status"),
    youtubeVideoId: text("youtube_video_id"),
    meta: jsonb("meta").default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
);

// Canonical editable video intent. The legacy generationProjects table remains
// the active scenario/keyframe/animation pipeline until a later migration PR.
export const videoProjects = generationPipeline.table(
  "video_projects",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    ownerId: uuid("owner_id").notNull(),
    clientSubmissionId: text("client_submission_id"),
    title: text("title").notNull(),
    idea: text("idea").notNull(),
    status: text("status", { enum: ["draft", "active", "archived"] })
      .default("draft")
      .notNull(),
    contentFormatId: uuid("content_format_id").references(
      () => contentFormats.id,
      { onDelete: "restrict" },
    ),
    storyTemplateId: uuid("story_template_id").references(
      () => storyTemplates.id,
      { onDelete: "set null" },
    ),
    projectDefaults: jsonb("project_defaults")
      .default({ schemaVersion: 1, production: {}, models: {} })
      .notNull(),
    // The FK is declared in SQL after generation_runs to avoid a circular Drizzle declaration.
    promotedRunId: uuid("promoted_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    ownerUpdatedIdx: index("video_projects_owner_updated_idx").on(
      table.ownerId,
      table.updatedAt,
    ),
    ownerSubmissionUnique: unique("video_projects_owner_submission_unique").on(
      table.ownerId,
      table.clientSubmissionId,
    ),
    contentFormatIdx: index("video_projects_content_format_idx").on(
      table.contentFormatId,
    ),
    storyTemplateIdx: index("video_projects_story_template_idx").on(
      table.storyTemplateId,
    ),
  }),
);

export const generationRuns = generationPipeline.table(
  "generation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => videoProjects.id, { onDelete: "cascade" }),
    clientSubmissionId: text("client_submission_id"),
    runNumber: integer("run_number").notNull(),
    status: text("status", {
      enum: [
        "draft",
        "active",
        "queued",
        "running",
        "succeeded",
        "failed",
        "cancelled",
      ],
    })
      .default("draft")
      .notNull(),
    stage: text("stage", {
      enum: ["scenario", "keyframes", "clips", "composition"],
    })
      .default("scenario")
      .notNull(),
    inputSnapshot: jsonb("input_snapshot").notNull(),
    projectSnapshot: jsonb("project_snapshot").notNull(),
    contentFormatSnapshot: jsonb("content_format_snapshot"),
    storyTemplateSnapshot: jsonb("story_template_snapshot"),
    modelSnapshot: jsonb("model_snapshot").notNull(),
    promptSnapshot: jsonb("prompt_snapshot").notNull(),
    sourceSnapshot: jsonb("source_snapshot"),
    schemaVersion: integer("schema_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    failedStage: text("failed_stage", {
      enum: ["scenario", "keyframes", "clips", "composition"],
    }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    projectNumberUnique: unique("generation_runs_project_number_unique").on(
      table.projectId,
      table.runNumber,
    ),
    projectSubmissionUnique: unique(
      "generation_runs_project_submission_unique",
    ).on(table.projectId, table.clientSubmissionId),
    projectIdIdUnique: unique("generation_runs_project_id_id_unique").on(
      table.projectId,
      table.id,
    ),
    projectCreatedIdx: index("generation_runs_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    statusStageIdx: index("generation_runs_status_stage_idx").on(
      table.status,
      table.stage,
    ),
  }),
);

export const scenarioGenerationAttempts = generationPipeline.table(
  "scenario_generation_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => generationRuns.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status", {
      enum: ["queued", "running", "succeeded", "failed", "cancelled"],
    })
      .default("queued")
      .notNull(),
    provider: text("provider").notNull(),
    modelId: text("model_id").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    providerRequestId: text("provider_request_id"),
    finishReason: text("finish_reason"),
    usage: jsonb("usage"),
    validationResult: jsonb("validation_result"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    diagnosticPayload: jsonb("diagnostic_payload"),
    queuedAt: timestamp("queued_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    runNumberUnique: unique("scenario_attempts_run_number_unique").on(
      table.runId,
      table.attemptNumber,
    ),
    runIdempotencyUnique: unique("scenario_attempts_run_idempotency_unique").on(
      table.runId,
      table.idempotencyKey,
    ),
    runCreatedIdx: index("scenario_attempts_run_created_idx").on(
      table.runId,
      table.attemptNumber,
    ),
    statusIdx: index("scenario_attempts_status_idx").on(
      table.status,
      table.queuedAt,
    ),
  }),
);

export const scenarioArtifacts = generationPipeline.table(
  "scenario_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => generationRuns.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => scenarioGenerationAttempts.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type", { enum: ["scenario_candidates"] })
      .default("scenario_candidates")
      .notNull(),
    schemaVersion: integer("schema_version").default(1).notNull(),
    payload: jsonb("payload").notNull(),
    validationMetadata: jsonb("validation_metadata").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    runUnique: unique("scenario_artifacts_run_unique").on(table.runId),
    attemptUnique: unique("scenario_artifacts_attempt_unique").on(
      table.attemptId,
    ),
  }),
);

/** Immutable, user-approved snapshots selected from scenario artifacts. */
export const approvedScenarioRevisions = generationPipeline.table(
  "approved_scenario_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => generationRuns.id, { onDelete: "cascade" }),
    scenarioArtifactId: uuid("scenario_artifact_id")
      .notNull()
      .references(() => scenarioArtifacts.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    sourceCandidateIndex: integer("source_candidate_index").notNull(),
    selectedCandidate: jsonb("selected_candidate").notNull(),
    scenes: jsonb("scenes").notNull(),
    productionPlan: jsonb("production_plan"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    runRevisionUnique: unique(
      "approved_scenario_revisions_run_revision_unique",
    ).on(table.runId, table.revisionNumber),
    runIdempotencyUnique: unique(
      "approved_scenario_revisions_run_idempotency_unique",
    ).on(table.runId, table.idempotencyKey),
    runIdIdUnique: unique("approved_scenario_revisions_run_id_id_unique").on(
      table.runId,
      table.id,
    ),
    runCreatedIdx: index("approved_scenario_revisions_run_created_idx").on(
      table.runId,
      table.createdAt,
    ),
  }),
);

/** Mutable pointer; downstream consumers resolve only through this table. */
export const currentApprovedScenarioRevisions = generationPipeline.table(
  "current_approved_scenario_revisions",
  {
    runId: uuid("run_id")
      .primaryKey()
      .notNull()
      .references(() => generationRuns.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
);

export const assets = generationPipeline.table(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    generationProjectId: uuid("generation_project_id")
      .notNull()
      .references(() => generationProjects.id, { onDelete: "cascade" }),
    beatId: uuid("beat_id").references(() => beats.id, {
      onDelete: "set null",
    }),
    assetType: text("asset_type").notNull(),
    status: appJobStatus("status").default("pending").notNull(),
    storageUrl: text("storage_url").notNull(),
    storageBucket: text("storage_bucket"),
    storagePath: text("storage_path"),
    minimaxJobId: text("minimax_job_id"),
    contentHash: text("content_hash"),
    apiCostUsd: numeric("api_cost_usd", { precision: 10, scale: 4 }).default(
      "0",
    ),
    meta: jsonb("meta").default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => {
    return {
      contentHashIdx: uniqueIndex("content_hash_idx").on(table.contentHash),
    };
  },
);

export const generationAnimationJobs = generationPipeline.table(
  "generation_animation_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => generationProjects.id, { onDelete: "cascade" }),
    sceneIndex: integer("scene_index").notNull(),
    provider: text("provider").default("minimax").notNull(),
    model: text("model").notNull(),
    minimaxTaskId: text("minimax_task_id"),
    minimaxFileId: text("minimax_file_id"),
    status: text("status").default("queued").notNull(),
    resolution: text("resolution"),
    durationSec: integer("duration_sec"),
    videoUrl: text("video_url"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
);

// =================== JOB QUEUES ===================

export const ingestJobQueue = jobs.table(
  "ingest_job_queue",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    query: text("query").notNull(),
    publishedAfter: timestamp("published_after", {
      withTimezone: true,
      mode: "string",
    }),
    duration: integer("duration"),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", {
      withTimezone: true,
      mode: "string",
    }),
    error: text("error"),
    errorMessage: text("error_message"),
    status: appJobStatus("status").default("pending").notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),

    // YouTube API параметры поиска
    maxResults: integer("max_results").default(25),
    regionCode: text("region_code"),
    relevanceLanguage: text("relevance_language"),
    safeSearch: text("safe_search").default("moderate"),
    orderBy: text("order_by").default("date"),
    searchType: text("search_type").default("video"),
    videoDuration: text("video_duration"),
    videoDefinition: text("video_definition"),
    videoCaption: text("video_caption"),
    videoEmbeddable: boolean("video_embeddable"),
    videoLicense: text("video_license"),
    eventType: text("event_type"),

    // Поле для отслеживания последней проверки задачи
    lastCheckedAt: timestamp("last_checked_at", {
      withTimezone: true,
      mode: "string",
    }),

    // === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
    stage: text("stage").default("init").notNull(),
    externalId: text("external_id"),
    idempotencyKey: text("idempotency_key"),
  },
  (table) => {
    return {
      uidxIngestQuery: uniqueIndex("uidx_ingest_query").on(table.query),
    };
  },
);

export const analysisJobQueue = jobs.table(
  "analysis_job_queue",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => youtubeVideos.id, { onDelete: "cascade" }),
    analyzer: text("analyzer").notNull(),
    status: appJobStatus("status").default("pending").notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", {
      withTimezone: true,
      mode: "string",
    }),
    retryCount: integer("retry_count").default(0).notNull(),
    error: text("error"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),

    // === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
    stage: text("stage").default("init").notNull(),
    externalId: text("external_id"),
    idempotencyKey: text("idempotency_key"),
  },
  (table) => {
    return {
      uidxAnalysisVideo: uniqueIndex("uidx_analysis_video").on(
        table.videoId,
        table.analyzer,
      ),
    };
  },
);

export const generationJobQueue = jobs.table(
  "generation_job_queue",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: appJobStatus("status").default("pending").notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", {
      withTimezone: true,
      mode: "string",
    }),
    retryCount: integer("retry_count").default(0).notNull(),
    error: text("error"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),

    // === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
    stage: text("stage").default("init").notNull(),
    externalId: text("external_id"),
    idempotencyKey: text("idempotency_key"),
  },
  (table) => {
    return {
      uidxGenerationAssetProvider: uniqueIndex(
        "uidx_generation_asset_provider",
      ).on(table.assetId, table.provider),
    };
  },
);

export const scenarioGenerationJobQueue = jobs.table(
  "scenario_generation_job_queue",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => scenarioGenerationAttempts.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    status: text("status", {
      enum: ["queued", "processing", "completed", "failed", "cancelled"],
    })
      .default("queued")
      .notNull(),
    availableAt: timestamp("available_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    lockedBy: uuid("locked_by"),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    attemptUnique: unique("scenario_jobs_attempt_unique").on(table.attemptId),
    eventUnique: unique("scenario_jobs_event_unique").on(table.eventKey),
    claimIdx: index("scenario_jobs_claim_idx").on(
      table.status,
      table.availableAt,
      table.createdAt,
    ),
  }),
);

export const keyframeJobQueue = jobs.table(
  "keyframe_job_queue",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => generationProjects.id, { onDelete: "cascade" }),
    sceneIndex: integer("scene_index").notNull(),
    frameType: text("frame_type").notNull(), // 'first' | 'last'
    prompt: text("prompt").notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    modelId: text("model_id"), // AI model ID for keyframe generation (references ai_models.id)
    status: appJobStatus("status").default("pending").notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", {
      withTimezone: true,
      mode: "string",
    }),
    retryCount: integer("retry_count").default(0).notNull(),
    error: text("error"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),

    // === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
    stage: text("stage").default("init").notNull(),
    externalId: text("external_id"),
    idempotencyKey: text("idempotency_key"),
  },
  (table) => {
    return {
      uidxKeyframeProjectScene: uniqueIndex("uidx_keyframe_project_scene").on(
        table.projectId,
        table.sceneIndex,
        table.frameType,
      ),
    };
  },
);
export const animationJobQueue = jobs.table(
  "animation_job_queue",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => generationProjects.id, { onDelete: "cascade" }),
    sceneIndex: integer("scene_index").notNull(),

    assetIdFirstFrame: uuid("asset_id_first_frame")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    assetIdLastFrame: uuid("asset_id_last_frame")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    sceneDescription: text("scene_description").notNull(),

    status: appJobStatus("status").default("pending").notNull(),

    // === НОВЫЕ ПОЛЯ БЕЗОПАСНОСТИ ===
    stage: text("stage").default("init").notNull(), // Используем text для простоты, в коде будем строго типизировать
    externalId: text("external_id"), // ID задачи в MiniMax. Храним ВЕЧНО, даже при ретраях.
    idempotencyKey: text("idempotency_key"), // hash(projectId + sceneIndex)

    // Legacy поле, можно оставить для совместимости или мигрировать в externalId
    haluTaskId: text("halu_task_id"),

    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at", {
      withTimezone: true,
      mode: "string",
    }),

    retryCount: integer("retry_count").default(0).notNull(),
    error: text("error"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => {
    return {
      // УНИКАЛЬНЫЙ ИНДЕКС. База физически не даст создать две задачи на одну и ту же сцену одного проекта.
      uniqueSceneGen: uniqueIndex("uidx_anim_project_scene").on(
        table.projectId,
        table.sceneIndex,
      ),
    };
  },
);

// =================== HWAR WORKERS ===================

export const hwarWorkerType = pgEnum("hwar_worker_type", [
  "ingest",
  "analysis",
  "keyframe",
  "animation",
  "enrichment",
  "cleanup",
]);

export const hwarWorkerStatus = pgEnum("hwar_worker_status", [
  "idle",
  "running",
  "paused",
  "error",
]);

// =================== BEAMNG ANALYTICS TABLES ===================

export const niches = pgTable("niches", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  language: text("language").default("en").notNull(),
  maxChannelAgeMonths: integer("max_channel_age_months").default(24).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const nicheQueries = pgTable(
  "niche_queries",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => niches.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nicheIdIdx: index("niche_queries_niche_id_idx").on(table.nicheId),
    nicheQueryUnique: unique("niche_queries_niche_query_unique").on(
      table.nicheId,
      table.query,
    ),
  }),
);

export const seedSources = pgTable("seed_sources", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  type: text("type", {
    enum: ["youtube_video", "youtube_channel", "manual"],
  }).notNull(),
  url: text("url"),
  title: text("title").notNull(),
  notes: text("notes"),
  status: text("status", { enum: ["new", "processed"] })
    .default("new")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const nicheCandidates = pgTable(
  "niche_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    seedSourceId: uuid("seed_source_id")
      .notNull()
      .references(() => seedSources.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status", { enum: ["candidate", "approved", "rejected"] })
      .default("candidate")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    seedSourceIdIdx: index("niche_candidates_seed_source_id_idx").on(
      table.seedSourceId,
    ),
    sourceNameUnique: uniqueIndex("niche_candidates_source_name_unique").on(
      table.seedSourceId,
      sql`lower(${table.name})`,
    ),
  }),
);
export const discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => niches.id),
    status: text("status", {
      enum: [
        "pending",
        "queued",
        "running",
        "blocked",
        "completed",
        "completed_with_errors",
        "failed",
        "cancelled",
      ],
    })
      .default("pending")
      .notNull(),
    cutoffDate: timestamp("cutoff_date", {
      withTimezone: true,
      mode: "string",
    }),
    searchOrders: jsonb("search_orders")
      .$type<string[]>()
      .default(["relevance", "viewCount", "date"])
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    errorMessage: text("error_message"),
    aiSummary: text("ai_summary"),
    cancelRequestedAt: timestamp("cancel_requested_at", {
      withTimezone: true,
      mode: "string",
    }),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "string",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    totalSteps: integer("total_steps").default(0).notNull(),
    requestBudget: integer("request_budget").default(50).notNull(),
    externalRequestCount: integer("external_request_count")
      .default(0)
      .notNull(),
    estimatedQuotaUnitsUsed: integer("estimated_quota_units_used")
      .default(0)
      .notNull(),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nicheCreatedIdx: index("discovery_runs_niche_created_idx").on(
      table.nicheId,
      table.createdAt,
    ),
  }),
);

export const discoveryRunSteps = pgTable(
  "discovery_run_steps",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => discoveryRuns.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    stepType: text("step_type", { enum: ["search", "finalize"] })
      .default("search")
      .notNull(),
    queryId: uuid("query_id").references(() => nicheQueries.id, {
      onDelete: "set null",
    }),
    querySnapshot: jsonb("query_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    searchOrder: text("search_order", {
      enum: ["relevance", "viewCount", "date"],
    }),
    status: text("status", {
      enum: [
        "pending",
        "processing",
        "retry_wait",
        "completed",
        "failed",
        "cancelled",
        "blocked_quota",
      ],
    })
      .default("pending")
      .notNull(),
    checkpoint: jsonb("checkpoint")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(4).notNull(),
    availableAt: timestamp("available_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    lockedBy: text("locked_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    lockExpiresAt: timestamp("lock_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    heartbeatAt: timestamp("heartbeat_at", {
      withTimezone: true,
      mode: "string",
    }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    externalRequestCount: integer("external_request_count")
      .default(0)
      .notNull(),
    estimatedQuotaUnitsUsed: integer("estimated_quota_units_used")
      .default(0)
      .notNull(),
    resultCounters: jsonb("result_counters")
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueKey: uniqueIndex("discovery_run_steps_unique_key").on(
      table.runId,
      table.stepKey,
    ),
    claimIdx: index("discovery_run_steps_claim_idx").on(
      table.availableAt,
      table.createdAt,
    ),
    leaseIdx: index("discovery_run_steps_lease_idx").on(table.lockExpiresAt),
    runStatusIdx: index("discovery_run_steps_run_status_idx").on(
      table.runId,
      table.status,
    ),
  }),
);

/**
 * A read-only, semantic view of the videos found in a single discovery run.
 * The raw YouTube video and discovery evidence remain the source of truth.
 */
export const discoveryClusters = pgTable(
  "discovery_clusters",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => discoveryRuns.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    summary: text("summary").notNull(),
    researchScore: numeric("research_score", {
      precision: 6,
      scale: 4,
    }).notNull(),
    adjustedResearchScore: numeric("adjusted_research_score", {
      precision: 6,
      scale: 4,
    }).notNull(),
    labelQualityScore: numeric("label_quality_score", {
      precision: 5,
      scale: 4,
    }).notNull(),
    dominantLanguage: text("dominant_language").notNull(),
    languageMatchScore: numeric("language_match_score", {
      precision: 5,
      scale: 4,
    }).notNull(),
    contentFormat: text("content_format").notNull(),
    audience: text("audience").notNull(),
    suggestedQueries: jsonb("suggested_queries").$type<string[]>().notNull(),
    whyResearchable: text("why_researchable").notNull(),
    semanticCohesion: numeric("semantic_cohesion", {
      precision: 5,
      scale: 4,
    }).notNull(),
    repeatedFormatEvidence: numeric("repeated_format_evidence", {
      precision: 5,
      scale: 4,
    }).notNull(),
    isOutlier: boolean("is_outlier").notNull(),
    rawTokenLabel: text("raw_token_label"),
    formatName: text("format_name")
      .notNull()
      .default("Repeatable Video Format"),
    confidenceScore: integer("confidence_score").notNull().default(0),
    formatSummary: text("format_summary").notNull().default(""),
    commonHooks: jsonb("common_hooks").$type<string[]>().notNull().default([]),
    commonTitlePatterns: jsonb("common_title_patterns")
      .$type<string[]>()
      .notNull()
      .default([]),
    commonEmotions: jsonb("common_emotions")
      .$type<string[]>()
      .notNull()
      .default([]),
    typicalDurationRange: text("typical_duration_range")
      .notNull()
      .default("Unavailable"),
    likelyVisualStyle: text("likely_visual_style")
      .notNull()
      .default("Unavailable"),
    repeatabilityScore: integer("repeatability_score").notNull().default(0),
    exampleVideos: jsonb("example_videos")
      .$type<string[]>()
      .notNull()
      .default([]),
    exampleChannels: jsonb("example_channels")
      .$type<string[]>()
      .notNull()
      .default([]),
    videoCount: integer("video_count").notNull(),
    channelCount: integer("channel_count").notNull(),
    medianViewsPerDay: numeric("median_views_per_day", {
      precision: 14,
      scale: 2,
    }).notNull(),
    smallChannelCount: integer("small_channel_count").notNull(),
    representativeTitles: jsonb("representative_titles")
      .$type<string[]>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    runScoreIdx: index("discovery_clusters_run_score_idx").on(
      table.runId,
      table.adjustedResearchScore,
    ),
  }),
);

/** Cache keyed by the exact title/channel/query evidence used for semantic discovery. */
export const discoveryVideoEmbeddings = pgTable("discovery_video_embeddings", {
  videoId: uuid("video_id")
    .primaryKey()
    .notNull()
    .references(() => youtubeVideos.id, { onDelete: "cascade" }),
  contentHash: text("content_hash").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  embedding: jsonb("embedding").$type<number[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

/** One semantic-cluster assignment for each unique video in a run. */
export const discoveryClusterVideos = pgTable(
  "discovery_cluster_videos",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => discoveryRuns.id, { onDelete: "cascade" }),
    videoId: uuid("video_id")
      .notNull()
      .references(() => youtubeVideos.id, { onDelete: "cascade" }),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => discoveryClusters.id, { onDelete: "cascade" }),
    // Curation is deliberately kept separate from the generated cluster data.
    // A false value means the video is included in the research dataset.
    isExcluded: boolean("is_excluded").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.runId, table.videoId],
      name: "discovery_cluster_videos_pk",
    }),
    clusterIdx: index("discovery_cluster_videos_cluster_idx").on(
      table.clusterId,
    ),
  }),
);

export const videoDiscoveries = pgTable(
  "video_discoveries",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => discoveryRuns.id, { onDelete: "cascade" }),
    videoId: uuid("video_id")
      .notNull()
      .references(() => youtubeVideos.id, { onDelete: "cascade" }),
    queryId: uuid("query_id")
      .notNull()
      .references(() => nicheQueries.id, { onDelete: "cascade" }),
    searchOrder: text("search_order").notNull(),
    resultPosition: integer("result_position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.runId, table.videoId, table.queryId, table.searchOrder],
      name: "video_discoveries_pk",
    }),
    runIdx: index("video_discoveries_run_idx").on(table.runId),
  }),
);

export const youtubeChannels = pgTable(
  "youtube_channels",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    youtubeChannelId: text("youtube_channel_id").notNull(),
    handle: text("handle"),
    title: text("title"),
    description: text("description"),
    country: text("country"),
    subscriberCount: bigint("subscriber_count", { mode: "number" }),
    hiddenSubscriberCount: boolean("hidden_subscriber_count"),
    videoCount: bigint("video_count", { mode: "number" }).default(0),
    viewCount: bigint("view_count", { mode: "number" }).default(0),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    }),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      youtubeChannelIdUidx: uniqueIndex("youtube_channels_channel_id_uidx").on(
        table.youtubeChannelId,
      ),
      handleIdx: index("youtube_channels_handle_idx").on(table.handle),
    };
  },
);

// A reusable, topic-independent description of how a video is packaged.
// Discovery cluster fields remain computed metadata and are intentionally separate.
export const contentFormats = pgTable(
  "content_formats",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    status: text("status", { enum: ["draft", "active", "archived"] })
      .default("draft")
      .notNull(),
    formatType: text("format_type", {
      enum: ["long_form", "short_form", "mixed"],
    })
      .default("mixed")
      .notNull(),
    hookPattern: text("hook_pattern"),
    structurePattern: text("structure_pattern"),
    visualPattern: text("visual_pattern"),
    pacingPattern: text("pacing_pattern"),
    targetDurationMinSeconds: integer("target_duration_min_seconds"),
    targetDurationMaxSeconds: integer("target_duration_max_seconds"),
    exampleOutput: text("example_output"),
    inputSchema: jsonb("input_schema")
      .default({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      })
      .notNull(),
    productionDefaults: jsonb("production_defaults").default({}).notNull(),
    productionRules: jsonb("production_rules").default([]).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusIdx: index("content_formats_status_idx").on(table.status),
    updatedAtIdx: index("content_formats_updated_at_idx").on(table.updatedAt),
  }),
);

export const contentFormatVideos = pgTable(
  "content_format_videos",
  {
    contentFormatId: uuid("content_format_id")
      .notNull()
      .references(() => contentFormats.id, { onDelete: "cascade" }),
    videoId: uuid("video_id")
      .notNull()
      .references(() => youtubeVideos.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["exemplar", "supporting", "counterexample"] })
      .default("supporting")
      .notNull(),
    source: text("source", {
      enum: ["manual", "discovery", "transcript", "ai", "import"],
    })
      .default("manual")
      .notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.contentFormatId, table.videoId],
      name: "content_format_videos_pk",
    }),
    formatIdx: index("content_format_videos_format_idx").on(
      table.contentFormatId,
    ),
    videoIdx: index("content_format_videos_video_idx").on(table.videoId),
  }),
);

export const contentFormatChannels = pgTable(
  "content_format_channels",
  {
    contentFormatId: uuid("content_format_id")
      .notNull()
      .references(() => contentFormats.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => youtubeChannels.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["primary", "frequent", "occasional", "reference"],
    })
      .default("occasional")
      .notNull(),
    source: text("source", {
      enum: ["manual", "discovery", "transcript", "ai", "import"],
    })
      .default("manual")
      .notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.contentFormatId, table.channelId],
      name: "content_format_channels_pk",
    }),
    formatIdx: index("content_format_channels_format_idx").on(
      table.contentFormatId,
    ),
    channelIdx: index("content_format_channels_channel_idx").on(
      table.channelId,
    ),
  }),
);

export const contentFormatEvidence = pgTable(
  "content_format_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    contentFormatId: uuid("content_format_id")
      .notNull()
      .references(() => contentFormats.id, { onDelete: "cascade" }),
    videoId: uuid("video_id").references(() => youtubeVideos.id, {
      onDelete: "set null",
    }),
    channelId: uuid("channel_id").references(() => youtubeChannels.id, {
      onDelete: "set null",
    }),
    evidenceType: text("evidence_type", {
      enum: [
        "title_pattern",
        "thumbnail_pattern",
        "hook",
        "structure",
        "visual_style",
        "pacing",
        "audience_promise",
        "topic_independence",
        "performance",
        "other",
      ],
    }).notNull(),
    statement: text("statement").notNull(),
    source: text("source", {
      enum: ["manual", "metadata", "discovery", "transcript", "ai"],
    })
      .default("manual")
      .notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    provenance: jsonb("provenance").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    formatIdx: index("content_format_evidence_format_idx").on(
      table.contentFormatId,
    ),
    videoIdx: index("content_format_evidence_video_idx").on(table.videoId),
    channelIdx: index("content_format_evidence_channel_idx").on(
      table.channelId,
    ),
  }),
);

export const importSessions = pgTable(
  "import_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    source: text("source").notNull(),
    status: text("status").default("pending").notNull(),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    totalChannels: integer("total_channels").default(0),
    totalVideos: integer("total_videos").default(0),
    errorMessage: text("error_message"),
    meta: jsonb("meta").default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      sourceIdx: index("import_sessions_source_idx").on(table.source),
      statusIdx: index("import_sessions_status_idx").on(table.status),
    };
  },
);

export const hwarWorkers = pgTable(
  "hwar_workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: hwarWorkerType("type").notNull(),
    status: hwarWorkerStatus("status").notNull().default("idle"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    isPaused: boolean("is_paused").notNull().default(false),
    concurrency: integer("concurrency").notNull().default(1),
    dailyLimitUsd: numeric("daily_limit_usd").notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    typeIdx: index("hwar_workers_type_idx").on(table.type),
    lastSeenIdx: index("hwar_workers_last_seen_idx").on(table.lastSeenAt),
  }),
);
