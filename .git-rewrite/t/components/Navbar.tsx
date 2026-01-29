'use client';

import Link from 'next/link';

interface NavbarProps {
  showRefresh?: boolean;
}

export default function Navbar({ showRefresh = true }: NavbarProps) {
  return (
    <nav className="max-w-5xl mx-auto mb-16 flex items-center justify-between">
      <Link href="/" className="logo">
        <img src="/logo.svg" alt="SoulPrint" className="logo-icon" />
        <span className="text-white">SoulPrint</span>
      </Link>
      {showRefresh && (
        <button
          onClick={() => window.location.reload()}
          className="w-10 h-10 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
          aria-label="Refresh"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </nav>
  );
}
