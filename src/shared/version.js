/**
 * Loads the application version from the VERSION file and sets it on window. 
 */
export async function loadVersion() {
  const res = await fetch('VERSION');
  if (!res.ok) throw new Error('not ok');
  const text = (await res.text()).trim();
  window.VERSION = text;
  // Optional: uncomment to see version on startup
  console.log('Loaded version:', window.VERSION);
}

// Start loading the version but do not use top-level await.
// Export the promise so other modules can wait for it if they need to.
export const versionLoaded = loadVersion();
