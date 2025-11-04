// src/rules/systems/effectSystem.js
// Processes gameplay effects applied via ActiveEffects, updating Vitality and Status.
import { ActiveEffects } from '../components/ActiveEffects.js';
import { Status } from '../components/Status.js';
import { Vitality } from '../components/Vitality.js';

/**
 * effectSystem — per-tick effect resolver.
 * - Iterates entities with ActiveEffects
 * - Applies on-tick impacts (e.g., poison damage, regeneration)
 * - Derives Status from currently active effects (e.g., poisoned, burning)
 * - Expires effects when their turnsLeft reach 0
 */
export function effectSystem(world) {
        for (const [id, ae] of world.query(ActiveEffects)) {
            if (!ae || !Array.isArray(ae.effects)) continue;
            if (ae.effects.length === 0) {
                // If no active effects, clear Status if present
                if (world.has(id, Status)) {
                    try { world.set(id, Status, { statuses: [] }); } catch {}
                }
                continue;
            }

        // Ensure targets have Vitality/Status if needed
        let vit = world.get(id, Vitality);
        if (!vit) {
            // Add a default Vitality if missing to make effects universal
            try { world.add(id, Vitality, { maxHp: 10, hp: 10 }); } catch {}
            vit = world.get(id, Vitality);
        }
        const hadStatus = world.has(id, Status);

        // Aggregate next Status view from active effects (kept in sync with effects)
        const nextStatuses = new Map(); // type -> { type, duration, potency, stacks }

        // Process effects (mutate in place); remove expired afterwards
        for (const e of ae.effects) {
            if (!e || typeof e !== 'object') continue;

            // Onset delay handling (optional field)
            if (Number.isInteger(e.onsetLeft) && e.onsetLeft > 0) {
                e.onsetLeft -= 1;
                // Not yet active; still reflect a latent status if desired (skip for now)
                continue;
            }

            // Defensive defaults
            e.turnsLeft = Number.isInteger(e.turnsLeft) ? e.turnsLeft : 0;
            const stacks = (e.stacks && e.stacks > 0) ? e.stacks : 1;
            const potency = (typeof e.potency === 'number') ? e.potency : 1;
            const key = (e.key || '').toLowerCase();

            // Apply effect
            switch (key) {
                case 'invuln':
                case 'invulnerable': {
                    // No direct HP change; reflect status for bridge/display and for other systems to check if needed
                    upsertStatus(nextStatuses, { type: 'invulnerable', duration: e.turnsLeft, potency, stacks });
                    break;
                }
                case 'poison':
                case 'poisoned': {
                    const dmg = Math.max(0, potency * stacks);
                    if (vit) {
                        vit.hp = Math.max(0, vit.hp - dmg);
                        // Emit semantic damage event for bridge/display
                        try { world.emit && world.emit('damage', { id, amount: dmg }); } catch {}
                        if (vit.hp <= 0) { try { world.emit && world.emit('died', { id }); } catch {} }
                    }
                    // Reflect status
                    upsertStatus(nextStatuses, { type: 'poisoned', duration: e.turnsLeft, potency, stacks });
                    break;
                }
                case 'burn':
                case 'burning': {
                    const dmg = Math.max(0, potency * stacks);
                    if (vit) {
                        vit.hp = Math.max(0, vit.hp - dmg);
                        try { world.emit && world.emit('damage', { id, amount: dmg }); } catch {}
                        if (vit.hp <= 0) { try { world.emit && world.emit('died', { id }); } catch {} }
                    }
                    upsertStatus(nextStatuses, { type: 'burning', duration: e.turnsLeft, potency, stacks });
                    break;
                }
                case 'regen':
                case 'regeneration': {
                    const heal = Math.max(0, potency * stacks);
                    if (vit) {
                        const before = vit.hp;
                        vit.hp = Math.min(vit.maxHp, vit.hp + heal);
                        const delta = vit.hp - before;
                        if (delta > 0) { try { world.emit && world.emit('healed', { id, amount: delta }); } catch {} }
                    }
                    upsertStatus(nextStatuses, { type: 'regenerating', duration: e.turnsLeft, potency, stacks });
                    break;
                }
                case 'stun':
                case 'stunned': {
                    upsertStatus(nextStatuses, { type: 'stunned', duration: e.turnsLeft, potency, stacks });
                    break;
                }
                case 'thorns': {
                    // Purely visual status to indicate a thorns proc this turn
                    upsertStatus(nextStatuses, { type: 'thorns', duration: e.turnsLeft, potency, stacks });
                    break;
                }
                default: {
                    // Fallback: optional callback dispatch by name (future-friendly)
                    if (e.cbKey && typeof effectCallbacks[e.cbKey] === 'function') {
                        try { effectCallbacks[e.cbKey]({ world, id, e, vit, statusMap: nextStatuses }); } catch {}
                    }
                    // Unknown types still tick down but do nothing by default
                    break;
                }
            }

            // Age the effect at the end of its tick
            e.turnsLeft -= 1;
        }

        // Cull expired effects
        ae.effects = ae.effects.filter(e => (e && Number.isInteger(e.turnsLeft) ? e.turnsLeft : 0) > 0 || (Number.isInteger(e.onsetLeft) && e.onsetLeft > 0));

        // Sync Status with active effects snapshot
            const statuses = Array.from(nextStatuses.values())
                .map(s => ({ type: s.type, duration: Math.max(0, ~~s.duration), potency: s.potency, stacks: s.stacks }))
                .filter(s => s.duration > 0);
            try {
                if (hadStatus || world.has(id, Status)) world.set(id, Status, { statuses });
                else world.add(id, Status, { statuses });
            } catch { /* deferred during tick; will flush post-tick */ }
    }
}

// ===== helpers =====
function upsertStatus(map, rec) {
    const k = rec.type;
    const cur = map.get(k);
    if (!cur) { map.set(k, { ...rec }); return; }
    // Merge: keep max duration, max potency, add stacks
    cur.duration = Math.max(cur.duration ?? 0, rec.duration ?? 0);
    cur.potency = Math.max(cur.potency ?? 0, rec.potency ?? 0);
    cur.stacks = Math.max(cur.stacks ?? 1, rec.stacks ?? 1);
}

// Optional callback registry for script-driven effects
const effectCallbacks = Object.create(null);
export function registerEffectCallback(key, fn) { if (key) effectCallbacks[key] = fn; }