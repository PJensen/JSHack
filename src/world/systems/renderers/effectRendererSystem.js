// Effect Renderer System
// Responsible for rendering effects (particles, animations, etc.)
// Assumes existence of effect, position, and visibility components

import { getRenderContext } from './renderingUtils.js';
import { Effect } from '../../components/Effect.js';
import { getGlobalParticlePool } from '../../effects/particlePool.js';

// Draw float text effects and leave hooks for other effect types
export function renderEffectsSystem(world){
    const rc = getRenderContext(world);
    if (!rc) return;
    const { ctx, W, H, cellW, cellH, canvas } = rc;

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Camera reference. Many renderers keep camera on world or RenderContext
    const cam = world.camera || world.cam || null;

    for (const [id, eff] of world.query(Effect)){
        if (!eff.type) continue;
        if (eff.type === 'float_text'){
            const d = eff.data || {};
            const pos = eff.pos || d.pos || { x:0, y:0 };
            // Convert world tile to screen pixels (center)
            const sx = (pos.x - (rc.camX || 0)) * cellW + cellW/2;
            const sy = (pos.y - (rc.camY || 0)) * cellH + cellH/2;
            // Cull if offscreen (with small margin)
            if (sx < -40 || sy < -40 || sx > canvas.width + 40 || sy > canvas.height + 40) continue;

            const ttl = eff.ttl || 0;
            const ttlMax = eff.ttlMax || 1;
            const lin = Math.max(0, ttl / ttlMax);
            const alpha = lin * lin; // quadratic fade
            const t = 1 - lin; // progress

            const scaleStart = (d.scaleStart !== undefined) ? d.scaleStart : 1.0;
            const scaleEnd = (d.scaleEnd !== undefined) ? d.scaleEnd : 0.75;
            const scale = scaleStart + (scaleEnd - scaleStart) * t;

            const fontPx = Math.max(10, Math.round((cellH - 8) * scale));
            ctx.globalAlpha = alpha;
            ctx.font = `${fontPx}px monospace`;
            ctx.fillStyle = d.color || '#ffffff';
            ctx.fillText(d.text || '', sx, sy);
            ctx.globalAlpha = 1.0;
        }
        // Other effect types (particle_burst, lightning, ripple) to be added
    }

    // Render pooled particles (non-ECS entities)
    const particlePool = getGlobalParticlePool();
    if (particlePool && particlePool.count > 0) {
        particlePool.forEach(p => {
            if (!p.alive) return;
            
            // Convert world coordinates to screen pixels
            const sx = (p.x - (rc.camX || 0)) * cellW + cellW / 2;
            const sy = (p.y - (rc.camY || 0)) * cellH + cellH / 2;
            
            // Cull particles outside viewport (with margin)
            if (sx < -40 || sy < -40 || sx > canvas.width + 40 || sy > canvas.height + 40) {
                return;
            }
            
            // Calculate fade based on lifetime
            const lifeRatio = Math.max(0, Math.min(1, p.life / p.lifeMax));
            const progress = 1 - lifeRatio; // 0 at birth, 1 at death
            
            // Interpolate size
            const currentSize = p.size + (p.sizeEnd - p.size) * progress;
            const pixelSize = Math.max(1, Math.round(currentSize * cellH * 0.5));
            
            // Calculate alpha
            const alpha = lifeRatio * (p.alpha || 1.0);
            
            // Apply rotation if needed
            const hasRotation = p.rotation !== 0 || p.rotationSpeed !== 0;
            
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color || '#ffffff';
            
            if (hasRotation) {
                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(p.rotation);
                ctx.fillRect(-pixelSize / 2, -pixelSize / 2, pixelSize, pixelSize);
                ctx.restore();
            } else {
                // Simple non-rotated rectangle
                ctx.fillRect(
                    Math.round(sx - pixelSize / 2),
                    Math.round(sy - pixelSize / 2),
                    pixelSize,
                    pixelSize
                );
            }
            
            ctx.globalAlpha = 1.0;
        });
    }

        // Render global particle system if present on the RenderContext (legacy support)
        const ps = rc.particleSystem || null;
        if (ps){
            // assume particles are in world coordinates (tile coords)
            ps.forEach(p => {
                if (!p.alive) return;
                const sx = (p.x - (rc.camX || 0)) * cellW + cellW/2;
                const sy = (p.y - (rc.camY || 0)) * cellH + cellH/2;
                // cull small margin
                if (sx < -40 || sy < -40 || sx > canvas.width + 40 || sy > canvas.height + 40) return;

                const life = Math.max(0, p.life || 0);
                const lifeMax = p.lifeMax || 1;
                const t = 1 - (life / lifeMax); // progress 0..1
                const alpha = Math.max(0, Math.min(1, life / lifeMax));
                const size = (p.size || 1) + ((p.sizeEnd || p.size) - (p.size || 1)) * t;
                const px = Math.max(1, Math.round(size * cellH * 0.5));

                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color || '#ffffff';
                // draw a filled rectangle centered
                ctx.fillRect(Math.round(sx - px/2), Math.round(sy - px/2), px, px);
                ctx.globalAlpha = 1.0;
            });
        }

    ctx.restore();
}
