# Tree Catechism

This file exists because the tree renderer bug was made harder than it needed to be.

## Rules

1. Overworld trees should use the entity model, not the legacy `tree` terrain tile model.
2. A tree entity is a glyph drawn over the existing base terrain.
3. A tree entity does not own the cell background color.
4. A tree on grass should look like it is on that grass.
5. A tree on cobblestone should look like it is on that cobblestone.
6. Trees may still be occluders.
7. Being an occluder must not cause the tree glyph itself to render as if its own cell is fully shadowed.
8. Herbs and flowers are the reference behavior for overworld vegetation overlays.
9. Do not "fix" tree backgrounds by forcing grass under them unless the authored content explicitly wants grass there.
10. Do not infer fake base terrain in the renderer when the actual underlying tile already exists.

## Anti-Rules

- Do not treat the symptom as an emoji problem unless the actual bug proves that.
- Do not treat the symptom as a palette-color problem unless the actual bug proves that.
- Do not replace live tree art with placeholder glyph hacks to chase a lighting bug.
- Do not add renderer special cases before tracing the exact draw path.
- Do not reintroduce legacy `TILE_TREE` usage for overworld vegetation if the goal is overlay behavior.

## Source Of Truth

If an overworld tree background looks wrong, check these in order:

1. Is the thing on screen a legacy `tree` tile or a real tree entity?
2. Does the palette entry bake in a `bg` when it should be foreground-only?
3. Does the post-light redraw path lift the tree foreground back over darkness?
4. Is the lighting/vision pass counting the occluder cell itself as unseeable black?

## Correct Mental Model

The bug is not "trees need grass."

The bug is:

- the underlying terrain should remain authoritative
- the tree glyph should draw on top of it
- occlusion should block what is behind the tree
- occlusion should not erase the visible front-face glyph of the tree itself

## Operational Rule

When this breaks again:

1. Trace one live tree from world data to palette to atlas to final draw.
2. Identify whether it is tile-backed or entity-backed.
3. Fix the real render path.
4. Do not patch generation, palette, and lighting all at once.
