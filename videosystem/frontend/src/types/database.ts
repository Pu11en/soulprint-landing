export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          subscription_tier: 'free' | 'pro' | 'enterprise'
          created_at: string
          updated_at: string
          last_login: string | null
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'pro' | 'enterprise'
          created_at?: string
          updated_at?: string
          last_login?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          subscription_tier?: 'free' | 'pro' | 'enterprise'
          created_at?: string
          updated_at?: string
          last_login?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          campaign_type: 'product-launch' | 'social-ad' | 'brand-awareness' | 'event-promotion' | 'educational-content'
          aspect_ratio: '9:16' | '16:9' | '1:1'
          target_duration: 15 | 30 | 60
          brand_colors: Json | null
          brand_logo_url: string | null
          status: 'draft' | 'processing' | 'completed' | 'error'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          campaign_type: 'product-launch' | 'social-ad' | 'brand-awareness' | 'event-promotion' | 'educational-content'
          aspect_ratio: '9:16' | '16:9' | '1:1'
          target_duration: 15 | 30 | 60
          brand_colors?: Json | null
          brand_logo_url?: string | null
          status?: 'draft' | 'processing' | 'completed' | 'error'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          campaign_type?: 'product-launch' | 'social-ad' | 'brand-awareness' | 'event-promotion' | 'educational-content'
          aspect_ratio?: '9:16' | '16:9' | '1:1'
          target_duration?: 15 | 30 | 60
          brand_colors?: Json | null
          brand_logo_url?: string | null
          status?: 'draft' | 'processing' | 'completed' | 'error'
          created_at?: string
          updated_at?: string
        }
      }
      nodes: {
        Row: {
          id: string
          project_id: string
          type: 'video' | 'image' | 'text' | 'audio' | 'effect' | 'shape' | 'logo' | 'timing' | 'export' | 'comment'
          position: Json
          data: Json
          config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          type: 'video' | 'image' | 'text' | 'audio' | 'effect' | 'shape' | 'logo' | 'timing' | 'export' | 'comment'
          position: Json
          data: Json
          config: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          type?: 'video' | 'image' | 'text' | 'audio' | 'effect' | 'shape' | 'logo' | 'timing' | 'export' | 'comment'
          position?: Json
          data?: Json
          config?: Json
          created_at?: string
          updated_at?: string
        }
      }
      connections: {
        Row: {
          id: string
          project_id: string
          source_node_id: string
          target_node_id: string
          source_handle: string
          target_handle: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          source_node_id: string
          target_node_id: string
          source_handle: string
          target_handle: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          source_node_id?: string
          target_node_id?: string
          source_handle?: string
          target_handle?: string
          created_at?: string
        }
      }
      assets: {
        Row: {
          id: string
          project_id: string
          user_id: string
          type: 'video' | 'image' | 'audio' | 'logo'
          name: string
          url: string
          size: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          type: 'video' | 'image' | 'audio' | 'logo'
          name: string
          url: string
          size: number
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          type?: 'video' | 'image' | 'audio' | 'logo'
          name?: string
          url?: string
          size?: number
          metadata?: Json | null
          created_at?: string
        }
      }
      exports: {
        Row: {
          id: string
          project_id: string
          settings: Json
          status: 'pending' | 'processing' | 'completed' | 'failed'
          url: string | null
          size: number | null
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          settings: Json
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          url?: string | null
          size?: number | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          settings?: Json
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          url?: string | null
          size?: number | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
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