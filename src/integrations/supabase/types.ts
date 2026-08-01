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
      categories: {
        Row: {
          created_at: string
          emoji: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          active: boolean
          created_at: string
          cta_href: string
          cta_label: string
          highlight: string
          id: string
          image: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_href?: string
          cta_label?: string
          highlight?: string
          id?: string
          image: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_href?: string
          cta_label?: string
          highlight?: string
          id?: string
          image?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          cashback_awarded: number
          cashback_status: string
          city: string
          country: string
          created_at: string
          customer_name: string
          id: string
          items: Json
          momo_amount: number | null
          notes: string | null
          paid_at: string | null
          payment_method: string
          payment_reference: string | null
          phone: string
          status: string
          total: number
          updated_at: string
          user_id: string | null
          wallet_applied: number
        }
        Insert: {
          address: string
          cashback_awarded?: number
          cashback_status?: string
          city: string
          country?: string
          created_at?: string
          customer_name: string
          id?: string
          items: Json
          momo_amount?: number | null
          notes?: string | null
          paid_at?: string | null
          payment_method: string
          payment_reference?: string | null
          phone: string
          status?: string
          total: number
          updated_at?: string
          user_id?: string | null
          wallet_applied?: number
        }
        Update: {
          address?: string
          cashback_awarded?: number
          cashback_status?: string
          city?: string
          country?: string
          created_at?: string
          customer_name?: string
          id?: string
          items?: Json
          momo_amount?: number | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          phone?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
          wallet_applied?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          external_ref: string | null
          failure_reason: string | null
          id: string
          order_id: string | null
          phone: string
          provider: string
          provider_ref: string | null
          raw_response: Json
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          external_ref?: string | null
          failure_reason?: string | null
          id?: string
          order_id?: string | null
          phone: string
          provider?: string
          provider_ref?: string | null
          raw_response?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          external_ref?: string | null
          failure_reason?: string | null
          id?: string
          order_id?: string | null
          phone?: string
          provider?: string
          provider_ref?: string | null
          raw_response?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cashback_percent: number
          category_slug: string
          created_at: string
          delivery: string
          id: string
          image: string
          images: string[]
          in_stock: boolean
          name: string
          price: number
          rating: number
          reviews: number
          slug: string
          specs: Json
          stock: number
          updated_at: string
          warranty: string
        }
        Insert: {
          cashback_percent?: number
          category_slug: string
          created_at?: string
          delivery?: string
          id?: string
          image: string
          images?: string[]
          in_stock?: boolean
          name: string
          price?: number
          rating?: number
          reviews?: number
          slug: string
          specs?: Json
          stock?: number
          updated_at?: string
          warranty?: string
        }
        Update: {
          cashback_percent?: number
          category_slug?: string
          created_at?: string
          delivery?: string
          id?: string
          image?: string
          images?: string[]
          in_stock?: boolean
          name?: string
          price?: number
          rating?: number
          reviews?: number
          slug?: string
          specs?: Json
          stock?: number
          updated_at?: string
          warranty?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_purchases: number
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          referral_code: string
          referred_by: string | null
          total_spent: number
          updated_at: string
        }
        Insert: {
          approved_purchases?: number
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          referral_code: string
          referred_by?: string | null
          total_spent?: number
          updated_at?: string
        }
        Update: {
          approved_purchases?: number
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_code?: string
          referred_by?: string | null
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_settings: {
        Row: {
          active: boolean
          created_at: string
          id: boolean
          max_rewards_per_referrer: number | null
          reward_amount: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: boolean
          max_rewards_per_referrer?: number | null
          reward_amount?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: boolean
          max_rewards_per_referrer?: number | null
          reward_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          order_id: string | null
          referred_id: string
          referrer_id: string
          reward_amount: number
          rewarded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          order_id?: string | null
          referred_id: string
          referrer_id: string
          reward_amount?: number
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          order_id?: string | null
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
          rewarded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          note: string | null
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_purchases: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_url: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_wallet: {
        Args: { _amount: number; _note?: string; _user_id: string }
        Returns: number
      }
      admin_reverse_cashback: {
        Args: { _order_id: string; _reason?: string }
        Returns: number
      }
      attach_referral: { Args: { _code: string }; Returns: string }
      compute_order_cashback: { Args: { _order_id: string }; Returns: number }
      credit_order_cashback: { Args: { _order_id: string }; Returns: number }
      ensure_wallet: { Args: { _user_id: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_order_paid: {
        Args: { _order_id: string; _reference?: string }
        Returns: number
      }
      my_referral_list: {
        Args: never
        Returns: {
          created_at: string
          id: string
          name: string
          reward_amount: number
          rewarded_at: string
          status: string
        }[]
      }
      my_referral_stats: { Args: never; Returns: Json }
      my_wallet_balance: { Args: never; Returns: number }
      process_referral_reward: { Args: { _order_id: string }; Returns: number }
      recount_and_unlock_rewards: {
        Args: { _user_id: string }
        Returns: undefined
      }
      redeem_wallet_for_order: {
        Args: { _amount: number; _order_id: string }
        Returns: number
      }
      reverse_order_cashback: {
        Args: { _order_id: string; _reason?: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
