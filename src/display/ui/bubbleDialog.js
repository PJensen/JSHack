// src/display/ui/bubbleDialog.js
// Self-contained speech bubble dialog overlay.
// Pure DOM — no ECS, no rules imports. Receives position via callbacks.

/**
 * @typedef {{
 *   open: boolean,
 *   sessionId: number,
 *   actorId: number,
 *   targetId: number,
 *   maxDistance: number,
 * }} BubbleDialogState
 */

/**
 * Create the DOM elements for the bubble dialog.
 */
function createBubbleDialogDom() {
  const el = document.createElement("div");
  const title = document.createElement("div");
  const body = document.createElement("div");
  const choices = document.createElement("div");
  const tail = document.createElement("div");
  const connector = document.createElement("div");
  const speakerDot = document.createElement("div");

  el.id = "speech-bubble-dialog";
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "90",
    display: "none",
    pointerEvents: "auto",
    minWidth: "220px",
    maxWidth: "min(78vw, 360px)",
    padding: "10px 12px 12px",
    borderRadius: "16px",
    border: "2px solid rgba(75,62,43,0.9)",
    background: "rgba(252,248,238,0.98)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
    transform: "translate(-9999px, -9999px)",
    overflow: "visible",
  });
  Object.assign(tail.style, {
    position: "absolute",
    left: "50%",
    bottom: "-14px",
    width: "20px",
    height: "20px",
    background: "rgba(252,248,238,0.98)",
    borderRight: "2px solid rgba(75,62,43,0.9)",
    borderBottom: "2px solid rgba(75,62,43,0.9)",
    transform: "translateX(-50%) rotate(45deg)",
    borderBottomRightRadius: "4px",
    pointerEvents: "none",
    boxShadow: "4px 4px 10px rgba(0,0,0,0.10)",
  });
  Object.assign(connector.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "0",
    height: "3px",
    display: "none",
    pointerEvents: "none",
    transformOrigin: "0 50%",
    backgroundImage: "repeating-linear-gradient(90deg, rgba(90,74,48,0.92) 0 7px, rgba(90,74,48,0) 7px 13px)",
    filter: "drop-shadow(0 0 1px rgba(255,250,240,0.85))",
    zIndex: "91",
  });
  Object.assign(speakerDot.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "10px",
    height: "10px",
    display: "none",
    pointerEvents: "none",
    borderRadius: "999px",
    border: "2px solid rgba(75,62,43,0.95)",
    background: "rgba(252,248,238,1)",
    boxShadow: "0 0 0 2px rgba(255,250,240,0.65)",
    zIndex: "92",
  });
  Object.assign(title.style, {
    font: "700 14px 'Trebuchet MS', sans-serif",
    color: "#4b3e2b",
    marginBottom: "6px",
  });
  Object.assign(body.style, {
    font: "400 15px 'Trebuchet MS', sans-serif",
    lineHeight: "1.35",
    color: "#261f16",
    marginBottom: "10px",
  });
  Object.assign(choices.style, {
    display: "grid",
    gap: "8px",
  });

  el.appendChild(title);
  el.appendChild(body);
  el.appendChild(choices);
  el.appendChild(tail);
  document.body.appendChild(connector);
  document.body.appendChild(speakerDot);
  document.body.appendChild(el);
  return { el, title, body, choices, tail, connector, speakerDot };
}

/**
 * Create a BubbleDialogController.
 *
 * @param {object} deps
 * @param {(id:number) => ({x:number,y:number}|null)} deps.getPosition
 * @param {() => ({id:number, pos:{x:number,y:number}}|null)} deps.playerEntity
 * @param {HTMLCanvasElement} deps.canvas
 * @param {() => object} deps.getCam
 * @param {(cam:object, x:number, y:number, dims:object) => [number,number]} deps.worldToScreen
 * @param {() => {cssW:number, cssH:number}} deps.getCanvasSetup
 */
export function createBubbleDialogController({ getPosition, playerEntity, canvas, getCam, worldToScreen, getCanvasSetup }) {
  const dom = createBubbleDialogDom();

  /** @type {BubbleDialogState} */
  let state = { open: false, sessionId: 0, actorId: 0, targetId: 0, maxDistance: 2 };

  function getSpeakerBubbleLiftPx() {
    const cam = getCam();
    const scale = Math.max(1, Number(cam?.scale) || 1);
    return Math.max(32, Math.min(96, Math.round(scale * 1.15)));
  }

  function getSpeakerBubbleAnchorPos(pos) {
    return {
      x: Number(pos?.x || 0),
      y: Number(pos?.y || 0) - 0.68,
    };
  }

  function close() {
    state = { open: false, sessionId: 0, actorId: 0, targetId: 0, maxDistance: 2 };
    dom.el.style.display = "none";
    dom.el.style.transform = "translate(-9999px, -9999px)";
    dom.connector.style.display = "none";
    dom.connector.style.width = "0";
    dom.speakerDot.style.display = "none";
    dom.choices.innerHTML = "";
  }

  function open(detail = {}) {
    const choices = Array.isArray(detail?.choices) ? detail.choices : [];
    state = {
      open: true,
      sessionId: Number(detail?.sessionId || 0) | 0,
      actorId: Number(detail?.actorId || 0) | 0,
      targetId: Number(detail?.targetId || 0) | 0,
      maxDistance: Math.max(1, Number(detail?.maxDistance || 2) | 0),
    };
    dom.title.textContent = String(detail?.speakerName || "Someone");
    dom.body.textContent = String(detail?.text || "...");
    dom.choices.innerHTML = "";
    for (const choice of choices) {
      const btn = document.createElement("button");
      btn.textContent = String(choice?.label || choice?.id || "Continue");
      Object.assign(btn.style, {
        minHeight: "40px",
        padding: "8px 10px",
        borderRadius: "10px",
        border: "1px solid rgba(75,62,43,0.35)",
        background: "rgba(255,255,255,0.96)",
        color: "#241d15",
        font: "600 14px 'Trebuchet MS', sans-serif",
        textAlign: "left",
        cursor: "pointer",
        touchAction: "manipulation",
      });
      btn.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("ui:requestDialogChoice", {
          detail: { sessionId: state.sessionId, choiceId: String(choice?.id || "") },
        }));
      });
      dom.choices.appendChild(btn);
    }
    dom.el.style.display = "block";
  }

  function layout() {
    if (!state.open) return;
    const speakerPos = getPosition(state.targetId || state.actorId);
    const pe = playerEntity();
    if (speakerPos && pe) {
      const dist = Math.max(
        Math.abs((speakerPos.x | 0) - (pe.pos.x | 0)),
        Math.abs((speakerPos.y | 0) - (pe.pos.y | 0)),
      );
      if (dist > (state.maxDistance | 0)) {
        window.dispatchEvent(new CustomEvent("ui:requestDialogClose", {
          detail: { sessionId: state.sessionId },
        }));
        return;
      }
    }
    const targetId = state.targetId || state.actorId;
    const pos = getPosition(targetId);
    if (!pos) { close(); return; }

    const anchor = getSpeakerBubbleAnchorPos(pos);
    const cam = getCam();
    const canvasSetup = getCanvasSetup();
    const rect = typeof canvas.getBoundingClientRect === "function"
      ? canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: canvas.offsetWidth || canvasSetup.cssW, height: canvas.offsetHeight || canvasSetup.cssH };
    const logicalCanvas = {
      width: canvas.offsetWidth || canvasSetup.cssW,
      height: canvas.offsetHeight || canvasSetup.cssH,
    };
    const [localX, localY] = worldToScreen(cam, anchor.x, anchor.y, logicalCanvas);
    const rxScale = rect.width / logicalCanvas.width;
    const ryScale = rect.height / logicalCanvas.height;
    const sx = rect.left + localX * rxScale;
    const sy = rect.top + localY * ryScale;
    const boxW = dom.el.offsetWidth || 280;
    const boxH = dom.el.offsetHeight || 120;
    const lift = getSpeakerBubbleLiftPx();
    const viewportW = typeof window !== "undefined" ? window.innerWidth : logicalCanvas.width;
    const viewportH = typeof window !== "undefined" ? window.innerHeight : logicalCanvas.height;
    const left = Math.max(10, Math.min(viewportW - boxW - 10, Math.round(sx - (boxW / 2))));
    const top = Math.max(10, Math.min(viewportH - boxH - 30, Math.round(sy - boxH - 12 - lift)));
    dom.el.style.transform = `translate(${left}px, ${top}px)`;

    const tailTipX = left + (boxW * 0.5);
    const tailTipY = top + boxH + 18;
    const dx = sx - tailTipX;
    const dy = sy - tailTipY;
    const dist = Math.hypot(dx, dy);
    if (dist > 6) {
      dom.connector.style.display = "block";
      dom.connector.style.width = `${Math.round(dist)}px`;
      dom.connector.style.transform = `translate(${Math.round(tailTipX)}px, ${Math.round(tailTipY)}px) rotate(${Math.atan2(dy, dx)}rad)`;
      dom.speakerDot.style.display = "block";
      dom.speakerDot.style.transform = `translate(${Math.round(sx - 5)}px, ${Math.round(sy - 5)}px)`;
    } else {
      dom.connector.style.display = "none";
      dom.connector.style.width = "0";
      dom.speakerDot.style.display = "none";
    }
  }

  function isOpen() { return state.open; }
  function getSessionId() { return state.sessionId; }

  // ── Window event wiring ───────────────────────────────────────────────
  addEventListener("ui:openBubbleDialog", (ev) => {
    const detail = /** @type {CustomEvent} */ (ev).detail || {};
    open(detail);
  });

  addEventListener("ui:closeBubbleDialog", () => { close(); });

  addEventListener("keydown", (ev) => {
    if (!state.open) return;
    if (ev.key !== "Escape") return;
    window.dispatchEvent(new CustomEvent("ui:requestDialogClose", {
      detail: { sessionId: state.sessionId },
    }));
    ev.preventDefault();
  });

  return { open, close, layout, isOpen, getSessionId };
}
