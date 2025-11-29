
import React, { useState } from 'react';
import { SimulationSettings, ShapeType } from '../types';
import { generateProfile } from '../utils/math';
import { Activity, Zap, Wind, Droplets, Palette, Maximize, Cpu, Flower2, Orbit, Grid, Tornado, Sun, Box, Plus, Aperture } from 'lucide-react';

interface SidebarProps {
    settings: SimulationSettings;
    onSettingsChange: (newSettings: SimulationSettings) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ settings, onSettingsChange }) => {
    const [prompt, setPrompt] = useState('');
    const [flashing, setFlashing] = useState(false);

    const handleChange = (key: keyof SimulationSettings, value: number) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    const handleInject = () => {
        if (!prompt.trim()) return;

        const newSettings = generateProfile(prompt);
        onSettingsChange(newSettings);
        
        setFlashing(true);
        setTimeout(() => setFlashing(false), 800);
    };

    const getShapeIcon = (shape: ShapeType) => {
        switch(shape) {
            case 'spirograph': return <Aperture size={14} className="text-accent" />;
            case 'rose': return <Flower2 size={14} className="text-accent" />;
            case 'torus': return <Orbit size={14} className="text-accent" />;
            case 'lattice': return <Grid size={14} className="text-accent" />;
            case 'vortex': return <Tornado size={14} className="text-accent" />;
            case 'supernova': return <Sun size={14} className="text-accent" />;
            default: return <Box size={14} className="text-accent" />;
        }
    };

    const getShapeLabel = (shape: ShapeType) => {
        switch(shape) {
            case 'spirograph': return 'Spirograph';
            case 'rose': return 'Rose Curve';
            case 'torus': return 'Torus Knot';
            case 'lattice': return 'Liquid Grid';
            case 'vortex': return 'Spiral Vortex';
            case 'supernova': return 'Supernova';
            default: return shape;
        }
    };

    return (
        <div className="w-full lg:w-80 bg-panel border-l border-gray-800 flex flex-col h-auto lg:h-full z-10 shadow-2xl overflow-y-auto">
            <div className="p-6 border-b border-gray-800">
                <div className="flex items-center gap-3 mb-2">
                    <div className="relative">
                        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
                    </div>
                    <h1 className="text-lg font-bold tracking-widest text-accent uppercase font-mono">
                        Neuro-Fluid
                    </h1>
                </div>
                <p className="text-xs text-gray-500">Personality Pattern Engine</p>
            </div>

            <div className="p-6 space-y-8 flex-1">
                {/* Personality Injector */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Cpu size={14} /> System Personality
                        </label>
                        {/* Current Shape Indicator */}
                        <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded border border-gray-700 shadow-sm">
                             {getShapeIcon(settings.shape)}
                             <span className="text-[10px] font-mono text-gray-300 uppercase">{getShapeLabel(settings.shape)}</span>
                        </div>
                    </div>

                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Paste personality prompt here..."
                        className="w-full bg-surface border border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none h-24 placeholder-gray-600"
                    />
                    <button
                        onClick={handleInject}
                        className={`w-full py-2.5 px-4 rounded-lg text-sm font-bold uppercase tracking-wide transition-all transform active:scale-95 ${
                            flashing 
                            ? 'bg-indigo-500 text-white' 
                            : 'bg-accent hover:bg-accent-hover text-white'
                        }`}
                    >
                        {flashing ? 'Profile Generated' : 'Generate Profile'}
                    </button>
                </div>

                {/* Field Dynamics */}
                <div className="space-y-6">
                    <div className="pb-2 border-b border-gray-800 text-xs font-bold text-gray-300 uppercase">
                        Equation Parameters
                    </div>

                    <SliderControl 
                        label="Complexity" 
                        icon={<Activity size={14} />}
                        value={settings.entropy} 
                        onChange={(v) => handleChange('entropy', v)} 
                        min={0.1} max={3.0} step={0.1} 
                    />
                    <SliderControl 
                        label="Flux Speed" 
                        icon={<Zap size={14} />}
                        value={settings.speed} 
                        onChange={(v) => handleChange('speed', v)} 
                        min={0} max={3} step={0.1} 
                    />
                    <SliderControl 
                        label="Trail Fade" 
                        icon={<Wind size={14} />}
                        value={settings.decay} 
                        onChange={(v) => handleChange('decay', v)} 
                        min={0.5} max={0.99} step={0.01} 
                    />
                    <SliderControl 
                        label="Particle Density" 
                        icon={<Droplets size={14} />}
                        value={settings.count} 
                        onChange={(v) => handleChange('count', v)} 
                        min={500} max={5000} step={100} 
                        format={(v) => v.toFixed(0)}
                    />
                </div>

                {/* Visual Aesthetics */}
                <div className="space-y-6">
                    <div className="pb-2 border-b border-gray-800 text-xs font-bold text-gray-300 uppercase">
                        Visual Aesthetics
                    </div>

                    <SliderControl 
                        label="Base Hue" 
                        icon={<Palette size={14} />}
                        value={settings.hue} 
                        onChange={(v) => handleChange('hue', v)} 
                        min={0} max={360} step={1} 
                        format={(v) => v.toFixed(0)}
                    />
                    <SliderControl 
                        label="Color Shift" 
                        icon={<Palette size={14} className="opacity-50" />}
                        value={settings.hueVar} 
                        onChange={(v) => handleChange('hueVar', v)} 
                        min={0} max={180} step={1} 
                        format={(v) => v.toFixed(0)}
                    />
                    <SliderControl 
                        label="Mesh Connect" 
                        icon={<Plus size={14} />}
                        value={settings.connect} 
                        onChange={(v) => handleChange('connect', v)} 
                        min={0} max={100} step={1} 
                        format={(v) => v.toFixed(0)}
                    />
                    <SliderControl 
                        label="Scale" 
                        icon={<Maximize size={14} />}
                        value={settings.zoom} 
                        onChange={(v) => handleChange('zoom', v)} 
                        min={0.5} max={2.0} step={0.1} 
                        format={(v) => v.toFixed(1)}
                    />
                </div>
            </div>
            
            <div className="p-4 border-t border-gray-800 text-[10px] text-gray-600 font-mono text-center">
                v2.1.0 • SPIROGRAPH ENGINE
            </div>
        </div>
    );
};

interface SliderControlProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    min: number;
    max: number;
    step: number;
    format?: (val: number) => string;
    icon?: React.ReactNode;
}

const SliderControl: React.FC<SliderControlProps> = ({ 
    label, value, onChange, min, max, step, format, icon 
}) => {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-2">
                    {icon && <span className="text-gray-600">{icon}</span>}
                    {label}
                </label>
                <span className="font-mono text-xs text-accent">
                    {format ? format(value) : value.toFixed(2)}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer hover:bg-gray-600 focus:outline-none focus:bg-gray-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
            />
        </div>
    );
};

export default Sidebar;
