function readStoredNumber(key, fallback = 0) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readStoredString(key, fallback = "") {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return typeof raw === "string" ? raw : fallback;
  } catch {
    return fallback;
  }
}

function parsePositiveFloat(raw, fallback = null) {
  const value = Number.parseFloat(String(raw ?? ""));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parsePositiveInt(raw, fallback = null) {
  const value = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseNonNegativeInt(raw, fallback = null) {
  const value = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function buildPerfConfig(params) {
  const q = (
    params.get("quality") ||
    readStoredString("jshack.quality", "high") ||
    "high"
  ).toLowerCase();
  const defaultCap = 1.5;
  const dprCapArg = Number(params.get("dprCap")) || readStoredNumber("jshack.dprCap", 0);
  const dprCap = Number.isFinite(dprCapArg) && dprCapArg > 0 ? dprCapArg : defaultCap;
  const isLow = q === "low";
  const isHigh = q === "high";
  return {
    quality: q,
    dprCap: isHigh ? 3 : (isLow ? 1 : dprCap),
    glowLayers: isLow ? 0 : 2,
    particleCapacity: isLow ? 512 : 4096,
    cameraLerp: params.get("cameraLerp") !== null ? Number(params.get("cameraLerp")) : 0,
  };
}

export function readRuntimeConfig() {
  const params = new URLSearchParams(window.location.search || "");
  return {
    params,
    perf: buildPerfConfig(params),
    startDepth: parseNonNegativeInt(params.get("floor"), 0) ?? 0,
    dungeonScale: parsePositiveFloat(params.get("dungeonScale"), null),
    chosenDeityId: params.get("deity") || "molkhar",
    giveParam:    params.get("give")    || "",
    effectsParam: params.get("effects") || "",
    debug:        params.has("debug"),
    identifyItems: params.get("identify") !== "off",
  };
}
