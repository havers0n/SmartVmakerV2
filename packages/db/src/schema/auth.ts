import { bigint, boolean, json, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const auditLogEntries = pgTable('audit_log_entries', {
    instance_id: uuid('instance_id'),
    id: uuid('id').notNull().primaryKey(),
    payload: json('payload'),
    created_at: timestamp('created_at', { withTimezone: true }),
    ip_address: text('ip_address').notNull().default(''),
});


export type AuditLogEntries = typeof auditLogEntries.$inferSelect;

export type NewAuditLogEntries = typeof auditLogEntries.$inferInsert;


export const flowState = pgTable('flow_state', {
    id: uuid('id').notNull().primaryKey(),
    user_id: uuid('user_id'),
    auth_code: text('auth_code').notNull(),
    code_challenge_method: text('code_challenge_method').notNull(),
    code_challenge: text('code_challenge').notNull(),
    provider_type: text('provider_type').notNull(),
    provider_access_token: text('provider_access_token'),
    provider_refresh_token: text('provider_refresh_token'),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    authentication_method: text('authentication_method').notNull(),
    auth_code_issued_at: timestamp('auth_code_issued_at', { withTimezone: true }),
});


export type FlowState = typeof flowState.$inferSelect;

export type NewFlowState = typeof flowState.$inferInsert;


export const identities = pgTable('identities', {
    provider_id: text('provider_id').notNull(),
    user_id: uuid('user_id').notNull(),
    identity_data: jsonb('identity_data').notNull(),
    provider: text('provider').notNull(),
    last_sign_in_at: timestamp('last_sign_in_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    email: text('email'),
    id: uuid('id').notNull().defaultRandom().primaryKey(),
});


export type Identities = typeof identities.$inferSelect;

export type NewIdentities = typeof identities.$inferInsert;


export const instances = pgTable('instances', {
    id: uuid('id').notNull().primaryKey(),
    uuid: uuid('uuid'),
    raw_base_config: text('raw_base_config'),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
});


export type Instances = typeof instances.$inferSelect;

export type NewInstances = typeof instances.$inferInsert;


export const mfaAmrClaims = pgTable('mfa_amr_claims', {
    session_id: uuid('session_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull(),
    authentication_method: text('authentication_method').notNull(),
    id: uuid('id').notNull().primaryKey(),
});


export type MfaAmrClaims = typeof mfaAmrClaims.$inferSelect;

export type NewMfaAmrClaims = typeof mfaAmrClaims.$inferInsert;


export const mfaChallenges = pgTable('mfa_challenges', {
    id: uuid('id').notNull().primaryKey(),
    factor_id: uuid('factor_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull(),
    verified_at: timestamp('verified_at', { withTimezone: true }),
    ip_address: text('ip_address').notNull(),
    otp_code: text('otp_code'),
    web_authn_session_data: jsonb('web_authn_session_data'),
});


export type MfaChallenges = typeof mfaChallenges.$inferSelect;

export type NewMfaChallenges = typeof mfaChallenges.$inferInsert;


export const mfaFactors = pgTable('mfa_factors', {
    id: uuid('id').notNull().primaryKey(),
    user_id: uuid('user_id').notNull(),
    friendly_name: text('friendly_name'),
    factor_type: text('factor_type').notNull(),
    status: text('status').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull(),
    secret: text('secret'),
    phone: text('phone'),
    last_challenged_at: timestamp('last_challenged_at', { withTimezone: true }),
    web_authn_credential: jsonb('web_authn_credential'),
    web_authn_aaguid: uuid('web_authn_aaguid'),
});


export type MfaFactors = typeof mfaFactors.$inferSelect;

export type NewMfaFactors = typeof mfaFactors.$inferInsert;


export const oauthAuthorizations = pgTable('oauth_authorizations', {
    id: uuid('id').notNull().primaryKey(),
    authorization_id: text('authorization_id').notNull(),
    client_id: uuid('client_id').notNull(),
    user_id: uuid('user_id'),
    redirect_uri: text('redirect_uri').notNull(),
    scope: text('scope').notNull(),
    state: text('state'),
    resource: text('resource'),
    code_challenge: text('code_challenge'),
    code_challenge_method: text('code_challenge_method'),
    response_type: text('response_type').notNull().default('code'),
    status: text('status').notNull().default('pending'),
    authorization_code: text('authorization_code'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull().defaultNow(),
    approved_at: timestamp('approved_at', { withTimezone: true }),
});


export type OauthAuthorizations = typeof oauthAuthorizations.$inferSelect;

export type NewOauthAuthorizations = typeof oauthAuthorizations.$inferInsert;


export const oauthClients = pgTable('oauth_clients', {
    id: uuid('id').notNull().primaryKey(),
    client_secret_hash: text('client_secret_hash'),
    registration_type: text('registration_type').notNull(),
    redirect_uris: text('redirect_uris').notNull(),
    grant_types: text('grant_types').notNull(),
    client_name: text('client_name'),
    client_uri: text('client_uri'),
    logo_uri: text('logo_uri'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    client_type: text('client_type').notNull().default('confidential'),
});


export type OauthClients = typeof oauthClients.$inferSelect;

export type NewOauthClients = typeof oauthClients.$inferInsert;


export const oauthConsents = pgTable('oauth_consents', {
    id: uuid('id').notNull().primaryKey(),
    user_id: uuid('user_id').notNull(),
    client_id: uuid('client_id').notNull(),
    scopes: text('scopes').notNull(),
    granted_at: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revoked_at: timestamp('revoked_at', { withTimezone: true }),
});


export type OauthConsents = typeof oauthConsents.$inferSelect;

export type NewOauthConsents = typeof oauthConsents.$inferInsert;


export const oneTimeTokens = pgTable('one_time_tokens', {
    id: uuid('id').notNull().primaryKey(),
    user_id: uuid('user_id').notNull(),
    token_type: text('token_type').notNull(),
    token_hash: text('token_hash').notNull(),
    relates_to: text('relates_to').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
});


export type OneTimeTokens = typeof oneTimeTokens.$inferSelect;

export type NewOneTimeTokens = typeof oneTimeTokens.$inferInsert;


export const refreshTokens = pgTable('refresh_tokens', {
    instance_id: uuid('instance_id'),
    id: bigint('id', { mode: 'number' }).notNull().default(sql`nextval('auth.refresh_tokens_id_seq')`).primaryKey(),
    token: text('token'),
    user_id: text('user_id'),
    revoked: boolean('revoked'),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    parent: text('parent'),
    session_id: uuid('session_id'),
});


export type RefreshTokens = typeof refreshTokens.$inferSelect;

export type NewRefreshTokens = typeof refreshTokens.$inferInsert;


export const samlProviders = pgTable('saml_providers', {
    id: uuid('id').notNull().primaryKey(),
    sso_provider_id: uuid('sso_provider_id').notNull(),
    entity_id: text('entity_id').notNull(),
    metadata_xml: text('metadata_xml').notNull(),
    metadata_url: text('metadata_url'),
    attribute_mapping: jsonb('attribute_mapping'),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    name_id_format: text('name_id_format'),
});


export type SamlProviders = typeof samlProviders.$inferSelect;

export type NewSamlProviders = typeof samlProviders.$inferInsert;


export const samlRelayStates = pgTable('saml_relay_states', {
    id: uuid('id').notNull().primaryKey(),
    sso_provider_id: uuid('sso_provider_id').notNull(),
    request_id: text('request_id').notNull(),
    for_email: text('for_email'),
    redirect_to: text('redirect_to'),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    flow_state_id: uuid('flow_state_id'),
});


export type SamlRelayStates = typeof samlRelayStates.$inferSelect;

export type NewSamlRelayStates = typeof samlRelayStates.$inferInsert;


export const schemaMigrations = pgTable('schema_migrations', {
    version: text('version').notNull(),
});


export type SchemaMigrations = typeof schemaMigrations.$inferSelect;

export type NewSchemaMigrations = typeof schemaMigrations.$inferInsert;


export const sessions = pgTable('sessions', {
    id: uuid('id').notNull().primaryKey(),
    user_id: uuid('user_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    factor_id: uuid('factor_id'),
    aal: text('aal'),
    not_after: timestamp('not_after', { withTimezone: true }),
    refreshed_at: timestamp('refreshed_at'),
    user_agent: text('user_agent'),
    ip: text('ip'),
    tag: text('tag'),
    oauth_client_id: uuid('oauth_client_id'),
});


export type Sessions = typeof sessions.$inferSelect;

export type NewSessions = typeof sessions.$inferInsert;


export const ssoDomains = pgTable('sso_domains', {
    id: uuid('id').notNull().primaryKey(),
    sso_provider_id: uuid('sso_provider_id').notNull(),
    domain: text('domain').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
});


export type SsoDomains = typeof ssoDomains.$inferSelect;

export type NewSsoDomains = typeof ssoDomains.$inferInsert;


export const ssoProviders = pgTable('sso_providers', {
    id: uuid('id').notNull().primaryKey(),
    resource_id: text('resource_id'),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    disabled: boolean('disabled'),
});


export type SsoProviders = typeof ssoProviders.$inferSelect;

export type NewSsoProviders = typeof ssoProviders.$inferInsert;


export const users = pgTable('users', {
    instance_id: uuid('instance_id'),
    id: uuid('id').notNull().primaryKey(),
    aud: text('aud'),
    role: text('role'),
    email: text('email'),
    encrypted_password: text('encrypted_password'),
    email_confirmed_at: timestamp('email_confirmed_at', { withTimezone: true }),
    invited_at: timestamp('invited_at', { withTimezone: true }),
    confirmation_token: text('confirmation_token'),
    confirmation_sent_at: timestamp('confirmation_sent_at', { withTimezone: true }),
    recovery_token: text('recovery_token'),
    recovery_sent_at: timestamp('recovery_sent_at', { withTimezone: true }),
    email_change_token_new: text('email_change_token_new'),
    email_change: text('email_change'),
    email_change_sent_at: timestamp('email_change_sent_at', { withTimezone: true }),
    last_sign_in_at: timestamp('last_sign_in_at', { withTimezone: true }),
    raw_app_meta_data: jsonb('raw_app_meta_data'),
    raw_user_meta_data: jsonb('raw_user_meta_data'),
    is_super_admin: boolean('is_super_admin'),
    created_at: timestamp('created_at', { withTimezone: true }),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    phone: text('phone').default('NULL'),
    phone_confirmed_at: timestamp('phone_confirmed_at', { withTimezone: true }),
    phone_change: text('phone_change').default(''),
    phone_change_token: text('phone_change_token').default(''),
    phone_change_sent_at: timestamp('phone_change_sent_at', { withTimezone: true }),
    confirmed_at: timestamp('confirmed_at', { withTimezone: true }),
    email_change_token_current: text('email_change_token_current').default(''),
    email_change_confirm_status: text('email_change_confirm_status'),
    banned_until: timestamp('banned_until', { withTimezone: true }),
    reauthentication_token: text('reauthentication_token').default(''),
    reauthentication_sent_at: timestamp('reauthentication_sent_at', { withTimezone: true }),
    is_sso_user: boolean('is_sso_user').notNull(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    is_anonymous: boolean('is_anonymous').notNull(),
});


export type Users = typeof users.$inferSelect;

export type NewUsers = typeof users.$inferInsert;
