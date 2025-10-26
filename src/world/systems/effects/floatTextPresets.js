// Float Text Presets
// Choose based on feeling, not meaning. Size/energy/rise map to readable motion.
// Minimal, generic, and easy to reason about.

/**
 * Create a float text spec from a preset name
 * @param {"Punch"|"Pulse"|"Pop"|"Echo"|"Shatter"|"Feather"|"Still"|"Arc"|string} name
 * @param {{ text:string, color?:string, seed?:number|null }} params
 * @returns {{ text:string, color?:string, life?:number, size?:number, energy?:number, rise?:number, layer?:string, seed?:number|null, reduceMotion?:boolean }}
 */ 
export function ftPreset(name, { text, color, seed } = { text: '' }) {
  const base = (spec) => ({
    life: 1,
    rise: 1.0,
    layer: 'top',
    reduceMotion: false,
    ...spec,
    text,
    color,
    seed
  });

  switch (name) {
    // Punch: start small, rise while growing, with a slight arcing drift
    // - scaleStart/scaleEnd explicitly control growth over lifetime
    // - arc widens sideways angle and adds gentle sideways acceleration (handled in spawner)
    case 'Punch':   return base({
      rise: 1.0,
      size: 1.0,          // base size context; growth controlled via scaleStart/End
      scaleStart: 0.85,    // begin smaller
      scaleEnd: 1.15,      // grow as it rises
      energy: 0.55,        // moderate speed/jitter so it stays readable
      arc: 0.6             // 0..1: widen angle and add slight sideways curvature
    });
    case 'Pulse':   return base({ size: 0.9, energy: 0.1, rise: 0.8 });
    case 'Pop':     return base({ size: 0.9, energy: 0.2, life: 0.8, life: 2 });
    case 'Echo':    return base({ size: 1.0, energy: 0.05, life: 1.3, rise: 0.6 });
    case 'Shatter': return base({ size: 1.6, energy: 0.9, life: 0.9 });
    case 'Feather': return base({ size: 0.95, energy: 0.0, rise: 0.5, life: 1.2 });
    case 'Still':   return base({ size: 1.0, energy: 0.0, rise: 0.0, life: 1.5 });
    // Stronger arc preset: wider sideways spread and noticeable curve, still readable
      case 'Arc':     return base({
        life: 1.05,
        rise: 1.0,
        size: 1.0,
        scaleStart: 0.85,
        scaleEnd: 1.20,
        energy: 0.45,       // slightly calmer for readability
        arc: 0.9,           // strong arc intent
        angleRange: 0.35,   // radians in PI units (~0.35π spread)
        arcCurvature: 0.07, // explicit sideways acceleration magnitude
        jitterAmpPx: 0      // disable jitter for super-clean motion
      });
    default:        return base({ size: 1.0, energy: 0.2 });
  }
}
