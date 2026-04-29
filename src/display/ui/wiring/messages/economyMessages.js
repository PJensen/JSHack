/**
 * Harvest, alchemy, smithy, mill, town economy, townfolk, bulletin board wiring.
 * Lines ~1555-1593, ~1741-1893, ~1974-2037 from original.
 */
export function installEconomyMessages(ctx) {
  const { world, log, nameOfEntity, nameOfItem, bracketizeName, playerEntity,
          compGet, canSeeAt, formatBulletinDistrictLine, formatBulletinRumors,
          formatIngredientBag, harvestYieldLabel, harvestNodeLabel, isOreKind,
          BULLETIN_SECTOR_LABELS, Position } = ctx;
  const formatEnchantingBag = (bag, { includeZero = false } = {}) => {
    const labels = {
      emberRoot: 'ember root',
      moonleaf: 'moonleaf',
      thornPods: 'thorn pods',
      venomFronds: 'venom fronds',
      oil: 'oil',
      water: 'water',
      gold: 'gold',
    };
    const parts = [];
    for (const [key, label] of Object.entries(labels)) {
      const count = Math.max(0, Number(bag?.[key] || 0) | 0);
      if (!includeZero && count <= 0) continue;
      parts.push(`${count} ${label}`);
    }
    return parts.join(', ');
  };

  world.on('town:bulletinBoard', ({ actor, districts, opportunityView, questBoard }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const payload = {
      districts: Array.isArray(districts) ? districts : [],
      opportunityView: opportunityView && typeof opportunityView === 'object' ? opportunityView : null,
      questBoard: questBoard && typeof questBoard === 'object' ? questBoard : null,
    };
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('ui:openTownBoard'));
        window.dispatchEvent(new CustomEvent('ui:townBoardData', { detail: payload }));
      } catch (e) {
        console.debug('[messageWiring] dispatch town board overlay events:', e);
      }
    }
    log('--- TOWN BOARD ---', 'system');
    const bulletins = Array.isArray(districts) ? districts : [];
    if (!bulletins.length) { log('The board is empty.', 'system'); return; }
    for (const bulletin of bulletins.slice(0, 4)) {
      log(formatBulletinDistrictLine(bulletin), 'system');
    }
    const sectors = Array.isArray(opportunityView?.profitableSectors)
      ? opportunityView.profitableSectors
      : [];
    if (sectors.length) {
      const labels = sectors.map((sector) => BULLETIN_SECTOR_LABELS[sector] || String(sector || "").replace(/_/g, " "));
      log(`Profitable work: ${labels.join(', ')}.`, 'system');
    }
    const rumor = formatBulletinRumors(bulletins);
    if (rumor) log(rumor, 'system');
  });

  // === Harvest events ===
  world.on('harvest:picked', ({ actor, kind, count, itemId }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const yieldLabel = harvestYieldLabel(kind);
    const itemLabel = itemId ? nameOfItem(itemId) : bracketizeName(yieldLabel);
    const verb = isOreKind(kind) ? 'mine' : 'harvest';
    log(`You ${verb} ${count} ${yieldLabel} (${itemLabel}).`, 'system');
  });

  world.on('harvest:empty', ({ actor, kind }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const nodeLabel = harvestNodeLabel(kind);
    if (isOreKind(kind)) log(`The ${nodeLabel} is exhausted.`, 'system');
    else log(`The ${nodeLabel} is picked clean.`, 'system');
  });

  world.on('harvest:regrown', ({ id, kind }) => {
    const pe = playerEntity(world);
    if (!pe) return;
    const ppos = compGet(pe.id, Position);
    const pos = compGet(Number(id || 0), Position);
    if (!ppos || !pos) return;
    const dist = Math.max(Math.abs(ppos.x - pos.x), Math.abs(ppos.y - pos.y));
    if (dist > 6) return;
    const k = String(kind || "").toLowerCase();
    let what;
    if (k === "iron_ore") what = "An iron vein shimmers with fresh ore nearby.";
    else if (k === "coal_ore") what = "A coal seam darkens with fresh deposits nearby.";
    else if (k === "stone") what = "A stone outcrop juts up fresh rock nearby.";
    else if (k === "herbs") what = "A herb patch looks fresh again.";
    else if (k === "thorn_bramble") what = "A thorn bramble thickens nearby.";
    else if (k === "venom_fern") what = "A venom fern unfurls fresh fronds nearby.";
    else if (k === "wheat") what = "A wheat crop has grown back.";
    else if (k === "carrot") what = "A carrot plant sprouts anew.";
    else if (k === "corn") what = "A corn stalk shoots up nearby.";
    else if (k === "tree") what = "A tree has regrown nearby.";
    else what = "A berry bush ripens nearby.";
    log(what, 'ambient');
  });

  world.on('harvest:no_tool', ({ actor, kind }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You need a pickaxe to mine the ${harvestNodeLabel(kind)}.`, 'system');
  });

  world.on('harvest:no_stamina', ({ actor, kind, cost }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You're too exhausted to mine the ${harvestNodeLabel(kind)}. (${cost} stamina needed)`, 'system');
  });

  world.on('harvest:danger', ({ actor, kind, effect, damage }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const n = Math.max(0, Number(damage || 0) | 0);
    if (effect === 'thorns') { log(`The thorn bramble bites your hands${n > 0 ? ` for ${n}` : ''}.`, 'combat'); return; }
    if (effect === 'spores') {
      const dmgText = n > 0 ? ` You take ${n} poison damage.` : '';
      log(`Venom spores burst from the fern.${dmgText}`, 'combat');
    }
  });

  world.on('harvest:seed_drop', ({ actor, kind }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const label = kind === 'wheat' ? 'wheat' : kind === 'carrot' ? 'carrot' : kind === 'corn' ? 'corn' : kind;
    log(`You find some ${label} seeds!`, 'system');
  });

  world.on('seed:planted', ({ actor, kind }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const label = kind === 'wheat' ? 'wheat' : kind === 'carrot' ? 'carrot' : kind === 'corn' ? 'corn' : kind;
    log(`You plant ${label} seeds in the soil.`, 'system');
  });

  // === Alchemy events ===
  world.on('alchemy:open', ({ actor, ingredients }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const summary = formatIngredientBag(ingredients, { includeZero: true });
    log(`You open the alchemy bench. (${summary || "no reagents"})`, 'system');
  });

  world.on('alchemy:crafted', ({ actor, recipeLabel, outputName, outputCount }) => {
    if (nameOfEntity(actor) !== 'You') return;
    const count = Math.max(1, Number(outputCount || 1) | 0);
    log(`You distill ${bracketizeName(String(recipeLabel || 'brew'))} and craft ${count} ${bracketizeName(String(outputName || 'vial'))}.`, 'system');
  });

  world.on('alchemy:result', ({ actor, result, missing, recipeKey }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (result === 'missing_ingredients') { log(`Missing ingredients for ${recipeKey || 'that recipe'}: ${formatIngredientBag(missing) || "requirements not met"}.`, 'system'); return; }
    if (result === 'unknown_recipe') { log('That alchemy recipe is unknown.', 'system'); return; }
    if (result === 'no_inventory') { log('You need an inventory to carry brewed vials.', 'system'); return; }
    if (result === 'brew_failed') log('The brew collapses into sludge.', 'system');
  });

  // === Enchanting events ===
  world.on('enchanting:open', ({ actor, ingredients }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You open the enchanting bench. (${formatEnchantingBag(ingredients, { includeZero: true }) || "no stock"})`, 'system');
  });

  world.on('enchanting:crafted', ({ actor, recipeLabel, outputName }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You scribe ${bracketizeName(String(recipeLabel || 'an enchantment'))} and receive ${bracketizeName(String(outputName || 'a scroll'))}.`, 'system');
  });

  world.on('enchanting:result', ({ actor, result, missing, recipeKey }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (result === 'missing_requirements') {
      log(`Missing materials for ${recipeKey || 'that enchant'}: ${formatEnchantingBag(missing) || "requirements not met"}.`, 'system');
      return;
    }
    if (result === 'unknown_recipe') { log('That enchantment recipe is unknown.', 'system'); return; }
    if (result === 'no_inventory') { log('You need an inventory to carry the finished scroll.', 'system'); return; }
    if (result === 'craft_failed') log('The glyph buckles and the enchantment fails to take hold.', 'system');
  });

  // === Mill events ===
  world.on('mill:milled', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('You grind wheat into fresh flour at the millstone.', 'system');
  });

  world.on('mill:failed', ({ actor, reason }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (reason === 'missing_wheat') { log('You need wheat before the millstone can do any work.', 'system'); return; }
    if (reason === 'no_inventory') { log('You need some way to carry the flour.', 'system'); return; }
    log('The millstone grinds to a halt.', 'system');
  });

  // === Smithy events ===
  world.on('smithy:smelted', ({ actor }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log('You fire the forge and smelt ore into a workable iron ingot.', 'system');
  });

  world.on('smithy:forged', ({ actor, outputName }) => {
    if (nameOfEntity(actor) !== 'You') return;
    log(`You hammer out ${bracketizeName(String(outputName || 'new tools'))} at the anvil.`, 'system');
  });

  world.on('smithy:failed', ({ actor, reason, station }) => {
    if (nameOfEntity(actor) !== 'You') return;
    if (station === 'furnace') {
      if (reason === 'missing_ore') log('You need iron ore to fire the forge.', 'system');
      else if (reason === 'missing_fuel') log('The forge needs coal before you can smelt anything.', 'system');
      else log('The forge sputters without producing anything useful.', 'system');
      return;
    }
    if (reason === 'missing_iron') log('You need smelted iron before the anvil can shape anything.', 'system');
    else if (reason === 'missing_lumber') log('You need lumber for handles and hafts before you can finish a tool.', 'system');
    else log('You study the anvil, but you lack the right materials for the next job.', 'system');
  });

  // === Townfolk NPC events ===
  world.on('townfolk:chopped', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A woodcutter fells a tree.', 'ambient');
  });
  world.on('townfolk:repaired', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A mason repairs some damage.', 'ambient');
  });
  world.on('townfolk:mined', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A miner chips away at the rock.', 'ambient');
  });
  world.on('townfolk:harvested', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A farmer picks a ripe crop.', 'ambient');
  });
  world.on('townfolk:planted', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A farmer plants a seed.', 'ambient');
  });
  world.on('townfolk:carrying', ({ resource }) => { /* silent */ });
  world.on('townfolk:delivered', () => { /* silent */ });
  world.on('townfolk:gathered_herbs', ({ x, y }) => {
    if (canSeeAt(x, y)) log('An herbalist gathers wild herbs.', 'ambient');
  });
  world.on('townfolk:fished', ({ x, y }) => {
    if (canSeeAt(x, y)) log('A fisher works the water and lands a catch.', 'ambient');
  });
  world.on('townfolk:brewed', ({ x, y }) => {
    if (canSeeAt(x, y)) log('An alchemist brews a potion.', 'ambient');
  });
  world.on('townfolk:smelted', ({ x, y }) => {
    if (canSeeAt(x, y)) log('The smith stokes the forge and draws out fresh iron.', 'ambient');
  });
  world.on('townfolk:stocked', ({ x, y }) => {
    if (canSeeAt(x, y)) log('An alchemist arranges potions on the shelves.', 'ambient');
  });
  world.on('townfolk:sorted_herbs', ({ x, y }) => {
    if (canSeeAt(x, y)) log('An herbalist sorts through dried herbs.', 'ambient');
  });

  world.on('town:produced', ({ chain, itemId }) => {
    if (chain === 'mill') log('The mill turns stored grain into fresh flour.', 'ambient');
    else if (chain === 'furnace') log('The forge roars as ore melts down into iron.', 'ambient');
    else if (chain === 'smithy') log('Hammering rings out as the smith turns iron into tools.', 'ambient');
    else if (chain === 'tavern_fish') log('The tavern turns the fresh catch into hot stew.', 'ambient');
  });

  world.on('town:shortage', ({ food, materials, medicine }) => {
    if (food) log('The town is running lean on food.', 'system');
    else if (medicine) log('The apothecary stores are running low.', 'system');
    else if (materials) log('The workshops are short on raw materials.', 'system');
  });

  world.on('town:threatened', ({ threatLevel }) => {
    if (threatLevel > 0) log('The town stirs uneasily at a nearby threat.', 'system');
  });
}
