import { supabase } from '../utils/supabase';
import { Database } from '../types/database';

type User = Database['public']['Tables']['users']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type UserUpdate = Database['public']['Tables']['users']['Update'];

export class AuthService {
  /**
   * Create a new user record in the database
   * This should be called after a user signs up through Supabase Auth
   */
  static async createUser(userData: UserInsert): Promise<{ data: User | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<{ data: User | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<{ data: User | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Update user profile
   */
  static async updateUser(userId: string, userData: UserUpdate): Promise<{ data: User | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', userId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(userId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);

      return { error };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Delete user account
   */
  static async deleteUser(userId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      return { error };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Verify JWT token from Supabase Auth
   */
  static async verifyToken(token: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase.auth.getUser(token);

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Refresh JWT token
   */
  static async refreshToken(refreshToken: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Sign up with email and password
   */
  static async signUp(email: string, password: string, name?: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      // If signup is successful, create user record in our database
      if (data.user && !error) {
        await this.createUser({
          id: data.user.id,
          email: data.user.email || email,
          name: name || null,
        });
      }

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Sign in with email and password
   */
  static async signIn(email: string, password: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Update last login timestamp
      if (data.user && !error) {
        await this.updateLastLogin(data.user.id);
      }

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Sign out
   */
  static async signOut(): Promise<{ error: any }> {
    try {
      const { error } = await supabase.auth.signOut();

      return { error };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(email: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email);

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Update password
   */
  static async updatePassword(newPassword: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }
}

export default AuthService;