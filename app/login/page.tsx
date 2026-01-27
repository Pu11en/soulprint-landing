'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signIn, signInWithGoogle } from '@/app/actions/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    const result = await signIn(formData);
    
    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signInWithGoogle();
  };

  return (
    <main className="min-h-screen bg-[#09090B] flex items-center justify-center px-6 sm:px-8 py-16">
      {/* Ambient glow */}
      <div className="glow-ambient top-0 left-1/2 -translate-x-1/2" />

      <div className="w-full max-w-[420px] relative">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="logo inline-flex justify-center">
            <img src="/logo.svg" alt="SoulPrint" className="logo-icon" />
            <span className="text-white">SoulPrint</span>
          </Link>
        </div>

        {/* Card */}
        <div className="card-elevated p-8 sm:p-10">
          <div className="text-center mb-10">
            <h1 className="text-title text-white mb-3">Welcome back</h1>
            <p className="text-caption">Sign in to continue to your memories</p>
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
            className="btn btn-secondary w-full mb-8"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="divider-text mb-8">or</div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="input-label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="input-label">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <p className="text-center mt-6 text-caption">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-orange-500 hover:text-orange-400 font-medium transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
