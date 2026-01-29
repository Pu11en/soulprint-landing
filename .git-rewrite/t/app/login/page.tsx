'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect /login to home (auth modal is on home now)
export default function LoginPage() {
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
