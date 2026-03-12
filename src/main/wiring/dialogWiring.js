const INSTALLED = Symbol.for("jshack:main:dialogWiring:installed");

/**
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 * }} opts
 */
export function installDialogWiring({ world }) {
  if (!world) return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on("dialog:opened", (detail) => {
    try {
      window.dispatchEvent(new CustomEvent("ui:openDialog", { detail }));
    } catch (e) { console.debug("[dialogWiring] dispatch ui:openDialog:", e); }
  });

  world.on("dialog:closed", (detail) => {
    try {
      window.dispatchEvent(new CustomEvent("ui:closeDialog", { detail }));
    } catch (e) { console.debug("[dialogWiring] dispatch ui:closeDialog:", e); }
  });

  addEventListener("ui:requestDialogChoice", (ev) => {
    const detail = /** @type {CustomEvent} */ (ev).detail || {};
    world.emit?.("dialog:choose", detail);
  });

  addEventListener("ui:requestDialogClose", (ev) => {
    const detail = /** @type {CustomEvent} */ (ev).detail || {};
    world.emit?.("dialog:cancel", detail);
  });
}
