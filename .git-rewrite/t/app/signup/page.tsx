'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect /signup to home (auth modal is on home now)
export default function SignupPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
