// display/ui/memoryGraph.js
// Memory usage debug graph — thin wrapper over the generic debugGraph factory.

import { createDebugGraph } from './debugGraph.js';

let _instance = null;

/**
 * Creates and initializes the memory graph canvas.
 * @param {HTMLElement} root - Root element to append canvas to
 */
export function ensureMemoryGraph(root) {
  if (_instance) return _instance;

  _instance = createDebugGraph({
    id: 'memory-graph-layer',
    title: 'Memory (MB)',
    width: 240,
    height: 140,
    zIndex: 910,
    series: [
      { key: 'total', color: 'rgba(85, 170, 255, 0.35)', label: 'Total' },
      { key: 'used',  color: '#55aaff',                   label: 'Used' },
    ],
    maxPoints: 100,
    sampleInterval: 500,
    sampler() {
      if (!performance.memory) return null;
      return {
        used:  performance.memory.usedJSHeapSize  / (1024 * 1024),
        total: performance.memory.totalJSHeapSize / (1024 * 1024),
      };
    },
    unavailableMessage: 'Memory API not available\n(Chrome/Edge only)',
  });

  return _instance;
}
