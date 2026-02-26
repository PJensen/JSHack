/**
 * Pluralization utilities (JS port of the C# concept).
 *
 * Usage:
 *   "sheep".pluralize(1)  // "sheep"
 *   "sheep".pluralize(2)  // "sheep"
 *   "goat".pluralize(10)  // "goats"
 *   "knives".singularize() // "knife"
 *
 * Notes:
 * - Order matters: rules are applied top-to-bottom.
 * - This mirrors the C# approach: regex rules + a small unchangeables set.
 * - For safety, the String prototype methods are defined as non-enumerable.
 */

export const PluralizationUtil = (() => {
  const UNCHANGEABLE_WORDS = new Set([
    "equipment", "information", "rice", "money", "species", "series", "fish", "sheep", "deer"
  ]);

  // Keep as arrays to preserve deterministic order (like the C# dictionaries’ insertion order in practice).
  const SINGULAR_RULES = [
    [/people$/i, "person"],
    [/oxen$/i, "ox"],
    [/children$/i, "child"],
    [/feet$/i, "foot"],
    [/teeth$/i, "tooth"],
    [/geese$/i, "goose"],
    [/(men)$/i, "man"],      // note: kept close to original intent
    [/(women)$/i, "woman"],  // note: kept close to original intent

    // Unchanging plurals
    [/(deer|trout|swine|sheep|fish)$/i, "$1"],

    // Specific exceptions for irregular plurals
    [/knives$/i, "knife"],
    [/lives$/i, "life"],
    [/hooves$/i, "hoof"],
    [/leaves$/i, "leaf"],
    [/wives$/i, "wife"],
    [/scarves$/i, "scarf"],
    [/thieves$/i, "thief"],
    [/dwarves$/i, "dwarf"],
    [/elves$/i, "elf"],

    // Additional specific exceptions for "es" endings
    [/echoes$/i, "echo"],
    [/heroes$/i, "hero"],
    [/tomatoes$/i, "tomato"],
    [/potatoes$/i, "potato"],
    [/millennia$/i, "millennium"],

    // Plurals ending in "ves" generally to "f"
    [/(.*)ves$/i, "$1f"],

    // Words ending in "ies" to "y"
    [/(.+[^aeiou])ies$/i, "$1y"],

    // Words ending in "zzes" and "zes"
    [/(.+zz)es$/i, "$1"],
    [/(.+z)es$/i, "$1"],

    // Words ending in "ices" to "ix" or "ex"
    [/(append|matr|ind)ices$/i, "$1ix"],

    // Greek and Latin roots
    [/(octop|vir|radi|fung|nucle|cact|alumn)i$/i, "$1us"],
    [/(phenomen|criteri|automat)a$/i, "$1on"],
    [/(analys|thes)es$/i, "$1is"],

    // Latin-origin words ending in "a" to "um"
    [/(phyl|milleni|spectr)a$/i, "$1um"],
    [/(cris|ax)es$/i, "$1is"],

    // Words ending in "es" but not "ies"
    [/(.+(s|x|sh|ch))es$/i, "$1"],

    // Catch-all rule for regular plurals
    [/(.+)s$/i, "$1"],
  ];

  const PLURAL_RULES = [
    [/^ox$/i, "oxen"],
    [/person$/i, "people"],
    [/child$/i, "children"],
    [/foot$/i, "feet"],
    [/tooth$/i, "teeth"],
    [/goose$/i, "geese"],
    [/moose$/i, "moose"],
    [/knife$/i, "knives"],
    [/elf$/i, "elves"],
    [/life$/i, "lives"],
    [/loaf$/i, "loaves"],
    [/wife$/i, "wives"],
    [/scarf$/i, "scarves"],
    [/thief$/i, "thieves"],
    [/dwarf$/i, "dwarves"],
    [/hoof$/i, "hooves"],
    [/leaf$/i, "leaves"],
    [/(cliff|cuff|roof|belief|chef|proof|giraffe)$/i, "$1s"],
    [/(deer|trout|swine|sheep|fish)$/i, "$1"],

    // Specific words changing "f/fe" to "ves"
    [/([^aeiou][aeiou]?l)f$/i, "$1ves"],     // half -> halves, wolf -> wolves, shelf -> shelves
    [/(kn|wh|l|hoo)ife?$/i, "$1ves"],        // knife -> knives, life -> lives, hoof -> hooves

    [/(.*)man$/i, "$1men"],

    // Refined rule for Latin-origin 'us' endings
    [/(octop|vir|radi|fung|nucle|cact|alumn|bacill|stimul)us$/i, "$1i"],

    [/(append|matr|ind)ix$/i, "$1ices"],
    [/(phenomen|criteri|automat)on$/i, "$1a"],
    [/(analys|thes)is$/i, "$1es"],
    [/([m|l])ouse$/i, "$1ice"],
    [/(echo|hero|potato|tomato|veto|torpedo|zero)$/i, "$1es"],
    [/(millennium)$/i, "millennia"],
    [/(.*[aeiou]y)$/i, "$1s"],
    [/(.+[^aeiou])y$/i, "$1ies"],
    [/(.+zz)$/i, "$1es"],
    [/(.+z)$/i, "$1zes"],
    [/(phyl|milleni|spectr)um$/i, "$1a"],
    [/(cris|ax)is$/i, "$1es"],
    [/(.+(s|x|sh|ch))$/i, "$1es"],
    [/(.+)/i, "$1s"], // default rule
  ];

  function isUnchangeable(word) {
    return UNCHANGEABLE_WORDS.has(String(word).toLowerCase());
  }

  function singularize(plural) {
    const w = String(plural);
    if (isUnchangeable(w)) return w;

    for (const [re, replacement] of SINGULAR_RULES) {
      if (re.test(w)) return w.replace(re, replacement);
    }
    return w;
  }

  function pluralize(count, singular) {
    const w = String(singular);
    if (count === 1 || isUnchangeable(w)) return w;

    for (const [re, replacement] of PLURAL_RULES) {
      if (re.test(w)) return w.replace(re, replacement);
    }
    return w + "s";
  }

  return Object.freeze({
    pluralize,
    singularize,
  });
})();

// Optional: C#-style extension methods on String (non-enumerable).
export function installPluralizationExtensions() {
  const define = (name, fn) => {
    if (Object.prototype.hasOwnProperty.call(String.prototype, name)) return;
    Object.defineProperty(String.prototype, name, {
      value: fn,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  };

  define("pluralize", function pluralizeExt(count) {
    return PluralizationUtil.pluralize(count, this.toString());
  });

  define("singularize", function singularizeExt() {
    return PluralizationUtil.singularize(this.toString());
  });
}