/**
 * Creature-specific proc, gaze, flying, mimic, nymph, and monster wiring.
 * Lines ~2139-2253 from original.
 */
export function installCreatureMessages(ctx) {
  const { world, log, nameOfEntity, bracketizeName, canSeeAt, playerEntity,
          compGet, spellLabel, NamedIdentity, Player, Position } = ctx;

  // === Gaze events (Floating Eye) ===
  world.on('proc:gaze:message', ({ message }) => {
    if (typeof message === 'string') log(message, 'system');
  });
  world.on('proc:gaze:stun', () => {
    log("The Floating Eye's gaze locks your mind \u2014 you are stunned!", 'danger');
  });
  world.on('channeling:cancelled', ({ actor, spellId, reason }) => {
    if (String(spellId || '') !== 'gaze_beam') return;
    if (reason === 'los_break') log("The Floating Eye's gaze fades as it loses sight of you.", 'system');
    else if (reason === 'stunned') log("The Floating Eye's concentration shatters!", 'system');
    else if (reason === 'caster_moved') log("The Floating Eye breaks its gaze as it shifts position.", 'system');
    else if (reason === 'dead') { /* no message */ }
    else log("The Floating Eye's gaze falters.", 'system');
  });

  // === Web Spit events ===
  world.on('spell:web_spit', ({ actor, slowed }) => {
    const ni = NamedIdentity ? world.get(actor, NamedIdentity) : null;
    const name = bracketizeName(String(ni?.name || 'Something'));
    if (slowed) log(`${name} spits a web at you \u2014 you're stuck!`, 'danger');
    else log(`${name} spits a glob of web!`, 'warning');
  });

  world.on('movement:slowed', ({ actor }) => {
    if (!Player || !world.has(actor, Player)) return;
    const lines = [
      'You struggle against the sticky web!',
      'You wriggle but the web slows you!',
      'The web clings to you \u2014 you stumble!',
      'You strain against the webbing!',
      'Sticky silk drags at your limbs!',
    ];
    const pick = lines[(world.step || 0) % lines.length];
    log(pick, 'warning');
  });

  // === Mimic events ===
  world.on('mimic:revealed', ({ fromIdentity }) => {
    const label = String(fromIdentity || 'chest').replace(/_/g, ' ');
    log(`The ${label} lurches \u2014 it's a Mimic!`, 'danger');
  });

  // === Nymph events ===
  world.on('nymph:stole', ({ itemName }) => {
    log(`The Nymph snatched your ${bracketizeName(String(itemName || 'item'))}!`, 'danger');
  });
  world.on('nymph:blinked', () => {
    log('The Nymph vanishes in a shimmer of light!', 'warning');
  });

  // === Rust Monster events ===
  world.on('proc:corroded', ({ itemName, stacks }) => {
    const severity = (stacks | 0) >= 3 ? 'badly corroded' : 'corroded';
    log(`The Rust Monster's touch has ${severity} your ${bracketizeName(String(itemName || 'equipment'))}!`, 'danger');
  });

  // === Spell-proc gear messages ===
  world.on('proc:glacierSigil', ({ actor, targetId }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const tid = Number(targetId || 0) | 0;
    const tpos = compGet(tid, Position);
    if (tpos && !canSeeAt(tpos.x, tpos.y)) return;
    log(`${bracketizeName("Glacier Sigil")} locks ${nameOfEntity(tid)} in ice!`, 'system');
  });
  world.on('proc:conductionLens', ({ actor, extraChains }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const links = Math.max(1, Number(extraChains || 1) | 0);
    log(`${bracketizeName("Conduction Lens")} forks your lightning to ${links} extra ${links === 1 ? "target" : "targets"}.`, 'system');
  });
  world.on('proc:echoGrimoire:echo', ({ actor, spellId, powerScale }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const pct = Math.max(1, Math.round(Math.max(0, Number(powerScale || 1)) * 100));
    log(`${bracketizeName("Echo Grimoire")} echoes ${bracketizeName(spellLabel(spellId))} for free (${pct}% power).`, 'system');
  });

  // === Centipede events ===
  world.on('centipede:split', () => {
    log('The centipede splits in two!', 'warning');
  });

  // === Monster corpse eating ===
  world.on('monster:corpse-eat', ({ monsterName, behavior, corpseName, at }) => {
    if (!canSeeAt(at?.x, at?.y)) return;
    const name = bracketizeName(String(monsterName || 'creature'));
    const label = bracketizeName(String(corpseName || 'corpse'));
    if (behavior === 'devour') log(`${name} devours ${label} and swells with stolen vitality!`, 'warning');
    else log(`${name} gnaws on ${label}.`, 'info');
  });

  // === Flying events ===
  world.on('proc:fly:takeoff', ({ name, x, y }) => {
    if (!canSeeAt(x, y)) return;
    log(`The ${name || 'creature'} takes to the air!`, 'system');
  });
  world.on('proc:fly:land', ({ name, x, y }) => {
    if (!canSeeAt(x, y)) return;
    log(`The ${name || 'creature'} lands.`, 'system');
  });
}
