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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      assets_control: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          is_visible: boolean
          stock_code: string
          table_source: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          stock_code: string
          table_source: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          stock_code?: string
          table_source?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          new_values: Json | null
          old_values: Json | null
          operation: string
          table_name: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          table_name: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          table_name?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      backtest_stats: {
        Row: {
          asset_class: string | null
          asset_code: string
          entry_percent: number
          exchange: string | null
          id: number
          last_updated: string | null
          losses: number
          operation: string
          reference_price: string
          stop_percent: number
          wins: number
        }
        Insert: {
          asset_class?: string | null
          asset_code: string
          entry_percent: number
          exchange?: string | null
          id?: number
          last_updated?: string | null
          losses?: number
          operation: string
          reference_price: string
          stop_percent: number
          wins?: number
        }
        Update: {
          asset_class?: string | null
          asset_code?: string
          entry_percent?: number
          exchange?: string | null
          id?: number
          last_updated?: string | null
          losses?: number
          operation?: string
          reference_price?: string
          stop_percent?: number
          wins?: number
        }
        Relationships: []
      }
      br_b3_stocks: {
        Row: {
          close: number | null
          date: string
          high: number | null
          id: number
          low: number | null
          open: number | null
          stock_code: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          date: string
          high?: number | null
          id?: number
          low?: number | null
          open?: number | null
          stock_code: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          date?: string
          high?: number | null
          id?: number
          low?: number | null
          open?: number | null
          stock_code?: string
          volume?: number | null
        }
        Relationships: []
      }
      crypto_usd: {
        Row: {
          close: number | null
          date: string
          high: number | null
          id: string
          low: number | null
          open: number | null
          stock_code: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          date: string
          high?: number | null
          id?: string
          low?: number | null
          open?: number | null
          stock_code: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          date?: string
          high?: number | null
          id?: string
          low?: number | null
          open?: number | null
          stock_code?: string
          volume?: number | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          clicked_at: string | null
          email_to: string
          email_type: string
          id: string
          opened_at: string | null
          resend_id: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          user_id: string | null
        }
        Insert: {
          clicked_at?: string | null
          email_to: string
          email_type: string
          id?: string
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          clicked_at?: string | null
          email_to?: string
          email_type?: string
          id?: string
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          created_at: string | null
          email_to: string
          email_type: string
          id: string
          is_processed: boolean | null
          processed_at: string | null
          scheduled_for: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_to: string
          email_type: string
          id?: string
          is_processed?: boolean | null
          processed_at?: string | null
          scheduled_for: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_to?: string
          email_type?: string
          id?: string
          is_processed?: boolean | null
          processed_at?: string | null
          scheduled_for?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data_sources: {
        Row: {
          asset_class: string
          country: string
          created_at: string | null
          id: number
          stock_market: string
          stock_table: string
          updated_at: string | null
        }
        Insert: {
          asset_class: string
          country: string
          created_at?: string | null
          id?: number
          stock_market: string
          stock_table: string
          updated_at?: string | null
        }
        Update: {
          asset_class?: string
          country?: string
          created_at?: string | null
          id?: number
          stock_market?: string
          stock_table?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_results: {
        Row: {
          change_percent: number | null
          company_name: string
          created_at: string | null
          dividend_yield: number | null
          id: string
          industry: string | null
          market_cap: number | null
          pe_ratio: number | null
          price: number
          sector: string | null
          symbol: string
          volume: number | null
        }
        Insert: {
          change_percent?: number | null
          company_name: string
          created_at?: string | null
          dividend_yield?: number | null
          id?: string
          industry?: string | null
          market_cap?: number | null
          pe_ratio?: number | null
          price: number
          sector?: string | null
          symbol: string
          volume?: number | null
        }
        Update: {
          change_percent?: number | null
          company_name?: string
          created_at?: string | null
          dividend_yield?: number | null
          id?: string
          industry?: string | null
          market_cap?: number | null
          pe_ratio?: number | null
          price?: number
          sector?: string | null
          symbol?: string
          volume?: number | null
        }
        Relationships: []
      }
      us_nasdaq100_stocks: {
        Row: {
          close: number | null
          date: string
          high: number | null
          id: number
          low: number | null
          open: number | null
          stock_code: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          date: string
          high?: number | null
          id?: number
          low?: number | null
          open?: number | null
          stock_code: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          date?: string
          high?: number | null
          id?: number
          low?: number | null
          open?: number | null
          stock_code?: string
          volume?: number | null
        }
        Relationships: []
      }
      us_nasdaqfinancial100_stocks: {
        Row: {
          close: number | null
          date: string
          high: number | null
          id: string
          low: number | null
          open: number | null
          stock_code: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          date: string
          high?: number | null
          id?: string
          low?: number | null
          open?: number | null
          stock_code: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          date?: string
          high?: number | null
          id?: string
          low?: number | null
          open?: number | null
          stock_code?: string
          volume?: number | null
        }
        Relationships: []
      }
      us_sp500_stocks: {
        Row: {
          close: number | null
          date: string
          high: number | null
          id: number
          low: number | null
          open: number | null
          stock_code: string
          volume: number | null
        }
        Insert: {
          close?: number | null
          date: string
          high?: number | null
          id?: number
          low?: number | null
          open?: number | null
          stock_code: string
          volume?: number | null
        }
        Update: {
          close?: number | null
          date?: string
          high?: number | null
          id?: number
          low?: number | null
          open?: number | null
          stock_code?: string
          volume?: number | null
        }
        Relationships: []
      }
      user_login_history: {
        Row: {
          created_at: string
          id: string
          login_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          login_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_query_history: {
        Row: {
          created_at: string
          id: string
          query_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query_type?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          country_code: string | null
          created_at: string | null
          email: string
          email_sequence_step: number | null
          email_subscribed: boolean | null
          email_verified: boolean | null
          has_seen_tour: boolean | null
          id: string
          joined_telegram: boolean | null
          last_email_sent_at: string | null
          last_login: string | null
          lead_source: string | null
          level_id: number | null
          locale: string | null
          must_change_password: boolean
          name: string | null
          role: string | null
          status_users: string | null
          stripe_customer_id: string | null
          subscribed: boolean | null
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          email: string
          email_sequence_step?: number | null
          email_subscribed?: boolean | null
          email_verified?: boolean | null
          has_seen_tour?: boolean | null
          id?: string
          joined_telegram?: boolean | null
          last_email_sent_at?: string | null
          last_login?: string | null
          lead_source?: string | null
          level_id?: number | null
          locale?: string | null
          must_change_password?: boolean
          name?: string | null
          role?: string | null
          status_users?: string | null
          stripe_customer_id?: string | null
          subscribed?: boolean | null
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          email?: string
          email_sequence_step?: number | null
          email_subscribed?: boolean | null
          email_verified?: boolean | null
          has_seen_tour?: boolean | null
          id?: string
          joined_telegram?: boolean | null
          last_email_sent_at?: string | null
          last_login?: string | null
          lead_source?: string | null
          level_id?: number | null
          locale?: string | null
          must_change_password?: boolean
          name?: string | null
          role?: string | null
          status_users?: string | null
          stripe_customer_id?: string | null
          subscribed?: boolean | null
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_asset_everywhere: {
        Args: { p_stock_code: string; p_table_source: string }
        Returns: undefined
      }
      admin_reconcile_assets_control: { Args: never; Returns: undefined }
      calculate_today_probability: {
        Args: {
          p_asset_class: string
          p_asset_code: string
          p_entry_percent: number
          p_exchange: string
          p_operation: string
          p_reference_price: string
          p_stop_percent: number
        }
        Returns: {
          confidence_95: string
          probability_raw: number
          probability_today: string
        }[]
      }
      check_user_by_email: {
        Args: { p_email: string }
        Returns: {
          level_id: number
          status_users: string
          user_exists: boolean
        }[]
      }
      current_user_level: { Args: never; Returns: number }
      enqueue_existing_users: { Args: never; Returns: undefined }
      get_current_user: {
        Args: never
        Returns: {
          created_at: string
          email: string
          email_verified: boolean
          id: string
          level_id: number
          name: string
          status_users: string
          subscription_tier: string
        }[]
      }
      get_stock_data:
        | {
            Args: {
              p_limit_rows?: number
              p_stock_code_param: string
              p_table_name: string
            }
            Returns: Json
          }
        | {
            Args: {
              end_date?: string
              start_date?: string
              stock_code_param: string
              table_name: string
            }
            Returns: {
              close: number
              date: string
              high: number
              low: number
              open: number
              stock_code: string
              volume: number
            }[]
          }
      get_subscription_status_secure: {
        Args: never
        Returns: {
          subscribed: boolean
          subscription_end: string
          subscription_tier: string
        }[]
      }
      get_unique_stock_codes: {
        Args: { p_table_name: string }
        Returns: string[]
      }
      get_user_profile_safe: {
        Args: never
        Returns: {
          created_at: string
          email: string
          email_verified: boolean
          has_seen_tour: boolean
          id: string
          name: string
          status_users: string
          updated_at: string
        }[]
      }
      get_user_profile_secure: {
        Args: never
        Returns: {
          created_at: string
          email: string
          email_verified: boolean
          id: string
          name: string
          status_users: string
          updated_at: string
        }[]
      }
      get_user_subscription_safe: {
        Args: never
        Returns: {
          subscribed: boolean
          subscription_end: string
          subscription_tier: string
        }[]
      }
      get_user_subscription_status: {
        Args: never
        Returns: {
          subscribed: boolean
          subscription_end: string
          subscription_tier: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_valid_asset_source_table: {
        Args: { p_table: string }
        Returns: boolean
      }
      populate_assets_control: { Args: never; Returns: undefined }
      reconcile_assets_control: { Args: never; Returns: undefined }
      record_user_login: { Args: never; Returns: undefined }
      record_user_query: { Args: { p_query_type?: string }; Returns: undefined }
      table_exists: { Args: { p_table_name: string }; Returns: boolean }
      update_user_level_admin_only: {
        Args: { new_level: number; target_user_id: string }
        Returns: undefined
      }
      upsert_backtest_stats: {
        Args: {
          p_asset_class: string
          p_asset_code: string
          p_entry_percent: number
          p_exchange: string
          p_losses: number
          p_operation: string
          p_reference_price: string
          p_stop_percent: number
          p_wins: number
        }
        Returns: undefined
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
