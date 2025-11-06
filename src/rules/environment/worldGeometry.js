import { GeometryKernel } from "./GeometryKernel.js";

const KEY = Symbol.for("jshack.geometry.kernel");

export function ensureGeometryKernel(world, opts = {}) {
  if (!world) throw new Error("World is required");
  if (!world[KEY]) {
    world[KEY] = new GeometryKernel(opts);
  }
  return world[KEY];
}

export function getGeometryKernel(world) {
  return world ? world[KEY] ?? null : null;
}

export function setGeometryKernel(world, kernel) {
  if (!world) throw new Error("World is required");
  world[KEY] = kernel;
  return kernel;
}
