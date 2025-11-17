import { Database } from '@/types/database';

export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export class UserModel {
  static create(userData: UserInsert): UserInsert {
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name || null,
      avatar_url: userData.avatar_url || null,
      subscription_tier: userData.subscription_tier || 'free',
      created_at: userData.created_at || new Date().toISOString(),
      updated_at: userData.updated_at || new Date().toISOString(),
      last_login: userData.last_login || null,
    };
  }

  static update(userData: Partial<UserUpdate>): UserUpdate {
    return {
      ...userData,
      updated_at: new Date().toISOString(),
    };
  }

  static validate(userData: Partial<UserInsert>): string[] {
    const errors: string[] = [];

    if (!userData.email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push('Email is invalid');
    }

    if (userData.name && userData.name.length > 100) {
      errors.push('Name must be less than 100 characters');
    }

    if (userData.subscription_tier && !['free', 'pro', 'enterprise'].includes(userData.subscription_tier)) {
      errors.push('Subscription tier must be one of: free, pro, enterprise');
    }

    return errors;
  }

  static isPro(user: User): boolean {
    return user.subscription_tier === 'pro' || user.subscription_tier === 'enterprise';
  }

  static isEnterprise(user: User): boolean {
    return user.subscription_tier === 'enterprise';
  }

  static getDisplayName(user: User): string {
    return user.name || user.email;
  }

  static getInitials(user: User): string {
    const name = user.name || user.email;
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  }
}

export default UserModel;