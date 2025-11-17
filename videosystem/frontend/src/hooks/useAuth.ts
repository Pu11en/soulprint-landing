import { useAuth } from '@/contexts/AuthContext';

// Custom hook to access authentication state and functions
export const useAuthState = () => {
  const { user, authUser, session, loading } = useAuth();
  
  return {
    user,
    authUser,
    session,
    loading,
    isAuthenticated: !!user,
    userId: user?.id || null,
    userEmail: user?.email || null,
    userName: authUser?.name || user?.email || null,
    userAvatar: authUser?.avatar_url || null,
    subscriptionTier: authUser?.subscription_tier || 'free',
    isPro: authUser?.subscription_tier === 'pro' || authUser?.subscription_tier === 'enterprise',
    isEnterprise: authUser?.subscription_tier === 'enterprise',
  };
};

// Custom hook for authentication actions
export const useAuthActions = () => {
  const { signUp, signIn, signOut, resetPassword, updatePassword, refreshUser } = useAuth();
  
  return {
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refreshUser,
  };
};

// Combined hook for both state and actions
export const useAuthFull = () => {
  const authState = useAuthState();
  const authActions = useAuthActions();
  
  return {
    ...authState,
    ...authActions,
  };
};

export default useAuthFull;