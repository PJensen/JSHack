# Social Memory and Aggro Snapshot

This snapshot captures the current state of the NPC social memory work before
expanding spell/effect offense coverage. It is intentionally descriptive: what
the code supports today, what the intended model is, and where the weak spots
still are.

## Mental Model

The current social stack has five separate layers:

- `Offense`: a classified bad action, with severity, source, and attribution.
- `Disposition`: one entity's personal opinion of another entity.
- `Reputation`: a scoped public belief about an entity, such as town or
  shopkeeper-faction standing.
- `AggroState`: tactical state: this entity is acting against a target now.
- Readers: concrete behaviors that use the state, such as prices, pursuit, and
  melee attacks.

The intended flow is:

```txt
offense
  -> attribution check
  -> personal disposition
  -> public reputation if witnessed or ledgered
  -> aggro request if severe enough
  -> behavior readers act on that state
```

`AggroState` is not the source of social truth. It is the short-term tactical
output. `Disposition` and `Reputation` are memory.

## Implemented Code Anchors

- Offense vocabulary: `src/rules/data/offenses.js`
- Actor-target classifier: `src/rules/utils/offenseClassifier.js`
- Explicit melee direction policy: `src/rules/utils/attackActionPolicy.js`
- Explicit melee direction system: `src/rules/systems/attackDirectionSystem.js`
- Melee offense emission: `src/rules/systems/combatSystem.js`
- Personal memory component: `src/rules/components/Disposition.js`
- Personal memory helper/listeners: `src/rules/utils/disposition.js`
- Public memory component: `src/rules/components/Reputation.js`
- Public memory helper/listeners: `src/rules/utils/reputation.js`
- Social aggro behavior: `src/rules/systems/socialAggroSystem.js`
- Shop-law claim bridge: `src/rules/utils/shopClaims.js`
- Shop pricing reader: `src/rules/content/interaction/interactPayloads.js`

## Offense Coverage Today

Supported offense inputs today are narrow:

- Confirmed direct melee attempt against a protected/social non-hostile target.
- Shop-law claims, such as unpaid use, knowledge theft, or extracted value.
- Manual/test calls into `applyOffenseDisposition`.

Not yet broadly covered:

- Area spells.
- Mental/status spells such as confusion, charm, fear, paralysis, polymorph.
- Environmental or chain damage.
- Summon/pet-caused offenses.
- Property damage and vandalism outside shop-law.

This means a powerful town-wide confusion spell likely has no social consequence
today unless that spell path explicitly emits an offense.

## Attribution

Offenses now carry attribution:

- `known`: the actor is known; normal disposition/reputation applies.
- `suspected`: reduced-strength personal memory applies.
- `unknown`: no disposition/reputation is written; `offense:unattributed` is
  emitted instead.

Current attribution logic is still shallow. The concrete implemented case is:

- If the player is invisible during a protected melee attempt, the offense is
  marked `unknown`.

Future attribution questions:

- Did the victim see the actor?
- Did any witness see the actor?
- Did witnesses see the spell origin but not the caster?
- Can the witness see invisible or sense hidden entities?
- Is there recent context that makes suspicion reasonable?
- Is the offense ledgered or magically marked, as shop-law claims are?

## Disposition

`Disposition` is a child-entity record attached under the subject entity. It
answers: what does this entity think of that entity?

Key fields:

- `subjectId`: the entity holding the opinion.
- `objectId`: the entity being judged.
- `score`: `-100..100`; negative means resentment/hostility.
- `maxSeverity`: worst offense severity ever applied.
- `lastOffenseTurn`
- `lastOffenseKind`

Disposition bands:

- `trusted`
- `neutral`
- `wary`
- `angry`
- `furious`
- `wrathful`

Current rules:

- Victim gets full disposition penalty for known offenses.
- Witnesses get partial disposition penalty.
- Suspected offenses apply reduced penalty.
- Unknown offenses do not write disposition.
- Serious enough disposition can request/escalate `AggroState`.

No decay or forgiveness exists yet.

## Reputation

`Reputation` is also a child-entity record, but it is attached under the judged
entity. It answers: what does a public scope think of this entity?

Key fields:

- `objectId`: the judged entity.
- `scopeKind`: for example `town` or `faction`.
- `scopeKey`: for example `overworld`, `shopkeeper`, or `townfolk`.
- `score`: `-100..100`; negative means bad public standing.
- `maxSeverity`
- `lastOffenseTurn`
- `lastOffenseKind`
- `witnessCount`

Reputation bands:

- `honored`
- `neutral`
- `suspect`
- `notorious`
- `wanted`
- `infamous`

Current rules:

- Witnessed social offenses can create public reputation.
- Unwitnessed personal offenses stay personal.
- Shop-law claims are treated as ledgered public knowledge.
- Shopkeeper reputation can affect prices even with a different shopkeeper.

No rumor propagation system exists yet. Reputation is written immediately when
the code decides the offense is public.

## Social Aggro

Social NPCs can now act on `AggroState` without becoming monster-faction
entities.

`socialAggroSystem` handles:

- `shopkeeper`
- `townfolk`
- `neutral`

Current behavior:

- If social NPC is `hunting` and adjacent to player, it queues `AttackIntent`
  with `allowNonHostile: true`.
- If social NPC is `hunting` and not adjacent, it moves toward the player.
- If the player is invisible and not adjacent, it does not magically pursue.
- It overrides ordinary social movement while aggro is active.

This is deliberately mundane for now. Shopkeeper zap/polymorph/call-guards
responses are not implemented yet.

## Shop Readers

Shop pricing reads both personal and public memory.

Personal disposition effects:

- `wary`: worse prices.
- `angry`: worse again.
- `furious`: severe penalty.
- `wrathful`: extreme penalty.

Public reputation effects:

- `suspect`: small penalty.
- `notorious`: larger penalty.
- `wanted`: severe penalty.
- `infamous`: extreme penalty.

The final terms combine:

```txt
base shop terms
  * personal disposition multiplier
  * public reputation multiplier
```

## Supported Stories Today

### Story 1: The Player Openly Attacks a Shopkeeper

1. Player uses explicit attack direction toward an adjacent shopkeeper.
2. `rulesDispatch` classifies the direction through `classifyAttackDirection`.
3. Because the shopkeeper is protected/social and non-hostile, the UI opens a
   confirmation surface instead of using browser `confirm`.
4. Player confirms.
5. `AttackDirectionIntent` is created.
6. `attackDirectionSystem` resolves the direction into `AttackIntent`.
7. `combatSystem` consumes `AttackIntent`.
8. After melee gates pass, `combatSystem` emits `offense:committed`.
9. `installDispositionOffenseListeners` applies personal disposition:
   the shopkeeper now remembers the player negatively.
10. Severity is high enough to seed/escalate `AggroState`.
11. `socialAggroSystem` sees the shopkeeper hunting.
12. If adjacent, the shopkeeper queues an `AttackIntent` against the player.

What this supports: direct protected melee can create memory and make the NPC
fight back.

### Story 2: The Player Attacks While Invisible

1. Player has an active `invisible` effect.
2. Player confirms a direct melee attack against a protected social NPC.
3. `AttackDirectionIntent` becomes `AttackIntent`.
4. `combatSystem` reaches the real melee attempt.
5. The offense is classified with attribution `unknown`.
6. `disposition.js` receives `offense:committed`.
7. Since attribution is `unknown`, it does not create `Disposition`.
8. It emits `offense:unattributed`.
9. No public `Reputation` is created.
10. No social aggro is created from disposition.

What this supports: the attack can happen, but the social memory system does
not magically know who did it.

Important limitation: this does not yet model suspicion, sound, visible spell
origin, or witnesses with special senses.

### Story 3: The Player Steals Shop Value Through Shop-Law

1. Player extracts shop value, such as unpaid consumption or unpaid knowledge.
2. Shop-law code records a `ShopClaim`.
3. `recordShopClaim` projects an offense vocabulary object onto the claim event.
4. `shop:claim-recorded` is emitted.
5. Disposition listeners treat the claim as a personal offense against the
   shopkeeper.
6. Reputation listeners treat it as ledgered public knowledge.
7. The original shopkeeper gets worse personal disposition toward the player.
8. The shopkeeper faction and town can get worse public reputation toward the
   player.
9. Later shop interactions call `shopDispositionTerms`.
10. Prices are worsened by both personal memory and public reputation.

What this supports: shop-law is no longer only a bill. It can now feed social
memory and cross-shop reputation.

### Story 4: A Witnessed Assault Becomes Public Reputation

1. Player commits a known offense against a social NPC.
2. A townfolk or shopkeeper witness is supplied or discovered.
3. Victim gets full personal disposition penalty.
4. Witness gets partial personal disposition penalty.
5. `disposition:changed` carries `witnessIds`.
6. Reputation listeners see that the offense was witnessed.
7. `Reputation` records are written under the player for relevant scopes, such
   as `town:overworld` and `faction:shopkeeper`.
8. A different shopkeeper can later price goods worse because public shopkeeper
   reputation is bad, even if that shopkeeper has no personal grudge yet.

What this supports: reputation can diverge from personal disposition.

## Weak Spots

### Offense Coverage Is Sparse

Most harmful actions still do not emit offenses. In particular:

- Confusion spells over town.
- Polymorphing social NPCs through spell paths.
- Charm or mind control.
- Area damage and environmental hazards.
- Pet or summoned creature damage.
- Vandalism.

The next major step is a canonical offense emitter for spell/effect/status
resolution.

### Attribution Is Too Simple

Only invisibility currently influences attribution. Real attribution should
consider perception, sound, spell origin, witnesses, recent suspicion, and
special senses.

### No Decay or Forgiveness

Disposition and reputation only accumulate. Nothing decays over time. There is
no payment, absolution, quest repair, charm repair, faction rank forgiveness, or
death/identity reset.

### Aggro Has No Social Cooldown

`AggroState` can be created for social NPCs, and they can act on it. But there
is not yet a social cooldown policy for calming down, returning to work, or
switching from attack to refusal/dialog.

### Shopkeeper Fury Is Not Magical Yet

Shopkeepers can attack through social aggro, but they do not yet have a fury
response ladder:

- worse prices
- refusal
- call guards
- zap
- polymorph retaliation
- curse
- summon help

### Reputation Does Not Spread

Public reputation is currently written at the moment of witnessed or ledgered
offense. There is no delayed news propagation, rumor strength, faction-specific
communication, or witness reporting.

## Next Slice Candidate

The next best slice is spell/effect offense coverage:

```txt
spell/effect resolves
  -> classify affected protected/social targets
  -> determine attribution
  -> emit offense:committed or offense:unattributed
  -> disposition/reputation/aggro readers react
```

For a town-wide confusion spell, the likely first-pass rule is:

- If a spell applies hostile mental/body-control status to protected social
  NPCs, classify it as `bodily_violation` or `reckless_endangerment`.
- Use `intentional_area` source.
- Scale severity by number and importance of affected NPCs.
- If caster is invisible and no witness can attribute the caster, emit
  `offense:unattributed`.
- If witnessed or public, create personal disposition and town reputation.

