```mermaid
flowchart LR
  event__dynamic_emitEvent_(["(dynamic:emitEvent)"])
  event__dynamic_eventName_(["(dynamic:eventName)"])
  event_alchemy_result(["alchemy:result"])
  event_attack_insufficient_stamina(["attack:insufficient-stamina"])
  event_bell_rung(["bell:rung"])
  event_castSpell(["castSpell"])
  event_channeling_cancelled(["channeling:cancelled"])
  event_channeling_complete(["channeling:complete"])
  event_channeling_start(["channeling:start"])
  event_combat_dodge(["combat:dodge"])
  event_combat_parry(["combat:parry"])
  event_damaged(["damaged"])
  event_deity_intervention(["deity:intervention"])
  event_died(["died"])
  event_dungeon_teleport_depth(["dungeon:teleport-depth"])
  event_dungeon_transitioned(["dungeon:transitioned"])
  event_enchanting_result(["enchanting:result"])
  event_fountain_dip(["fountain:dip"])
  event_fountain_drink(["fountain:drink"])
  event_fountain_dry(["fountain:dry"])
  event_harvest_picked(["harvest:picked"])
  event_healed(["healed"])
  event_interaction(["interaction"])
  event_inventory_added(["inventory:added"])
  event_item_applied(["item:applied"])
  event_item_dropped(["item:dropped"])
  event_item_pickup(["item:pickup"])
  event_item_thrown(["item:thrown"])
  event_message(["message"])
  event_moved(["moved"])
  event_npc_dialogue(["npc:dialogue"])
  event_pet_state_auto(["pet:state:auto"])
  event_shrine_communion(["shrine:communion"])
  event_smithy_failed(["smithy:failed"])
  event_spell_blind(["spell:blind"])
  event_spell_plague_swarm(["spell:plague_swarm"])
  event_spell_scorch(["spell:scorch"])
  event_status(["status"])
  event_townfolk_carrying(["townfolk:carrying"])
  event_trap_triggered(["trap:triggered"])
  file_src_content_abilityHandler_js["src/content/abilityHandler.js"]
  file_src_content_items_potions_js["src/content/items/potions.js"]
  file_src_content_items_scrolls_js["src/content/items/scrolls.js"]
  file_src_content_worldFacade_js["src/content/worldFacade.js"]
  file_src_display_audio_audioWiring_js["src/display/audio/audioWiring.js"]
  file_src_display_composition_setupDisplayRuntime_js["src/display/composition/setupDisplayRuntime.js"]
  file_src_display_fx_aggroFxController_js["src/display/fx/aggroFxController.js"]
  file_src_display_fx_boltFxController_js["src/display/fx/boltFxController.js"]
  file_src_display_fx_bumpFxController_js["src/display/fx/bumpFxController.js"]
  file_src_display_fx_cloudFx_js["src/display/fx/cloudFx.js"]
  file_src_display_fx_deathEssenceFxController_js["src/display/fx/deathEssenceFxController.js"]
  file_src_display_fx_delayedDeathFxController_js["src/display/fx/delayedDeathFxController.js"]
  file_src_display_fx_hitstopController_js["src/display/fx/hitstopController.js"]
  file_src_display_fx_meleeSlashFx_js["src/display/fx/meleeSlashFx.js"]
  file_src_display_fx_pickupFxController_js["src/display/fx/pickupFxController.js"]
  file_src_display_fx_projectileFx_js["src/display/fx/projectileFx.js"]
  file_src_display_fx_recoilFxController_js["src/display/fx/recoilFxController.js"]
  file_src_display_fx_spellAreaFx_js["src/display/fx/spellAreaFx.js"]
  file_src_display_fx_spiritWispFx_js["src/display/fx/spiritWispFx.js"]
  file_src_display_fx_throwFxController_js["src/display/fx/throwFxController.js"]
  file_src_display_lighting_sources_index_js["src/display/lighting/sources/index.js"]
  file_src_display_passes_vfx_particles_statusEmitterController_js["src/display/passes/vfx/particles/statusEmitterController.js"]
  file_src_display_ui_wiring_eventUiWiring_js["src/display/ui/wiring/eventUiWiring.js"]
  file_src_display_ui_wiring_floatTextWiring_js["src/display/ui/wiring/floatTextWiring.js"]
  file_src_display_ui_wiring_goreEngine_js["src/display/ui/wiring/goreEngine.js"]
  file_src_display_ui_wiring_messages_combatMessages_js["src/display/ui/wiring/messages/combatMessages.js"]
  file_src_display_ui_wiring_messages_creatureMessages_js["src/display/ui/wiring/messages/creatureMessages.js"]
  file_src_display_ui_wiring_messages_economyMessages_js["src/display/ui/wiring/messages/economyMessages.js"]
  file_src_display_ui_wiring_messages_environmentMessages_js["src/display/ui/wiring/messages/environmentMessages.js"]
  file_src_display_ui_wiring_messages_itemMessages_js["src/display/ui/wiring/messages/itemMessages.js"]
  file_src_display_ui_wiring_messages_spellMessages_js["src/display/ui/wiring/messages/spellMessages.js"]
  file_src_display_ui_wiring_petUiBridge_js["src/display/ui/wiring/petUiBridge.js"]
  file_src_main_js["src/main.js"]
  file_src_main_channelingController_js["src/main/channelingController.js"]
  file_src_main_debug_consoleCommands_js["src/main/debug/consoleCommands.js"]
  file_src_main_proof_proofWiring_js["src/main/proof/proofWiring.js"]
  file_src_main_sceneRuntime_js["src/main/sceneRuntime.js"]
  file_src_main_wiring_alchemyWiring_js["src/main/wiring/alchemyWiring.js"]
  file_src_main_wiring_anvilWiring_js["src/main/wiring/anvilWiring.js"]
  file_src_main_wiring_cookingWiring_js["src/main/wiring/cookingWiring.js"]
  file_src_main_wiring_deathShareWiring_js["src/main/wiring/deathShareWiring.js"]
  file_src_main_wiring_digWiring_js["src/main/wiring/digWiring.js"]
  file_src_main_wiring_enchantingWiring_js["src/main/wiring/enchantingWiring.js"]
  file_src_main_wiring_petWiring_js["src/main/wiring/petWiring.js"]
  file_src_main_wiring_savegameWiring_js["src/main/wiring/savegameWiring.js"]
  file_src_main_wiring_scrollWandWiring_js["src/main/wiring/scrollWandWiring.js"]
  file_src_main_wiring_shopWiring_js["src/main/wiring/shopWiring.js"]
  file_src_main_wiring_speechBubbleWiring_js["src/main/wiring/speechBubbleWiring.js"]
  file_src_main_wiring_spiritGuideWiring_js["src/main/wiring/spiritGuideWiring.js"]
  file_src_main_wiring_transitionWiring_js["src/main/wiring/transitionWiring.js"]
  file_src_rules_content_alchemy_benchGame_js["src/rules/content/alchemy/benchGame.js"]
  file_src_rules_content_cooking_cookingGame_js["src/rules/content/cooking/cookingGame.js"]
  file_src_rules_content_enchanting_benchGame_js["src/rules/content/enchanting/benchGame.js"]
  file_src_rules_content_interaction_interactPayloads_js["src/rules/content/interaction/interactPayloads.js"]
  file_src_rules_content_smithing_anvilGame_js["src/rules/content/smithing/anvilGame.js"]
  file_src_rules_content_useActions_fishingAction_js["src/rules/content/useActions/fishingAction.js"]
  file_src_rules_data_bumpResolvers_js["src/rules/data/bumpResolvers.js"]
  file_src_rules_data_callbacks_ai_js["src/rules/data/callbacks/ai.js"]
  file_src_rules_data_callbacks_combat_js["src/rules/data/callbacks/combat.js"]
  file_src_rules_data_callbacks_death_js["src/rules/data/callbacks/death.js"]
  file_src_rules_data_callbacks_projectile_js["src/rules/data/callbacks/projectile.js"]
  file_src_rules_data_itemCatalogHooks_js["src/rules/data/itemCatalogHooks.js"]
  file_src_rules_data_lootResolver_js["src/rules/data/lootResolver.js"]
  file_src_rules_dialogues_runtime_js["src/rules/dialogues/runtime.js"]
  file_src_rules_environment_dungeon_transition_js["src/rules/environment/dungeon/transition.js"]
  file_src_rules_interaction_facets_createFacets_js["src/rules/interaction/facets/createFacets.js"]
  file_src_rules_interaction_mutations_js["src/rules/interaction/mutations.js"]
  file_src_rules_interaction_verbs_throwPipeline_js["src/rules/interaction/verbs/throwPipeline.js"]
  file_src_rules_quests_actions_js["src/rules/quests/actions.js"]
  file_src_rules_quests_definitions_graveyardWatch_js["src/rules/quests/definitions/graveyardWatch.js"]
  file_src_rules_quests_definitions_ratInfestation_js["src/rules/quests/definitions/ratInfestation.js"]
  file_src_rules_quests_definitions_runContract_js["src/rules/quests/definitions/runContract.js"]
  file_src_rules_scripts_spells_js["src/rules/scripts/spells.js"]
  file_src_rules_scripts_traps_js["src/rules/scripts/traps.js"]
  file_src_rules_systems_aiChaseSystem_js["src/rules/systems/aiChaseSystem.js"]
  file_src_rules_systems_aiCorpseEatSystem_js["src/rules/systems/aiCorpseEatSystem.js"]
  file_src_rules_systems_aiScrollSystem_js["src/rules/systems/aiScrollSystem.js"]
  file_src_rules_systems_aiTownfolkSystem_js["src/rules/systems/aiTownfolkSystem.js"]
  file_src_rules_systems_aiWeaponPickupSystem_js["src/rules/systems/aiWeaponPickupSystem.js"]
  file_src_rules_systems_autoPickupSystem_js["src/rules/systems/autoPickupSystem.js"]
  file_src_rules_systems_castSpellSystem_js["src/rules/systems/castSpellSystem.js"]
  file_src_rules_systems_channelingSystem_js["src/rules/systems/channelingSystem.js"]
  file_src_rules_systems_cleanupSystem_js["src/rules/systems/cleanupSystem.js"]
  file_src_rules_systems_combatSystem_js["src/rules/systems/combatSystem.js"]
  file_src_rules_systems_deitySystem_js["src/rules/systems/deitySystem.js"]
  file_src_rules_systems_effectSystem_js["src/rules/systems/effectSystem.js"]
  file_src_rules_systems_engraveSystem_js["src/rules/systems/engraveSystem.js"]
  file_src_rules_systems_genocideSystem_js["src/rules/systems/genocideSystem.js"]
  file_src_rules_systems_hungerSystem_js["src/rules/systems/hungerSystem.js"]
  file_src_rules_systems_itemDestructionSystem_js["src/rules/systems/itemDestructionSystem.js"]
  file_src_rules_systems_itemDropSystem_js["src/rules/systems/itemDropSystem.js"]
  file_src_rules_systems_itemPickupSystem_js["src/rules/systems/itemPickupSystem.js"]
  file_src_rules_systems_knockbackSystem_js["src/rules/systems/knockbackSystem.js"]
  file_src_rules_systems_materialReactionSystem_js["src/rules/systems/materialReactionSystem.js"]
  file_src_rules_systems_monsterDeathHookSystem_js["src/rules/systems/monsterDeathHookSystem.js"]
  file_src_rules_systems_movementSystem_js["src/rules/systems/movementSystem.js"]
  file_src_rules_systems_perceptionMemorySystem_js["src/rules/systems/perceptionMemorySystem.js"]
  file_src_rules_systems_petBehaviorSystem_js["src/rules/systems/petBehaviorSystem.js"]
  file_src_rules_systems_praySystem_js["src/rules/systems/praySystem.js"]
  file_src_rules_systems_rangedAttackSystem_js["src/rules/systems/rangedAttackSystem.js"]
  file_src_rules_systems_scoreSystem_js["src/rules/systems/scoreSystem.js"]
  file_src_rules_systems_searchSystem_js["src/rules/systems/searchSystem.js"]
  file_src_rules_systems_shopAmbientSoundSystem_js["src/rules/systems/shopAmbientSoundSystem.js"]
  file_src_rules_systems_shopkeeperSystem_js["src/rules/systems/shopkeeperSystem.js"]
  file_src_rules_systems_tamingSystem_js["src/rules/systems/tamingSystem.js"]
  file_src_rules_systems_tauntSystem_js["src/rules/systems/tauntSystem.js"]
  file_src_rules_systems_threatSystem_js["src/rules/systems/threatSystem.js"]
  file_src_rules_systems_tileStepEffectSystem_js["src/rules/systems/tileStepEffectSystem.js"]
  file_src_rules_systems_tombstoneSystem_js["src/rules/systems/tombstoneSystem.js"]
  file_src_rules_systems_townfolkAmbientDialogueSystem_js["src/rules/systems/townfolkAmbientDialogueSystem.js"]
  file_src_rules_systems_trapSystem_js["src/rules/systems/trapSystem.js"]
  file_src_rules_utils_actionContexts_js["src/rules/utils/actionContexts.js"]
  file_src_rules_utils_centipedeMovement_js["src/rules/utils/centipedeMovement.js"]
  file_src_rules_utils_dealDamage_js["src/rules/utils/dealDamage.js"]
  file_src_rules_utils_doorAccess_js["src/rules/utils/doorAccess.js"]
  file_src_rules_utils_electrocute_js["src/rules/utils/electrocute.js"]
  file_src_rules_utils_inventoryFacade_js["src/rules/utils/inventoryFacade.js"]
  file_src_rules_utils_shopClaims_js["src/rules/utils/shopClaims.js"]
  file_src_rules_utils_shopLaw_js["src/rules/utils/shopLaw.js"]
  file_src_rules_utils_sleep_js["src/rules/utils/sleep.js"]
  file_src_rules_utils_spellDamage_js["src/rules/utils/spellDamage.js"]
  event__dynamic_eventName_ --> file_src_display_ui_wiring_messages_spellMessages_js
  event__dynamic_eventName_ --> file_src_rules_systems_materialReactionSystem_js
  event_alchemy_result --> file_src_display_ui_wiring_messages_economyMessages_js
  event_attack_insufficient_stamina --> file_src_display_fx_bumpFxController_js
  event_attack_insufficient_stamina --> file_src_display_ui_wiring_floatTextWiring_js
  event_attack_insufficient_stamina --> file_src_display_ui_wiring_messages_combatMessages_js
  event_bell_rung --> file_src_display_audio_audioWiring_js
  event_bell_rung --> file_src_display_ui_wiring_floatTextWiring_js
  event_bell_rung --> file_src_display_ui_wiring_messages_environmentMessages_js
  event_bell_rung --> file_src_rules_systems_aiTownfolkSystem_js
  event_castSpell --> file_src_display_fx_spiritWispFx_js
  event_castSpell --> file_src_display_ui_wiring_messages_spellMessages_js
  event_castSpell --> file_src_rules_systems_deitySystem_js
  event_channeling_cancelled --> file_src_display_audio_audioWiring_js
  event_channeling_cancelled --> file_src_display_fx_spellAreaFx_js
  event_channeling_cancelled --> file_src_display_lighting_sources_index_js
  event_channeling_cancelled --> file_src_display_ui_wiring_messages_creatureMessages_js
  event_channeling_cancelled --> file_src_display_ui_wiring_messages_spellMessages_js
  event_channeling_cancelled --> file_src_main_channelingController_js
  event_channeling_complete --> file_src_display_audio_audioWiring_js
  event_channeling_complete --> file_src_display_fx_spellAreaFx_js
  event_channeling_complete --> file_src_main_channelingController_js
  event_channeling_start --> file_src_display_audio_audioWiring_js
  event_channeling_start --> file_src_display_fx_spellAreaFx_js
  event_channeling_start --> file_src_display_ui_wiring_messages_spellMessages_js
  event_channeling_start --> file_src_main_channelingController_js
  event_combat_dodge --> file_src_display_audio_audioWiring_js
  event_combat_dodge --> file_src_display_fx_bumpFxController_js
  event_combat_dodge --> file_src_display_fx_meleeSlashFx_js
  event_combat_dodge --> file_src_display_ui_wiring_floatTextWiring_js
  event_combat_dodge --> file_src_display_ui_wiring_messages_combatMessages_js
  event_combat_parry --> file_src_display_audio_audioWiring_js
  event_combat_parry --> file_src_display_fx_bumpFxController_js
  event_combat_parry --> file_src_display_fx_meleeSlashFx_js
  event_combat_parry --> file_src_display_ui_wiring_floatTextWiring_js
  event_combat_parry --> file_src_display_ui_wiring_messages_combatMessages_js
  event_damaged --> file_src_display_audio_audioWiring_js
  event_damaged --> file_src_display_composition_setupDisplayRuntime_js
  event_damaged --> file_src_display_fx_bumpFxController_js
  event_damaged --> file_src_display_fx_deathEssenceFxController_js
  event_damaged --> file_src_display_fx_delayedDeathFxController_js
  event_damaged --> file_src_display_fx_hitstopController_js
  event_damaged --> file_src_display_fx_meleeSlashFx_js
  event_damaged --> file_src_display_fx_projectileFx_js
  event_damaged --> file_src_display_fx_recoilFxController_js
  event_damaged --> file_src_display_fx_spiritWispFx_js
  event_damaged --> file_src_display_ui_wiring_goreEngine_js
  event_damaged --> file_src_display_ui_wiring_messages_combatMessages_js
  event_damaged --> file_src_main_js
  event_damaged --> file_src_main_wiring_spiritGuideWiring_js
  event_damaged --> file_src_rules_systems_aiChaseSystem_js
  event_damaged --> file_src_rules_systems_channelingSystem_js
  event_damaged --> file_src_rules_systems_cleanupSystem_js
  event_damaged --> file_src_rules_systems_deitySystem_js
  event_damaged --> file_src_rules_systems_itemDestructionSystem_js
  event_damaged --> file_src_rules_systems_threatSystem_js
  event_damaged --> file_src_rules_utils_electrocute_js
  event_damaged --> file_src_rules_utils_sleep_js
  event_deity_intervention --> file_src_display_fx_boltFxController_js
  event_deity_intervention --> file_src_display_fx_spiritWispFx_js
  event_deity_intervention --> file_src_display_lighting_sources_index_js
  event_deity_intervention --> file_src_display_ui_wiring_messages_environmentMessages_js
  event_died --> file_src_display_audio_audioWiring_js
  event_died --> file_src_display_fx_deathEssenceFxController_js
  event_died --> file_src_display_fx_delayedDeathFxController_js
  event_died --> file_src_display_fx_hitstopController_js
  event_died --> file_src_display_fx_spiritWispFx_js
  event_died --> file_src_display_ui_wiring_goreEngine_js
  event_died --> file_src_display_ui_wiring_messages_combatMessages_js
  event_died --> file_src_display_ui_wiring_petUiBridge_js
  event_died --> file_src_main_js
  event_died --> file_src_main_proof_proofWiring_js
  event_died --> file_src_main_wiring_deathShareWiring_js
  event_died --> file_src_main_wiring_savegameWiring_js
  event_died --> file_src_rules_quests_definitions_ratInfestation_js
  event_died --> file_src_rules_quests_definitions_runContract_js
  event_died --> file_src_rules_systems_deitySystem_js
  event_died --> file_src_rules_systems_monsterDeathHookSystem_js
  event_died --> file_src_rules_systems_perceptionMemorySystem_js
  event_died --> file_src_rules_systems_scoreSystem_js
  event_died --> file_src_rules_systems_tombstoneSystem_js
  event_dungeon_teleport_depth --> file_src_display_ui_wiring_messages_environmentMessages_js
  event_dungeon_teleport_depth --> file_src_main_js
  event_dungeon_teleport_depth --> file_src_main_wiring_transitionWiring_js
  event_dungeon_teleport_depth --> file_src_rules_dialogues_runtime_js
  event_dungeon_transitioned --> file_src_display_audio_audioWiring_js
  event_dungeon_transitioned --> file_src_display_fx_cloudFx_js
  event_dungeon_transitioned --> file_src_display_lighting_sources_index_js
  event_dungeon_transitioned --> file_src_main_js
  event_dungeon_transitioned --> file_src_main_wiring_transitionWiring_js
  event_dungeon_transitioned --> file_src_rules_dialogues_runtime_js
  event_dungeon_transitioned --> file_src_rules_quests_definitions_graveyardWatch_js
  event_dungeon_transitioned --> file_src_rules_quests_definitions_ratInfestation_js
  event_dungeon_transitioned --> file_src_rules_quests_definitions_runContract_js
  event_enchanting_result --> file_src_display_ui_wiring_messages_economyMessages_js
  event_fountain_dip --> file_src_display_audio_audioWiring_js
  event_fountain_dip --> file_src_display_ui_wiring_floatTextWiring_js
  event_fountain_dip --> file_src_display_ui_wiring_messages_environmentMessages_js
  event_fountain_drink --> file_src_display_audio_audioWiring_js
  event_fountain_drink --> file_src_display_ui_wiring_floatTextWiring_js
  event_fountain_drink --> file_src_display_ui_wiring_messages_environmentMessages_js
  event_fountain_dry --> file_src_display_passes_vfx_particles_statusEmitterController_js
  event_fountain_dry --> file_src_display_ui_wiring_messages_environmentMessages_js
  event_harvest_picked --> file_src_display_audio_audioWiring_js
  event_harvest_picked --> file_src_display_ui_wiring_eventUiWiring_js
  event_harvest_picked --> file_src_display_ui_wiring_messages_economyMessages_js
  event_harvest_picked --> file_src_main_wiring_spiritGuideWiring_js
  event_harvest_picked --> file_src_rules_systems_deitySystem_js
  event_healed --> file_src_display_ui_wiring_floatTextWiring_js
  event_healed --> file_src_display_ui_wiring_messages_combatMessages_js
  event_healed --> file_src_rules_systems_deitySystem_js
  event_interaction --> file_src_display_audio_audioWiring_js
  event_interaction --> file_src_display_ui_wiring_eventUiWiring_js
  event_interaction --> file_src_display_ui_wiring_messages_environmentMessages_js
  event_inventory_added --> file_src_main_js
  event_inventory_added --> file_src_main_wiring_spiritGuideWiring_js
  event_item_applied --> file_src_display_ui_wiring_messages_itemMessages_js
  event_item_dropped --> file_src_display_audio_audioWiring_js
  event_item_dropped --> file_src_display_fx_deathEssenceFxController_js
  event_item_dropped --> file_src_display_fx_delayedDeathFxController_js
  event_item_dropped --> file_src_display_fx_spiritWispFx_js
  event_item_dropped --> file_src_display_ui_wiring_messages_itemMessages_js
  event_item_dropped --> file_src_main_js
  event_item_dropped --> file_src_rules_utils_shopLaw_js
  event_item_pickup --> file_src_display_audio_audioWiring_js
  event_item_pickup --> file_src_display_fx_pickupFxController_js
  event_item_pickup --> file_src_display_ui_wiring_messages_itemMessages_js
  event_item_pickup --> file_src_main_js
  event_item_pickup --> file_src_main_wiring_shopWiring_js
  event_item_pickup --> file_src_main_wiring_spiritGuideWiring_js
  event_item_thrown --> file_src_display_audio_audioWiring_js
  event_item_thrown --> file_src_display_fx_throwFxController_js
  event_item_thrown --> file_src_main_js
  event_item_thrown --> file_src_rules_utils_shopLaw_js
  event_moved --> file_src_main_js
  event_moved --> file_src_main_wiring_alchemyWiring_js
  event_moved --> file_src_main_wiring_anvilWiring_js
  event_moved --> file_src_main_wiring_cookingWiring_js
  event_moved --> file_src_main_wiring_enchantingWiring_js
  event_moved --> file_src_main_wiring_spiritGuideWiring_js
  event_moved --> file_src_rules_systems_aiTownfolkSystem_js
  event_moved --> file_src_rules_systems_engraveSystem_js
  event_moved --> file_src_rules_systems_movementSystem_js
  event_moved --> file_src_rules_systems_tileStepEffectSystem_js
  event_moved --> file_src_rules_utils_centipedeMovement_js
  event_moved --> file_src_rules_utils_shopLaw_js
  event_npc_dialogue --> file_src_main_wiring_speechBubbleWiring_js
  event_npc_dialogue --> file_src_main_wiring_spiritGuideWiring_js
  event_pet_state_auto --> file_src_display_ui_wiring_messages_environmentMessages_js
  event_pet_state_auto --> file_src_main_wiring_petWiring_js
  event_shrine_communion --> file_src_display_audio_audioWiring_js
  event_shrine_communion --> file_src_display_fx_spiritWispFx_js
  event_shrine_communion --> file_src_display_lighting_sources_index_js
  event_shrine_communion --> file_src_display_ui_wiring_messages_environmentMessages_js
  event_smithy_failed --> file_src_display_ui_wiring_messages_economyMessages_js
  event_spell_blind --> file_src_display_ui_wiring_messages_spellMessages_js
  event_spell_blind --> file_src_rules_systems_threatSystem_js
  event_spell_plague_swarm --> file_src_display_fx_projectileFx_js
  event_spell_plague_swarm --> file_src_display_fx_spiritWispFx_js
  event_spell_plague_swarm --> file_src_display_ui_wiring_floatTextWiring_js
  event_spell_plague_swarm --> file_src_display_ui_wiring_messages_spellMessages_js
  event_spell_scorch --> file_src_display_fx_spiritWispFx_js
  event_spell_scorch --> file_src_display_ui_wiring_floatTextWiring_js
  event_spell_scorch --> file_src_display_ui_wiring_messages_spellMessages_js
  event_status --> file_src_display_audio_audioWiring_js
  event_status --> file_src_display_fx_aggroFxController_js
  event_status --> file_src_display_fx_bumpFxController_js
  event_status --> file_src_display_fx_meleeSlashFx_js
  event_status --> file_src_display_ui_wiring_floatTextWiring_js
  event_status --> file_src_display_ui_wiring_messages_combatMessages_js
  event_status --> file_src_main_wiring_spiritGuideWiring_js
  event_townfolk_carrying --> file_src_display_ui_wiring_messages_economyMessages_js
  event_trap_triggered --> file_src_display_audio_audioWiring_js
  event_trap_triggered --> file_src_main_js
  event_trap_triggered --> file_src_main_wiring_spiritGuideWiring_js
  event_trap_triggered --> file_src_rules_systems_deitySystem_js
  file_src_content_abilityHandler_js --> event_message
  file_src_content_items_potions_js --> event_item_applied
  file_src_content_items_potions_js --> event_item_thrown
  file_src_content_items_potions_js --> event_status
  file_src_content_items_scrolls_js --> event_castSpell
  file_src_content_items_scrolls_js --> event_item_applied
  file_src_content_worldFacade_js --> event_damaged
  file_src_main_channelingController_js --> event_channeling_cancelled
  file_src_main_debug_consoleCommands_js --> event_dungeon_teleport_depth
  file_src_main_js --> event_message
  file_src_main_sceneRuntime_js --> event_moved
  file_src_main_wiring_digWiring_js --> event_item_dropped
  file_src_main_wiring_scrollWandWiring_js --> event_message
  file_src_main_wiring_scrollWandWiring_js --> event_moved
  file_src_rules_content_alchemy_benchGame_js --> event_alchemy_result
  file_src_rules_content_cooking_cookingGame_js --> event_inventory_added
  file_src_rules_content_enchanting_benchGame_js --> event_enchanting_result
  file_src_rules_content_interaction_interactPayloads_js --> event_bell_rung
  file_src_rules_content_interaction_interactPayloads_js --> event_fountain_dip
  file_src_rules_content_interaction_interactPayloads_js --> event_fountain_drink
  file_src_rules_content_interaction_interactPayloads_js --> event_fountain_dry
  file_src_rules_content_interaction_interactPayloads_js --> event_harvest_picked
  file_src_rules_content_interaction_interactPayloads_js --> event_interaction
  file_src_rules_content_interaction_interactPayloads_js --> event_item_dropped
  file_src_rules_content_interaction_interactPayloads_js --> event_item_thrown
  file_src_rules_content_interaction_interactPayloads_js --> event_moved
  file_src_rules_content_interaction_interactPayloads_js --> event_npc_dialogue
  file_src_rules_content_interaction_interactPayloads_js --> event_smithy_failed
  file_src_rules_content_smithing_anvilGame_js --> event_smithy_failed
  file_src_rules_content_useActions_fishingAction_js --> event_channeling_start
  file_src_rules_data_bumpResolvers_js --> event_attack_insufficient_stamina
  file_src_rules_data_bumpResolvers_js --> event_moved
  file_src_rules_data_callbacks_ai_js --> event__dynamic_eventName_
  file_src_rules_data_callbacks_ai_js --> event_item_thrown
  file_src_rules_data_callbacks_ai_js --> event_moved
  file_src_rules_data_callbacks_combat_js --> event__dynamic_emitEvent_
  file_src_rules_data_callbacks_combat_js --> event__dynamic_eventName_
  file_src_rules_data_callbacks_death_js --> event__dynamic_eventName_
  file_src_rules_data_callbacks_projectile_js --> event__dynamic_eventName_
  file_src_rules_data_itemCatalogHooks_js --> event__dynamic_eventName_
  file_src_rules_data_itemCatalogHooks_js --> event_castSpell
  file_src_rules_data_itemCatalogHooks_js --> event_item_applied
  file_src_rules_data_itemCatalogHooks_js --> event_item_thrown
  file_src_rules_data_lootResolver_js --> event_item_dropped
  file_src_rules_environment_dungeon_transition_js --> event_dungeon_transitioned
  file_src_rules_interaction_facets_createFacets_js --> event_channeling_start
  file_src_rules_interaction_mutations_js --> event_item_dropped
  file_src_rules_interaction_mutations_js --> event_message
  file_src_rules_interaction_verbs_throwPipeline_js --> event_item_thrown
  file_src_rules_quests_actions_js --> event__dynamic_eventName_
  file_src_rules_quests_definitions_ratInfestation_js --> event_item_dropped
  file_src_rules_quests_definitions_ratInfestation_js --> event_npc_dialogue
  file_src_rules_quests_definitions_runContract_js --> event_item_dropped
  file_src_rules_scripts_spells_js --> event__dynamic_eventName_
  file_src_rules_scripts_spells_js --> event_channeling_cancelled
  file_src_rules_scripts_spells_js --> event_dungeon_teleport_depth
  file_src_rules_scripts_spells_js --> event_healed
  file_src_rules_scripts_spells_js --> event_item_thrown
  file_src_rules_scripts_spells_js --> event_moved
  file_src_rules_scripts_spells_js --> event_spell_blind
  file_src_rules_scripts_spells_js --> event_spell_plague_swarm
  file_src_rules_scripts_spells_js --> event_spell_scorch
  file_src_rules_scripts_traps_js --> event_healed
  file_src_rules_systems_aiChaseSystem_js --> event_status
  file_src_rules_systems_aiCorpseEatSystem_js --> event_healed
  file_src_rules_systems_aiScrollSystem_js --> event_message
  file_src_rules_systems_aiTownfolkSystem_js --> event_bell_rung
  file_src_rules_systems_aiTownfolkSystem_js --> event_townfolk_carrying
  file_src_rules_systems_aiWeaponPickupSystem_js --> event_message
  file_src_rules_systems_autoPickupSystem_js --> event_item_pickup
  file_src_rules_systems_castSpellSystem_js --> event_castSpell
  file_src_rules_systems_castSpellSystem_js --> event_channeling_start
  file_src_rules_systems_channelingSystem_js --> event_channeling_cancelled
  file_src_rules_systems_channelingSystem_js --> event_channeling_complete
  file_src_rules_systems_cleanupSystem_js --> event_item_dropped
  file_src_rules_systems_combatSystem_js --> event_attack_insufficient_stamina
  file_src_rules_systems_combatSystem_js --> event_combat_dodge
  file_src_rules_systems_combatSystem_js --> event_combat_parry
  file_src_rules_systems_combatSystem_js --> event_status
  file_src_rules_systems_deitySystem_js --> event_deity_intervention
  file_src_rules_systems_deitySystem_js --> event_healed
  file_src_rules_systems_deitySystem_js --> event_item_dropped
  file_src_rules_systems_deitySystem_js --> event_shrine_communion
  file_src_rules_systems_effectSystem_js --> event_channeling_cancelled
  file_src_rules_systems_effectSystem_js --> event_channeling_complete
  file_src_rules_systems_effectSystem_js --> event_healed
  file_src_rules_systems_genocideSystem_js --> event_damaged
  file_src_rules_systems_genocideSystem_js --> event_message
  file_src_rules_systems_hungerSystem_js --> event_healed
  file_src_rules_systems_itemDropSystem_js --> event_item_dropped
  file_src_rules_systems_itemPickupSystem_js --> event_item_pickup
  file_src_rules_systems_knockbackSystem_js --> event_moved
  file_src_rules_systems_movementSystem_js --> event_item_pickup
  file_src_rules_systems_movementSystem_js --> event_moved
  file_src_rules_systems_petBehaviorSystem_js --> event_healed
  file_src_rules_systems_petBehaviorSystem_js --> event_pet_state_auto
  file_src_rules_systems_praySystem_js --> event_deity_intervention
  file_src_rules_systems_praySystem_js --> event_healed
  file_src_rules_systems_rangedAttackSystem_js --> event_attack_insufficient_stamina
  file_src_rules_systems_rangedAttackSystem_js --> event_status
  file_src_rules_systems_searchSystem_js --> event_message
  file_src_rules_systems_shopAmbientSoundSystem_js --> event_npc_dialogue
  file_src_rules_systems_shopkeeperSystem_js --> event_npc_dialogue
  file_src_rules_systems_tamingSystem_js --> event_message
  file_src_rules_systems_tauntSystem_js --> event_status
  file_src_rules_systems_tileStepEffectSystem_js --> event_moved
  file_src_rules_systems_townfolkAmbientDialogueSystem_js --> event_npc_dialogue
  file_src_rules_systems_trapSystem_js --> event_trap_triggered
  file_src_rules_utils_actionContexts_js --> event__dynamic_eventName_
  file_src_rules_utils_dealDamage_js --> event_damaged
  file_src_rules_utils_dealDamage_js --> event_died
  file_src_rules_utils_dealDamage_js --> event_status
  file_src_rules_utils_doorAccess_js --> event_interaction
  file_src_rules_utils_inventoryFacade_js --> event_inventory_added
  file_src_rules_utils_shopClaims_js --> event_npc_dialogue
  file_src_rules_utils_spellDamage_js --> event_status
```