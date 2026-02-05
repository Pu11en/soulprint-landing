'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Suspense } from 'react';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status') || 'success';
  const message = searchParams.get('message') || "You're on the list!";

  const isSuccess = status === 'success';

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/images/soulprintlogomain.png"
            alt="SoulPrint"
            width={48}
            height={48}
            className="w-12 h-12 object-contain"
          />
          <span className="text-white text-3xl font-koulen tracking-tight">SOULPRINT</span>
        </Link>

        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
          isSuccess ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {isSuccess ? (
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          ) : (
            <XCircle className="w-10 h-10 text-red-500" />
          )}
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-white">
            {isSuccess ? "You're Confirmed!" : 'Oops!'}
          </h1>
          <p className="text-white/60 text-lg">{message}</p>
        </div>

        {/* CTA */}
        <Link
          href="/"
          className="inline-block px-8 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg transition-colors"
        >
          Back to Home
        </Link>

        {isSuccess && (
          <p className="text-white/40 text-sm">
            We&apos;ll email you when your access is ready.
          </p>
        )}
      </div>
    </main>
  );
}

export default function WaitlistConfirmedPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
