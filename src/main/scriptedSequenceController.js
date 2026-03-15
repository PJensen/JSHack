import {
  activateScriptedSpeechBubble,
  advanceScriptedSpeechBubble,
  createScriptedSpeechBubble,
} from "./ui/scriptedSpeechState.js";
import {
  getLogicalCanvasSize,
  placeBubbleBox,
  projectBubbleAnchor,
} from "./ui/bubblePlacement.js";
import { Position } from "../rules/components/Position.js";
import { Player } from "../rules/components/Player.js";
import { DungeonState } from "../rules/components/DungeonState.js";
import { NamedIdentity } from "../rules/components/NamedIdentity.js";

export function createScriptedSequenceController({
  world,
  getPlayerEntity,
  getCam,
  getCanvas,
  getCanvasSetup,
}) {
  let speechBubble = createScriptedSpeechBubble({ entityId: 0, text: "" });
  let speechQueue = [];
  let walk = {
    entityId: 0,
    resolveEntityId: null,
    target: null,
    resolveTarget: null,
    stepDelaySec: 0,
    accumulatorSec: 0,
    onArrive: null,
    targetLocked: false,
  };

  function emptyBubble() {
    return createScriptedSpeechBubble({ entityId: 0, text: "" });
  }

  function clearSpeechState() {
    speechBubble = emptyBubble();
    speechQueue = [];
  }

  function clearWalkState() {
    walk = {
      entityId: 0,
      resolveEntityId: null,
      target: null,
      resolveTarget: null,
      stepDelaySec: 0,
      accumulatorSec: 0,
      onArrive: null,
      targetLocked: false,
    };
  }

  function clearAll() {
    clearSpeechState();
    clearWalkState();
  }

  function isEntityOnCurrentFloor(entityId) {
    const id = Number(entityId || 0) | 0;
    if (!(id > 0) || !world.isAlive(id)) return false;
    if (world.has(id, Player)) return true;
    let sawDungeonState = false;
    for (const [, ds] of world.query(DungeonState)) {
      sawDungeonState = true;
      if (!Array.isArray(ds?.floorEntityIds)) return false;
      return ds.floorEntityIds.includes(id);
    }
    return !sawDungeonState;
  }

  function canActorAddressPlayer(entityId, maxDistance = Infinity) {
    const speakerId = Number(entityId || 0) | 0;
    if (!(speakerId > 0) || !isEntityOnCurrentFloor(speakerId)) return false;
    const pe = getPlayerEntity();
    if (!pe || !isEntityOnCurrentFloor(pe.id)) return false;
    const speakerPos = world.get(speakerId, Position);
    if (!speakerPos) return false;
    const limit = Number(maxDistance);
    if (!Number.isFinite(limit)) return true;
    const dist = Math.max(
      Math.abs((speakerPos.x | 0) - (pe.pos.x | 0)),
      Math.abs((speakerPos.y | 0) - (pe.pos.y | 0)),
    );
    return dist <= limit;
  }

  function findEntityIdByIdentity(identity) {
    const wanted = String(identity || "");
    if (!wanted) return 0;
    for (const [id, ni] of world.query(NamedIdentity)) {
      if (String(ni?.identity || "") === wanted) return id | 0;
    }
    return 0;
  }

  function activateQueuedSpeech(next) {
    let bubble = next;
    while (bubble) {
      if (typeof bubble?.resolveEntityId === "function") {
        bubble.entityId = Number(bubble.resolveEntityId() || 0) | 0;
      }
      const canShow = typeof bubble?.canShow === "function" ? bubble.canShow() : true;
      if (canShow) {
        speechBubble = activateScriptedSpeechBubble(bubble, world.step | 0);
        return;
      }
      bubble = speechQueue.shift() || null;
    }
    speechBubble = emptyBubble();
  }

  function queueSpeechBubble({
    entityId,
    text,
    delaySec = 0,
    durationSec = 3.4,
    delayTurns = 0,
    holdTurns = 0,
    onShow = null,
    canShow = null,
    resolveEntityId = null,
  }) {
    const next = createScriptedSpeechBubble({
      entityId,
      text,
      delaySec,
      durationSec,
      delayTurns,
      holdTurns,
      onShow,
    });
    next.canShow = typeof canShow === "function" ? canShow : null;
    next.resolveEntityId = typeof resolveEntityId === "function" ? resolveEntityId : null;
    if (!(speechBubble.entityId > 0) && !speechBubble.text) {
      activateQueuedSpeech(next);
      return;
    }
    speechQueue.push(next);
  }

  function queueWalk({ entityId, target, stepDelaySec = 0.18, onArrive = null }) {
    walk = {
      entityId: Number(entityId || 0) | 0,
      resolveEntityId: null,
      target: target && Number.isInteger(target.x) && Number.isInteger(target.y)
        ? { x: target.x | 0, y: target.y | 0 }
        : null,
      resolveTarget: null,
      stepDelaySec: Math.max(0.05, Number(stepDelaySec) || 0.18),
      accumulatorSec: 0,
      onArrive: typeof onArrive === "function" ? onArrive : null,
      targetLocked: !!target,
    };
  }

  function queueResolvedWalk({ resolveEntityId, resolveTarget, stepDelaySec = 0.18, onArrive = null }) {
    walk = {
      entityId: 0,
      resolveEntityId: typeof resolveEntityId === "function" ? resolveEntityId : null,
      target: null,
      resolveTarget: typeof resolveTarget === "function" ? resolveTarget : null,
      stepDelaySec: Math.max(0.05, Number(stepDelaySec) || 0.18),
      accumulatorSec: 0,
      onArrive: typeof onArrive === "function" ? onArrive : null,
      targetLocked: false,
    };
  }

  function tickWalk(dtSec) {
    if (typeof walk.resolveEntityId === "function") {
      walk.entityId = Number(walk.resolveEntityId() || 0) | 0;
    }
    if (!(walk.entityId > 0) || !world.isAlive(walk.entityId)) {
      walk.target = null;
      walk.targetLocked = false;
      return;
    }
    if (!walk.targetLocked && typeof walk.resolveTarget === "function") {
      const nextTarget = walk.resolveTarget();
      walk.target = nextTarget && Number.isInteger(nextTarget.x) && Number.isInteger(nextTarget.y)
        ? { x: nextTarget.x | 0, y: nextTarget.y | 0 }
        : null;
      walk.targetLocked = !!walk.target;
    }
    if (!walk.target) return;

    walk.accumulatorSec += Math.max(0, Number(dtSec) || 0);
    while (walk.accumulatorSec >= walk.stepDelaySec) {
      walk.accumulatorSec -= walk.stepDelaySec;
      const pos = world.get(walk.entityId, Position);
      if (!pos) break;
      const dx = (walk.target.x | 0) - (pos.x | 0);
      const dy = (walk.target.y | 0) - (pos.y | 0);
      if (dx === 0 && dy === 0) {
        const fn = walk.onArrive;
        clearWalkState();
        if (typeof fn === "function") {
          try { fn(); } catch (e) { console.debug("[scriptedSequenceController] walk onArrive failed:", e); }
        }
        return;
      }
      const stepX = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
      const stepY = stepX === 0 ? Math.sign(dy) : 0;
      const next = { x: (pos.x | 0) + stepX, y: (pos.y | 0) + stepY };
      world.set(walk.entityId, Position, next);
      try {
        world.emit?.("moved", {
          id: walk.entityId,
          from: { x: pos.x | 0, y: pos.y | 0 },
          to: next,
        });
      } catch {}
    }
  }

  function tickSpeech(dtSec) {
    if (!(speechBubble.entityId > 0) || !speechBubble.text) return;
    if (typeof speechBubble.resolveEntityId === "function") {
      speechBubble.entityId = Number(speechBubble.resolveEntityId() || 0) | 0;
    }
    if (typeof speechBubble.canShow === "function" && !speechBubble.canShow()) return;
    const result = advanceScriptedSpeechBubble(speechBubble, world.step | 0, dtSec);
    speechBubble = result.bubble;
    if (typeof result.onShow === "function") {
      try { result.onShow(); } catch (e) { console.debug("[scriptedSequenceController] speech onShow failed:", e); }
    }
    if (result.isExpired) {
      const next = speechQueue.shift();
      if (next) activateQueuedSpeech(next);
      else speechBubble = emptyBubble();
    }
  }

  function tick(dtSec) {
    tickWalk(dtSec);
    tickSpeech(dtSec);
  }

  function drawSpeechBubble(ctx) {
    const bubble = speechBubble;
    if (!(bubble.entityId > 0) || !bubble.text) return;
    if (typeof bubble.resolveEntityId === "function") {
      bubble.entityId = Number(bubble.resolveEntityId() || 0) | 0;
    }
    if (typeof bubble.canShow === "function" && !bubble.canShow()) return;
    if (bubble.delaySec > 0) return;
    if (bubble.usesTurnPacing && (bubble.delayTurns | 0) > 0) return;
    if (!world.isAlive(bubble.entityId)) return;
    const pos = world.get(bubble.entityId, Position);
    if (!pos) return;

    const canvas = getCanvas();
    const canvasSetup = getCanvasSetup();
    const cam = getCam();
    const anchor = { x: Number(pos.x || 0), y: Number(pos.y || 0) - 0.68 };
    const logicalCanvas = getLogicalCanvasSize(canvas, canvasSetup.cssW, canvasSetup.cssH);
    const projected = projectBubbleAnchor(cam, anchor, logicalCanvas, { left: 0, top: 0 });
    const dprScale = Math.max(1, canvas.width / Math.max(1, logicalCanvas.width));
    const sx = projected.localX * dprScale;
    const sy = projected.localY * dprScale;
    const padX = 12 * dprScale;
    const maxWidth = Math.min(logicalCanvas.width * 0.44, 360) * dprScale;
    const text = bubble.text;
    const fade = Math.max(0, Math.min(1, bubble.durationSec > 0 ? bubble.ttlSec / bubble.durationSec : 1));

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `600 ${Math.round(15 * dprScale)}px 'Trebuchet MS', sans-serif`;
    const textWidth = Math.min(maxWidth, Math.ceil(ctx.measureText(text).width));
    const boxW = textWidth + (padX * 2);
    const boxH = 34 * dprScale;
    const scale = Math.max(1, Number(cam?.scale) || 1);
    const lift = Math.max(32, Math.min(96, Math.round(scale * 1.15))) * dprScale;
    const tailH = Math.max(14, 14 * dprScale);
    const tailHalfW = Math.max(10, 10 * dprScale);
    const placed = placeBubbleBox({
      anchorX: sx,
      anchorY: sy,
      boxWidth: boxW,
      boxHeight: boxH,
      liftPx: lift,
      tailHeight: tailH,
      viewportWidth: canvas.width,
      viewportHeight: canvas.height,
      margin: 10 * dprScale,
      bottomMargin: 30 * dprScale,
    });
    const boxX = placed.left;
    const boxY = placed.top;
    const alpha = 0.78 + (fade * 0.22);
    const tailTipX = Math.round(sx - (2 * dprScale));
    const tailTipY = boxY + boxH + tailH;
    const lineDx = sx - tailTipX;
    const lineDy = sy - tailTipY;
    const lineDist = Math.hypot(lineDx, lineDy);

    if (lineDist > (8 * dprScale)) {
      ctx.save();
      ctx.strokeStyle = `rgba(90,74,48,${Math.min(1, alpha + 0.08).toFixed(3)})`;
      ctx.lineWidth = Math.max(2, 3 * dprScale);
      ctx.setLineDash([Math.max(5, 7 * dprScale), Math.max(4, 6 * dprScale)]);
      ctx.beginPath();
      ctx.moveTo(tailTipX, tailTipY);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      ctx.fillStyle = `rgba(252,248,238,${Math.min(1, alpha + 0.16).toFixed(3)})`;
      ctx.strokeStyle = `rgba(75,62,43,${Math.min(1, alpha + 0.12).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.5, 2.5 * dprScale);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(4, 5 * dprScale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = `rgba(253,249,235,${alpha.toFixed(3)})`;
    ctx.strokeStyle = `rgba(57,46,32,${Math.min(1, alpha + 0.1).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, 2 * dprScale);
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12 * dprScale);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(Math.round(sx - tailHalfW), boxY + boxH - 1);
    ctx.lineTo(Math.round(sx + (tailHalfW * 0.25)), boxY + boxH - 1);
    ctx.lineTo(tailTipX, tailTipY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `rgba(32,26,18,${Math.min(1, alpha + 0.12).toFixed(3)})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, Math.round(sx), boxY + Math.round(boxH / 2) + dprScale, maxWidth);
    ctx.restore();
  }

  return {
    canActorAddressPlayer,
    clearAll,
    clearSpeechState,
    clearWalkState,
    drawSpeechBubble,
    findEntityIdByIdentity,
    queueResolvedWalk,
    queueSpeechBubble,
    queueWalk,
    tick,
  };
}
