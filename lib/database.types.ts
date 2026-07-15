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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
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
      agenda_items: {
        Row: {
          asignado_a: string[]
          categoria_id: string | null
          completado: boolean
          completado_at: string | null
          completado_por: string | null
          created_at: string
          created_by: string | null
          fecha: string
          hora: string | null
          household_id: string
          id: string
          tipo: string
          titulo: string
        }
        Insert: {
          asignado_a?: string[]
          categoria_id?: string | null
          completado?: boolean
          completado_at?: string | null
          completado_por?: string | null
          created_at?: string
          created_by?: string | null
          fecha: string
          hora?: string | null
          household_id: string
          id?: string
          tipo: string
          titulo: string
        }
        Update: {
          asignado_a?: string[]
          categoria_id?: string | null
          completado?: boolean
          completado_at?: string | null
          completado_por?: string | null
          created_at?: string
          created_by?: string | null
          fecha?: string
          hora?: string | null
          household_id?: string
          id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_completado_por_fkey"
            columns: ["completado_por"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          estado: string
          fin_utc: string
          id: string
          inicio_utc: string
          member_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estado: string
          fin_utc: string
          id?: string
          inicio_utc: string
          member_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estado?: string
          fin_utc?: string
          id?: string
          inicio_utc?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_overrides_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_segments: {
        Row: {
          estado: string
          fin_utc: string
          id: string
          inicio_utc: string
          member_id: string
          source: string
          source_event_hash: string | null
          updated_at: string
        }
        Insert: {
          estado: string
          fin_utc: string
          id?: string
          inicio_utc: string
          member_id: string
          source?: string
          source_event_hash?: string | null
          updated_at?: string
        }
        Update: {
          estado?: string
          fin_utc?: string
          id?: string
          inicio_utc?: string
          member_id?: string
          source?: string
          source_event_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_segments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          color: string
          created_at: string
          household_id: string
          id: string
          nombre: string
        }
        Insert: {
          color?: string
          created_at?: string
          household_id: string
          id?: string
          nombre: string
        }
        Update: {
          color?: string
          created_at?: string
          household_id?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_schedules: {
        Row: {
          almuerza_en_casa: boolean
          created_at: string
          dia_semana: number
          hora_almuerzo_fin: string | null
          hora_almuerzo_inicio: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          member_id: string
        }
        Insert: {
          almuerza_en_casa?: boolean
          created_at?: string
          dia_semana: number
          hora_almuerzo_fin?: string | null
          hora_almuerzo_inicio?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          member_id: string
        }
        Update: {
          almuerza_en_casa?: boolean
          created_at?: string
          dia_semana?: number
          hora_almuerzo_fin?: string | null
          hora_almuerzo_inicio?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_schedules_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
          onboarding_completed: boolean
          plan: string
          subscription_ref: string | null
          subscription_status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          onboarding_completed?: boolean
          plan?: string
          subscription_ref?: string | null
          subscription_status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          onboarding_completed?: boolean
          plan?: string
          subscription_ref?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          buffer_llegada_min: number
          buffer_salida_min: number
          created_at: string
          created_by_member_id: string | null
          display_name: string
          household_id: string
          id: string
          is_owner: boolean
          rol: string
          tipo_horario: string
          user_id: string | null
        }
        Insert: {
          buffer_llegada_min?: number
          buffer_salida_min?: number
          created_at?: string
          created_by_member_id?: string | null
          display_name: string
          household_id: string
          id?: string
          is_owner?: boolean
          rol?: string
          tipo_horario?: string
          user_id?: string | null
        }
        Update: {
          buffer_llegada_min?: number
          buffer_salida_min?: number
          created_at?: string
          created_by_member_id?: string | null
          display_name?: string
          household_id?: string
          id?: string
          is_owner?: boolean
          rol?: string
          tipo_horario?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_activities: {
        Row: {
          asignado_a: string[]
          categoria_id: string | null
          created_at: string
          created_by: string | null
          fecha_fin: string | null
          fecha_inicio: string
          hora: string | null
          household_id: string
          id: string
          payment_link: string | null
          recurrence: Json
          reminder_offset_hours: number | null
          tipo: string
          titulo: string
        }
        Insert: {
          asignado_a?: string[]
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          hora?: string | null
          household_id: string
          id?: string
          payment_link?: string | null
          recurrence: Json
          reminder_offset_hours?: number | null
          tipo?: string
          titulo: string
        }
        Update: {
          asignado_a?: string[]
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          hora?: string | null
          household_id?: string
          id?: string
          payment_link?: string | null
          recurrence?: Json
          reminder_offset_hours?: number | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_activities_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_activities_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_completions: {
        Row: {
          completado_at: string
          completado_por: string | null
          fecha: string
          id: string
          recurring_activity_id: string
        }
        Insert: {
          completado_at?: string
          completado_por?: string | null
          fecha: string
          id?: string
          recurring_activity_id: string
        }
        Update: {
          completado_at?: string
          completado_por?: string | null
          fecha?: string
          id?: string
          recurring_activity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_completions_completado_por_fkey"
            columns: ["completado_por"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_completions_recurring_activity_id_fkey"
            columns: ["recurring_activity_id"]
            isOneToOne: false
            referencedRelation: "recurring_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_connections: {
        Row: {
          created_at: string
          ical_url_encrypted: string
          id: string
          last_fetch_hash: string | null
          last_synced_at: string | null
          member_id: string
        }
        Insert: {
          created_at?: string
          ical_url_encrypted: string
          id?: string
          last_fetch_hash?: string | null
          last_synced_at?: string | null
          member_id: string
        }
        Update: {
          created_at?: string
          ical_url_encrypted?: string
          id?: string
          last_fetch_hash?: string | null
          last_synced_at?: string | null
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_connections_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          added_by: string | null
          carried_from_list_id: string | null
          created_at: string
          id: string
          is_purchased: boolean
          list_id: string
          name: string
          quantity: string | null
        }
        Insert: {
          added_by?: string | null
          carried_from_list_id?: string | null
          created_at?: string
          id?: string
          is_purchased?: boolean
          list_id: string
          name: string
          quantity?: string | null
        }
        Update: {
          added_by?: string | null
          carried_from_list_id?: string | null
          created_at?: string
          id?: string
          is_purchased?: boolean
          list_id?: string
          name?: string
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_carried_from_list_id_fkey"
            columns: ["carried_from_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          closed_at: string | null
          created_at: string
          household_id: string
          id: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          household_id: string
          id?: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          household_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_household: { Args: { p_name: string }; Returns: string }
      current_household_id: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
