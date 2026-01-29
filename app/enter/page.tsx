'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowLeft } from 'lucide-react';

// Referral codes from ArcheForge team
const VALID_CODES: Record<string, string> = {
  // Team codes
  'NINETEEN19': 'Layla Ghafarri',
  'ACE1': 'Ben Woodard',
  'ACE!1': 'Ben Woodard',
  'FLOYD': 'Adrian Floyd',
  'WHITEBOYNICK': 'Nicholas Hill',
  'BLANCHE': 'Lisa Quible',
  // Founders
  'DREW2026': 'Drew',
  'GLENN2026': 'Glenn',
  'RONNIE2026': 'Ronnie',
};

export default function EnterPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsValidating(true);

    const upperCode = code.toUpperCase().trim();
    
    if (VALID_CODES[upperCode]) {
      // Store referrer info in localStorage
      localStorage.setItem('referralCode', upperCode);
      localStorage.setItem('referredBy', VALID_CODES[upperCode]);
      
      // Redirect to signup
      router.push('/signup');
    } else {
      setError('Invalid access code. Contact a team member for an invite.');
    }
    
    setIsValidating(false);
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
          {/* Title */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl sm:text-5xl font-koulen uppercase tracking-tight text-white">
              ENTER <span className="text-orange-600">SOULPRINT</span>
            </h1>
            <p className="text-white/60 text-lg">
              SoulPrint is invite-only. Enter your access code to continue.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
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
              disabled={isValidating || !code.trim()}
              className="w-full h-16 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-between px-8 group"
            >
              <span className="text-black font-black text-xl uppercase tracking-wider font-koulen">
                {isValidating ? 'Validating...' : 'Continue'}
              </span>
              <ArrowRight className="w-6 h-6 text-black group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/40 text-sm uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Login link */}
          <div className="text-center">
            <p className="text-white/60">
              Already have an account?{' '}
              <Link href="/login" className="text-orange-600 hover:text-orange-500 font-bold">
                Sign In
              </Link>
            </p>
          </div>

          {/* Request access */}
          <div className="text-center pt-4">
            <p className="text-white/40 text-sm">
              Need an access code?{' '}
              <a 
                href="mailto:drew@archeforge.com?subject=SoulPrint Access Request" 
                className="text-white/60 hover:text-white underline"
              >
                Request invite
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
