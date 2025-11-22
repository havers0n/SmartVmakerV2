CREATE TYPE "public"."auth_type" AS ENUM('bearer_token', 'api_key_header', 'query_param');--> statement-breakpoint
CREATE TYPE "public"."model_type" AS ENUM('text-to-text', 'text-to-image', 'image-to-video', 'text-to-video', 'image-to-image', 'audio-to-text', 'text-to-audio', 'multimodal');--> statement-breakpoint
CREATE TABLE "aes_core"."ai_models" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "model_type" NOT NULL,
	"cost_details" jsonb DEFAULT '{}'::jsonb,
	"capabilities" text[],
	"is_default" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aes_core"."ai_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"api_base_url" text,
	"authentication_type" "auth_type" NOT NULL,
	"api_key_env_var_name" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aes_core"."ai_models" ADD CONSTRAINT "ai_models_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "aes_core"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;