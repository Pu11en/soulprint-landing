
import { SimulationSettings, ShapeType } from '../types';

// --- Simplex Noise Simplified (2D) ---
// A fast pseudo-random noise generator ported for TypeScript

const perm = new Uint8Array(512);
const p = new Uint8Array(256);

// Initialize permutation table
for (let i = 0; i < 256; i++) p[i] = i;

// Fisher-Yates shuffle
let seedVal = 1;
const random = () => {
    const x = Math.sin(seedVal++) * 10000;
    return x - Math.floor(x);
};

for (let i = 255; i > 0; i--) {
    const r = Math.floor(random() * (i + 1));
    [p[i], p[r]] = [p[r], p[i]];
}
for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t: number, a: number, b: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : 0);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function fastNoise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const A = perm[X] + Y;
    const B = perm[X + 1] + Y;
    return lerp(v, lerp(u, grad(perm[A], x, y), grad(perm[B], x - 1, y)),
                   lerp(u, grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1)));
}

// --- Personality / PRNG Logic ---

export function stringToSeed(str: string): number {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// Mulberry32 PRNG
export function mulberry32(a: number) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Helper to map 0-1 range to min-max
export function mapRange(val: number, min: number, max: number) {
    return min + val * (max - min);
}

// Helper for integers
export function mapInt(val: number, min: number, max: number) {
    return Math.floor(mapRange(val, min, max + 0.99));
}

// --- Generator ---

export function generateProfile(prompt: string): SimulationSettings {
    const seed = stringToSeed(prompt);
    const rng = mulberry32(seed);
    const map = (min: number, max: number) => mapRange(rng(), min, max);

    // Deterministic Pattern Selection
    // We prioritize spirographs for complex prompts
    const shapeIndex = mapInt(rng(), 0, 5);
    const shapes: ShapeType[] = ['spirograph', 'rose', 'torus', 'lattice', 'vortex', 'supernova'];
    const selectedShape = shapes[shapeIndex];

    return {
        entropy: map(0.5, 2.5), // Complexity factor
        speed: map(0.5, 2.0),   // Animation speed
        decay: map(0.75, 0.92), // Trail persistence
        count: Math.floor(map(2000, 4000)),
        hue: Math.floor(map(0, 360)),
        hueVar: map(30, 90),
        connect: map(30, 60),
        zoom: map(0.8, 1.2),
        shape: selectedShape
    };
}
