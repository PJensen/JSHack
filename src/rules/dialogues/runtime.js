import { NamedIdentity } from "../components/NamedIdentity.js";
import { getDialog } from "./registry.js";
import { isEntityOnCurrentFloor } from "../utils/floorEntities.js";

const DIALOG_RUNTIME_KEY = Symbol.for("jshack:dialog:runtime:installed");
const DIALOG_SESSIONS_KEY = Symbol.for("jshack:dialog:sessions");
const DIALOG_SESSION_NEXT_KEY = Symbol.for("jshack:dialog:sessionNext");

function getSessions(world) {
  if (!world[DIALOG_SESSIONS_KEY]) world[DIALOG_SESSIONS_KEY] = new Map();
  return world[DIALOG_SESSIONS_KEY];
}

function nextSessionId(world) {
  const next = (Number(world[DIALOG_SESSION_NEXT_KEY] || 0) | 0) + 1;
  world[DIALOG_SESSION_NEXT_KEY] = next;
  return next;
}

function speakerName(world, targetId) {
  const ni = world.get(targetId, NamedIdentity);
  return String(ni?.name || "Someone");
}

function buildContext(world, session, choice = null) {
  return {
    world,
    sessionId: session.sessionId,
    actorId: session.actorId,
    targetId: session.targetId,
    dialogId: session.dialogId,
    nodeId: session.nodeId,
    speakerName: session.speakerName,
    presentation: session.presentation,
    maxDistance: session.maxDistance,
    choice,
  };
}

function evalMaybe(value, ctx, fallback = "") {
  if (typeof value === "function") return value(ctx);
  if (value == null) return fallback;
  return value;
}

function visibleChoices(world, session, nodeDef) {
  const ctx = buildContext(world, session);
  const raw = Array.isArray(nodeDef?.choices) ? nodeDef.choices : [];
  const out = [];
  for (const choice of raw) {
    if (typeof choice !== "object" || !choice) continue;
    if (typeof choice.visible === "function" && !choice.visible(ctx)) continue;
    out.push({
      ...choice,
      id: String(choice.id || ""),
      label: String(evalMaybe(choice.label, ctx, choice.id || "Continue") || choice.id || "Continue"),
    });
  }
  if (out.length > 0) return out;
  return [{
    id: "close",
    label: "Goodbye.",
    close: true,
  }];
}

function emitDialogOpened(world, session) {
  const def = getDialog(session.dialogId);
  if (!def) return false;
  const nodeDef = def.nodes?.[session.nodeId];
  if (!nodeDef) return false;
  const ctx = buildContext(world, session);
  const text = String(evalMaybe(nodeDef.text, ctx, "...") || "...");
  const presentation = String(
    evalMaybe(nodeDef.presentation, ctx, session.presentation || def.presentation || "bubble") || "bubble"
  );
  const maxDistance = Math.max(
    1,
    Number(evalMaybe(nodeDef.maxDistance, ctx, session.maxDistance || def.maxDistance || 2) || 2) | 0
  );
  session.presentation = presentation;
  session.maxDistance = maxDistance;
  const choices = visibleChoices(world, session, nodeDef).map((choice) => ({
    id: choice.id,
    label: choice.label,
  }));
  world.emit?.("dialog:opened", {
    sessionId: session.sessionId,
    actorId: session.actorId,
    targetId: session.targetId,
    dialogId: session.dialogId,
    nodeId: session.nodeId,
    speakerName: session.speakerName,
    text,
    presentation,
    maxDistance,
    choices,
  });
  return true;
}

function closeDialog(world, sessionId, reason = "closed") {
  const sessions = getSessions(world);
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  world.emit?.("dialog:closed", {
    sessionId,
    actorId: session.actorId,
    targetId: session.targetId,
    dialogId: session.dialogId,
    reason,
  });
}

function openDialog(world, payload) {
  const dialogId = String(payload?.dialogId || "");
  const def = getDialog(dialogId);
  if (!def) return;

  const actorId = Number(payload?.actorId || 0) | 0;
  const targetId = Number(payload?.targetId || 0) | 0;
  const floorOpts = { treatPlayerAsOnFloor: true, fallbackWhenNoDungeonState: true };
  if (actorId > 0 && !isEntityOnCurrentFloor(world, actorId, floorOpts)) return;
  if (!isEntityOnCurrentFloor(world, targetId, floorOpts)) return;

  // Only one live session per actor. Re-opening the same NPC should refresh state;
  // opening a different NPC should replace the older conversation cleanly.
  for (const [sid, session] of getSessions(world)) {
    if (session.actorId === actorId) {
      closeDialog(world, sid, "replaced");
    }
  }

  const sessionId = nextSessionId(world);
  const session = {
    sessionId,
    actorId: Number(payload?.actorId || 0) | 0,
    targetId: Number(payload?.targetId || 0) | 0,
    dialogId,
    nodeId: String(payload?.nodeId || def.start || "root"),
    speakerName: speakerName(world, Number(payload?.targetId || 0) | 0),
    presentation: String(payload?.presentation || def.presentation || "bubble"),
    maxDistance: Math.max(1, Number(payload?.maxDistance || def.maxDistance || 2) | 0),
  };
  getSessions(world).set(sessionId, session);
  if (!emitDialogOpened(world, session)) closeDialog(world, sessionId, "invalid");
}

function chooseDialog(world, payload) {
  const sessionId = Number(payload?.sessionId || 0) | 0;
  if (!(sessionId > 0)) return;
  const session = getSessions(world).get(sessionId);
  if (!session) return;
  if (!isEntityOnCurrentFloor(world, session.targetId, { treatPlayerAsOnFloor: true, fallbackWhenNoDungeonState: true })) {
    closeDialog(world, sessionId, "off_floor");
    return;
  }

  const def = getDialog(session.dialogId);
  const nodeDef = def?.nodes?.[session.nodeId];
  if (!def || !nodeDef) {
    closeDialog(world, sessionId, "invalid");
    return;
  }

  const choiceId = String(payload?.choiceId || "");
  const choice = visibleChoices(world, session, nodeDef).find((entry) => String(entry.id || "") === choiceId);
  if (!choice) return;

  const ctx = buildContext(world, session, choice);
  world.emit?.("dialog:choice", {
    sessionId,
    actorId: session.actorId,
    targetId: session.targetId,
    dialogId: session.dialogId,
    nodeId: session.nodeId,
    choiceId: choice.id,
  });

  if (typeof choice.onSelect === "function") choice.onSelect(ctx);
  if (Array.isArray(choice.emits)) {
    for (const entry of choice.emits) {
      if (!entry || !entry.name) continue;
      const payloadValue = typeof entry.payload === "function" ? entry.payload(ctx) : entry.payload;
      world.emit?.(entry.name, payloadValue);
    }
  } else if (choice.emit && choice.emit.name) {
    const payloadValue = typeof choice.emit.payload === "function" ? choice.emit.payload(ctx) : choice.emit.payload;
    world.emit?.(choice.emit.name, payloadValue);
  }

  if (choice.close) {
    closeDialog(world, sessionId, "choice");
    return;
  }

  if (choice.to && def.nodes?.[choice.to]) {
    session.nodeId = String(choice.to);
    emitDialogOpened(world, session);
    return;
  }

  closeDialog(world, sessionId, "choice");
}

export function installDialogRuntime(world) {
  if (world[DIALOG_RUNTIME_KEY]) return;
  world[DIALOG_RUNTIME_KEY] = true;
  world.on("dialog:openRequest", (payload) => openDialog(world, payload));
  world.on("dialog:choose", (payload) => chooseDialog(world, payload));
  world.on("dialog:cancel", ({ sessionId }) => closeDialog(world, Number(sessionId || 0) | 0, "cancel"));
  const closeAll = (reason) => {
    const sessionIds = [...getSessions(world).keys()];
    for (const sessionId of sessionIds) closeDialog(world, sessionId, reason);
  };
  world.on("dungeon:teleport-depth", () => closeAll("transition"));
  world.on("dungeon:transitioned", () => closeAll("transition"));
}
