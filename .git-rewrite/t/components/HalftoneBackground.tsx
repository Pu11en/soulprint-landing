'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface HalftoneBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export function HalftoneBackground({ children, className = '' }: HalftoneBackgroundProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if mobile on mount
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    setMousePos({ x: e.clientX, y: e.clientY });
  }, [isMobile]);

  const handleMouseEnter = useCallback(() => {
    if (!isMobile) setIsHovering(true);
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  return (
    <div
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base halftone background */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          backgroundImage: `url('/images/halftone-bg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Dark overlay to dim the base */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Cursor-following glow effect */}
      {!isMobile && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovering ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{
            background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(234,88,12,0.12), transparent 50%)`,
          }}
        />
      )}

      {/* Spotlight reveal layer - shows the halftone more clearly near cursor */}
      {!isMobile && isHovering && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url('/images/halftone-bg.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            maskImage: `radial-gradient(500px circle at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 60%)`,
            WebkitMaskImage: `radial-gradient(500px circle at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 60%)`,
            opacity: 0.7,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
