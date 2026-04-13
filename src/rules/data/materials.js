/** Pure data — safe to move to JSON. Values are approximate, tuned for gameplay. */
export const MATERIAL_CATALOG = [
  /* ------------------ ORGANIC / NATURAL ------------------ */
  { id:'wood', Material:{
    kind:'wood', mohsHardness:2.0, density_g_cm3:0.7, brittleness:0.2,
    flammability:0.7, ignitionTempC:300, burnSeverity:0.8, meltPointC:Infinity,
    wetAbsorbency:0.6, conductivity:0.05, corrosionResist:0.3,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.10, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.7, radShieldGamma:0.15, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'leather', Material:{
    kind:'leather', mohsHardness:2.5, density_g_cm3:0.95, brittleness:0.15,
    flammability:0.3, ignitionTempC:200, burnSeverity:0.5, meltPointC:Infinity,
    wetAbsorbency:0.5, conductivity:0.05, corrosionResist:0.6,
    lightPass:0.0, lightReflect:0.10, lightAbsorb:0.20, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.7, radShieldGamma:0.25, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'wool', Material:{
    kind:'wool', mohsHardness:2.0, density_g_cm3:1.3, brittleness:0.05,
    flammability:0.4, ignitionTempC:570, burnSeverity:0.5, meltPointC:Infinity,
    wetAbsorbency:0.8, conductivity:0.02, corrosionResist:0.5,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.10, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.6, radShieldGamma:0.20, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'bone', Material:{
    kind:'bone', mohsHardness:3.0, density_g_cm3:1.8, brittleness:0.5,
    flammability:0.1, ignitionTempC:400, burnSeverity:0.3, meltPointC:Infinity,
    wetAbsorbency:0.2, conductivity:0.05, corrosionResist:0.5,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.10, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.7, radShieldGamma:0.2, radShieldNeutron:0.25, radActivation:0.0
  }},
  { id:'ivory', Material:{
    kind:'ivory', mohsHardness:2.5, density_g_cm3:1.9, brittleness:0.35,
    flammability:0.1, ignitionTempC:400, burnSeverity:0.3, meltPointC:Infinity,
    wetAbsorbency:0.3, conductivity:0.04, corrosionResist:0.6,
    lightPass:0.0, lightReflect:0.06, lightAbsorb:0.12, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.7, radShieldGamma:0.22, radShieldNeutron:0.25, radActivation:0.0
  }},
  { id:'shell', Material:{
    kind:'shell', mohsHardness:3.0, density_g_cm3:2.6, brittleness:0.45,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.1, conductivity:0.02, corrosionResist:0.8,
    lightPass:0.0, lightReflect:0.10, lightAbsorb:0.15, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.8, radShieldGamma:0.25, radShieldNeutron:0.3, radActivation:0.0
  }},
  { id:'horn', Material:{
    kind:'horn', mohsHardness:2.5, density_g_cm3:1.3, brittleness:0.3,
    flammability:0.5, ignitionTempC:360, burnSeverity:0.6, meltPointC:Infinity,
    wetAbsorbency:0.4, conductivity:0.03, corrosionResist:0.4,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.10, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.6, radShieldGamma:0.18, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'paper', Material:{
    kind:'paper', mohsHardness:2.0, density_g_cm3:0.8, brittleness:0.2,
    flammability:0.9, ignitionTempC:233, burnSeverity:0.8, meltPointC:Infinity,
    wetAbsorbency:0.9, conductivity:0.0, corrosionResist:0.2,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.10, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.4, radShieldGamma:0.05, radShieldNeutron:0.1, radActivation:0.0
  }},
  { id:'cloth', Material:{
    kind:'cloth', mohsHardness:2.0, density_g_cm3:1.0, brittleness:0.05,
    flammability:0.7, ignitionTempC:400, burnSeverity:0.7, meltPointC:Infinity,
    wetAbsorbency:0.8, conductivity:0.02, corrosionResist:0.4,
    lightPass:0.0, lightReflect:0.04, lightAbsorb:0.08, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.5, radShieldGamma:0.10, radShieldNeutron:0.15, radActivation:0.0
  }},
  { id:'flesh', Material:{
    kind:'flesh', mohsHardness:1.0, density_g_cm3:1.0, brittleness:0.05,
    flammability:0.2, ignitionTempC:300, burnSeverity:0.6, meltPointC:Infinity,
    wetAbsorbency:0.7, conductivity:0.2, corrosionResist:0.2,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.15, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.7, radShieldGamma:0.20, radShieldNeutron:0.25, radActivation:0.0
  }},

  /* ------------------ MINERAL / INORGANIC ------------------ */
  { id:'stone', Material:{
    kind:'stone', mohsHardness:6.0, density_g_cm3:2.7, brittleness:0.5,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.05, conductivity:0.05, corrosionResist:0.8,
    lightPass:0.0, lightReflect:0.10, lightAbsorb:0.20, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.95, radShieldGamma:0.30, radShieldNeutron:0.25, radActivation:0.0
  }},
  { id:'obsidian', Material:{
    kind:'obsidian', mohsHardness:5.0, density_g_cm3:2.4, brittleness:0.9,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1000,
    wetAbsorbency:0.0, conductivity:0.02, corrosionResist:0.9,
    lightPass:0.0, lightReflect:0.15, lightAbsorb:0.25, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.9, radShieldGamma:0.25, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'clay', Material:{
    kind:'clay', mohsHardness:2.0, density_g_cm3:1.6, brittleness:0.6,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.4, conductivity:0.02, corrosionResist:0.7,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.10, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.8, radShieldGamma:0.20, radShieldNeutron:0.25, radActivation:0.0
  }},
  { id:'ceramic', Material:{
    kind:'ceramic', mohsHardness:7.0, density_g_cm3:2.6, brittleness:0.85,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1500,
    wetAbsorbency:0.1, conductivity:0.02, corrosionResist:0.95,
    lightPass:0.0, lightReflect:0.10, lightAbsorb:0.20, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.95, radShieldGamma:0.35, radShieldNeutron:0.25, radActivation:0.0
  }},
  { id:'glass', Material:{
    kind:'glass', mohsHardness:5.5, density_g_cm3:2.6, brittleness:0.9,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:600,
    wetAbsorbency:0.0, conductivity:0.05, corrosionResist:0.9,
    lightPass:0.9, lightReflect:0.05, lightAbsorb:0.05, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.8, radShieldGamma:0.20, radShieldNeutron:0.1, radActivation:0.0
  }},
  { id:'sand', Material:{
    kind:'sand', mohsHardness:7.0, density_g_cm3:1.6, brittleness:0.2,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1700,
    wetAbsorbency:0.1, conductivity:0.01, corrosionResist:0.9,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.10, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.9, radShieldGamma:0.25, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'salt', Material:{
    kind:'salt', mohsHardness:2.5, density_g_cm3:2.2, brittleness:0.8,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:801,
    wetAbsorbency:0.6, conductivity:0.0, corrosionResist:0.7,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.08, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.85, radShieldGamma:0.22, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'quartz', Material:{
    kind:'quartz', mohsHardness:7.0, density_g_cm3:2.6, brittleness:0.8,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1670,
    wetAbsorbency:0.0, conductivity:0.01, corrosionResist:0.95,
    lightPass:0.7, lightReflect:0.1, lightAbsorb:0.2, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.9, radShieldGamma:0.28, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'ice', Material:{
    kind:'ice', mohsHardness:1.5, density_g_cm3:0.92, brittleness:0.6,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:0,
    wetAbsorbency:0.0, conductivity:0.01, corrosionResist:0.7,
    lightPass:0.6, lightReflect:0.1, lightAbsorb:0.3, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.8, radShieldGamma:0.2, radShieldNeutron:0.25, radActivation:0.0
  }},

  /* ------------------ METALS / ALLOYS ------------------ */
  { id:'iron', Material:{
    kind:'iron', mohsHardness:4.0, density_g_cm3:7.9, brittleness:0.25,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1538,
    wetAbsorbency:0.0, conductivity:0.7, corrosionResist:0.3,
    lightPass:0.0, lightReflect:0.30, lightAbsorb:0.20, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.8, radShieldGamma:0.4, radShieldNeutron:0.25, radActivation:0.3
  }},
  { id:'steel', Material:{
    kind:'steel', mohsHardness:5.5, density_g_cm3:7.8, brittleness:0.2,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1500,
    wetAbsorbency:0.0, conductivity:0.8, corrosionResist:0.7,
    lightPass:0.0, lightReflect:0.40, lightAbsorb:0.20, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.8, radShieldGamma:0.4, radShieldNeutron:0.3, radActivation:0.3
  }},
  { id:'copper', Material:{
    kind:'copper', mohsHardness:3.0, density_g_cm3:8.9, brittleness:0.15,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1085,
    wetAbsorbency:0.0, conductivity:1.0, corrosionResist:0.4,
    lightPass:0.0, lightReflect:0.35, lightAbsorb:0.25, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.85, radShieldGamma:0.45, radShieldNeutron:0.3, radActivation:0.25
  }},
  { id:'bronze', Material:{
    kind:'bronze', mohsHardness:3.5, density_g_cm3:8.8, brittleness:0.25,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:950,
    wetAbsorbency:0.0, conductivity:0.6, corrosionResist:0.7,
    lightPass:0.0, lightReflect:0.35, lightAbsorb:0.25, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.85, radShieldGamma:0.45, radShieldNeutron:0.3, radActivation:0.2
  }},
  { id:'brass', Material:{
    kind:'brass', mohsHardness:3.0, density_g_cm3:8.5, brittleness:0.2,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:930,
    wetAbsorbency:0.0, conductivity:0.6, corrosionResist:0.6,
    lightPass:0.0, lightReflect:0.35, lightAbsorb:0.25, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.85, radShieldGamma:0.45, radShieldNeutron:0.3, radActivation:0.2
  }},
  { id:'silver', Material:{
    kind:'silver', mohsHardness:2.5, density_g_cm3:10.5, brittleness:0.15,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:962,
    wetAbsorbency:0.0, conductivity:0.95, corrosionResist:0.5,
    lightPass:0.0, lightReflect:0.6, lightAbsorb:0.15, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.9, radShieldGamma:0.5, radShieldNeutron:0.35, radActivation:0.25
  }},
  { id:'gold', Material:{
    kind:'gold', mohsHardness:2.5, density_g_cm3:19.3, brittleness:0.05,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1064,
    wetAbsorbency:0.0, conductivity:0.7, corrosionResist:0.95,
    lightPass:0.0, lightReflect:0.6, lightAbsorb:0.15, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.95, radShieldGamma:0.6, radShieldNeutron:0.4, radActivation:0.3
  }},
  { id:'lead', Material:{
    kind:'lead', mohsHardness:1.5, density_g_cm3:11.3, brittleness:0.4,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:327,
    wetAbsorbency:0.0, conductivity:0.43, corrosionResist:0.5,
    lightPass:0.0, lightReflect:0.35, lightAbsorb:0.25, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.95, radShieldGamma:0.8, radShieldNeutron:0.35, radActivation:0.2
  }},
  { id:'mercury', Material:{
    kind:'mercury', mohsHardness:0.0, density_g_cm3:13.5, brittleness:0.0,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:-39,
    wetAbsorbency:0.0, conductivity:0.9, corrosionResist:0.4,
    lightPass:0.0, lightReflect:0.5, lightAbsorb:0.2, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.9, radShieldGamma:0.6, radShieldNeutron:0.35, radActivation:0.25
  }},
  { id:'aluminum', Material:{
    kind:'aluminum', mohsHardness:2.75, density_g_cm3:2.7, brittleness:0.15,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:660,
    wetAbsorbency:0.0, conductivity:0.6, corrosionResist:0.9,
    lightPass:0.0, lightReflect:0.55, lightAbsorb:0.15, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.9, radShieldGamma:0.35, radShieldNeutron:0.25, radActivation:0.2
  }},
  { id:'titanium', Material:{
    kind:'titanium', mohsHardness:6.0, density_g_cm3:4.5, brittleness:0.2,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1668,
    wetAbsorbency:0.0, conductivity:0.25, corrosionResist:0.95,
    lightPass:0.0, lightReflect:0.35, lightAbsorb:0.25, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.9, radShieldGamma:0.45, radShieldNeutron:0.35, radActivation:0.2
  }},

  /* ------------------ SYNTHETIC / CHEMICAL ------------------ */
  { id:'plastic', Material:{
    kind:'plastic', mohsHardness:2.0, density_g_cm3:1.2, brittleness:0.3,
    flammability:0.6, ignitionTempC:350, burnSeverity:0.9, meltPointC:180,
    wetAbsorbency:0.2, conductivity:0.01, corrosionResist:0.6,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.1, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.7, radShieldGamma:0.2, radShieldNeutron:0.25, radActivation:0.0
  }},
  { id:'rubber', Material:{
    kind:'rubber', mohsHardness:1.5, density_g_cm3:1.1, brittleness:0.05,
    flammability:0.6, ignitionTempC:260, burnSeverity:0.9, meltPointC:180,
    wetAbsorbency:0.1, conductivity:0.01, corrosionResist:0.6,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.1, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.7, radShieldGamma:0.2, radShieldNeutron:0.3, radActivation:0.0
  }},
  { id:'resin', Material:{
    kind:'resin', mohsHardness:2.0, density_g_cm3:1.2, brittleness:0.4,
    flammability:0.8, ignitionTempC:300, burnSeverity:0.9, meltPointC:120,
    wetAbsorbency:0.1, conductivity:0.01, corrosionResist:0.7,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.1, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.7, radShieldGamma:0.2, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'tar', Material:{
    kind:'tar', mohsHardness:0.5, density_g_cm3:1.2, brittleness:0.0,
    flammability:0.9, ignitionTempC:250, burnSeverity:1.0, meltPointC:60,
    wetAbsorbency:0.0, conductivity:0.01, corrosionResist:0.5,
    lightPass:0.0, lightReflect:0.02, lightAbsorb:0.15, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.7, radShieldGamma:0.2, radShieldNeutron:0.25, radActivation:0.0
  }},
  { id:'concrete', Material:{
    kind:'concrete', mohsHardness:6.5, density_g_cm3:2.4, brittleness:0.7,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.1, conductivity:0.1, corrosionResist:0.8,
    lightPass:0.0, lightReflect:0.1, lightAbsorb:0.2, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.95, radShieldGamma:0.5, radShieldNeutron:0.4, radActivation:0.0
  }},
  { id:'glassfiber', Material:{
    kind:'glass-fiber', mohsHardness:6.0, density_g_cm3:1.9, brittleness:0.6,
    flammability:0.1, ignitionTempC:600, burnSeverity:0.2, meltPointC:700,
    wetAbsorbency:0.1, conductivity:0.02, corrosionResist:0.9,
    lightPass:0.0, lightReflect:0.1, lightAbsorb:0.2, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.9, radShieldGamma:0.35, radShieldNeutron:0.3, radActivation:0.0
  }},

  /* ------------------ EXOTIC / MAGICAL ------------------ */
  { id:'mithril', Material:{
    kind:'mithril', mohsHardness:9.0, density_g_cm3:1.2, brittleness:0.1,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:3000,
    wetAbsorbency:0.0, conductivity:0.6, corrosionResist:1.0,
    lightPass:0.0, lightReflect:0.5, lightAbsorb:0.1, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.95, radShieldGamma:0.6, radShieldNeutron:0.6, radActivation:0.0
  }},
  { id:'adamantine', Material:{
    kind:'adamantine', mohsHardness:10.0, density_g_cm3:5.0, brittleness:0.05,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:4000,
    wetAbsorbency:0.0, conductivity:0.5, corrosionResist:1.0,
    lightPass:0.0, lightReflect:0.4, lightAbsorb:0.2, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.98, radShieldGamma:0.8, radShieldNeutron:0.7, radActivation:0.0
  }},
  { id:'voidstone', Material:{
    kind:'voidstone', mohsHardness:9.0, density_g_cm3:3.0, brittleness:0.2,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.0, conductivity:0.0, corrosionResist:1.0,
    lightPass:0.0, lightReflect:0.0, lightAbsorb:1.0, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:1.0, radShieldGamma:0.9, radShieldNeutron:0.9, radActivation:0.0
  }},
  { id:'radiant-alloy', Material:{
    kind:'radiant-alloy', mohsHardness:8.0, density_g_cm3:7.0, brittleness:0.1,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:2500,
    wetAbsorbency:0.0, conductivity:0.7, corrosionResist:0.9,
    lightPass:0.0, lightReflect:0.5, lightAbsorb:0.1, lightEmit:0.6, glowColorTempK:5000,
    radShieldAlpha:1.0, radShieldBeta:0.95, radShieldGamma:0.7, radShieldNeutron:0.6, radActivation:0.1
  }},
  { id:'darksteel', Material:{
    kind:'darksteel', mohsHardness:8.5, density_g_cm3:8.0, brittleness:0.2,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:3500,
    wetAbsorbency:0.0, conductivity:0.3, corrosionResist:1.0,
    lightPass:0.0, lightReflect:0.05, lightAbsorb:0.9, lightEmit:0.0, glowColorTempK:0,
    radShieldAlpha:1.0, radShieldBeta:0.95, radShieldGamma:0.75, radShieldNeutron:0.7, radActivation:0.0
  }},
  { id:'ectoplasm', Material:{
    kind:'ectoplasm', mohsHardness:0.5, density_g_cm3:0.5, brittleness:0.0,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:-Infinity,
    wetAbsorbency:0.0, conductivity:0.0, corrosionResist:1.0,
    lightPass:0.8, lightReflect:0.0, lightAbsorb:0.2, lightEmit:0.2, glowColorTempK:8000,
    radShieldAlpha:0.5, radShieldBeta:0.3, radShieldGamma:0.1, radShieldNeutron:0.1, radActivation:0.0
  }},
  { id:'starmetal', Material:{
    kind:'star-metal', mohsHardness:9.0, density_g_cm3:7.5, brittleness:0.15,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:2500,
    wetAbsorbency:0.0, conductivity:0.6, corrosionResist:0.9,
    lightPass:0.0, lightReflect:0.45, lightAbsorb:0.25, lightEmit:0.05, glowColorTempK:3500,
    radShieldAlpha:1.0, radShieldBeta:0.97, radShieldGamma:0.75, radShieldNeutron:0.7, radActivation:0.05
  }},
  { id:'soul-glass', Material:{
    kind:'soul-glass', mohsHardness:6.0, density_g_cm3:2.6, brittleness:0.95,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:700,
    wetAbsorbency:0.0, conductivity:0.01, corrosionResist:0.9,
    lightPass:0.7, lightReflect:0.1, lightAbsorb:0.2, lightEmit:0.1, glowColorTempK:12000,
    radShieldAlpha:1.0, radShieldBeta:0.9, radShieldGamma:0.3, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'aetherium', Material:{
    kind:'aetherium', mohsHardness:8.0, density_g_cm3:0.1, brittleness:0.0,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.0, conductivity:0.0, corrosionResist:1.0,
    lightPass:1.0, lightReflect:0.0, lightAbsorb:0.0, lightEmit:0.5, glowColorTempK:10000,
    radShieldAlpha:0.2, radShieldBeta:0.2, radShieldGamma:0.2, radShieldNeutron:0.2, radActivation:0.0
  }},
  { id:'blood-iron', Material:{
    kind:'blood-iron', mohsHardness:5.0, density_g_cm3:7.6, brittleness:0.25,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.2, meltPointC:1450,
    wetAbsorbency:0.1, conductivity:0.6, corrosionResist:0.2,
    lightPass:0.0, lightReflect:0.25, lightAbsorb:0.3, lightEmit:0.05, glowColorTempK:1800,
    radShieldAlpha:1.0, radShieldBeta:0.85, radShieldGamma:0.45, radShieldNeutron:0.3, radActivation:0.4
  }},
];

export const MATERIAL_TAGS = Object.freeze({
  metal: new Set([
    "iron", "steel", "copper", "bronze", "brass", "silver", "gold",
    "lead", "mercury", "aluminum", "titanium", "mithril", "adamantine",
    "radiant-alloy", "darksteel", "star-metal", "blood-iron",
  ]),
  paper: new Set(["paper"]),
  wood: new Set(["wood"]),
  glass: new Set(["glass", "soul-glass", "glass-fiber"]),
  organic: new Set([
    "flesh", "leather", "wool", "cloth", "bone", "ivory", "horn", "shell",
  ]),
});

export function materialHasTag(kind, tag) {
  const kinds = MATERIAL_TAGS[String(tag || "").toLowerCase()];
  if (!kinds) return false;
  return kinds.has(String(kind || "").toLowerCase());
}

export function materialTagsFor(kind) {
  const needle = String(kind || "").toLowerCase();
  const out = [];
  for (const [tag, kinds] of Object.entries(MATERIAL_TAGS)) {
    if (kinds.has(needle)) out.push(tag);
  }
  return out;
}
