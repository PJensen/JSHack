import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Trap } from "../components/Trap.js";

// Spike trap — percentage-based HP damage on trigger
export const SpikeTrap = defineArchetype(
    "SpikeTrap",
    [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
    [Trap, (p) => ({
        type: 'spike',
        script: 'trap_spike',
        params: p.trapParams ?? { percent: 0.15 },
        revealed: false,
        armed: true,
    })],
);

// Snake trap — spawns snakes on trigger
export const SnakeTrap = defineArchetype(
    "SnakeTrap",
    [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
    [Trap, (p) => ({
        type: 'snake',
        script: 'trap_snake',
        params: p.trapParams ?? { count: 2 },
        revealed: false,
        armed: true,
    })],
);
