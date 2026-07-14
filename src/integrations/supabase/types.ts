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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      book_dna_consensus: {
        Row: {
          cache_key: string
          consensus: Json
          recommendation: Json | null
          recommendation_signature: string | null
          updated_at: string
        }
        Insert: {
          cache_key: string
          consensus?: Json
          recommendation?: Json | null
          recommendation_signature?: string | null
          updated_at?: string
        }
        Update: {
          cache_key?: string
          consensus?: Json
          recommendation?: Json | null
          recommendation_signature?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_dna_consensus_cache_key_fkey"
            columns: ["cache_key"]
            isOneToOne: true
            referencedRelation: "novel_analyses"
            referencedColumns: ["cache_key"]
          },
        ]
      }
      book_overrides: {
        Row: {
          alt_climax_event_id: string | null
          axis_overrides: Json
          cache_key: string
          centered_character_id: string | null
          character_ranks: Json
          created_at: string
          id: string
          notes: string | null
          theme_weights: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          alt_climax_event_id?: string | null
          axis_overrides?: Json
          cache_key: string
          centered_character_id?: string | null
          character_ranks?: Json
          created_at?: string
          id?: string
          notes?: string | null
          theme_weights?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          alt_climax_event_id?: string | null
          axis_overrides?: Json
          cache_key?: string
          centered_character_id?: string | null
          character_ranks?: Json
          created_at?: string
          id?: string
          notes?: string | null
          theme_weights?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      book_takeaways: {
        Row: {
          answers: Json
          author: string
          book_type: string
          cache_key: string
          created_at: string
          free_notes: string | null
          id: string
          questions: Json
          status: string
          takeaways: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          author: string
          book_type?: string
          cache_key: string
          created_at?: string
          free_notes?: string | null
          id?: string
          questions?: Json
          status?: string
          takeaways?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          author?: string
          book_type?: string
          cache_key?: string
          created_at?: string
          free_notes?: string | null
          id?: string
          questions?: Json
          status?: string
          takeaways?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dna_recommendation_cache: {
        Row: {
          axes_signature: string
          cache_key: string
          created_at: string
          hit_count: number
          id: string
          last_accessed_at: string
          model: string | null
          recommendation: Json
        }
        Insert: {
          axes_signature: string
          cache_key: string
          created_at?: string
          hit_count?: number
          id?: string
          last_accessed_at?: string
          model?: string | null
          recommendation: Json
        }
        Update: {
          axes_signature?: string
          cache_key?: string
          created_at?: string
          hit_count?: number
          id?: string
          last_accessed_at?: string
          model?: string | null
          recommendation?: Json
        }
        Relationships: []
      }
      novel_analyses: {
        Row: {
          analysis: Json
          author: string
          cache_key: string
          created_at: string
          hit_count: number
          id: string
          is_validated: boolean
          last_accessed_at: string
          model: string
          slug: string | null
          title: string
        }
        Insert: {
          analysis: Json
          author?: string
          cache_key: string
          created_at?: string
          hit_count?: number
          id?: string
          is_validated?: boolean
          last_accessed_at?: string
          model: string
          slug?: string | null
          title: string
        }
        Update: {
          analysis?: Json
          author?: string
          cache_key?: string
          created_at?: string
          hit_count?: number
          id?: string
          is_validated?: boolean
          last_accessed_at?: string
          model?: string
          slug?: string | null
          title?: string
        }
        Relationships: []
      }
      pca_basis: {
        Row: {
          axis_order: Json
          book_type: string
          components: Json
          created_at: string
          id: string
          means: Json
          seed_corpus: Json
          version: number
          x_axis_label: string
          y_axis_label: string
        }
        Insert: {
          axis_order: Json
          book_type?: string
          components: Json
          created_at?: string
          id?: string
          means: Json
          seed_corpus: Json
          version: number
          x_axis_label?: string
          y_axis_label?: string
        }
        Update: {
          axis_order?: Json
          book_type?: string
          components?: Json
          created_at?: string
          id?: string
          means?: Json
          seed_corpus?: Json
          version?: number
          x_axis_label?: string
          y_axis_label?: string
        }
        Relationships: []
      }
      pinned_characters: {
        Row: {
          cache_key: string
          character_id: string
          character_name: string
          created_at: string
          id: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cache_key: string
          character_id: string
          character_name: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cache_key?: string
          character_id?: string
          character_name?: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          handle: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          created_at: string
          id: number
          ip_hash: string
          is_prefetch: boolean
          route: string
        }
        Insert: {
          created_at?: string
          id?: number
          ip_hash: string
          is_prefetch?: boolean
          route: string
        }
        Update: {
          created_at?: string
          id?: number
          ip_hash?: string
          is_prefetch?: boolean
          route?: string
        }
        Relationships: []
      }
      recommendation_blocks: {
        Row: {
          block_type: string
          created_at: string
          id: string
          user_id: string
          value: string
        }
        Insert: {
          block_type: string
          created_at?: string
          id?: string
          user_id: string
          value: string
        }
        Update: {
          block_type?: string
          created_at?: string
          id?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      recommendation_feedback: {
        Row: {
          author: string
          created_at: string
          id: string
          reason: string | null
          rec_key: string
          signal: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string
          created_at?: string
          id?: string
          reason?: string | null
          rec_key: string
          signal: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          reason?: string | null
          rec_key?: string
          signal?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_cache: {
        Row: {
          created_at: string
          hit_count: number
          id: string
          last_accessed_at: string
          query_key: string
          results: Json
        }
        Insert: {
          created_at?: string
          hit_count?: number
          id?: string
          last_accessed_at?: string
          query_key: string
          results: Json
        }
        Update: {
          created_at?: string
          hit_count?: number
          id?: string
          last_accessed_at?: string
          query_key?: string
          results?: Json
        }
        Relationships: []
      }
      shelf_books: {
        Row: {
          added_at: string
          author: string
          cache_key: string
          finished_at: string | null
          id: string
          note: string | null
          position: number
          rating: number | null
          shelf_id: string
          started_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          added_at?: string
          author?: string
          cache_key: string
          finished_at?: string | null
          id?: string
          note?: string | null
          position?: number
          rating?: number | null
          shelf_id: string
          started_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          added_at?: string
          author?: string
          cache_key?: string
          finished_at?: string | null
          id?: string
          note?: string | null
          position?: number
          rating?: number | null
          shelf_id?: string
          started_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_books_shelf_id_fkey"
            columns: ["shelf_id"]
            isOneToOne: false
            referencedRelation: "shelves"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_cluster_members: {
        Row: {
          cluster_id: string
          created_at: string
          id: string
          shelf_book_id: string
          user_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          id?: string
          shelf_book_id: string
          user_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          id?: string
          shelf_book_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_cluster_members_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "shelf_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_cluster_members_shelf_book_id_fkey"
            columns: ["shelf_book_id"]
            isOneToOne: false
            referencedRelation: "shelf_books"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_clusters: {
        Row: {
          centroid_x: number | null
          centroid_y: number | null
          color: string | null
          created_at: string
          id: string
          name: string
          position: number
          shelf_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          centroid_x?: number | null
          centroid_y?: number | null
          color?: string | null
          created_at?: string
          id?: string
          name: string
          position?: number
          shelf_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          centroid_x?: number | null
          centroid_y?: number | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          shelf_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shelf_recommendations: {
        Row: {
          created_at: string
          id: string
          last_accessed_at: string
          mode: string
          model: string
          recommendations: Json
          shelf_signature: string
          source_titles: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_accessed_at?: string
          mode: string
          model: string
          recommendations: Json
          shelf_signature: string
          source_titles?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_accessed_at?: string
          mode?: string
          model?: string
          recommendations?: Json
          shelf_signature?: string
          source_titles?: Json
          user_id?: string
        }
        Relationships: []
      }
      shelves: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      takeaway_questions_cache: {
        Row: {
          author: string
          book_type: string
          cache_key: string
          created_at: string
          hit_count: number
          id: string
          last_accessed_at: string
          model: string | null
          questions: Json
          title: string
        }
        Insert: {
          author?: string
          book_type?: string
          cache_key: string
          created_at?: string
          hit_count?: number
          id?: string
          last_accessed_at?: string
          model?: string | null
          questions: Json
          title: string
        }
        Update: {
          author?: string
          book_type?: string
          cache_key?: string
          created_at?: string
          hit_count?: number
          id?: string
          last_accessed_at?: string
          model?: string | null
          questions?: Json
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_recent_events: {
        Args: {
          p_ip_hash: string
          p_prefetch_only?: boolean
          p_route: string
          p_window_seconds: number
        }
        Returns: number
      }
      purge_cold_novel_analyses: { Args: never; Returns: number }
      purge_old_rate_limit_events: { Args: never; Returns: number }
      purge_old_search_cache: { Args: never; Returns: number }
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
  public: {
    Enums: {},
  },
} as const
