const CACHE_NAME = 'pg-qms-v8';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './pravesh-logo.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[PWA] Caching essential assets');
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch(err => console.error("[PWA] Cache error:", err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[PWA] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Only intercept basic GET requests to HTTP/HTTPS
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    // Supabase REST and Realtime calls should always go to network directly (Never Cache)
    if (event.request.url.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Google Sheets Sync should always go directly to network
    if (event.request.url.includes('script.google.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Stale-while-revalidate strategy for UI assets
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                // Fetch in background to update cache for next time
                fetch(event.request).then(response => {
                    if (response && response.status === 200) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, response.clone());
                        });
                    }
                }).catch(() => { }); // Ignore offline background errors

                return cachedResponse;
            }

            // Network fallback if not in cache
            return fetch(event.request).then(response => {
                // Cache new assets dynamically
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            });
        })
    );
});
