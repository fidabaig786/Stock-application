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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      analysis_results: {
        Row: {
          analysis_id: string | null
          created_at: string
          id: string
          result_data: Json
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          result_data: Json
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          result_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "stock_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_positions: {
        Row: {
          buy_date: string
          buy_price: number
          comments: string | null
          created_at: string
          holding: number
          id: string
          index_buy_price: number
          index_ticker: string
          shares: number
          stop_loss_price: number | null
          ticker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buy_date: string
          buy_price: number
          comments?: string | null
          created_at?: string
          holding?: number
          id?: string
          index_buy_price: number
          index_ticker?: string
          shares: number
          stop_loss_price?: number | null
          ticker: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buy_date?: string
          buy_price?: number
          comments?: string | null
          created_at?: string
          holding?: number
          id?: string
          index_buy_price?: number
          index_ticker?: string
          shares?: number
          stop_loss_price?: number | null
          ticker?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      screening_results: {
        Row: {
          analysis_id: string | null
          conditions_met: Json
          created_at: string
          id: string
          met_conditions: number
          score: number
          security_id: string | null
          total_conditions: number
        }
        Insert: {
          analysis_id?: string | null
          conditions_met?: Json
          created_at?: string
          id?: string
          met_conditions?: number
          score?: number
          security_id?: string | null
          total_conditions?: number
        }
        Update: {
          analysis_id?: string | null
          conditions_met?: Json
          created_at?: string
          id?: string
          met_conditions?: number
          score?: number
          security_id?: string | null
          total_conditions?: number
        }
        Relationships: [
          {
            foreignKeyName: "screening_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "stock_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_results_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      securities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          market_cap: number | null
          name: string | null
          price: number | null
          sector: string | null
          symbol: string
          type: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          market_cap?: number | null
          name?: string | null
          price?: number | null
          sector?: string | null
          symbol: string
          type: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          market_cap?: number | null
          name?: string | null
          price?: number | null
          sector?: string | null
          symbol?: string
          type?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: []
      }
      stock_analyses: {
        Row: {
          created_at: string
          criteria: Json
          id: string
          scan_type: string
          ticker: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          criteria?: Json
          id?: string
          scan_type: string
          ticker: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          criteria?: Json
          id?: string
          scan_type?: string
          ticker?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          cash_balance: number | null
          created_at: string
          email: string | null
          email_notifications_enabled: boolean | null
          id: string
          notification_criteria: Json | null
          polygon_api_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_balance?: number | null
          created_at?: string
          email?: string | null
          email_notifications_enabled?: boolean | null
          id?: string
          notification_criteria?: Json | null
          polygon_api_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_balance?: number | null
          created_at?: string
          email?: string | null
          email_notifications_enabled?: boolean | null
          id?: string
          notification_criteria?: Json | null
          polygon_api_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          added_at: string
          asset_type: string
          company_url: string | null
          current_price: number | null
          id: string
          ticker: string
          user_id: string
        }
        Insert: {
          added_at?: string
          asset_type: string
          company_url?: string | null
          current_price?: number | null
          id?: string
          ticker: string
          user_id: string
        }
        Update: {
          added_at?: string
          asset_type?: string
          company_url?: string | null
          current_price?: number | null
          id?: string
          ticker?: string
          user_id?: string
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
  public: {
    Enums: {},
  },
} as const
