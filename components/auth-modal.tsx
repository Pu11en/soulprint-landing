'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { signIn, signUp, signInWithGoogle } from '@/app/actions/auth';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    if (mode === 'signup') formData.append('name', name);

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
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signInWithGoogle();
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
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-white/60">
                  {mode === 'login' ? 'Sign in to continue' : 'Start building your AI memory'}
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Google OAuth */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50 mb-6"
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
                  disabled={isLoading}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
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
