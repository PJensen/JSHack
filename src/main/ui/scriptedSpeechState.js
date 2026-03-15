function clampNonNegative(value) {
  return Math.max(0, Number(value) || 0);
}

export function createScriptedSpeechBubble({
  entityId,
  text,
  delaySec = 0,
  durationSec = 3.4,
  delayTurns = 0,
  holdTurns = 0,
  onShow = null,
}) {
  const usesTurnPacing = clampNonNegative(delayTurns) > 0 || clampNonNegative(holdTurns) > 0;
  return {
    entityId: Number(entityId || 0) | 0,
    text: String(text || ""),
    delaySec: usesTurnPacing ? 0 : clampNonNegative(delaySec),
    ttlSec: usesTurnPacing ? 0 : clampNonNegative(durationSec),
    durationSec: usesTurnPacing ? 0 : clampNonNegative(durationSec),
    delayTurns: usesTurnPacing ? Math.floor(clampNonNegative(delayTurns)) : 0,
    holdTurns: usesTurnPacing ? Math.max(1, Math.floor(clampNonNegative(holdTurns) || 1)) : 0,
    usesTurnPacing,
    lastStepSeen: null,
    onShow: typeof onShow === "function" ? onShow : null,
  };
}

export function activateScriptedSpeechBubble(bubble, step) {
  if (!bubble) return createScriptedSpeechBubble({ entityId: 0, text: "" });
  return {
    ...bubble,
    lastStepSeen: Number.isFinite(step) ? (step | 0) : 0,
  };
}

export function advanceScriptedSpeechBubble(bubble, step, dtSec) {
  if (!(bubble?.entityId > 0) || !bubble.text) {
    return { bubble, didShow: false, isExpired: false };
  }

  if (bubble.usesTurnPacing) {
    const currentStep = Number.isFinite(step) ? (step | 0) : 0;
    const lastStep = Number.isFinite(bubble.lastStepSeen) ? (bubble.lastStepSeen | 0) : currentStep;
    let remainingDelay = bubble.delayTurns | 0;
    let remainingHold = bubble.holdTurns | 0;
    let didShow = false;

    if (currentStep > lastStep) {
      let stepDelta = currentStep - lastStep;
      if (remainingDelay > 0) {
        const consumedDelay = Math.min(remainingDelay, stepDelta);
        remainingDelay -= consumedDelay;
        stepDelta -= consumedDelay;
        if (remainingDelay === 0 && typeof bubble.onShow === "function") didShow = true;
      }
      if (remainingDelay === 0 && stepDelta > 0) {
        remainingHold = Math.max(0, remainingHold - stepDelta);
      }
    }

    return {
      bubble: {
        ...bubble,
        delayTurns: remainingDelay,
        holdTurns: remainingHold,
        lastStepSeen: currentStep,
      },
      didShow,
      onShow: didShow ? bubble.onShow : null,
      isExpired: remainingDelay === 0 && remainingHold <= 0,
    };
  }

  const dt = clampNonNegative(dtSec);
  let didShow = false;
  if (bubble.delaySec > 0) {
    const nextDelaySec = Math.max(0, bubble.delaySec - dt);
    didShow = nextDelaySec === 0 && typeof bubble.onShow === "function";
    return {
      bubble: {
        ...bubble,
        delaySec: nextDelaySec,
      },
      didShow,
      onShow: didShow ? bubble.onShow : null,
      isExpired: false,
    };
  }

  const ttlSec = Math.max(0, bubble.ttlSec - dt);
  return {
    bubble: {
      ...bubble,
      ttlSec,
    },
    didShow: false,
    onShow: null,
    isExpired: ttlSec <= 0,
  };
}
