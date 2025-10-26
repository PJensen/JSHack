// Float Text Presets
// Choose based on feeling, not meaning. Size/energy/rise map to readable motion.
// Minimal, generic, and easy to reason about.

/**
 * Create a float text spec from a preset name
 * @param {"Punch"|"Pulse"|"Pop"|"Echo"|"Shatter"|"Feather"|"Still"|string} name
 * @param {{ text:string, color?:string, seed?:number|null }} params
 * @returns {{ text:string, color?:string, life?:number, size?:number, energy?:number, rise?:number, layer?:string, seed?:number|null, reduceMotion?:boolean }}
 */
export function ftPreset(name, { text, color, seed } = { text: '' }) {
  const base = (spec) => ({
    life: 1.0,
    rise: 1.0,
    layer: 'top',
    reduceMotion: false,
    ...spec,
    text,
    color,
    seed
  });

  switch (name) {
    case 'Punch':   return base({ size: 1.2, energy: 0.7 });
    case 'Pulse':   return base({ size: 0.9, energy: 0.1, rise: 0.8 });
    case 'Pop':     return base({ size: 0.9, energy: 0.2, life: 0.8 });
    case 'Echo':    return base({ size: 1.0, energy: 0.05, life: 1.3, rise: 0.6 });
    case 'Shatter': return base({ size: 1.6, energy: 0.9, life: 0.9 });
    case 'Feather': return base({ size: 0.95, energy: 0.0, rise: 0.5, life: 1.2 });
    case 'Still':   return base({ size: 1.0, energy: 0.0, rise: 0.0, life: 1.5 });
    default:        return base({ size: 1.0, energy: 0.2 });
  }
}
