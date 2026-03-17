const CACHE_VERSION = '2026-03-17T16:10:00Z';
const CACHE_NAME = 'phone-shell-' + CACHE_VERSION;
const CORE_URLS = [
  './',
  './index.html',
  './style.css',
  './main.js',
  './assetStore.js',
  './chatStorage.js',
  './avatar-frames.js',
  './manifest.webmanifest',
  './version.json',
  './apps/qq.html',
  './apps/chat.html',
  './apps/characters.html',
  './apps/settings.html',
  './apps/customize.html',
  './apps/worldbook.html',
  './apps/offline_mode.html'
];

function isSameOrigin(requestUrl){
  try{
    return new URL(requestUrl, self.location.href).origin === self.location.origin;
  }catch(err){
    return false;
  }
}

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache)=>cache.addAll(CORE_URLS))
      .catch(()=>null)
  );
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys()
      .then((keys)=>Promise.all(keys.map((key)=>{
        if(key === CACHE_NAME) return null;
        return caches.delete(key);
      })))
  );
});

self.addEventListener('message', (event)=>{
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event)=>{
  if(event.request.method !== 'GET') return;
  if(!isSameOrigin(event.request.url)) return;

  const url = new URL(event.request.url);
  const isNavigate = event.request.mode === 'navigate';
  const isDocument = event.request.destination === 'document' || /\.html?$/i.test(url.pathname) || url.pathname === '/';
  const isShellAsset = /(?:^|\/)(?:main\.js|style\.css|assetStore\.js|chatStorage\.js|avatar-frames\.js|manifest\.webmanifest|version\.json)$/i.test(url.pathname);
  const isImageOrFont = /(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);

  if(isNavigate || isDocument){
    event.respondWith(
      caches.match(event.request)
        .then((cached)=>{
          if(cached) return cached;
          return fetch(event.request, { cache:'no-store' }).then((response)=>{
            if(response && response.ok){
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache)=>cache.put(event.request, copy)).catch(()=>null);
            }
            return response;
          });
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  if(isShellAsset){
    event.respondWith(
      caches.match(event.request).then((cached)=>{
        if(cached) return cached;
        return fetch(event.request, { cache:'no-store' })
          .then((response)=>{
            if(response && response.ok){
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache)=>cache.put(event.request, copy)).catch(()=>null);
            }
            return response;
          });
      }).catch(()=>fetch(event.request, { cache:'no-store' }))
    );
    return;
  }

  if(isImageOrFont){
    event.respondWith(
      caches.match(event.request).then((cached)=>{
        if(cached) return cached;
        return fetch(event.request).then((response)=>{
          if(response && response.ok){
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache)=>cache.put(event.request, copy)).catch(()=>null);
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response)=>{
        if(response && response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache)=>cache.put(event.request, copy)).catch(()=>null);
        }
        return response;
      })
      .catch(()=>caches.match(event.request))
  );
});
