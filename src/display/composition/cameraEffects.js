/**
 * Apply display-only camera sway for hallucination/intoxication states.
 */
export function applyHallucinationSway({ cam, view, fxTime }) {
  if (!view?.player) return;
  const pe = view.entities.find((e) => e.id === view.player.id);
  if (!pe || !Array.isArray(pe.tags)) return;
  if (!pe.tags.includes("intoxicated")) return;
  cam.x += Math.sin(fxTime * 0.27 * Math.PI * 2) * 0.15;
  cam.y += Math.sin(fxTime * 0.41 * Math.PI * 2 + 1.3) * 0.15;
}
