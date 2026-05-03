import { installPluralizationExtensions } from "../src/shared/utils/pluralization.js";
import "../src/content/items/index.js";
import "../src/content/monsters/index.js";
import { installContent } from "../src/content/install.js";

installPluralizationExtensions();
installContent();
