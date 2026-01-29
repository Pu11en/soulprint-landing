"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BackgroundBeamsProps {
  className?: string;
}

export function BackgroundBeams({ className }: BackgroundBeamsProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-zinc-950" />
      
      {/* Main beam rays */}
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="beam1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(232, 99, 43, 0)" />
            <stop offset="50%" stopColor="rgba(232, 99, 43, 0.08)" />
            <stop offset="100%" stopColor="rgba(232, 99, 43, 0)" />
          </linearGradient>
          <linearGradient id="beam2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.03)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </linearGradient>
          <filter id="blur1">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>
        
        {/* Beam rays from center */}
        <g className="animate-pulse-slow" style={{ animationDuration: "8s" }}>
          <path
            d="M500,500 L200,-50 L250,-50 Z"
            fill="url(#beam1)"
            filter="url(#blur1)"
            opacity="0.6"
          />
          <path
            d="M500,500 L350,-50 L400,-50 Z"
            fill="url(#beam2)"
            filter="url(#blur1)"
            opacity="0.4"
          />
          <path
            d="M500,500 L600,-50 L650,-50 Z"
            fill="url(#beam1)"
            filter="url(#blur1)"
            opacity="0.5"
          />
          <path
            d="M500,500 L750,-50 L800,-50 Z"
            fill="url(#beam2)"
            filter="url(#blur1)"
            opacity="0.3"
          />
        </g>
        
        {/* Secondary beams */}
        <g className="animate-pulse-slow" style={{ animationDuration: "12s", animationDelay: "2s" }}>
          <path
            d="M500,500 L-50,200 L-50,250 Z"
            fill="url(#beam1)"
            filter="url(#blur1)"
            opacity="0.4"
          />
          <path
            d="M500,500 L1050,300 L1050,350 Z"
            fill="url(#beam1)"
            filter="url(#blur1)"
            opacity="0.4"
          />
        </g>
      </svg>
      
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/50" />
      
      {/* Center glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-orange-500/[0.07] rounded-full blur-[120px]" />
    </div>
  );
}

export function BackgroundGradient({ className }: BackgroundBeamsProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-0 bg-black" />
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[150px] -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-orange-600/8 rounded-full blur-[120px] translate-y-1/2" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-white/[0.02] rounded-full blur-[80px]" />
    </div>
  );
}
