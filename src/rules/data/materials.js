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
    dispersion:0.0,
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
    dispersion:0.18,
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
    dispersion:0.05,
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

  /* ------------------ GEM MATERIALS / MINERALOGIC ------------------ */
  { id:'diamond', Material:{
    kind:'diamond', mohsHardness:10.0, density_g_cm3:3.52, brittleness:0.55,
    flammability:0.0, ignitionTempC:900, burnSeverity:0.1, meltPointC:Infinity,
    wetAbsorbency:0.0, conductivity:0.9, corrosionResist:0.98,
    lightPass:0.92, lightReflect:0.17, lightAbsorb:0.03, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.88,
    radShieldAlpha:1.0, radShieldBeta:0.88, radShieldGamma:0.30, radShieldNeutron:0.18, radActivation:0.0
  }},
  { id:'corundum', Material:{
    kind:'corundum', mohsHardness:9.0, density_g_cm3:4.00, brittleness:0.65,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:2040,
    wetAbsorbency:0.0, conductivity:0.05, corrosionResist:0.98,
    lightPass:0.75, lightReflect:0.10, lightAbsorb:0.15, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.08,
    radShieldAlpha:1.0, radShieldBeta:0.92, radShieldGamma:0.32, radShieldNeutron:0.22, radActivation:0.0
  }},
  { id:'beryl', Material:{
    kind:'beryl', mohsHardness:7.75, density_g_cm3:2.77, brittleness:0.60,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.0, conductivity:0.02, corrosionResist:0.96,
    lightPass:0.82, lightReflect:0.08, lightAbsorb:0.10, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.06,
    radShieldAlpha:1.0, radShieldBeta:0.90, radShieldGamma:0.26, radShieldNeutron:0.18, radActivation:0.0
  }},
  { id:'zircon', Material:{
    kind:'zircon', mohsHardness:7.5, density_g_cm3:4.65, brittleness:0.68,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:2550,
    wetAbsorbency:0.0, conductivity:0.03, corrosionResist:0.97,
    lightPass:0.80, lightReflect:0.12, lightAbsorb:0.08, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.76,
    radShieldAlpha:1.0, radShieldBeta:0.93, radShieldGamma:0.38, radShieldNeutron:0.26, radActivation:0.02
  }},
  { id:'topaz', Material:{
    kind:'topaz', mohsHardness:8.0, density_g_cm3:3.50, brittleness:0.72,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.0, conductivity:0.02, corrosionResist:0.96,
    lightPass:0.84, lightReflect:0.08, lightAbsorb:0.08, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.06,
    radShieldAlpha:1.0, radShieldBeta:0.90, radShieldGamma:0.30, radShieldNeutron:0.20, radActivation:0.0
  }},
  { id:'chrysoberyl', Material:{
    kind:'chrysoberyl', mohsHardness:8.5, density_g_cm3:3.75, brittleness:0.62,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.0, conductivity:0.03, corrosionResist:0.97,
    lightPass:0.80, lightReflect:0.10, lightAbsorb:0.10, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.30,
    radShieldAlpha:1.0, radShieldBeta:0.91, radShieldGamma:0.31, radShieldNeutron:0.21, radActivation:0.0
  }},
  { id:'opal', Material:{
    kind:'opal', mohsHardness:6.0, density_g_cm3:2.10, brittleness:0.70,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.05, conductivity:0.01, corrosionResist:0.88,
    lightPass:0.70, lightReflect:0.15, lightAbsorb:0.15, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.0,
    radShieldAlpha:1.0, radShieldBeta:0.86, radShieldGamma:0.20, radShieldNeutron:0.14, radActivation:0.0
  }},
  { id:'fluorite', Material:{
    kind:'fluorite', mohsHardness:4.0, density_g_cm3:3.18, brittleness:0.78,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:1360,
    wetAbsorbency:0.0, conductivity:0.01, corrosionResist:0.90,
    lightPass:0.78, lightReflect:0.08, lightAbsorb:0.14, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.14,
    radShieldAlpha:1.0, radShieldBeta:0.88, radShieldGamma:0.28, radShieldNeutron:0.18, radActivation:0.0
  }},
  { id:'garnet', Material:{
    kind:'garnet', mohsHardness:7.25, density_g_cm3:3.95, brittleness:0.58,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.0, conductivity:0.02, corrosionResist:0.95,
    lightPass:0.72, lightReflect:0.10, lightAbsorb:0.18, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.62,
    radShieldAlpha:1.0, radShieldBeta:0.90, radShieldGamma:0.30, radShieldNeutron:0.20, radActivation:0.0
  }},
  { id:'turquoise', Material:{
    kind:'turquoise', mohsHardness:5.5, density_g_cm3:2.70, brittleness:0.62,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.05, conductivity:0.01, corrosionResist:0.86,
    lightPass:0.10, lightReflect:0.12, lightAbsorb:0.18, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.10,
    radShieldAlpha:1.0, radShieldBeta:0.87, radShieldGamma:0.24, radShieldNeutron:0.16, radActivation:0.0
  }},
  { id:'amber', Material:{
    kind:'amber', mohsHardness:2.25, density_g_cm3:1.08, brittleness:0.35,
    flammability:0.85, ignitionTempC:250, burnSeverity:0.85, meltPointC:250,
    wetAbsorbency:0.02, conductivity:0.0, corrosionResist:0.70,
    lightPass:0.55, lightReflect:0.07, lightAbsorb:0.12, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.14,
    radShieldAlpha:1.0, radShieldBeta:0.55, radShieldGamma:0.10, radShieldNeutron:0.10, radActivation:0.0
  }},
  { id:'jet', Material:{
    kind:'jet', mohsHardness:3.0, density_g_cm3:1.30, brittleness:0.28,
    flammability:0.75, ignitionTempC:300, burnSeverity:0.80, meltPointC:Infinity,
    wetAbsorbency:0.04, conductivity:0.01, corrosionResist:0.65,
    lightPass:0.0, lightReflect:0.03, lightAbsorb:0.92, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.0,
    radShieldAlpha:1.0, radShieldBeta:0.58, radShieldGamma:0.12, radShieldNeutron:0.10, radActivation:0.0
  }},
  { id:'jadeite', Material:{
    kind:'jadeite', mohsHardness:6.75, density_g_cm3:3.34, brittleness:0.30,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.0, conductivity:0.02, corrosionResist:0.94,
    lightPass:0.35, lightReflect:0.10, lightAbsorb:0.15, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.12,
    radShieldAlpha:1.0, radShieldBeta:0.90, radShieldGamma:0.28, radShieldNeutron:0.20, radActivation:0.0
  }},
  { id:'nephrite', Material:{
    kind:'nephrite', mohsHardness:6.25, density_g_cm3:2.95, brittleness:0.22,
    flammability:0.0, ignitionTempC:Infinity, burnSeverity:0.0, meltPointC:Infinity,
    wetAbsorbency:0.0, conductivity:0.02, corrosionResist:0.94,
    lightPass:0.22, lightReflect:0.10, lightAbsorb:0.16, lightEmit:0.0, glowColorTempK:0,
    dispersion:0.10,
    radShieldAlpha:1.0, radShieldBeta:0.89, radShieldGamma:0.25, radShieldNeutron:0.18, radActivation:0.0
  }},
];

const MATERIAL_BY_KIND = new Map();
for (const row of MATERIAL_CATALOG) {
  const id = String(row?.id || "").toLowerCase();
  const kind = String(row?.Material?.kind || "").toLowerCase();
  if (id) MATERIAL_BY_KIND.set(id, row.Material);
  if (kind) MATERIAL_BY_KIND.set(kind, row.Material);
}

export function getMaterialIntrinsic(kind) {
  return MATERIAL_BY_KIND.get(String(kind || "").toLowerCase()) || null;
}

export const MATERIAL_TAGS = Object.freeze({
  metal: new Set([
    "iron", "steel", "copper", "bronze", "brass", "silver", "gold",
    "lead", "mercury", "aluminum", "titanium", "mithril", "adamantine",
    "radiant-alloy", "darksteel", "star-metal", "blood-iron",
  ]),
  paper: new Set(["paper"]),
  wood: new Set(["wood"]),
  glass: new Set(["glass", "soul-glass", "glass-fiber"]),
  gemstone: new Set([
    "diamond", "corundum", "beryl", "zircon", "topaz", "chrysoberyl",
    "opal", "fluorite", "garnet", "turquoise", "amber", "jet",
    "jadeite", "nephrite", "quartz", "obsidian",
  ]),
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
