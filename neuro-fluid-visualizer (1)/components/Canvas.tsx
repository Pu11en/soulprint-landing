import React, { useEffect, useRef } from 'react';
import { NeuroFluidEngine } from '../utils/engine';
import { SimulationSettings } from '../types';

interface CanvasProps {
    settings: SimulationSettings;
}

const Canvas: React.FC<CanvasProps> = ({ settings }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<NeuroFluidEngine | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Initialize engine
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
    }, []); // Only run once on mount

    // Update settings without destroying the engine
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.updateSettings(settings);
        }
    }, [settings]);

    return (
        <div className="flex-grow relative bg-surface overflow-hidden w-full h-full">
            <canvas 
                ref={canvasRef} 
                className="block w-full h-full absolute top-0 left-0 outline-none"
            />
        </div>
    );
};

export default Canvas;