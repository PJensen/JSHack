// systems.js - ECS System Registration, Dependencies, and Execution Order
// Usage: import * as Systems from './systems.js';

const _systems = {}; // { phase: [ { system, before, after } ] }
const _explicitOrder = {}; // { phase: [system, ...] }

/**
 * Register a system for a phase, with optional before/after dependencies.
 * @param {Function} system - The system function.
 * @param {string} phase - The phase name (e.g., 'update', 'render').
 * @param {Object} [opts] - Dependency options.
 * @param {Array<Function>} [opts.before]
 * @param {Array<Function>} [opts.after]
 */
export function registerSystem(system, phase, opts = {}) {
    if (!_systems[phase]) _systems[phase] = [];
    _systems[phase].push({ system, before: opts.before || [], after: opts.after || [] });
}

/**
 * Set explicit system order for a phase. Overrides dependency-based ordering.
 * @param {string} phase
 * @param {Array<Function>} systemList
 */
export function setSystemOrder(phase, systemList) {
    _explicitOrder[phase] = systemList;
}

/**
 * Get ordered list of systems for a phase, resolving dependencies.
 * @param {string} phase
 * @returns {Array<Function>}
 */
export function getOrderedSystems(phase) {
    if (_explicitOrder[phase]) return _explicitOrder[phase];
    const nodes = _systems[phase] || [];
    // Build dependency graph
    const graph = new Map();
    nodes.forEach(({ system }) => graph.set(system, new Set()));
    nodes.forEach(({ system, before, after }) => {
        after.forEach(dep => { if (graph.has(dep)) graph.get(dep).add(system); });
        before.forEach(dep => { if (graph.has(dep)) graph.get(system).add(dep); });
    });
    // Topological sort
    const result = [];
    const visited = new Set();
    function visit(n) {
        if (visited.has(n)) return;
        visited.add(n);
        (graph.get(n) || []).forEach(visit);
        result.push(n);
    }
    graph.forEach((_, n) => visit(n));
    return result.reverse();
}

/**
 * Execute all systems for a phase, in order.
 * @param {string} phase
 * @param  {...any} args - Arguments to pass to each system.
 */
export function runSystems(phase, ...args) {
    getOrderedSystems(phase).forEach(sys => sys(...args));
}

/**
 * Clear all systems and orders (for testing or hot reload).
 */
export function clearSystems() {
    Object.keys(_systems).forEach(k => delete _systems[k]);
    Object.keys(_explicitOrder).forEach(k => delete _explicitOrder[k]);
}
