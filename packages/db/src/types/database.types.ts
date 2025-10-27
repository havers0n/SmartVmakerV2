/**
 * Auto-generated types from Supabase database
 * Generated at: 2025-10-27T17:31:30.680Z
 * 
 * This file is generated directly from the live Supabase database.
 * The database is the single source of truth.
 * 
 * To regenerate: pnpm types:pull
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  aes_core: {
    Tables: {
      beats: {
        Row: {
          action_prompt: string | null
          contrast: Database["aes_core"]["Enums"]["contrast_enum"] | null
          description: string
          duration_seconds: number
          emotion: Database["aes_core"]["Enums"]["emotion_enum"]
          id: string
          intended_impact: string | null
          meta: Json
          order: number
          phase: Database["aes_core"]["Enums"]["phase_enum"]
          template_id: string
        }
        Insert: {
          action_prompt?: string | null
          contrast?: Database["aes_core"]["Enums"]["contrast_enum"] | null
          description: string
          duration_seconds: number
          emotion: Database["aes_core"]["Enums"]["emotion_enum"]
          id?: string
          intended_impact?: string | null
          meta?: Json
          order: number
          phase: Database["aes_core"]["Enums"]["phase_enum"]
          template_id: string
        }
        Update: {
          action_prompt?: string | null
          contrast?: Database["aes_core"]["Enums"]["contrast_enum"] | null
          description?: string
          duration_seconds?: number
          emotion?: Database["aes_core"]["Enums"]["emotion_enum"]
          id?: string
          intended_impact?: string | null
          meta?: Json
          order?: number
          phase?: Database["aes_core"]["Enums"]["phase_enum"]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beats_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "story_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      story_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          tags: string[] | null
          target_duration_seconds: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          tags?: string[] | null
          target_duration_seconds: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          tags?: string[] | null
          target_duration_seconds?: number
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      contrast_enum:
        | "small_vs_big"
        | "slow_vs_fast"
        | "alone_vs_together"
        | "sad_vs_happy"
        | "problem_vs_solution"
        | "before_vs_after"
      emotion_enum:
        | "joy"
        | "sadness"
        | "surprise"
        | "anticipation"
        | "tension"
        | "relief"
        | "empathy"
        | "curiosity"
        | "humor"
        | "awe"
      phase_enum: "HOOK" | "BUILD" | "PAYOFF" | "RESOLUTION"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  analytics: {
    Tables: {
      metrics_snapshots: {
        Row: {
          comments: number | null
          generation_project_id: string
          id: string
          likes: number | null
          retention_percentage: number | null
          snapshot_at: string
          views: number | null
          watch_time_seconds: number | null
        }
        Insert: {
          comments?: number | null
          generation_project_id: string
          id?: string
          likes?: number | null
          retention_percentage?: number | null
          snapshot_at?: string
          views?: number | null
          watch_time_seconds?: number | null
        }
        Update: {
          comments?: number | null
          generation_project_id?: string
          id?: string
          likes?: number | null
          retention_percentage?: number | null
          snapshot_at?: string
          views?: number | null
          watch_time_seconds?: number | null
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          comments: number | null
          engagement_rate: number | null
          generation_project_id: string
          id: string
          last_updated: string | null
          like_rate: number | null
          likes: number | null
          retention_percentage: number | null
          views: number | null
          viral_score: number | null
          watch_time_seconds: number | null
          youtube_url: string | null
        }
        Insert: {
          comments?: number | null
          engagement_rate?: number | null
          generation_project_id: string
          id?: string
          last_updated?: string | null
          like_rate?: number | null
          likes?: number | null
          retention_percentage?: number | null
          views?: number | null
          viral_score?: number | null
          watch_time_seconds?: number | null
          youtube_url?: string | null
        }
        Update: {
          comments?: number | null
          engagement_rate?: number | null
          generation_project_id?: string
          id?: string
          last_updated?: string | null
          like_rate?: number | null
          likes?: number | null
          retention_percentage?: number | null
          views?: number | null
          viral_score?: number | null
          watch_time_seconds?: number | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recompute_metrics: { Args: { p_short_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  generation_pipeline: {
    Tables: {
      asset_generation_jobs: {
        Row: {
          asset_id: string
          created_at: string
          error: string | null
          id: string
          provider: string
          status: Database["public"]["Enums"]["app_job_status"]
          updated_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          error?: string | null
          id?: string
          provider?: string
          status?: Database["public"]["Enums"]["app_job_status"]
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          error?: string | null
          id?: string
          provider?: string
          status?: Database["public"]["Enums"]["app_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_pipeline_jobs_asset_id_fk"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          api_cost_usd: number | null
          asset_type: string
          beat_id: string | null
          content_hash: string | null
          created_at: string | null
          deleted_at: string | null
          generation_project_id: string
          id: string
          meta: Json
          minimax_job_id: string | null
          status: Database["public"]["Enums"]["app_job_status"]
          storage_bucket: string | null
          storage_path: string | null
          storage_url: string
          updated_at: string | null
        }
        Insert: {
          api_cost_usd?: number | null
          asset_type: string
          beat_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          deleted_at?: string | null
          generation_project_id: string
          id?: string
          meta?: Json
          minimax_job_id?: string | null
          status?: Database["public"]["Enums"]["app_job_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_url: string
          updated_at?: string | null
        }
        Update: {
          api_cost_usd?: number | null
          asset_type?: string
          beat_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          deleted_at?: string | null
          generation_project_id?: string
          id?: string
          meta?: Json
          minimax_job_id?: string | null
          status?: Database["public"]["Enums"]["app_job_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          storage_url?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_generation_project_id_fkey"
            columns: ["generation_project_id"]
            isOneToOne: false
            referencedRelation: "generation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_projects: {
        Row: {
          api_cost_usd: number | null
          channel_id: string | null
          created_at: string | null
          deleted_at: string | null
          error_message: string | null
          final_video_url: string | null
          id: string
          meta: Json
          minimax_cost: number | null
          owner_id: string | null
          status: Database["public"]["Enums"]["app_job_status"]
          template_id: string | null
          updated_at: string | null
          upload_status: string | null
          youtube_video_id: string | null
        }
        Insert: {
          api_cost_usd?: number | null
          channel_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          error_message?: string | null
          final_video_url?: string | null
          id?: string
          meta?: Json
          minimax_cost?: number | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["app_job_status"]
          template_id?: string | null
          updated_at?: string | null
          upload_status?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          api_cost_usd?: number | null
          channel_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          error_message?: string | null
          final_video_url?: string | null
          id?: string
          meta?: Json
          minimax_cost?: number | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["app_job_status"]
          template_id?: string | null
          updated_at?: string | null
          upload_status?: string | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      jobs: {
        Row: {
          asset_id: string | null
          created_at: string | null
          error: string | null
          id: string | null
          provider: string | null
          status: Database["public"]["Enums"]["app_job_status"] | null
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string | null
          provider?: string | null
          status?: Database["public"]["Enums"]["app_job_status"] | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string | null
          provider?: string | null
          status?: Database["public"]["Enums"]["app_job_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_pipeline_jobs_asset_id_fk"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  jobs: {
    Tables: {
      analysis_job_queue: {
        Row: {
          analyzer: string
          created_at: string | null
          error: string | null
          error_message: string | null
          id: string
          retry_count: number
          status: Database["public"]["Enums"]["app_job_status"]
          updated_at: string | null
          video_id: string
        }
        Insert: {
          analyzer: string
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          id?: string
          retry_count?: number
          status?: Database["public"]["Enums"]["app_job_status"]
          updated_at?: string | null
          video_id: string
        }
        Update: {
          analyzer?: string
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          id?: string
          retry_count?: number
          status?: Database["public"]["Enums"]["app_job_status"]
          updated_at?: string | null
          video_id?: string
        }
        Relationships: []
      }
      generation_job_queue: {
        Row: {
          asset_id: string
          created_at: string | null
          error: string | null
          error_message: string | null
          id: string
          provider: string
          retry_count: number
          status: Database["public"]["Enums"]["app_job_status"]
          updated_at: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          id?: string
          provider: string
          retry_count?: number
          status?: Database["public"]["Enums"]["app_job_status"]
          updated_at?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          id?: string
          provider?: string
          retry_count?: number
          status?: Database["public"]["Enums"]["app_job_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      ingest_job_queue: {
        Row: {
          created_at: string | null
          duration: number | null
          error: string | null
          error_message: string | null
          id: string
          published_after: string | null
          query: string
          retry_count: number
          status: Database["public"]["Enums"]["app_job_status"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          error?: string | null
          error_message?: string | null
          id?: string
          published_after?: string | null
          query: string
          retry_count?: number
          status?: Database["public"]["Enums"]["app_job_status"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          error?: string | null
          error_message?: string | null
          id?: string
          published_after?: string | null
          query?: string
          retry_count?: number
          status?: Database["public"]["Enums"]["app_job_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      analysis_queue: {
        Row: {
          analyzer: string | null
          created_at: string | null
          error: string | null
          error_message: string | null
          id: string | null
          status: Database["public"]["Enums"]["app_job_status"] | null
          updated_at: string | null
          video_id: string | null
        }
        Insert: {
          analyzer?: string | null
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          id?: string | null
          status?: Database["public"]["Enums"]["app_job_status"] | null
          updated_at?: string | null
          video_id?: string | null
        }
        Update: {
          analyzer?: string | null
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          id?: string | null
          status?: Database["public"]["Enums"]["app_job_status"] | null
          updated_at?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      generation_queue: {
        Row: {
          asset_id: string | null
          created_at: string | null
          error: string | null
          error_message: string | null
          id: string | null
          provider: string | null
          status: Database["public"]["Enums"]["app_job_status"] | null
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          id?: string | null
          provider?: string | null
          status?: Database["public"]["Enums"]["app_job_status"] | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          error?: string | null
          error_message?: string | null
          id?: string | null
          provider?: string | null
          status?: Database["public"]["Enums"]["app_job_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ingest_queue: {
        Row: {
          created_at: string | null
          duration: number | null
          error: string | null
          error_message: string | null
          id: string | null
          published_after: string | null
          query: string | null
          status: Database["public"]["Enums"]["app_job_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          error?: string | null
          error_message?: string | null
          id?: string | null
          published_after?: string | null
          query?: string | null
          status?: Database["public"]["Enums"]["app_job_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          error?: string | null
          error_message?: string | null
          id?: string | null
          published_after?: string | null
          query?: string | null
          status?: Database["public"]["Enums"]["app_job_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analysis_results: {
        Row: {
          aes_breakdown: Json | null
          analysis_url: string | null
          analyzer: string
          analyzer_name: string | null
          created_at: string
          emotional_tags: Json | null
          id: string
          overall_score: number | null
          updated_at: string
          version: number
          video_id: string
        }
        Insert: {
          aes_breakdown?: Json | null
          analysis_url?: string | null
          analyzer: string
          analyzer_name?: string | null
          created_at?: string
          emotional_tags?: Json | null
          id?: string
          overall_score?: number | null
          updated_at?: string
          version?: number
          video_id: string
        }
        Update: {
          aes_breakdown?: Json | null
          analysis_url?: string | null
          analyzer?: string
          analyzer_name?: string | null
          created_at?: string
          emotional_tags?: Json | null
          id?: string
          overall_score?: number | null
          updated_at?: string
          version?: number
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      batches: {
        Row: {
          avg_time_ms: number | null
          deleted_at: string | null
          fail: number
          finished_at: string | null
          id: string
          ok: number
          plan_path: string | null
          quality_score: number | null
          started_at: string
          status: Database["public"]["Enums"]["app_job_status"]
          total: number
        }
        Insert: {
          avg_time_ms?: number | null
          deleted_at?: string | null
          fail?: number
          finished_at?: string | null
          id?: string
          ok?: number
          plan_path?: string | null
          quality_score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["app_job_status"]
          total?: number
        }
        Update: {
          avg_time_ms?: number | null
          deleted_at?: string | null
          fail?: number
          finished_at?: string | null
          id?: string
          ok?: number
          plan_path?: string | null
          quality_score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["app_job_status"]
          total?: number
        }
        Relationships: []
      }
      clips: {
        Row: {
          beat_id: string | null
          created_at: string
          duration_s: number | null
          id: string
          legacy_task_id: string
          public_url: string | null
          task_id: string
        }
        Insert: {
          beat_id?: string | null
          created_at?: string
          duration_s?: number | null
          id?: string
          legacy_task_id: string
          public_url?: string | null
          task_id: string
        }
        Update: {
          beat_id?: string | null
          created_at?: string
          duration_s?: number | null
          id?: string
          legacy_task_id?: string
          public_url?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clips_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "legacy_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_events: {
        Row: {
          aes_score: number | null
          candidates: Json | null
          chosen_first_asset_id: string | null
          chosen_first_asset_legacy_id: string | null
          chosen_index: number | null
          chosen_last_asset_id: string | null
          chosen_last_asset_legacy_id: string | null
          compose_job_id: string | null
          created_at: string | null
          deleted_at: string | null
          duration_category: string | null
          emotional_curve: string[] | null
          evaluator: string | null
          hook_strength: number | null
          id: string
          scenario: Json | null
          status: string | null
          topic: string | null
          user_id: string | null
        }
        Insert: {
          aes_score?: number | null
          candidates?: Json | null
          chosen_first_asset_id?: string | null
          chosen_first_asset_legacy_id?: string | null
          chosen_index?: number | null
          chosen_last_asset_id?: string | null
          chosen_last_asset_legacy_id?: string | null
          compose_job_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          duration_category?: string | null
          emotional_curve?: string[] | null
          evaluator?: string | null
          hook_strength?: number | null
          id?: string
          scenario?: Json | null
          status?: string | null
          topic?: string | null
          user_id?: string | null
        }
        Update: {
          aes_score?: number | null
          candidates?: Json | null
          chosen_first_asset_id?: string | null
          chosen_first_asset_legacy_id?: string | null
          chosen_index?: number | null
          chosen_last_asset_id?: string | null
          chosen_last_asset_legacy_id?: string | null
          compose_job_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          duration_category?: string | null
          emotional_curve?: string[] | null
          evaluator?: string | null
          hook_strength?: number | null
          id?: string
          scenario?: Json | null
          status?: string | null
          topic?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      id_uuid_mapping: {
        Row: {
          created_at: string | null
          legacy_id: string
          table_name: string
          uuid_id: string
        }
        Insert: {
          created_at?: string | null
          legacy_id: string
          table_name: string
          uuid_id: string
        }
        Update: {
          created_at?: string | null
          legacy_id?: string
          table_name?: string
          uuid_id?: string
        }
        Relationships: []
      }
      json_schemas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          schema_def: Json
          schema_name: string
          schema_version: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          schema_def: Json
          schema_name: string
          schema_version?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          schema_def?: Json
          schema_name?: string
          schema_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      legacy_tasks: {
        Row: {
          batch_id: string | null
          deleted_at: string | null
          error: string | null
          file_id: string | null
          finished_at: string | null
          id: string
          kind: string
          lang: string | null
          legacy_id: string
          params: Json | null
          prompt: string | null
          public_url: string | null
          started_at: string
          status: Database["public"]["Enums"]["app_job_status"]
          topic: string | null
        }
        Insert: {
          batch_id?: string | null
          deleted_at?: string | null
          error?: string | null
          file_id?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          lang?: string | null
          legacy_id: string
          params?: Json | null
          prompt?: string | null
          public_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["app_job_status"]
          topic?: string | null
        }
        Update: {
          batch_id?: string | null
          deleted_at?: string | null
          error?: string | null
          file_id?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          lang?: string | null
          legacy_id?: string
          params?: Json | null
          prompt?: string | null
          public_url?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["app_job_status"]
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_videos: {
        Row: {
          channel_title: string | null
          comment_count: number | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          like_count: number | null
          published_at: string | null
          tags: Json | null
          title: string
          updated_at: string
          url: string
          view_count: number | null
          youtube_id: string | null
        }
        Insert: {
          channel_title?: string | null
          comment_count?: number | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          like_count?: number | null
          published_at?: string | null
          tags?: Json | null
          title: string
          updated_at?: string
          url: string
          view_count?: number | null
          youtube_id?: string | null
        }
        Update: {
          channel_title?: string | null
          comment_count?: number | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          like_count?: number | null
          published_at?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string
          url?: string
          view_count?: number | null
          youtube_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      clips_with_legacy: {
        Row: {
          beat_id: string | null
          created_at: string | null
          duration_s: number | null
          id: string | null
          public_url: string | null
          task_id: string | null
          task_legacy_id: string | null
          task_text_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "legacy_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      v_audit_log_recent: {
        Row: {
          action: string | null
          changed_fields: string[] | null
          created_at: string | null
          fields_changed_count: number | null
          id: string | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_audit_stats: {
        Row: {
          action: string | null
          action_count: number | null
          first_action_at: string | null
          last_action_at: string | null
          table_name: string | null
        }
        Relationships: []
      }
      v_cron_jobs: {
        Row: {
          active: boolean | null
          command: string | null
          database: string | null
          jobid: number | null
          jobname: string | null
          nodename: string | null
          nodeport: number | null
          schedule: string | null
          username: string | null
        }
        Insert: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean | null
          command?: string | null
          database?: string | null
          jobid?: number | null
          jobname?: string | null
          nodename?: string | null
          nodeport?: number | null
          schedule?: string | null
          username?: string | null
        }
        Relationships: []
      }
      v_generation_costs_by_user: {
        Row: {
          first_short_at: string | null
          last_short_at: string | null
          owner_id: string | null
          total_assets: number | null
          total_assets_cost: number | null
          total_cost: number | null
          total_shorts: number | null
          total_shorts_cost: number | null
        }
        Relationships: []
      }
      v_index_dependencies: {
        Row: {
          constraint_description: string | null
          constraint_name: unknown
          constraint_type: unknown
          index_size: string | null
          indexname: unknown
          schemaname: unknown
          tablename: unknown
        }
        Relationships: []
      }
    }
    Functions: {
      auto_score_scenario: { Args: { p_scenario: Json }; Returns: Json }
      build_llm_system_prompt: {
        Args: { p_duration_category?: string; p_topic?: string }
        Returns: string
      }
      clean_old_audit_logs: { Args: { days_to_keep?: number }; Returns: number }
      find_similar_videos: {
        Args: { p_duration_s: number; p_limit?: number; p_topic: string }
        Returns: {
          analysis_url: string
          duration_seconds: number
          emotional_tags: Json
          engagement_rate: number
          overall_score: number
          title: string
          video_id: string
        }[]
      }
      get_audit_history: {
        Args: { p_record_id: string; p_table_name: string }
        Returns: {
          action: string
          changed_fields: string[]
          created_at: string
          id: string
          new_data: Json
          old_data: Json
          user_id: string
        }[]
      }
      get_legacy_id_by_uuid: {
        Args: { p_table_name: string; p_uuid: string }
        Returns: string
      }
      get_materialized_view_stats: {
        Args: never
        Returns: {
          last_refreshed: string
          row_count: number
          size_pretty: string
          view_name: string
        }[]
      }
      get_metadata_schema: {
        Args: { column_name?: string; table_name: string }
        Returns: Json
      }
      get_top_patterns_for_llm: { Args: never; Returns: Json }
      get_uuid_by_legacy_id: {
        Args: { p_legacy_id: string; p_table_name: string }
        Returns: string
      }
      purge_old_deleted_records: {
        Args: { days_old?: number; table_name: string }
        Returns: number
      }
      refresh_all_analytics_views: { Args: never; Returns: undefined }
      refresh_yt_priors: { Args: never; Returns: undefined }
      restore_deleted_record: {
        Args: { record_id: string; table_name: string }
        Returns: boolean
      }
      safe_jsonb: { Args: { s: string }; Returns: Json }
      score_scenario: {
        Args: { _duration: string; _tags: string[] }
        Returns: {
          src: string
          success_est: number
          tag: string
          viral_est: number
          weight: number
        }[]
      }
      soft_delete_record: {
        Args: { record_id: string; table_name: string }
        Returns: boolean
      }
      validate_json_schema: {
        Args: { data: Json; schema_name_param: string }
        Returns: boolean
      }
    }
    Enums: {
      app_job_status: "pending" | "processing" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  studio: {
    Tables: {
      analysis_tasks: {
        Row: {
          created_at: string
          id: string
          kind: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          status?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          created_at: string
          id: string
          kind: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          status?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          name?: string
        }
        Relationships: []
      }
      datasets: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      harvests: {
        Row: {
          created_at: string
          id: string
          query: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
        }
        Relationships: []
      }
      presets: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          name?: string
        }
        Relationships: []
      }
      queues: {
        Row: {
          id: string
          name: string
          size: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          size?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          size?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          created_at: string
          duration_sec: number
          id: string
          tags: Json
          topic: string
        }
        Insert: {
          created_at?: string
          duration_sec: number
          id?: string
          tags?: Json
          topic: string
        }
        Update: {
          created_at?: string
          duration_sec?: number
          id?: string
          tags?: Json
          topic?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          name?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          status: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  aes_core: {
    Enums: {
      contrast_enum: [
        "small_vs_big",
        "slow_vs_fast",
        "alone_vs_together",
        "sad_vs_happy",
        "problem_vs_solution",
        "before_vs_after",
      ],
      emotion_enum: [
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
      ],
      phase_enum: ["HOOK", "BUILD", "PAYOFF", "RESOLUTION"],
    },
  },
  analytics: {
    Enums: {},
  },
  generation_pipeline: {
    Enums: {},
  },
  jobs: {
    Enums: {},
  },
  public: {
    Enums: {
      app_job_status: ["pending", "processing", "completed", "failed"],
    },
  },
  studio: {
    Enums: {},
  },
} as const
