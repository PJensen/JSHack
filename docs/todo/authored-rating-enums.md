# Authored Rating Enums

Polymorph stability moved from bare numeric ratings (`0`, `1`, `2`, `3`) to a serialized enum surface:

- `unstable`
- `ordinary`
- `anchored`
- `fixed`

This pattern is easier to read in content files, survives JSON/save serialization, and still supports formulas through an explicit score helper.

TODO: audit similar authored "rating" or "tier-like" magic numbers and migrate the ones that represent named qualitative states to enum-backed surfaces with numeric score helpers. Good candidates are mechanics where content authors must remember what `2` means rather than simply comparing quantities.

