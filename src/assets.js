const moduleURL = new URL(import.meta.url);
const site = new URL('../', moduleURL);

function loadAsset(path) {
  const url = new URL(path, site);
  // Use the same release URL as the modules that read these files.
  url.search = moduleURL.search;
  return fetch(url);
}

export { loadAsset };
