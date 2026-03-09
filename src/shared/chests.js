export function isChestIdentity(identity) {
  const key = String(identity || "");
  return key === "chest" || key.endsWith("_chest");
}
