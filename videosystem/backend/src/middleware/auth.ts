import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Authentication middleware to verify JWT token from Supabase Auth
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data, error } = await AuthService.verifyToken(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Get user from our database
    const { data: userData, error: userError } = await AuthService.getUserById(data.user.id);

    if (userError || !userData) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    // Add user to request object
    req.user = userData;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next();
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data, error } = await AuthService.verifyToken(token);

    if (error || !data.user) {
      // Invalid token, continue without user
      return next();
    }

    // Get user from our database
    const { data: userData, error: userError } = await AuthService.getUserById(data.user.id);

    if (userError || !userData) {
      // User not found, continue without user
      return next();
    }

    // Add user to request object
    req.user = userData;

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    // Continue without user on error
    next();
  }
};

/**
 * Authorization middleware to check if user has required subscription tier
 */
export const requireSubscriptionTier = (requiredTier: 'free' | 'pro' | 'enterprise') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const userTier = req.user.subscription_tier as 'free' | 'pro' | 'enterprise';
    
    // Define tier hierarchy
    const tierHierarchy: Record<string, number> = {
      'free': 0,
      'pro': 1,
      'enterprise': 2
    };

    const userTierLevel = tierHierarchy[userTier];
    const requiredTierLevel = tierHierarchy[requiredTier];

    if (userTierLevel < requiredTierLevel) {
      return res.status(403).json({ 
        error: 'Forbidden: Subscription tier too low',
        required: requiredTier,
        current: userTier
      });
    }

    next();
  };
};

/**
 * Authorization middleware to check if user owns the resource
 */
export const requireOwnership = (resourceIdParam: string = 'id', resourceType: 'project' | 'asset') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const resourceId = req.params[resourceIdParam];
    if (!resourceId) {
      return res.status(400).json({ error: 'Bad request: Resource ID required' });
    }

    try {
      const { supabase } = await import('../utils/supabase');
      
      let query;
      if (resourceType === 'project') {
        query = supabase
          .from('projects')
          .select('user_id')
          .eq('id', resourceId)
          .single();
      } else if (resourceType === 'asset') {
        query = supabase
          .from('assets')
          .select('user_id')
          .eq('id', resourceId)
          .single();
      }

      const { data, error } = await query;

      if (error || !data) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      if (data.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: You do not own this resource' });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export default {
  authenticate,
  optionalAuth,
  requireSubscriptionTier,
  requireOwnership
};