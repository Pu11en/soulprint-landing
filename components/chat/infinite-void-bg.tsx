'use client';

import { useEffect, useRef } from 'react';

export function InfiniteVoidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Star particles
    const stars: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];
    const numStars = 150;

    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }

    // Nebula particles (larger, more colorful)
    const nebulas: { x: number; y: number; size: number; color: string; opacity: number }[] = [];
    const nebulaColors = ['#EA580C', '#7C3AED', '#3B82F6', '#10B981'];
    
    for (let i = 0; i < 20; i++) {
      nebulas.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 200 + 100,
        color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
        opacity: Math.random() * 0.08 + 0.02,
      });
    }

    let animationId: number;

    const animate = () => {
      // Deep void gradient
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width
      );
      gradient.addColorStop(0, '#0a0a0a');
      gradient.addColorStop(0.5, '#050508');
      gradient.addColorStop(1, '#000000');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw nebulas (behind stars)
      nebulas.forEach(nebula => {
        const nebulaGradient = ctx.createRadialGradient(
          nebula.x, nebula.y, 0,
          nebula.x, nebula.y, nebula.size
        );
        nebulaGradient.addColorStop(0, nebula.color + Math.floor(nebula.opacity * 255).toString(16).padStart(2, '0'));
        nebulaGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = nebulaGradient;
        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw and update stars
      stars.forEach(star => {
        // Twinkle effect
        const twinkle = Math.sin(Date.now() * 0.003 + star.x) * 0.3 + 0.7;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkle})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Subtle drift
        star.y += star.speed * 0.5;
        star.x += Math.sin(Date.now() * 0.001 + star.y * 0.01) * 0.1;

        // Wrap around
        if (star.y > canvas.height + star.size) {
          star.y = -star.size;
          star.x = Math.random() * canvas.width;
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
