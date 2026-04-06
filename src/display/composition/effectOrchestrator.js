/**
 * Advance display-only effect lifetimes.
 */
export function tickDisplayEffects({ dtSec, boltFx, spellAreaFx, projectileFx, throwFx, pickupFx, cloudFx, spiritWispFx, deathEssenceFx, ftext, goreTick }) {
  boltFx.tick(dtSec);
  spellAreaFx.tick(dtSec);
  projectileFx.tick(dtSec);
  throwFx.tick(dtSec);
  if (pickupFx) pickupFx.tick(dtSec);
  cloudFx.tick(dtSec);
  if (spiritWispFx) spiritWispFx.tick(dtSec);
  if (deathEssenceFx) deathEssenceFx.tick(dtSec);
  ftext.step(dtSec);
  if (goreTick) goreTick(dtSec);
}

/**
 * Draw world-space effects in the canonical pass order.
 */
export function drawWorldEffects({ bctx, worldView, glyphAtlas, boltFx, spellAreaFx, projectileFx, throwFx, pickupFx, cloudFx, spiritWispFx, deathEssenceFx, fx, PERF }) {
  if (!bctx) return;
  throwFx.draw(bctx, worldView, glyphAtlas);
  if (pickupFx) pickupFx.draw(bctx, worldView, glyphAtlas);
  boltFx.drawBolts(bctx);
  boltFx.drawDeityWrath(bctx);
  spellAreaFx.drawBlink(bctx);
  spellAreaFx.drawMeteor(bctx);
  spellAreaFx.drawBlastwave(bctx);
  if (typeof spellAreaFx.drawDrainLife === "function") {
    spellAreaFx.drawDrainLife(bctx);
  }
  if (typeof spellAreaFx.drawEvocation === "function") {
    spellAreaFx.drawEvocation(bctx);
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
  // Class ability VFX
  if (typeof spellAreaFx.drawCleave === "function") {
    spellAreaFx.drawCleave(bctx);
  }
  if (typeof spellAreaFx.drawWarCry === "function") {
    spellAreaFx.drawWarCry(bctx);
  }
  if (typeof spellAreaFx.drawDivineShield === "function") {
    spellAreaFx.drawDivineShield(bctx);
  }
  if (typeof spellAreaFx.drawConsecrate === "function") {
    spellAreaFx.drawConsecrate(bctx);
  }
  if (typeof spellAreaFx.drawSmokeBomb === "function") {
    spellAreaFx.drawSmokeBomb(bctx);
  }
  projectileFx.draw(bctx);
  if (spiritWispFx) spiritWispFx.draw(bctx);
  if (deathEssenceFx) deathEssenceFx.draw(bctx);
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
