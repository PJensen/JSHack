# Polymorph Backlash Surface

Polymorph failure style is currently derived from body stability:

- `unstable` forms can fumble or surge.
- `ordinary` forms behave normally.
- `anchored` and `fixed` forms tend to resist cleanly.

Do not reintroduce a broad second axis like `polymorphFailureMode` unless the system needs it. If polymorph failures need richer consequences, prefer a separate backlash payload surface that describes actual effects rather than failure classification.

Possible future shape:

```js
polymorphBacklash: {
  kind: "psychic" | "toxic" | "arcane" | "summon" | "script",
  chance: 0.25,
  scriptId: "polymorph_backlash_mimic",
}
```

This could support whole monster classes, authored scripts, summoned hazards, deity reactions, or shop/legal consequences without creating an NxM matrix between stability and failure mode.

