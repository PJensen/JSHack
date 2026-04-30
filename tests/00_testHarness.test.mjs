import { installPluralizationExtensions } from "../src/shared/utils/pluralization.js";
import "../src/content/items/potionOfRadiance.js";
import "../src/content/items/sunVessel.js";
import "../src/content/items/dawnbreaker.js";
import "../src/content/items/sunsword.js";
import "../src/content/items/fishingRod.js";
import "../src/content/items/lodbrokSerpentBoundBreeches.js";
import { installContent } from "../src/content/install.js";

installPluralizationExtensions();
installContent();
