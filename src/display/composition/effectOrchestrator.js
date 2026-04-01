/**
 * Advance display-only effect lifetimes.
 */
export function tickDisplayEffects({ dtSec, boltFx, spellAreaFx, projectileFx, throwFx, cloudFx, ftext, goreTick }) {
  boltFx.tick(dtSec);
  spellAreaFx.tick(dtSec);
  projectileFx.tick(dtSec);
  throwFx.tick(dtSec);
  cloudFx.tick(dtSec);
  ftext.step(dtSec);
  if (goreTick) goreTick();
}

/**
 * Draw world-space effects in the canonical pass order.
 */
export function drawWorldEffects({ bctx, worldView, glyphAtlas, boltFx, spellAreaFx, projectileFx, throwFx, cloudFx, fx, PERF }) {
  if (!bctx) return;
  throwFx.draw(bctx, worldView, glyphAtlas);
  boltFx.drawBolts(bctx);
  boltFx.drawDeityWrath(bctx);
  spellAreaFx.drawBlink(bctx);
  spellAreaFx.drawMeteor(bctx);
  spellAreaFx.drawBlastwave(bctx);
  if (typeof spellAreaFx.drawDrainLife === "function") {
    spellAreaFx.drawDrainLife(bctx);
  }
  // Frost + Shadow bolt VFX are drawn by projectileFx.draw() (projectile style).
  if (typeof spellAreaFx.drawFlashHeal === "function") {
    spellAreaFx.drawFlashHeal(bctx);
  }
  if (typeof spellAreaFx.drawSmite === "function") {
    spellAreaFx.drawSmite(bctx);
  }
  spellAreaFx.drawPhaseStrike(bctx);
  if (typeof spellAreaFx.drawRampage === "function") {
    spellAreaFx.drawRampage(bctx);
  }
  if (typeof spellAreaFx.drawSearchPulse === "function") {
    spellAreaFx.drawSearchPulse(bctx);
  }
  projectileFx.draw(bctx);
  if (typeof cloudFx.drawFire === "function") {
    cloudFx.drawFire(bctx);
  }
  cloudFx.drawPoison(bctx);
  cloudFx.drawPlasma(bctx);
  if (typeof cloudFx.drawQuake === "function") {
    cloudFx.drawQuake(bctx);
  }
  fx.render({
    mode: (PERF.quality === "low" ? "source-over" : "lighter"),
    alphaScale: 0.9,
    shape: (PERF.quality === "low" ? "rect" : "circle"),
  });
}

/**
 * Draw screen-space effects layered above world presentation.
 */
export function drawScreenEffects({ ctx, W, H, boltFx }) {
  if (!boltFx.hasScreenEffects()) return;
  boltFx.drawScreenFlash(ctx, W, H);
  boltFx.drawScreenBolts(ctx, W, H);
}
