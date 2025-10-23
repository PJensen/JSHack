export async function loadVersion() {
  try {
    const res = await fetch('VERSION');
    if (!res.ok) throw new Error('not ok');
    const text = (await res.text()).trim();
    window.VERSION = text;
  } catch {
    // Silently default to 'dev' to reduce console noise
    window.VERSION = 'dev';
  }
  // Optional: uncomment to see version on startup
  // console.log('Loaded version:', window.VERSION);
}

// Start loading the version but do not use top-level await.
// Export the promise so other modules can wait for it if they need to.
export const versionLoaded = loadVersion();