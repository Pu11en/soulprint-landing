export type ShapeType = 'rose' | 'torus' | 'lattice' | 'vortex' | 'supernova' | 'spirograph';

export interface SimulationSettings {
  entropy: number;  // Controls Complexity / Frequency / Modifiers
  speed: number;    // Rotation / Animation Speed
  decay: number;    // Trail fade (0.5 - 0.99)
  count: number;    // Particle count
  hue: number;      // Base hue (0-360)
  hueVar: number;   // Hue variance
  connect: number;  // Connection distance (0-100)
  zoom: number;     // Scale of the pattern
  shape: ShapeType; // The parametric equation
}

export const DEFAULT_SETTINGS: SimulationSettings = {
  entropy: 1.0,     
  speed: 1.0,       
  decay: 0.82,      // Low decay for clear trails
  count: 3000,      // High count for dense lines
  hue: 200,
  hueVar: 50,       
  connect: 45,      // High connectivity for wireframe look
  zoom: 1.0,        
  shape: 'spirograph'
};
