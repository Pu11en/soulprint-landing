'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import { validateReferralCode } from '@/app/actions/referral';

type Mode = 'code' | 'waitlist' | 'success';

export default function EnterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const upperCode = code.toUpperCase().trim();

    try {
      const result = await validateReferralCode(upperCode);

      if (result.valid && result.teamMember) {
        localStorage.setItem('referralCode', upperCode);
        localStorage.setItem('referredBy', result.teamMember);
        localStorage.setItem('hasValidCode', 'true');
        router.push('/signup');
      } else {
        setError('Invalid access code');
      }
    } catch {
      setError('Failed to validate code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setMode('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/images/soulprintlogomain.png"
            alt="SoulPrint Logo"
            width={36}
            height={36}
            className="w-9 h-9 object-contain"
          />
          <span className="text-white text-3xl font-normal font-koulen leading-9 tracking-tight">SOULPRINT</span>
        </Link>
        <Link href="/" className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md space-y-8">
          
          {/* Success State */}
          {mode === 'success' && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-3xl font-koulen uppercase text-white">
                YOU&apos;RE ON THE LIST
              </h1>
              <p className="text-white/60">
                We&apos;ll reach out when your spot opens up. Keep an eye on your inbox!
              </p>
              <Link 
                href="/"
                className="inline-block text-orange-500 hover:text-orange-400 font-medium"
              >
                ← Back to home
              </Link>
            </div>
          )}

          {/* Code Entry */}
          {mode === 'code' && (
            <>
              <div className="text-center space-y-4">
                <h1 className="text-4xl sm:text-5xl font-koulen uppercase tracking-tight text-white">
                  ENTER <span className="text-orange-600">SOULPRINT</span>
                </h1>
                <p className="text-white/60 text-lg">
                  SoulPrint is invite-only. Enter your access code to continue.
                </p>
              </div>

              <form onSubmit={handleCodeSubmit} className="space-y-6">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError(''); }}
                    placeholder="ACCESS CODE"
                    className="w-full h-16 bg-white/5 border-2 border-white/10 focus:border-orange-600 text-white text-center text-xl font-bold uppercase tracking-widest placeholder:text-white/30 outline-none transition-colors px-4"
                    autoFocus
                  />
                  {error && (
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="w-full h-16 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-between px-8 group"
                >
                  <span className="text-black font-black text-xl uppercase tracking-wider font-koulen">
                    {isLoading ? 'Checking...' : 'Continue'}
                  </span>
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 text-black animate-spin" />
                  ) : (
                    <ArrowRight className="w-6 h-6 text-black group-hover:translate-x-1 transition-transform" />
                  )}
                </button>
              </form>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/40 text-sm uppercase tracking-wide">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Waitlist CTA */}
              <button
                onClick={() => setMode('waitlist')}
                className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center gap-3 transition-colors"
              >
                <Mail className="w-5 h-5 text-white/60" />
                <span className="font-medium">Join the waitlist</span>
              </button>

              <div className="text-center">
                <p className="text-white/60">
                  Already have an account?{' '}
                  <Link href="/login" className="text-orange-600 hover:text-orange-500 font-bold">
                    Sign In
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* Waitlist Form */}
          {mode === 'waitlist' && (
            <>
              <div className="text-center space-y-4">
                <h1 className="text-4xl sm:text-5xl font-koulen uppercase tracking-tight text-white">
                  JOIN THE <span className="text-orange-600">WAITLIST</span>
                </h1>
                <p className="text-white/60 text-lg">
                  We&apos;ll let you know when your spot opens up.
                </p>
              </div>

              <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full h-14 bg-white/5 border-2 border-white/10 focus:border-orange-600 text-white text-lg placeholder:text-white/30 outline-none transition-colors px-4"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="Your email"
                  className="w-full h-14 bg-white/5 border-2 border-white/10 focus:border-orange-600 text-white text-lg placeholder:text-white/30 outline-none transition-colors px-4"
                  required
                />
                {error && (
                  <p className="text-red-500 text-sm text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full h-16 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-between px-8 group"
                >
                  <span className="text-black font-black text-xl uppercase tracking-wider font-koulen">
                    {isLoading ? 'Joining...' : 'Join Waitlist'}
                  </span>
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 text-black animate-spin" />
                  ) : (
                    <ArrowRight className="w-6 h-6 text-black group-hover:translate-x-1 transition-transform" />
                  )}
                </button>
              </form>

              <button
                onClick={() => setMode('code')}
                className="w-full text-white/40 hover:text-white/60 text-sm transition-colors"
              >
                ← I have an access code
              </button>
            </>
          )}

        </div>
      </div>
    </main>
  );
}
