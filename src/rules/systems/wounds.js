export function computeGraspPenalty(anatomy, wounds) {
  // 0..1 where 1 = cannot grasp
  let palmHits = 0, fingerHits = 0;
  for (const w of wounds.list) {
    const part = anatomy.parts.find(p => p.id === w.part);
    if (!part) continue;
    if (part.id.startsWith("palm"))   palmHits += w.severity;
    if (part.tags?.includes("digit")) fingerHits += w.severity * 0.4;
  }
  return Math.max(0, Math.min(1, palmHits * 0.8 + fingerHits * 0.5));
}

export function computeGaitPenalty(anatomy, wounds) {
  // 0..1 where 1 = cannot move
  let foot = 0, toes = 0, shin = 0, thigh = 0;
  for (const w of wounds.list) {
    const id = w.part;
    if (id.startsWith("foot"))  foot  += w.severity * 0.9;
    if (id.startsWith("toe"))   toes  += w.severity * 0.25;
    if (id.startsWith("shin"))  shin  += w.severity * 0.5;
    if (id.startsWith("thigh")) thigh += w.severity * 0.5;
  }
  // diminishing returns from many toes until threshold
  const toeImpact = Math.min(1, toes * 0.7);
  return Math.max(0, Math.min(1, foot + toeImpact + shin + thigh));
}
