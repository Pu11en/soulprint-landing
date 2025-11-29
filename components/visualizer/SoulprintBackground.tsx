"use client"

import React, { useEffect, useRef, useMemo } from 'react';
import { NeuroFluidEngine } from '@/lib/visualizer/engine';
import { generateProfile } from '@/lib/visualizer/math';
import { DEFAULT_SETTINGS } from '@/lib/visualizer/types';

interface SoulprintBackgroundProps {
    personality: string;
}

const SoulprintBackground: React.FC<SoulprintBackgroundProps> = ({ personality }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<NeuroFluidEngine | null>(null);

    // Generate settings based on personality string
    const settings = useMemo(() => {
        if (!personality || personality === 'Default System') {
            return DEFAULT_SETTINGS;
        }
        return generateProfile(personality);
    }, [personality]);

    // Initialize engine on mount
    useEffect(() => {
        if (!canvasRef.current) return;

        const engine = new NeuroFluidEngine(canvasRef.current, settings);
        engineRef.current = engine;
        engine.start();

        const handleResize = () => {
            engine.resize();
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            engine.stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update settings when personality changes
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.updateSettings(settings);
        }
    }, [settings]);

    return (
        <canvas 
            ref={canvasRef} 
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
            }}
        />
    );
};

export default SoulprintBackground;
