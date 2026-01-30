'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Ticket, Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { validateReferralCode } from '@/app/actions/referral';

interface AccessCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeValid: () => void; // Called when valid code entered → show auth modal
}

type Mode = 'code' | 'waitlist' | 'success';

export function AccessCodeModal({ isOpen, onClose, onCodeValid }: AccessCodeModalProps) {
  const [mode, setMode] = useState<Mode>('waitlist'); // Waitlist first!
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('waitlist'); // Waitlist first!
      setCode('');
      setEmail('');
      setName('');
      setError('');
    }
  }, [isOpen]);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const upperCode = code.toUpperCase().trim();

    try {
      const result = await validateReferralCode(upperCode);
      
      if (result.valid && result.teamMember) {
        // Store in localStorage
        localStorage.setItem('referralCode', upperCode);
        localStorage.setItem('referredBy', result.teamMember);
        localStorage.setItem('hasValidCode', 'true');
        
        // Trigger auth modal
        onCodeValid();
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

          {/* Success State - Check Email */}
          {mode === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your email!</h2>
              <p className="text-white/60 mb-6">
                We sent a confirmation link to <span className="text-white">{email}</span>
              </p>
              <p className="text-white/40 text-sm mb-6">
                Click the link to confirm your spot on the waitlist.
              </p>
              <button
                onClick={onClose}
                className="text-orange-500 hover:text-orange-400 font-medium"
              >
                Got it
              </button>
            </div>
          )}

          {/* Code Entry */}
          {mode === 'code' && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                  <Ticket className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Enter SoulPrint</h2>
                <p className="text-white/60">SoulPrint is invite-only. Enter your access code.</p>
              </div>

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError(''); }}
                    placeholder="ACCESS CODE"
                    className="w-full h-14 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-white text-center text-lg font-bold uppercase tracking-widest placeholder:text-white/30 outline-none transition-colors px-4"
                    autoFocus
                  />
                  {error && (
                    <p className="text-red-400 text-sm text-center mt-2">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="w-full h-14 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 disabled:cursor-not-allowed rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              <button
                onClick={() => setMode('waitlist')}
                className="w-full text-white/40 hover:text-white/60 text-sm mt-4 transition-colors"
              >
                ← Back to waitlist
              </button>
            </>
          )}

          {/* Waitlist Form */}
          {mode === 'waitlist' && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Join the Waitlist</h2>
                <p className="text-white/60">We'll let you know when your spot opens up.</p>
              </div>

              <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full h-12 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-white placeholder:text-white/30 outline-none transition-colors px-4"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="Your email"
                  className="w-full h-12 bg-white/5 border border-white/10 focus:border-orange-500 rounded-xl text-white placeholder:text-white/30 outline-none transition-colors px-4"
                  required
                />
                {error && (
                  <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full h-14 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 disabled:cursor-not-allowed rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Join Waitlist
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center gap-4 mt-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/40 text-sm">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={() => setMode('code')}
                className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white flex items-center justify-center gap-2 mt-4 transition-colors"
              >
                <Ticket className="w-4 h-4 text-white/60" />
                <span>I have an access code</span>
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Check if user already has a valid access code stored
 */
export function hasStoredAccessCode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('hasValidCode') === 'true';
}
