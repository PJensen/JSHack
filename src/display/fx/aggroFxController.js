const TETHER_TTL = 0.48;
const ALERT_TTL = 0.48;

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function easeOutCubic(t) {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

function colorForFaction(faction, targetKind) {
  if (targetKind === "player") return [255, 76, 32];
  if (targetKind === "ally") return [255, 183, 66];
  switch (String(faction || "").trim().toLowerCase()) {
    case "enemy": return [175, 83, 72];
    case "townfolk": return [128, 150, 118];
    case "pet":
    case "summoned": return [116, 158, 176];
    default: return [142, 116, 104];
  }
}

function alphaColor(rgb, a) {
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${clamp01(a).toFixed(3)})`;
}

function readPos(getPosition, id, fallback) {
  const pos = typeof getPosition === "function" ? getPosition(Number(id || 0) | 0) : null;
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) return { x: Number(pos.x), y: Number(pos.y) };
  if (fallback && Number.isFinite(fallback.x) && Number.isFinite(fallback.y)) return { x: Number(fallback.x), y: Number(fallback.y) };
  return null;
}

export function createAggroFxController({ world, getPosition, isPet }) {
  const tethers = [];
  const alerts = [];
  let time = 0;

  function installListeners() {
    world.on("aggro:targetChanged", (ev) => {
      const sourceId = Number(ev?.sourceId || 0) | 0;
      const targetId = Number(ev?.targetId || 0) | 0;
      if (!(sourceId > 0) || !(targetId > 0)) return;
      const targetKind = String(ev?.targetKind || "");
      tethers.push({
        sourceId,
        targetId,
        sourcePos: ev?.sourcePos || null,
        targetPos: ev?.targetPos || null,
        color: colorForFaction(ev?.sourceFaction, targetKind),
        targetKind,
        age: 0,
        ttl: targetKind === "npc" ? TETHER_TTL : 0.72,
      });
    });

    world.on("status", (ev) => {
      if (String(ev?.kind || "") !== "alert") return;
      const id = Number(ev?.id || 0) | 0;
      if (!(id > 0)) return;
      alerts.push({
        id,
        at: ev?.at || null,
        age: 0,
        ttl: ALERT_TTL,
      });
    });
  }

  function tick(dt) {
    const step = Math.max(0, Number(dt) || 0);
    time += step;
    for (let i = tethers.length - 1; i >= 0; i--) {
      tethers[i].age += step;
      if (tethers[i].age >= tethers[i].ttl) tethers.splice(i, 1);
    }
    for (let i = alerts.length - 1; i >= 0; i--) {
      alerts[i].age += step;
      if (alerts[i].age >= alerts[i].ttl) alerts.splice(i, 1);
    }
  }

  function drawTethers(ctx) {
    if (!tethers.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < tethers.length; i++) {
      const fx = tethers[i];
      const from = readPos(getPosition, fx.sourceId, fx.sourcePos);
      const to = readPos(getPosition, fx.targetId, fx.targetPos);
      if (!from || !to) continue;

      const t = clamp01(fx.age / Math.max(0.001, fx.ttl));
      const reveal = easeOutCubic(Math.min(1, t * 2.6));
      const fade = 1 - clamp01((t - 0.52) / 0.48);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / dist;
      const ny = dx / dist;
      const bow = Math.min(0.28, dist * 0.08) * (fx.sourceId % 2 === 0 ? 1 : -1);
      const ex = from.x + dx * reveal;
      const ey = from.y + dy * reveal;
      const cpx = from.x + (ex - from.x) * 0.5 + nx * bow;
      const cpy = from.y + (ey - from.y) * 0.5 + ny * bow;
      const npc = fx.targetKind === "npc";
      const player = fx.targetKind === "player";
      const ally = fx.targetKind === "ally";
      const alpha = (player ? 0.28 : ally ? 0.22 : 0.12) * fade;
      const width = player ? 0.028 : ally ? 0.024 : 0.018;

      ctx.setLineDash(npc ? [0.10, 0.12] : [0.16, 0.09]);
      ctx.lineDashOffset = -(time * 0.35 + fx.sourceId * 0.017);
      ctx.strokeStyle = alphaColor(fx.color, alpha * 0.26);
      ctx.lineWidth = width * 2.0;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y - 0.08);
      ctx.quadraticCurveTo(cpx, cpy - 0.06, ex, ey - 0.08);
      ctx.stroke();

      ctx.strokeStyle = alphaColor(fx.color, alpha);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y - 0.08);
      ctx.quadraticCurveTo(cpx, cpy - 0.06, ex, ey - 0.08);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawAlertBursts(ctx) {
    if (!alerts.length) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalCompositeOperation = "source-over";

    for (let i = 0; i < alerts.length; i++) {
      const fx = alerts[i];
      const pos = readPos(getPosition, fx.id, fx.at);
      if (!pos) continue;
      const t = clamp01(fx.age / Math.max(0.001, fx.ttl));
      const rise = 0.18 * easeOutCubic(t);
      const pop = t < 0.18 ? t / 0.18 : 1;
      const fade = 1 - clamp01((t - 0.42) / 0.58);
      const y = pos.y - 0.64 - rise;
      const size = 0.16 + 0.12 * pop;

      ctx.globalAlpha = 0.26 * fade;
      ctx.fillStyle = "rgba(255,96,36,0.34)";
      ctx.beginPath();
      ctx.arc(pos.x, y, 0.14 + 0.12 * t, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.86 * fade;
      ctx.font = `bold ${size.toFixed(3)}px sans-serif`;
      ctx.lineWidth = 0.035;
      ctx.strokeStyle = "rgba(32,8,4,0.88)";
      ctx.fillStyle = "rgba(255,152,48,0.96)";
      ctx.strokeText("!", pos.x, y);
      ctx.fillText("!", pos.x, y);
    }

    ctx.restore();
  }

  function drawRing(ctx, e, targetEntity, playerId) {
    const level = String(e?.aggroLevel || "");
    if (level !== "hunting" && level !== "alerted") return;
    const x = Number(e.pos?.x);
    const y = Number(e.pos?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const targetId = Number(e.aggroTargetId || 0) | 0;
    const targetsPlayer = playerId > 0 && targetId === playerId;
    const targetsAlly = targetEntity?.isPet === true;
    const rgb = targetsPlayer ? [255, 72, 28] : targetsAlly ? [255, 184, 62] : [178, 88, 76];
    const pulse = 0.5 + 0.5 * Math.sin(time * (targetsPlayer ? 7.2 : 4.4) + (e.id | 0) * 0.71);
    const hasTarget = targetId > 0;
    const alpha = level === "hunting"
      ? (targetsPlayer ? 0.34 : targetsAlly ? 0.24 : hasTarget ? 0.14 : 0.10)
      : 0.12;
    const rx = (targetsPlayer ? 0.39 : 0.34) + pulse * 0.012;
    const ry = (targetsPlayer ? 0.24 : 0.20) + pulse * 0.008;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.setLineDash(level === "alerted" ? [0.11, 0.08] : []);
    ctx.lineDashOffset = -time * 0.25;
    ctx.strokeStyle = alphaColor(rgb, alpha);
    ctx.lineWidth = targetsPlayer ? 0.026 : 0.018;
    for (const [a0, a1] of [[0.10, 0.32], [0.68, 0.90], [1.10, 1.32], [1.68, 1.90]]) {
      ctx.beginPath();
      ctx.ellipse(x, y + 0.08, rx, ry, 0, a0 * Math.PI, a1 * Math.PI);
      ctx.stroke();
    }

    if (targetsPlayer) {
      ctx.setLineDash([]);
      ctx.strokeStyle = alphaColor(rgb, 0.18 + pulse * 0.06);
      ctx.lineWidth = 0.014;
      for (const [a0, a1] of [[0.02, 0.18], [0.82, 0.98], [1.02, 1.18], [1.82, 1.98]]) {
        ctx.beginPath();
        ctx.ellipse(x, y + 0.08, rx + 0.08, ry + 0.05, 0, a0 * Math.PI, a1 * Math.PI);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawTargetBrackets(ctx, targetEntity) {
    if (!targetEntity) return;
    const x = Number(targetEntity.pos?.x);
    const y = Number(targetEntity.pos?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const ss = Number(targetEntity._sizeScale || 1) || 1;
    const w = 0.36 * ss;
    const h = 0.42 * ss;
    const len = 0.13 * ss;
    const pulse = 0.55 + 0.45 * Math.sin(time * 6.5 + (targetEntity.id | 0));
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = `rgba(255,184,62,${(0.30 + pulse * 0.12).toFixed(3)})`;
    ctx.lineWidth = 0.026;
    ctx.beginPath();
    ctx.moveTo(x - w, y - h + len); ctx.lineTo(x - w, y - h); ctx.lineTo(x - w + len, y - h);
    ctx.moveTo(x + w - len, y - h); ctx.lineTo(x + w, y - h); ctx.lineTo(x + w, y - h + len);
    ctx.moveTo(x - w, y + h - len); ctx.lineTo(x - w, y + h); ctx.lineTo(x - w + len, y + h);
    ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
    ctx.stroke();
    ctx.restore();
  }

  function drawPersistent(ctx, worldView) {
    const entities = Array.isArray(worldView?.entities) ? worldView.entities : [];
    if (!entities.length) return;

    const byId = new Map();
    for (let i = 0; i < entities.length; i++) byId.set(entities[i].id, entities[i]);
    const playerId = Number(worldView?.player?.id || 0) | 0;
    const bracketTargets = new Set();

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const target = byId.get(Number(e.aggroTargetId || 0) | 0) || null;
      drawRing(ctx, e, target, playerId);
      if (target && target.isPet === true) bracketTargets.add(target.id);
      else if (target && typeof isPet === "function" && isPet(target.id)) bracketTargets.add(target.id);
    }

    for (const id of bracketTargets) drawTargetBrackets(ctx, byId.get(id));
  }

  function draw(ctx, worldView) {
    drawTethers(ctx);
    drawPersistent(ctx, worldView);
    drawAlertBursts(ctx);
  }

  return { installListeners, tick, draw };
}
