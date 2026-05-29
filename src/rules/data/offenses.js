export const OFFENSE_SEVERITY = Object.freeze({
  none: 0,
  minor: 1,
  serious: 2,
  major: 3,
  severe: 4,
  unforgivable: 5,
});

export const OFFENSE_KINDS = Object.freeze({
  none: "none",
  assault: "assault",
  recklessEndangerment: "reckless_endangerment",
  bodilyViolation: "bodily_violation",
  theft: "theft",
  fraud: "fraud",
  trespass: "trespass",
  vandalism: "vandalism",
  shopLaw: "shop_law",
});

export const OFFENSE_SOURCES = Object.freeze({
  intentionalDirect: "intentional_direct",
  intentionalArea: "intentional_area",
  recklessArea: "reckless_area",
  accidentalChain: "accidental_chain",
  petOrSummon: "pet_or_summon",
  environmental: "environmental",
  shopLaw: "shop_law",
});

export const OFFENSE_DEFS = Object.freeze({
  [OFFENSE_KINDS.none]: Object.freeze({
    severity: OFFENSE_SEVERITY.none,
    label: "None",
  }),
  [OFFENSE_KINDS.assault]: Object.freeze({
    severity: OFFENSE_SEVERITY.serious,
    label: "Assault",
  }),
  [OFFENSE_KINDS.recklessEndangerment]: Object.freeze({
    severity: OFFENSE_SEVERITY.minor,
    label: "Reckless endangerment",
  }),
  [OFFENSE_KINDS.bodilyViolation]: Object.freeze({
    severity: OFFENSE_SEVERITY.severe,
    label: "Bodily violation",
  }),
  [OFFENSE_KINDS.theft]: Object.freeze({
    severity: OFFENSE_SEVERITY.serious,
    label: "Theft",
  }),
  [OFFENSE_KINDS.fraud]: Object.freeze({
    severity: OFFENSE_SEVERITY.serious,
    label: "Fraud",
  }),
  [OFFENSE_KINDS.trespass]: Object.freeze({
    severity: OFFENSE_SEVERITY.minor,
    label: "Trespass",
  }),
  [OFFENSE_KINDS.vandalism]: Object.freeze({
    severity: OFFENSE_SEVERITY.serious,
    label: "Vandalism",
  }),
  [OFFENSE_KINDS.shopLaw]: Object.freeze({
    severity: OFFENSE_SEVERITY.serious,
    label: "Shop law",
  }),
});

