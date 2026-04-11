/**
 * Creature-specific proc, gaze, flying, mimic, nymph, and monster wiring.
 * Lines ~2139-2253 from original.
 */
export function installCreatureMessages(ctx) {
  const { world, log, nameOfEntity, bracketizeName, canSeeAt, playerEntity,
          compGet, spellLabel, richEntity, richSpell, richLabel, NamedIdentity, Player, Position } = ctx;

  // === Gaze events (Floating Eye) ===
  world.on('proc:gaze:message', ({ message }) => {
    if (typeof message === 'string') log(message, 'system');
  });
  world.on('proc:gaze:stun', () => {
    log("The Floating Eye's gaze bores into your skull \u2014 your thoughts freeze solid!", 'danger');
  });
  world.on('channeling:cancelled', ({ actor, spellId, reason }) => {
    if (String(spellId || '') !== 'gaze_beam') return;
    if (reason === 'los_break') log("You break eye contact. The Floating Eye's hold on you snaps.", 'system');
    else if (reason === 'stunned') log("The Floating Eye blinks \u2014 its concentration shatters!", 'system');
    else if (reason === 'caster_moved') log("The Floating Eye looks away. The pressure in your mind eases.", 'system');
    else if (reason === 'dead') { /* no message */ }
    else log("The Floating Eye's gaze falters and releases you.", 'system');
  });

  // === Web Spit events ===
  world.on('spell:web_spit', ({ actor, slowed }) => {
    const ni = NamedIdentity ? world.get(actor, NamedIdentity) : null;
    const name = bracketizeName(String(ni?.name || 'Something'));
    if (slowed) log(`${name} hawks a glob of silk at you \u2014 it hardens instantly! You're stuck!`, 'danger');
    else log(`${name} spits a rope of web across the corridor!`, 'warning');
  });

  world.on('movement:slowed', ({ actor }) => {
    if (!Player || !world.has(actor, Player)) return;
    const lines = [
      'Silk threads cling to your arms \u2014 every step is a fight!',
      'The web stretches but won\u2019t break \u2014 you strain forward!',
      'Gossamer strands drag at your legs like wet rope!',
      'You tear free of one strand only to snag another!',
      'The webbing tightens around your ankles!',
    ];
    const pick = lines[(world.step || 0) % lines.length];
    log(pick, 'warning');
  });

  // === Mimic events ===
  world.on('mimic:revealed', ({ fromIdentity }) => {
    const label = String(fromIdentity || 'chest').replace(/_/g, ' ');
    log(`Wait \u2014 that ${label} has TEETH! It's a Mimic!`, 'danger');
  });

  // === Nymph events ===
  world.on('nymph:stole', ({ itemName }) => {
    const stolen = bracketizeName(String(itemName || 'item'));
    log(`Hey! The Nymph snatched your ${stolen} right out of your hands!`, 'danger');
  });
  world.on('nymph:blinked', () => {
    log('The Nymph blows you a kiss and vanishes. Your item goes with her.', 'warning');
  });

  // === Rust Monster events ===
  world.on('proc:corroded', ({ itemName, stacks }) => {
    const sev = (stacks | 0) >= 3 ? 'crumbling' : 'pitted and corroded';
    log(`The Rust Monster's antennae brush your ${bracketizeName(String(itemName || 'equipment'))} \u2014 it's ${sev}!`, 'danger');
  });

  // === Spell-proc gear messages ===
  world.on('proc:glacierSigil', ({ actor, targetId }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const tid = Number(targetId || 0) | 0;
    const tpos = compGet(tid, Position);
    if (tpos && !canSeeAt(tpos.x, tpos.y)) return;
    const gl = richLabel('Glacier Sigil', '#55ccff');
    const tgtName = nameOfEntity(tid);
    log({ text: `${gl.text} \u2014 ${tgtName} is locked in ice!`, html: `${gl.html} \u2014 ${tgtName} is locked in ice!`, type: 'system' });
  });
  world.on('proc:conductionLens', ({ actor, extraChains }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const links = Math.max(1, Number(extraChains || 1) | 0);
    const cl = richLabel('Conduction Lens', '#ffdd44');
    const suffix = `${links} extra ${links === 1 ? "target caught" : "targets caught"} in the arc!`;
    log({ text: `${cl.text} \u2014 ${suffix}`, html: `${cl.html} \u2014 ${suffix}`, type: 'system' });
  });
  world.on('proc:echoGrimoire:echo', ({ actor, spellId, powerScale }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const pct = Math.max(1, Math.round(Math.max(0, Number(powerScale || 1)) * 100));
    const eg = richLabel('Echo Grimoire', '#c47bff');
    const sp = richSpell(spellId);
    log({ text: `${eg.text} \u2014 ${sp.text} echoes at ${pct}% power!`, html: `${eg.html} \u2014 ${sp.html} echoes at ${pct}% power!`, type: 'system' });
  });

  // === Centipede events ===
  world.on('centipede:split', () => {
    log('You cut the centipede in half \u2014 both halves keep moving!', 'warning');
  });

  // === Monster corpse eating ===
  world.on('monster:corpse-eat', ({ monsterName, behavior, corpseName, at }) => {
    if (!canSeeAt(at?.x, at?.y)) return;
    const name = bracketizeName(String(monsterName || 'creature'));
    const label = bracketizeName(String(corpseName || 'corpse'));
    if (behavior === 'devour') log(`${name} tears into ${label} \u2014 you can hear bones cracking from here.`, 'warning');
    else log(`${name} noses at ${label} and takes a bite.`, 'info');
  });

  // === Flying events ===
  world.on('proc:fly:takeoff', ({ name, x, y }) => {
    if (!canSeeAt(x, y)) return;
    log(`The ${name || 'creature'} spreads its wings and rises into the air!`, 'system');
  });
  world.on('proc:fly:land', ({ name, x, y }) => {
    if (!canSeeAt(x, y)) return;
    log(`The ${name || 'creature'} folds its wings and drops to the ground.`, 'system');
  });
}
