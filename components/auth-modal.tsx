'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Ticket, Check, Loader2 } from 'lucide-react';
import { signIn, signUp, signInWithGoogle } from '@/app/actions/auth';
import { validateReferralCode } from '@/app/actions/referral';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Referral state
  const [referralCode, setReferralCode] = useState('');
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  
  const validateCode = useCallback(async (code: string) => {
    if (!code.trim()) {
      setReferredBy(null);
      setCodeError('');
      return;
    }
    
    setValidatingCode(true);
    setCodeError('');
    
    try {
      const result = await validateReferralCode(code);
      if (result.valid && result.teamMember) {
        setReferredBy(result.teamMember);
        // Cache in localStorage
        localStorage.setItem('referralCode', code.toUpperCase());
        localStorage.setItem('referredBy', result.teamMember);
      } else {
        setReferredBy(null);
        setCodeError('Invalid referral code');
      }
    } catch {
      setCodeError('Failed to validate code');
    } finally {
      setValidatingCode(false);
    }
  }, []);
  
  // Load referral from URL params or localStorage when modal opens
  useEffect(() => {
    if (typeof window === 'undefined' || !isOpen) return;
    
    // Check URL params first
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('ref') || params.get('referral');
    
    // Then check localStorage (fresh read every time modal opens)
    const storedCode = localStorage.getItem('referralCode');
    const storedReferrer = localStorage.getItem('referredBy');
    
    const code = urlCode || storedCode;
    
    if (code) {
      setReferralCode(code.toUpperCase());
      if (storedReferrer && !urlCode) {
        // Use cached referrer name if we have it and no new URL code
        setReferredBy(storedReferrer);
      } else if (code) {
        // Validate the code to get referrer name
        validateCode(code);
      }
    }
  }, [isOpen, validateCode]);
  
  // Sync mode when defaultMode changes (e.g., Login vs Enter SoulPrint button)
  // Also reset form state when modal opens
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMode(defaultMode);
    if (isOpen) {
      setEmail('');
      setPassword('');
      setName('');
      setError('');
      setSuccess(false);
      // Don't reset referral state - keep it persistent
    }
  }, [defaultMode, isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    if (mode === 'signup') {
      formData.append('name', name);
      if (referralCode && referredBy) {
        formData.append('referralCode', referralCode);
      }
    }

    try {
      const result = mode === 'login'
        ? await signIn(formData)
        : await signUp(formData);

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      } else if ('success' in (result || {})) {
        setSuccess(true);
        setIsLoading(false);
      }
      // If redirect() was called in the server action, execution won't reach here
    } catch {
      // Server action redirect throws NEXT_REDIRECT which is expected.
      // Any other error means the action failed (e.g., network error).
      // Reset loading state so the user can retry.
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle(referralCode && referredBy ? referralCode : undefined);
    } catch {
      // Server action redirect throws NEXT_REDIRECT which is expected.
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md p-8 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">✉️</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
              <p className="text-white/60">We sent a confirmation link to {email}</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-white/60">
                  {mode === 'login' ? 'Sign in to continue' : 'Start building your AI memory'}
                </p>
              </div>

              {/* Referral Badge - Shows when code is validated */}
              {mode === 'signup' && referredBy && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl"
                >
                  <Ticket className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-300 text-sm font-medium">
                    Invited by <span className="text-orange-400">{referredBy}</span>
                  </span>
                  <Check className="w-4 h-4 text-green-400" />
                </motion.div>
              )}

              {/* Referral Code Input - REQUIRED for signup */}
              {mode === 'signup' && !referredBy && (
                <div className="mb-6">
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="block text-white/60 text-sm mb-2 flex items-center gap-2">
                      <Ticket className="w-4 h-4" />
                      Access Code <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        onBlur={() => validateCode(referralCode)}
                        onKeyDown={(e) => e.key === 'Enter' && validateCode(referralCode)}
                        placeholder="Enter your invite code"
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-center uppercase tracking-wider placeholder:text-white/30 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-orange-500/50 transition-colors pr-10"
                      />
                      {validatingCode && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    {codeError && (
                      <p className="text-red-400 text-xs text-center">{codeError}</p>
                    )}
                    <p className="text-white/30 text-xs text-center">
                      SoulPrint is invite-only. Need a code? <a href="mailto:drew@archeforge.com" className="text-orange-500/70 hover:text-orange-500">Request access</a>
                    </p>
                  </motion.div>
                </div>
              )}

              {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Google OAuth */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || (mode === 'signup' && !referredBy)}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/40 text-sm">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-white/60 text-sm mb-2">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors"
                      placeholder="Your name"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-white/60 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white/60 text-sm mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-colors"
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || (mode === 'signup' && !referredBy)}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              {/* Toggle mode */}
              <p className="text-center mt-6 text-white/60 text-sm">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
