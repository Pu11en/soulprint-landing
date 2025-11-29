import { SimulationSettings } from './types';

class Particle {
    x: number = 0;
    y: number = 0;
    index: number;
    normalizedIndex: number;
    
    constructor(index: number, total: number) {
        this.index = index;
        this.normalizedIndex = index / total;
    }

    update(time: number, width: number, height: number, settings: SimulationSettings) {
        const cx = width / 2;
        const cy = height / 2;
        const minDim = Math.min(width, height);
        const scale = (minDim * 0.35) * settings.zoom; 
        
        let px = 0;
        let py = 0;

        const t = time * 0.0005 * settings.speed;
        const i = this.normalizedIndex;

        switch (settings.shape) {
            case 'spirograph': {
                const R = scale;
                const ratioVar = (settings.entropy * 10) % 5 + 1;
                const r = scale * (1 / (ratioVar + 0.5));
                const d = scale * (0.5 + (settings.hueVar / 180));
                const theta = i * Math.PI * 2 * (10 + Math.floor(settings.entropy * 5)) + t * 0.1;
                const diff = R - r;
                const ratio = diff / r;
                
                px = diff * Math.cos(theta) + d * Math.cos(ratio * theta);
                py = diff * Math.sin(theta) - d * Math.sin(ratio * theta);
                
                const rot = t * 0.2;
                const rx = px * Math.cos(rot) - py * Math.sin(rot);
                const ry = px * Math.sin(rot) + py * Math.cos(rot);
                px = rx; py = ry;
                break;
            }
            case 'rose': {
                const k = 2 + Math.floor(settings.entropy * 5); 
                const theta = i * Math.PI * 2 * k + t;
                const radius = scale * Math.cos(k * theta) * (1 + Math.sin(t * 0.5) * 0.1);
                
                px = Math.cos(theta + t) * radius;
                py = Math.sin(theta + t) * radius;
                break;
            }
            case 'torus': {
                const windings = 5 + Math.floor(settings.entropy * 10);
                const theta = i * Math.PI * 2 * windings + t;
                const phi = i * Math.PI * 2 + t * 0.5;
                
                const R = scale * 0.8;
                const r = scale * 0.4 * Math.sin(t * 0.2 + i * Math.PI);
                
                px = (R + r * Math.cos(theta)) * Math.cos(phi);
                py = (R + r * Math.cos(theta)) * Math.sin(phi);
                break;
            }
            case 'lattice': {
                const gridSize = Math.ceil(Math.sqrt(settings.count));
                const row = Math.floor(this.index / gridSize);
                const col = this.index % gridSize;
                
                const u = (col / gridSize - 0.5) * 2;
                const v = (row / gridSize - 0.5) * 2;
                const dist = Math.sqrt(u*u + v*v);
                const wave = Math.sin(dist * 10 * settings.entropy - t * 2);
                
                const finalScale = scale * 1.5;
                px = u * finalScale * (1 + wave * 0.2);
                py = v * finalScale * (1 + wave * 0.2);
                
                const rot = t * 0.2;
                const rx = px * Math.cos(rot) - py * Math.sin(rot);
                const ry = px * Math.sin(rot) + py * Math.cos(rot);
                px = rx; py = ry;
                break;
            }
            case 'vortex': {
                const arms = 3 + Math.floor(settings.entropy * 3);
                const spin = t * 2;
                const r = i * scale * 1.5;
                const angle = (Math.log(r + 1) * arms) + spin + (i * Math.PI * 2 * arms);
                
                px = Math.cos(angle) * r;
                py = Math.sin(angle) * r;
                break;
            }
            case 'supernova':
            default: {
                const layers = 5;
                const layer = Math.floor(i * layers);
                const layerIdx = (i * layers) % 1;
                
                const rBase = scale * (0.2 + layer * 0.2);
                const theta = layerIdx * Math.PI * 2;
                const spikes = 10 * settings.entropy;
                const r = rBase + Math.sin(theta * spikes + t * (layer+1)) * (scale * 0.1);
                
                px = Math.cos(theta + t * (layer % 2 === 0 ? 1 : -1)) * r;
                py = Math.sin(theta + t) * r;
                break;
            }
        }

        this.x = cx + px;
        this.y = cy + py;
    }
}

export class NeuroFluidEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private particles: Particle[] = [];
    private animationId: number = 0;
    private width: number = 0;
    private height: number = 0;
    private settings: SimulationSettings;

    constructor(canvas: HTMLCanvasElement, initialSettings: SimulationSettings) {
        this.canvas = canvas;
        const context = canvas.getContext('2d', { alpha: false }); 
        if (!context) throw new Error("Could not get 2D context");
        this.ctx = context;
        this.settings = initialSettings;
        this.resize();
        this.initParticles();
    }

    public updateSettings(newSettings: SimulationSettings) {
        const countChanged = newSettings.count !== this.settings.count;
        this.settings = newSettings;
        
        if (countChanged) {
            this.initParticles();
        }
    }

    public resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    private initParticles() {
        this.particles = [];
        for(let i = 0; i < this.settings.count; i++) {
            this.particles.push(new Particle(i, this.settings.count));
        }
    }

    public start() {
        const animate = (time: number) => {
            this.draw(time);
            this.animationId = requestAnimationFrame(animate);
        };
        this.stop(); 
        requestAnimationFrame(animate);
    }

    public stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = 0;
        }
    }

    private draw(time: number) {
        // Trail effect
        this.ctx.fillStyle = `rgba(15, 17, 21, ${1 - this.settings.decay})`;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Update & Draw Particles
        for(const p of this.particles) {
            const particleHue = (this.settings.hue + p.normalizedIndex * this.settings.hueVar) % 360;
            p.update(time, this.width, this.height, this.settings);
            
            this.ctx.fillStyle = `hsla(${particleHue}, 70%, 60%, 0.8)`;
            this.ctx.fillRect(p.x, p.y, 1, 1);
        }

        // Connect the dots to form the mesh/wireframe
        if (this.settings.connect > 0) {
            this.ctx.lineWidth = 0.5;
            this.ctx.beginPath();
            
            const pLength = this.particles.length;
            
            // Ribbon connections
            this.ctx.strokeStyle = `hsla(${this.settings.hue}, 50%, 60%, 0.4)`;
            for (let i = 0; i < pLength - 1; i++) {
                 const p1 = this.particles[i];
                 const p2 = this.particles[i+1];
                 const dx = p1.x - p2.x;
                 const dy = p1.y - p2.y;
                 if (dx*dx + dy*dy < 5000) {
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                 }
            }

            // Mesh connections
            const lookAhead = 20; 
            for (let i = 0; i < pLength; i+=3) {
                 const p1 = this.particles[i];
                 for(let j = 1; j < lookAhead; j++) {
                     const idx2 = (i + j * 5) % pLength;
                     const p2 = this.particles[idx2];
                     const dx = p1.x - p2.x;
                     const dy = p1.y - p2.y;
                     const distSq = dx*dx + dy*dy;
                     const threshSq = this.settings.connect * this.settings.connect;
                     
                     if (distSq < threshSq) {
                         this.ctx.moveTo(p1.x, p1.y);
                         this.ctx.lineTo(p2.x, p2.y);
                     }
                 }
            }
            this.ctx.stroke();
        }
    }
}
