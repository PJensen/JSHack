// display/ui/debugGraph.js
// Generic debug graph factory — creates self-contained canvas overlays
// that render multi-series time-series line graphs.
//
// Usage:
//   const graph = createDebugGraph({ id, title, series, sampler, ... });
//   root.appendChild(graph.canvas);
//   graph.show(); graph.startSampling();
//
// All state is closure-scoped: multiple graphs coexist independently.

/**
 * @typedef {{key: string, color: string, label: string}} SeriesDef
 *
 * @typedef {object} DebugGraphConfig
 * @property {string} id - Canvas element id
 * @property {string} title - Title label (top-left)
 * @property {number} [width=240] - CSS width in px
 * @property {number} [height=140] - CSS height in px
 * @property {{[k:string]: string}} [position] - CSS position props, e.g. {left:'8px', bottom:'56px'}
 * @property {number} [zIndex=910]
 * @property {SeriesDef[]} series - Line series definitions
 * @property {number} [maxPoints=100]
 * @property {number} [sampleInterval=500] - ms between poll samples
 * @property {(() => object|null)|null} [sampler=null] - Poll function; return null = unavailable
 * @property {string|null} [unavailableMessage=null] - Shown when sampler returns null
 * @property {boolean} [normalizedY=false] - true → Y axis fixed 0..1; false → auto-scale
 */

/**
 * Create a debug graph overlay.
 * @param {DebugGraphConfig} config
 */
export function createDebugGraph(config) {
  const {
    id,
    title,
    width = 240,
    height = 140,
    position = { left: '8px', bottom: '56px' },
    zIndex = 910,
    series,
    maxPoints = 100,
    sampleInterval = 500,
    unavailableMessage = null,
    normalizedY = false,
  } = config;

  let sampler = config.sampler ?? null;
  let canvas = null;
  let ctx = null;
  let dataPoints = [];
  let samplingInterval = null;
  let needsRedraw = false;
  let animFrameId = null;

  // ── Canvas creation ──────────────────────────────────────────────

  canvas = document.createElement('canvas');
  canvas.id = id;

  const posStyle = {};
  for (const [k, v] of Object.entries(position)) posStyle[k] = v;

  Object.assign(canvas.style, {
    position: 'fixed',
    width: width + 'px',
    height: height + 'px',
    pointerEvents: 'auto',
    zIndex: String(zIndex),
    display: 'none',
    borderRadius: '6px',
    overflow: 'hidden',
    ...posStyle,
  });

  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);

  // ── DPR-aware resize ─────────────────────────────────────────────

  function resize() {
    if (!canvas || !ctx) return;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    needsRedraw = true;
  }

  // ── Drawing ──────────────────────────────────────────────────────

  function draw() {
    if (!ctx || !canvas) return;

    const w = width;
    const h = height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(10, 14, 22, 0.75)';
    ctx.fillRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = '#2d3b52';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // No data → show unavailable message
    if (dataPoints.length === 0) {
      if (unavailableMessage) {
        ctx.fillStyle = '#cfe8ff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.9;
        const lines = unavailableMessage.split('\n');
        const lineH = 14;
        const startY = h / 2 - ((lines.length - 1) * lineH) / 2;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], w / 2, startY + i * lineH);
        }
        ctx.globalAlpha = 1.0;
      }
      return;
    }

    // Graph area (with padding)
    const gx = 10;
    const gy = 25;
    const gw = w - 20;
    const gh = h - 50;

    // Y-axis scale
    let maxVal;
    if (normalizedY) {
      maxVal = 1;
    } else {
      maxVal = 0;
      for (const p of dataPoints) {
        for (const s of series) {
          const v = p[s.key] ?? 0;
          if (v > maxVal) maxVal = v;
        }
      }
      maxVal = maxVal * 1.1 || 1; // 10% headroom, avoid zero
    }

    // Grid lines (4 horizontal)
    ctx.strokeStyle = 'rgba(45, 59, 82, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = gy + (gh * i / 4);
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + gw, y);
      ctx.stroke();
    }

    // Draw each series
    if (dataPoints.length > 1) {
      for (const s of series) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < dataPoints.length; i++) {
          const val = dataPoints[i][s.key] ?? 0;
          const x = gx + (gw * i / (maxPoints - 1));
          const y = gy + gh - (gh * (val / maxVal));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Title (top-left)
    ctx.fillStyle = '#cfe8ff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.9;
    ctx.fillText(title, 10, 15);

    // [Esc] hint (top-right)
    ctx.textAlign = 'right';
    ctx.fillText('[Esc]', w - 10, 15);

    // Current values (bottom row)
    const latest = dataPoints[dataPoints.length - 1];
    const labelW = gw / series.length;
    ctx.font = '9px monospace';
    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      ctx.fillStyle = s.color;
      ctx.textAlign = 'center';
      const val = (latest[s.key] ?? 0).toFixed(2);
      const abbr = s.label.slice(0, 2).toLowerCase();
      ctx.fillText(`${abbr}:${val}`, gx + labelW * (i + 0.5), h - 8);
    }

    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';
  }

  // ── Animation loop ───────────────────────────────────────────────

  function animate() {
    if (needsRedraw) {
      draw();
      needsRedraw = false;
    }
    if (samplingInterval !== null) {
      animFrameId = requestAnimationFrame(animate);
    }
  }

  // ── Sampling ─────────────────────────────────────────────────────

  function doSample() {
    if (!sampler) return;
    const data = sampler();
    if (data === null || data === undefined) return;
    pushSample(data);
  }

  function startSampling() {
    if (samplingInterval !== null) return;
    // Take an initial sample
    doSample();
    samplingInterval = setInterval(doSample, sampleInterval);
    animate();
  }

  function stopSampling() {
    if (samplingInterval !== null) {
      clearInterval(samplingInterval);
      samplingInterval = null;
    }
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    dataPoints = [];
  }

  // ── Push API (for external data sources) ─────────────────────────

  function pushSample(data) {
    dataPoints.push(data);
    if (dataPoints.length > maxPoints) dataPoints.shift();
    needsRedraw = true;
  }

  // ── Show / Hide ──────────────────────────────────────────────────

  function show() { if (canvas) canvas.style.display = 'block'; }
  function hide() { if (canvas) canvas.style.display = 'none'; }

  // ── Late-bind sampler ────────────────────────────────────────────

  function setSampler(fn) { sampler = fn; }

  return { canvas, show, hide, startSampling, stopSampling, pushSample, setSampler };
}
