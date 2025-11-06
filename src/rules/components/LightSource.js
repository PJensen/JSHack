import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * LightSource describes an emissive light origin in world space.
 * radius: maximum reach of the light in world units (tiles).
 * intensity: scalar brightness multiplier for display (>= 0).
 * color: hex color string for the emissive tint.
 * flicker: [0..1] strength of temporal flicker (display side).
 * style: optional semantic hint (e.g., 'torch', 'arcane').
 * emitter: optional particle emitter hint for display-side FX.
 */
export const LightSource = defineComponent(
  "LightSource",
  {
    radius: 5,
    intensity: 1,
    color: "#ffffff",
    flicker: 0,
    style: "omni",
    emitter: null,
  },
  {
    validate(rec) {
      const radius = Number(rec.radius);
      if (!Number.isFinite(radius) || radius < 0) {
        throw new Error(`LightSource.radius must be a non-negative number (got ${rec.radius})`);
      }
      const intensity = Number(rec.intensity);
      if (!Number.isFinite(intensity) || intensity < 0) {
        throw new Error(`LightSource.intensity must be a non-negative number (got ${rec.intensity})`);
      }
      if (rec.color != null && typeof rec.color !== "string") {
        throw new Error(`LightSource.color must be a string or null (got ${typeof rec.color})`);
      }
      if (!Number.isFinite(rec.flicker ?? 0) || rec.flicker < 0) {
        throw new Error(`LightSource.flicker must be a non-negative number (got ${rec.flicker})`);
      }
      if (rec.style != null && typeof rec.style !== "string") {
        throw new Error(`LightSource.style must be a string or null (got ${typeof rec.style})`);
      }
      if (rec.emitter != null && typeof rec.emitter !== "string") {
        throw new Error(`LightSource.emitter must be a string or null (got ${typeof rec.emitter})`);
      }
      return true;
    }
  }
);
