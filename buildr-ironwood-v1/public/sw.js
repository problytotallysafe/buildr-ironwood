const CACHE="buildr-shell-v1";
const STATIC_ASSETS=["/manifest.webmanifest","/favicon.svg","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC_ASSETS)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);if(u.origin===self.location.origin&&STATIC_ASSETS.includes(u.pathname)){e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));}});