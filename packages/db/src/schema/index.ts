// Именованные экспорты для избежания конфликтов
export * from './aes_core';
export * from './analytics';
export * from './cron';
export * from './generation_pipeline';
export * from './jobs';
export * from './supabase_migrations';

// Именованные экспорты для public схемы
export {
  analysisResults,
  auditLog,
  batches as publicBatches,
  clips,
  generationEvents,
  idUuidMapping,
  jsonSchemas,
  legacyTasks,
  youtubeVideos
} from './public';

export type {
  AnalysisResults,
  NewAnalysisResults,
  AuditLog,
  NewAuditLog,
  Batches as PublicBatches,
  NewBatches as NewPublicBatches,
  Clips,
  NewClips,
  GenerationEvents,
  NewGenerationEvents,
  IdUuidMapping,
  NewIdUuidMapping,
  JsonSchemas,
  NewJsonSchemas,
  LegacyTasks,
  NewLegacyTasks,
  YoutubeVideos,
  NewYoutubeVideos
} from './public';

// Именованные экспорты для studio схемы
export {
  analysisTasks,
  batches as studioBatches,
  characters,
  datasets,
  harvests,
  presets,
  queues,
  scenarios,
  templates,
  workers
} from './studio';

export type {
  AnalysisTasks,
  NewAnalysisTasks,
  Batches as StudioBatches,
  NewBatches as NewStudioBatches,
  Characters,
  NewCharacters,
  Datasets,
  NewDatasets,
  Harvests,
  NewHarvests,
  Presets,
  NewPresets,
  Queues,
  NewQueues,
  Scenarios,
  NewScenarios,
  Templates,
  NewTemplates,
  Workers,
  NewWorkers
} from './studio';

// Именованные экспорты для auth схемы
export {
  auditLogEntries,
  flowState,
  identities,
  instances,
  mfaAmrClaims,
  mfaChallenges,
  mfaFactors,
  oauthAuthorizations,
  oauthClients,
  oauthConsents,
  oneTimeTokens,
  refreshTokens,
  samlProviders,
  samlRelayStates,
  schemaMigrations,
  sessions,
  ssoDomains,
  ssoProviders,
  users
} from './auth';

export type {
  AuditLogEntries,
  NewAuditLogEntries,
  FlowState,
  NewFlowState,
  Identities,
  NewIdentities,
  Instances,
  NewInstances,
  MfaAmrClaims,
  NewMfaAmrClaims,
  MfaChallenges,
  NewMfaChallenges,
  MfaFactors,
  NewMfaFactors,
  OauthAuthorizations,
  NewOauthAuthorizations,
  OauthClients,
  NewOauthClients,
  OauthConsents,
  NewOauthConsents,
  OneTimeTokens,
  NewOneTimeTokens,
  RefreshTokens,
  NewRefreshTokens,
  SamlProviders,
  NewSamlProviders,
  SamlRelayStates,
  NewSamlRelayStates,
  SchemaMigrations,
  NewSchemaMigrations,
  Sessions,
  NewSessions,
  SsoDomains,
  NewSsoDomains,
  SsoProviders,
  NewSsoProviders,
  Users,
  NewUsers
} from './auth';
