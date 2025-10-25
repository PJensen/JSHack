// Hallucination Post-Processing Renderer
// Applies wild screen-space distortions when a Hallucination component is present.
// READONLY: reads world state and draws using Canvas2D; no ECS mutations.
import { getRenderContext } from '../utils.js';
import { Hallucination } from '../../../components/Hallucination.js';
import { DevState } from '../../../components/DevState.js';

function clamp01(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }

export function hallucinationPostProcessRenderer(world){
  const rc = getRenderContext(world);
  if (!rc) return;
  const srcCanvas = rc.backCanvas || rc.canvas;
  const dstCtx = rc.presentCtx || rc.ctx;
  const dstCanvas = rc.presentCanvas || rc.canvas;
  if (!srcCanvas || !dstCtx || !dstCanvas) return;

  // Find maximum intensity across Hallucination components (typically on the player)
  let H = null; let maxIntensity = 0;
  for (const [id, h] of world.query(Hallucination)){
    if (h && h.intensity > maxIntensity){ maxIntensity = h.intensity; H = h; }
  }
  if (!H || maxIntensity <= 0.001){
    // No effect: simply present the backbuffer to the screen (single blit)
    dstCtx.save();
    dstCtx.globalAlpha = 1.0;
    dstCtx.globalCompositeOperation = 'source-over';
    dstCtx.filter = 'none';
    const Wcss = rc.W || dstCanvas.width;
    const Hcss = rc.H || dstCanvas.height;
    dstCtx.drawImage(srcCanvas, 0, 0, Wcss, Hcss);
    dstCtx.restore();
    return;
  }

  // Determine quality from DevState.effectQuality or auto based on size
  let quality = 'auto';
  for (const [id, dev] of world.query(DevState)){ if (dev && dev.effectQuality) { quality = dev.effectQuality; break; } }

  const Wcss = rc.W || dstCanvas.width; // CSS pixels
  const Hcss = rc.H || dstCanvas.height;
  const Wpx = dstCanvas.width;   // backing pixels
  const Hpx = dstCanvas.height;  // backing pixels
  const dpr = Math.max(1e-6, Wpx / Math.max(1, Wcss));

  // Parameters derived from intensity and profile (compute early; used by tiering)
  const I = clamp01(maxIntensity);
  const hueDeg = (H.hueMaxDeg || 0) * I;
  const satBoost = 1 + ((H.saturationBoost || 1) - 1) * I;
  const aberrPx = (H.aberrationMaxPx || 0) * I;
  const wobbleFreq = Math.max(0.1, H.wobbleFreqHz || 1.2);
  const wobbleAmpCss = (H.wobbleAmpPx || 0) * (0.5 + 0.5 * I);
  const vignette = clamp01(H.vignetteStrength || 0) * I;
  const kaleidoOn = I >= (H.kaleidoAt || 0.65);

  // Compute adaptive quality tier
  const areaCss = Wcss * Hcss;
  let tier = 'high';
  if (quality === 'low') tier = 'low';
  else if (quality === 'medium') tier = 'medium';
  else { // auto
    if (areaCss > 1_200_000) tier = 'low';
    else if (areaCss > 700_000) tier = 'medium';
    else tier = (I < 0.25) ? 'low' : (I < 0.6 ? 'medium' : 'high');
  }

  // Prepare present context for re-draw of distorted image
  const t = world.time;
  const speed = 2.0 * wobbleFreq;
  dstCtx.save();
  dstCtx.globalAlpha = 1.0;
  dstCtx.globalCompositeOperation = 'source-over';
  dstCtx.filter = 'none';

  const cheapJitter = Math.sin(t * speed) * wobbleAmpCss;

  if (tier === 'low'){
    // Single draw with filter + small translate = very cheap
    dstCtx.save();
    dstCtx.translate(cheapJitter, 0);
    dstCtx.filter = `hue-rotate(${hueDeg.toFixed(1)}deg) saturate(${satBoost.toFixed(3)})`;
    dstCtx.drawImage(srcCanvas, 0, 0, Wcss, Hcss);
    dstCtx.restore();
  } else {
    // Medium/High: stripe distortion
    const minStripe = (tier === 'high') ? 4 : 8; // CSS px
    const stripeCss = Math.max(minStripe, Math.round(minStripe * (1.0 - 0.5 * I)));
    const stripePx = Math.max(1, Math.round(stripeCss * dpr));
    const maxStripes = (tier === 'high') ? 180 : 120;
    const stepCss = Math.max(stripeCss, Math.ceil(Hcss / Math.max(1, maxStripes)));

    dstCtx.filter = `saturate(${satBoost.toFixed(3)})`;
    for (let yCss = 0; yCss < Hcss; yCss += stepCss){
      const srcY = Math.min(Hpx - stripePx, Math.max(0, Math.round(yCss * dpr)));
      const phase = (yCss / Hcss) * Math.PI * 2 * wobbleFreq + t * speed;
      const dxCss = Math.sin(phase) * wobbleAmpCss;
      dstCtx.drawImage(
        srcCanvas,
        0, srcY, Wpx, stripePx,
        dxCss, yCss, Wcss, stepCss
      );
    }

    // Chromatic shimmer overlays (reduced in medium)
    if (aberrPx > 0.5){
      const shift = aberrPx;
      const passes = (tier === 'high') ? [
        { dx: +shift, hue: +hueDeg, sat: 1.0 + 0.2 * I },
        { dx: -shift, hue: -hueDeg, sat: 1.0 + 0.2 * I }
      ] : [
        { dx: +shift * 0.8, hue: +hueDeg * 0.5, sat: 1.0 + 0.1 * I }
      ];
      const prev = dstCtx.globalCompositeOperation;
      dstCtx.globalCompositeOperation = 'lighter';
      dstCtx.globalAlpha = (tier === 'high') ? (0.35 + 0.25 * I) : (0.25 + 0.15 * I);
      for (const p of passes){
        dstCtx.filter = `hue-rotate(${p.hue.toFixed(1)}deg) saturate(${(satBoost*p.sat).toFixed(3)})`;
        for (let yCss = 0; yCss < Hcss; yCss += stepCss){
          const srcY = Math.min(Hpx - stripePx, Math.max(0, Math.round(yCss * dpr)));
          dstCtx.drawImage(
            srcCanvas,
            0, srcY, Wpx, stripePx,
            p.dx, yCss, Wcss, stepCss
          );
        }
      }
      dstCtx.globalCompositeOperation = prev;
      dstCtx.globalAlpha = 1.0;
    }

    // Kaleidoscope only in high tier and when above threshold
    if (tier === 'high' && kaleidoOn){
      const kAlpha = (I - (H.kaleidoAt || 0.65)) * 0.6;
      if (kAlpha > 0.02){
        const cx = Wcss * 0.5, cy = Hcss * 0.5;
        dstCtx.save();
        dstCtx.translate(cx, cy);
        dstCtx.globalAlpha = Math.min(0.7, kAlpha);
        const segs = 3;
        const scale = 0.65 + 0.12 * Math.sin(t * 1.1);
        for (let i=0;i<segs;i++){
          dstCtx.save();
          dstCtx.rotate((i * Math.PI * 2) / segs + Math.sin(t * 0.8 + i) * 0.12 * I);
          dstCtx.scale(scale, scale);
          dstCtx.drawImage(srcCanvas, -cx, -cy, Wcss, Hcss);
          dstCtx.restore();
        }
        dstCtx.restore();
      }
    }
  }

  // Vignette breathing with intensity
  if (vignette > 0.001){
    const gx = dstCtx.createRadialGradient(Wcss*0.5, Hcss*0.5, Math.min(Wcss,Hcss)*0.2, Wcss*0.5, Hcss*0.5, Math.max(Wcss,Hcss)*0.75);
    const edge = clamp01(0.75 + 0.2 * Math.sin(t * 0.7));
    gx.addColorStop(0.0, `rgba(255,255,255,0)`);
    gx.addColorStop(edge, `rgba(255,255,255,0)`);
    gx.addColorStop(1.0, `rgba(0,0,0,${(0.6*vignette).toFixed(3)})`);
    const prevOp = dstCtx.globalCompositeOperation;
    dstCtx.globalCompositeOperation = 'multiply';
    dstCtx.fillStyle = gx;
    dstCtx.fillRect(0, 0, Wcss, Hcss);
    dstCtx.globalCompositeOperation = prevOp;
  }

  dstCtx.filter = 'none';
  dstCtx.restore();
}
