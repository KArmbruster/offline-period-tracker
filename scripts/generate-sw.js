const fs = require('fs');
const path = require('path');

const BASE_PATH = '/offline-period-tracker';
const OUT_DIR = path.join(__dirname, '..', 'out');
const CACHE_VERSION = Date.now();

// Recursively get all files in a directory
function getAllFiles(dir, baseDir = dir) {
  let files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, baseDir));
    } else {
      // Get relative path from out directory
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push(relativePath);
    }
  }

  return files;
}

// Get all files from the out directory
const allFiles = getAllFiles(OUT_DIR);

// Filter to only include essential files (html, js, css, json, svg, ico, woff2)
const essentialFiles = allFiles.filter(file => {
  // Skip txt files (Next.js build artifacts)
  if (file.endsWith('.txt')) return false;
  // Include these extensions
  return /\.(html|js|css|json|svg|ico|woff2|woff|png|jpg|jpeg|webp)$/i.test(file);
});

// Create the URL paths with base path
const urlsToCache = [
  `${BASE_PATH}/`,
  ...essentialFiles.map(file => `${BASE_PATH}/${file}`)
];

const swContent = `// Generated at ${new Date().toISOString()}
const CACHE_NAME = 'period-tracker-v${CACHE_VERSION}';
const BASE_PATH = '${BASE_PATH}';

const URLS_TO_CACHE = ${JSON.stringify(urlsToCache, null, 2)};

// Install event - cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching', URLS_TO_CACHE.length, 'files');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('Failed to cache:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('period-tracker-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - cache-first strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Only handle same-origin requests
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clone and cache the response
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
            // For navigation requests, return the cached index.html
            if (event.request.mode === 'navigate') {
              return caches.match(BASE_PATH + '/index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});
`;

// Write the service worker to the out directory
fs.writeFileSync(path.join(OUT_DIR, 'sw.js'), swContent);
console.log('Generated sw.js with ' + urlsToCache.length + ' files to cache');
