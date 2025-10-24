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
  public: {
    Tables: {
      analysis_queue: {
        Row: {
          analyzer: string
          created_at: string
          error: string | null
          id: string
          metadata: Json | null
          status: string
          updated_at: string
          video_id: string
          video_legacy_id: string
        }
        Insert: {
          analyzer: string
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          updated_at?: string
          video_id: string
          video_legacy_id: string
        }
        Update: {
          analyzer?: string
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          updated_at?: string
          video_id?: string
          video_legacy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_queue_video_id_fk"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_queue_video_id_fk"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos_legacy"
            referencedColumns: ["uuid_id"]
          },
        ]
      }
      assets: {
        Row: {
          aspect_ratio: string | null
          created_at: string
          id: string
          kind: string
          legacy_id: string
          model: string | null
          prompt: string | null
          quality_score: number | null
          role: string | null
          selected: boolean | null
          url: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string
          id?: string
          kind: string
          legacy_id: string
          model?: string | null
          prompt?: string | null
          quality_score?: number | null
          role?: string | null
          selected?: boolean | null
          url?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string
          id?: string
          kind?: string
          legacy_id?: string
          model?: string | null
          prompt?: string | null
          quality_score?: number | null
          role?: string | null
          selected?: boolean | null
          url?: string | null
        }
        Relationships: []
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
          status: string
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
          status?: string
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
          status?: string
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
          public_url: string | null
          task_id: string
          task_legacy_id: string
        }
        Insert: {
          beat_id?: string | null
          created_at?: string
          duration_s?: number | null
          id?: string
          public_url?: string | null
          task_id: string
          task_legacy_id: string
        }
        Update: {
          beat_id?: string | null
          created_at?: string
          duration_s?: number | null
          id?: string
          public_url?: string | null
          task_id?: string
          task_legacy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clips_task_id_fk"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_task_id_fk"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_legacy"
            referencedColumns: ["uuid_id"]
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
        Relationships: [
          {
            foreignKeyName: "generation_events_first_asset_fk"
            columns: ["chosen_first_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_events_first_asset_fk"
            columns: ["chosen_first_asset_id"]
            isOneToOne: false
            referencedRelation: "assets_legacy"
            referencedColumns: ["uuid_id"]
          },
          {
            foreignKeyName: "generation_events_last_asset_fk"
            columns: ["chosen_last_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_events_last_asset_fk"
            columns: ["chosen_last_asset_id"]
            isOneToOne: false
            referencedRelation: "assets_legacy"
            referencedColumns: ["uuid_id"]
          },
        ]
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
      ingest_queue: {
        Row: {
          created_at: string
          duration: string
          error: string | null
          id: string
          metadata: Json | null
          published_after: string | null
          query: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          published_after?: string | null
          query: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          published_after?: string | null
          query?: string
          status?: string
          updated_at?: string
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
      tasks: {
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
          status: string
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
          status: string
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
          status?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_batch_id_fk"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      video_analysis: {
        Row: {
          analysis_url: string | null
          analyzer: string
          created_at: string
          id: string
          metadata: Json | null
          updated_at: string
          video_id: string
          video_legacy_id: string
        }
        Insert: {
          analysis_url?: string | null
          analyzer: string
          created_at?: string
          id?: string
          metadata?: Json | null
          updated_at?: string
          video_id: string
          video_legacy_id: string
        }
        Update: {
          analysis_url?: string | null
          analyzer?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          updated_at?: string
          video_id?: string
          video_legacy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_analysis_video_id_fk"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_videos: {
        Row: {
          channel_title: string | null
          comment_count: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          legacy_id: string
          like_count: number | null
          published_at: string | null
          tags: Json | null
          title: string
          updated_at: string
          url: string
          view_count: number | null
        }
        Insert: {
          channel_title?: string | null
          comment_count?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          legacy_id: string
          like_count?: number | null
          published_at?: string | null
          tags?: Json | null
          title: string
          updated_at?: string
          url: string
          view_count?: number | null
        }
        Update: {
          channel_title?: string | null
          comment_count?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          legacy_id?: string
          like_count?: number | null
          published_at?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string
          url?: string
          view_count?: number | null
        }
        Relationships: []
      }
      yt_samples: {
        Row: {
          channel_title: string | null
          comment_rate: number | null
          comments: number | null
          duration_category: string | null
          duration_s: number | null
          engagement_rate: number | null
          id: string
          inserted_at: string | null
          legacy_video_id: string
          like_rate: number | null
          likes: number | null
          num_tags: number | null
          tags_from_report: string[] | null
          title: string | null
          views: number | null
          viral_score: number | null
          virality_category: string | null
        }
        Insert: {
          channel_title?: string | null
          comment_rate?: number | null
          comments?: number | null
          duration_category?: string | null
          duration_s?: number | null
          engagement_rate?: number | null
          id?: string
          inserted_at?: string | null
          legacy_video_id: string
          like_rate?: number | null
          likes?: number | null
          num_tags?: number | null
          tags_from_report?: string[] | null
          title?: string | null
          views?: number | null
          viral_score?: number | null
          virality_category?: string | null
        }
        Update: {
          channel_title?: string | null
          comment_rate?: number | null
          comments?: number | null
          duration_category?: string | null
          duration_s?: number | null
          engagement_rate?: number | null
          id?: string
          inserted_at?: string | null
          legacy_video_id?: string
          like_rate?: number | null
          likes?: number | null
          num_tags?: number | null
          tags_from_report?: string[] | null
          title?: string | null
          views?: number | null
          viral_score?: number | null
          virality_category?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, any>
        Insert?: Record<string, any>
        Update?: Record<string, any>
        Relationships?: any[]
      }
    }
    Functions: {
      clean_old_audit_logs: { Args: { days_to_keep?: number }; Returns: number }
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
      get_metadata_schema: {
        Args: { column_name?: string; table_name: string }
        Returns: Json
      }
      get_uuid_by_legacy_id: {
        Args: { p_legacy_id: string; p_table_name: string }
        Returns: string
      }
      purge_old_deleted_records: {
        Args: { days_old?: number; table_name: string }
        Returns: number
      }
      refresh_all_analytics_views: { Args: Record<string, never>; Returns: undefined }
      restore_deleted_record: {
        Args: { record_id: string; table_name: string }
        Returns: boolean
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
