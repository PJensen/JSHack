function resolveWeight(entry, ctx) {
  const value = typeof entry.weight === "function"
    ? entry.weight(ctx)
    : entry.weight;
  const weight = Number(value || 0);
  return Number.isFinite(weight) ? Math.max(0, weight) : 0;
}

export function chanceTable(id, entries) {
  const tableId = String(id || "");
  if (!tableId) throw new Error("chanceTable requires an id");
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`chanceTable "${tableId}" requires entries`);
  }

  const seen = new Set();
  const candidates = entries.map((entry) => {
    const entryId = String(entry?.id || "");
    if (!entryId) throw new Error(`chanceTable "${tableId}" has an entry without an id`);
    if (seen.has(entryId)) throw new Error(`chanceTable "${tableId}" has duplicate entry "${entryId}"`);
    if (typeof entry.apply !== "function") {
      throw new Error(`chanceTable "${tableId}" entry "${entryId}" requires apply(ctx)`);
    }
    seen.add(entryId);
    return Object.freeze({ ...entry, id: entryId });
  });

  return Object.freeze({
    id: tableId,
    entries: Object.freeze(candidates),
    resolve(ctx) {
      const eligible = [];
      let total = 0;
      const forcedId = String(ctx.params?.forceOutcomeId || "");

      for (let i = 0; i < candidates.length; i++) {
        const entry = candidates[i];
        ctx.trace.considered(entry.id);
        const allowed = typeof entry.when !== "function" || entry.when(ctx) === true;
        if (!allowed) {
          ctx.trace.skipped(entry.id, "when");
          continue;
        }
        const weight = resolveWeight(entry, ctx);
        ctx.trace.weight(entry.id, weight);
        if (!(weight > 0)) {
          ctx.trace.skipped(entry.id, "weight");
          continue;
        }
        eligible.push({ entry, weight });
        total += weight;
      }

      if (forcedId) {
        const forced = eligible.find((candidate) => candidate.entry.id === forcedId);
        if (!forced) throw new Error(`chanceTable "${tableId}" cannot force ineligible outcome "${forcedId}"`);
        ctx.trace.selected(forced.entry.id, { forced: true, total });
        return forced.entry.apply(ctx);
      }

      if (!(total > 0)) return null;
      const roll = ctx.rng.next() * total;
      let cursor = roll;
      for (let i = 0; i < eligible.length; i++) {
        const candidate = eligible[i];
        cursor -= candidate.weight;
        if (cursor < 0) {
          ctx.trace.selected(candidate.entry.id, { roll, total });
          return candidate.entry.apply(ctx);
        }
      }

      const fallback = eligible[eligible.length - 1].entry;
      ctx.trace.selected(fallback.id, { roll, total, fallback: true });
      return fallback.apply(ctx);
    },
  });
}
