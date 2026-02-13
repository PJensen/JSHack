// Real-time memory graph visualization
// Shows JavaScript heap usage over time with a line graph

const MAX_POINTS = 100; // 50 seconds of history at 2Hz
const SAMPLE_INTERVAL = 500; // ms (2Hz)

let _canvas = null;
let _ctx = null;
let _dataPoints = [];
let _samplingInterval = null;
let _needsRedraw = false;
let _animationFrameId = null;

/**
 * Samples current memory usage from performance.memory API
 * @returns {{used: number, total: number, available: boolean}}
 */
function sampleMemory() {
  if (!performance.memory) {
    return { used: 0, total: 0, available: false };
  }

  const used = performance.memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
  const total = performance.memory.totalJSHeapSize / (1024 * 1024);

  return {
    used,
    total,
    available: true,
    timestamp: Date.now()
  };
}

/**
 * Renders the memory graph to canvas
 */
function draw() {
  if (!_ctx || !_canvas) return;

  const w = 240;
  const h = 140;

  // Clear canvas
  _ctx.clearRect(0, 0, w, h);

  // Draw background box
  _ctx.fillStyle = 'rgba(10, 14, 22, 0.75)';
  _ctx.fillRect(0, 0, w, h);

  // Draw border
  _ctx.strokeStyle = '#2d3b52';
  _ctx.lineWidth = 1;
  _ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  // Check if memory API is available
  if (_dataPoints.length === 0 || !_dataPoints[0].available) {
    // Show fallback message
    _ctx.fillStyle = '#cfe8ff';
    _ctx.font = '11px monospace';
    _ctx.textAlign = 'center';
    _ctx.globalAlpha = 0.9;
    _ctx.fillText('Memory API not available', w / 2, h / 2 - 10);
    _ctx.font = '10px monospace';
    _ctx.fillText('(Chrome/Edge only)', w / 2, h / 2 + 10);
    _ctx.globalAlpha = 1.0;
    return;
  }

  // Graph area dimensions (with padding)
  const gx = 10;
  const gy = 25;
  const gw = w - 20;
  const gh = h - 50;

  // Determine Y-axis scale (max of all data points, add 10% headroom)
  const maxVal = Math.max(..._dataPoints.map(p => Math.max(p.used, p.total))) * 1.1;

  if (maxVal === 0) return; // No data to display

  // Draw subtle grid lines (4 horizontal lines)
  _ctx.strokeStyle = 'rgba(45, 59, 82, 0.3)';
  _ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = gy + (gh * i / 4);
    _ctx.beginPath();
    _ctx.moveTo(gx, y);
    _ctx.lineTo(gx + gw, y);
    _ctx.stroke();
  }

  // Draw total heap line (background, faded)
  if (_dataPoints.length > 1) {
    _ctx.strokeStyle = 'rgba(85, 170, 255, 0.35)';
    _ctx.lineWidth = 2;
    _ctx.beginPath();
    _dataPoints.forEach((p, i) => {
      const x = gx + (gw * i / (MAX_POINTS - 1));
      const y = gy + gh - (gh * (p.total / maxVal));
      if (i === 0) {
        _ctx.moveTo(x, y);
      } else {
        _ctx.lineTo(x, y);
      }
    });
    _ctx.stroke();
  }

  // Draw used heap line (foreground, bright cyan)
  if (_dataPoints.length > 1) {
    _ctx.strokeStyle = '#55aaff';
    _ctx.lineWidth = 2;
    _ctx.beginPath();
    _dataPoints.forEach((p, i) => {
      const x = gx + (gw * i / (MAX_POINTS - 1));
      const y = gy + gh - (gh * (p.used / maxVal));
      if (i === 0) {
        _ctx.moveTo(x, y);
      } else {
        _ctx.lineTo(x, y);
      }
    });
    _ctx.stroke();
  }

  // Draw text labels
  _ctx.fillStyle = '#cfe8ff';
  _ctx.font = '11px monospace';
  _ctx.textAlign = 'left';
  _ctx.globalAlpha = 0.9;
  _ctx.fillText('Memory (MB)', 10, 15);

  // Draw [Esc] hint on the right
  _ctx.textAlign = 'right';
  _ctx.fillText('[Esc]', w - 10, 15);

  // Current values at bottom
  const latest = _dataPoints[_dataPoints.length - 1];
  _ctx.font = '10px monospace';
  _ctx.textAlign = 'left';
  _ctx.fillText(`Used: ${latest.used.toFixed(1)}`, 10, h - 8);
  _ctx.textAlign = 'center';
  _ctx.fillText(`Total: ${latest.total.toFixed(1)}`, w / 2 + 30, h - 8);

  _ctx.globalAlpha = 1.0;
  _ctx.textAlign = 'left'; // Reset
}

/**
 * Animation loop for rendering
 */
function animate() {
  if (_needsRedraw) {
    draw();
    _needsRedraw = false;
  }

  if (_samplingInterval !== null) {
    _animationFrameId = requestAnimationFrame(animate);
  }
}

/**
 * Starts memory sampling and rendering loop
 */
function startSampling() {
  if (_samplingInterval !== null) return; // Already sampling

  // Initial sample
  const sample = sampleMemory();
  _dataPoints = [sample];
  _needsRedraw = true;

  // Start sampling interval
  _samplingInterval = setInterval(() => {
    const sample = sampleMemory();
    _dataPoints.push(sample);

    // Keep only MAX_POINTS
    if (_dataPoints.length > MAX_POINTS) {
      _dataPoints.shift();
    }

    _needsRedraw = true;
  }, SAMPLE_INTERVAL);

  // Start animation loop
  animate();
}

/**
 * Stops memory sampling and rendering loop
 */
function stopSampling() {
  if (_samplingInterval !== null) {
    clearInterval(_samplingInterval);
    _samplingInterval = null;
  }

  if (_animationFrameId !== null) {
    cancelAnimationFrame(_animationFrameId);
    _animationFrameId = null;
  }

  // Clear data
  _dataPoints = [];
}

/**
 * Shows the memory graph
 */
function show() {
  if (_canvas) {
    _canvas.style.display = 'block';
  }
}

/**
 * Hides the memory graph
 */
function hide() {
  if (_canvas) {
    _canvas.style.display = 'none';
  }
}

/**
 * Handles canvas resize for DPR awareness
 */
function resize() {
  if (!_canvas || !_ctx) return;

  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const w = 240;
  const h = 140;

  _canvas.width = w * dpr;
  _canvas.height = h * dpr;
  _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  _needsRedraw = true;
}

/**
 * Creates and initializes the memory graph canvas
 * @param {HTMLElement} root - Root element to append canvas to
 * @returns {{canvas: HTMLCanvasElement, show: function, hide: function, startSampling: function, stopSampling: function}}
 */
export function ensureMemoryGraph(root) {
  if (_canvas) return { canvas: _canvas, show, hide, startSampling, stopSampling };

  // Create canvas element
  _canvas = document.createElement('canvas');
  _canvas.id = 'memory-graph-layer';

  // Apply styles
  Object.assign(_canvas.style, {
    position: 'fixed',
    left: '8px',
    bottom: '56px',
    width: '240px',
    height: '140px',
    pointerEvents: 'auto',
    zIndex: '910',
    display: 'none',
    borderRadius: '6px',
    overflow: 'hidden'
  });

  root.appendChild(_canvas);

  // Get context
  _ctx = _canvas.getContext('2d');

  // Initial resize
  resize();

  // Listen for window resize
  window.addEventListener('resize', resize);

  return {
    canvas: _canvas,
    show,
    hide,
    startSampling,
    stopSampling
  };
}
