
import React, { useState, useEffect } from 'react';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import { SimulationSettings, DEFAULT_SETTINGS } from './types';
import { generateProfile } from './utils/math';

function App() {
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Check for "personality" or "prompt" query params to simulate Supabase connection
    const params = new URLSearchParams(window.location.search);
    const personality = params.get('personality') || params.get('prompt');

    if (personality) {
      console.log('Injecting Personality:', personality);
      const newSettings = generateProfile(personality);
      setSettings(newSettings);
    }
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full overflow-hidden bg-surface text-gray-100">
      
      {/* Simulation Layer - Occupies full space, pushed by sidebar on desktop */}
      <div className="flex-grow relative h-[60vh] lg:h-full order-1 lg:order-1">
         <Canvas settings={settings} />
         
         {/* Mobile overlay title just in case Sidebar is scrolled out of view */}
         <div className="absolute top-4 left-4 lg:hidden pointer-events-none opacity-50">
             <h1 className="text-xs font-bold text-accent uppercase tracking-widest">Neuro-Fluid</h1>
         </div>
      </div>

      {/* Controls Layer */}
      <div className="h-[40vh] lg:h-full lg:w-auto order-2 lg:order-2 flex-shrink-0 z-20">
        <Sidebar 
          settings={settings} 
          onSettingsChange={setSettings} 
        />
      </div>

    </div>
  );
}

export default App;
