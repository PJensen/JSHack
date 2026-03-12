import { QuestState } from "../components/QuestState.js";
import { QuestVars } from "../components/QuestVars.js";
import { QuestLog } from "../components/QuestLog.js";

function cloneData(data) {
  if (!data || typeof data !== "object") return {};
  return { ...data };
}

export function setVar(key, valueOrFn) {
  return (ctx) => {
    const rec = ctx.world.get(ctx.qid, QuestVars);
    const data = cloneData(rec?.data);
    data[key] = typeof valueOrFn === "function" ? valueOrFn(ctx) : valueOrFn;
    ctx.world.set(ctx.qid, QuestVars, { data });
  };
}

export function incVar(key, amount = 1) {
  return (ctx) => {
    const rec = ctx.world.get(ctx.qid, QuestVars);
    const data = cloneData(rec?.data);
    const delta = typeof amount === "function" ? Number(amount(ctx) || 0) : Number(amount || 0);
    data[key] = Number(data[key] || 0) + delta;
    ctx.world.set(ctx.qid, QuestVars, { data });
  };
}

export function emit(eventName, payloadOrFn = undefined) {
  return (ctx) => {
    const payload = typeof payloadOrFn === "function" ? payloadOrFn(ctx) : payloadOrFn;
    ctx.world.emit?.(eventName, payload);
  };
}

export function setStatus(status) {
  return (ctx) => {
    const state = ctx.world.get(ctx.qid, QuestState);
    if (!state) return;
    ctx.world.set(ctx.qid, QuestState, {
      ...state,
      status: String(status || state.status || "active"),
    });
  };
}

export function noteError(message) {
  return (ctx) => {
    const log = ctx.world.get(ctx.qid, QuestLog);
    if (!log) return;
    ctx.world.set(ctx.qid, QuestLog, {
      ...log,
      lastError: String(typeof message === "function" ? message(ctx) : message || ""),
    });
  };
}
