import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Trap } from "../components/Trap.js";
import { NamedIdentity } from "../components/NamedIdentity.js";

// Spike trap — percentage-based HP damage on trigger
export const SpikeTrap = defineArchetype(
    "SpikeTrap",
    [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
    [Trap, (p) => ({
        type: 'spike',
        script: 'trap_spike',
        params: p.trapParams ?? { percent: 0.50 },
        revealed: false,
        armed: true,
        difficulty: p.difficulty ?? 8,
    })],
    [NamedIdentity, () => ({ name: 'Spike Trap', identity: 'trap_spike' })],
);

// Snake trap — spawns snakes on trigger
export const SnakeTrap = defineArchetype(
    "SnakeTrap",
    [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
    [Trap, (p) => ({
        type: 'snake',
        script: 'trap_snake',
        params: p.trapParams ?? { count: 4 },
        revealed: false,
        armed: true,
        difficulty: p.difficulty ?? 12,
    })],
    [NamedIdentity, () => ({ name: 'Snake Trap', identity: 'trap_snake' })],
);

// Shock trap — electric damage + sensory overload (stun, blindness, deafness) on trigger
// Damage is 15% of max HP (down from 30%) because sensory impairment is now a real penalty.
export const ShockTrap = defineArchetype(
    "ShockTrap",
    [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
    [Trap, (p) => ({
        type: 'shock',
        script: 'trap_shock',
        params: p.trapParams ?? { percent: 0.15 },
        revealed: false,
        armed: true,
        difficulty: p.difficulty ?? 15,
    })],
    [NamedIdentity, () => ({ name: 'Shock Trap', identity: 'trap_shock' })],
);
