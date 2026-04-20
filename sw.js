const CACHE_VERSION = '2026-04-20T07:49:26Z';
const CACHE_NAME = 'phone-shell-' + CACHE_VERSION;
const CORE_URLS = [
  './',
  './index.html',
  './style.css',
  './main.js',
  './avatar-frames.js',
  './offlineInviteStore.js',
  './assetStore.js',
  './chatStorage.js',
  './metadataStore.js',
  './scheduleShared.js',
  './presenceShared.js',
  './manifest.webmanifest',
  './version.json',
  './apps/qq.html',
  './apps/chat.html',
  './apps/offline.html',
  './apps/offline_mode.html',
  './apps/map6.html',
  './apps/characters.html',
  './apps/settings.html',
  './apps/customize.html',
  './apps/worldbook.html',
  './apps/backend.html',
  './apps/assets/海边小屋.webp',
  './apps/assets/亲亲脸.png',
  './apps/assets/约会提醒.svg',
  './apps/assets/吉他小黑猫.jpg',
  './apps/assets/loading-cat.png',
  './apps/assets/聊天设置.png',
  './apps/assets/联系人.png',
  './apps/assets/创建.svg',
  './apps/assets/导入.svg',
  './apps/assets/拉黑.png',
  './apps/assets/屏幕放大.png',
  './apps/assets/屏幕缩小.png',
  './apps/assets/聊天按钮.png',
];

function isSameOrigin(requestUrl){
  try{
    return new URL(requestUrl, self.location.href).origin === self.location.origin;
  }catch(err){
    return false;
  }
}

function shouldBypassDocumentCache(url){
  try{
    return url.searchParams.has('refreshBuild')
      || url.searchParams.has('swBuild')
      || url.searchParams.has('__appBuild')
      || url.searchParams.has('__ts');
  }catch(err){
    return false;
  }
}

function shouldBypassShellAssetCache(url){
  try{
    return url.searchParams.has('refreshBuild')
      || url.searchParams.has('swBuild')
      || url.searchParams.has('__appBuild')
      || url.searchParams.has('__ts')
      || url.searchParams.has('updateCheck');
  }catch(err){
    return false;
  }
}

async function shouldBypassViaClientBuild(event){
  try{
    const clientId = String(event && event.clientId || '').trim();
    if(!clientId || !self.clients || typeof self.clients.get !== 'function') return false;
    const client = await self.clients.get(clientId);
    if(!client || !client.url) return false;
    const clientUrl = new URL(client.url, self.location.href);
    return clientUrl.searchParams.has('__appBuild')
      || clientUrl.searchParams.has('refreshBuild')
      || clientUrl.searchParams.has('__ts');
  }catch(err){
    return false;
  }
}

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache)=>{
        for(const path of CORE_URLS){
          try{
            const requestUrl = new URL(path, self.location.href);
            requestUrl.searchParams.set('swBuild', CACHE_VERSION);
            const response = await fetch(requestUrl.toString(), { cache:'reload' });
            if(response && response.ok){
              await cache.put(new Request(path, { method:'GET' }), response.clone());
            }
          }catch(err){}
        }
        return null;
      })
      .catch(()=>null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys()
      .then((names)=>Promise.all(names
        .filter((name)=>String(name || '').indexOf('phone-shell') === 0 && name !== CACHE_NAME)
        .map((name)=>caches.delete(name).catch(()=>null))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message', (event)=>{
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (event)=>{
  var data = event && event.notification && event.notification.data ? event.notification.data : {};
  event.notification && event.notification.close && event.notification.close();
  if(event && event.action === 'dismiss') return;
  event.waitUntil((async function(){
    var allClients = await self.clients.matchAll({ type:'window', includeUncontrolled:true }).catch(function(){ return []; });
    var targetClient = allClients && allClients[0] ? allClients[0] : null;
    if(targetClient){
      try{ await targetClient.focus(); }catch(err){}
      try{
        targetClient.postMessage({
          type: 'OPEN_SHELL_NOTIFICATION',
          payload: data || {}
        });
      }catch(err){}
      return;
    }
    var nextUrl = new URL('./index.html', self.location.href);
    var app = String(data && data.app || '').trim();
    if(app) nextUrl.searchParams.set('openApp', app);
    if(data && data.charId) nextUrl.searchParams.set('notifyCharId', String(data.charId));
    if(data && data.inviteId) nextUrl.searchParams.set('notifyInviteId', String(data.inviteId));
    await self.clients.openWindow(nextUrl.toString()).catch(function(){ return null; });
  })());
});

self.addEventListener('fetch', (event)=>{
  if(event.request.method !== 'GET') return;
  if(!isSameOrigin(event.request.url)) return;

  const url = new URL(event.request.url);
  const isNavigate = event.request.mode === 'navigate';
  const isDocument = event.request.destination === 'document' || /\.html?$/i.test(url.pathname) || url.pathname === '/';
  const isShellAsset = /(?:^|\/)(?:main\.js|style\.css|assetStore\.js|chatStorage\.js|metadataStore\.js|avatar-frames\.js|manifest\.webmanifest|version\.json)$/i.test(url.pathname);
  const isCodeAsset = /(?:^|\/).+\.(?:js|css|json)$/i.test(url.pathname);
  const isImageOrFont = /(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);

  if(isNavigate || isDocument){
    event.respondWith(
      Promise.resolve().then(()=>{
        const fetchMode = shouldBypassDocumentCache(url) ? 'reload' : 'no-store';
        return fetch(event.request, { cache: fetchMode }).then((response)=>{
          if(response && response.ok){
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache)=>cache.put(new Request(url.pathname, { method:'GET' }), copy)).catch(()=>null);
          }
          return response;
        }).catch(()=>{
          return caches.match(event.request, { ignoreSearch: true })
            .then((cached)=>cached || caches.match('./index.html', { ignoreSearch: true }));
        });
      })
        .catch(()=>caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  if(isShellAsset){
    event.respondWith(
      Promise.resolve().then(async ()=>{
        const bypass = shouldBypassShellAssetCache(url) || await shouldBypassViaClientBuild(event);
        if(bypass){
          return fetch(event.request, { cache:'reload' }).then((response)=>{
            if(response && response.ok){
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache)=>cache.put(new Request(url.pathname, { method:'GET' }), copy)).catch(()=>null);
            }
            return response;
          });
        }
        return caches.match(event.request, { ignoreSearch: true }).then((cached)=>{
          if(cached) return cached;
          return fetch(event.request, { cache:'no-store' })
            .then((response)=>{
              if(response && response.ok){
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache)=>cache.put(event.request, copy)).catch(()=>null);
              }
              return response;
            });
        });
      }).catch(()=>fetch(event.request, { cache:'no-store' }))
    );
    return;
  }

  if(isCodeAsset){
    event.respondWith(
      Promise.resolve().then(async ()=>{
        const bypass = shouldBypassShellAssetCache(url) || await shouldBypassViaClientBuild(event);
        if(bypass){
          return fetch(event.request, { cache:'reload' }).then((response)=>{
            if(response && response.ok){
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache)=>cache.put(new Request(url.pathname, { method:'GET' }), copy)).catch(()=>null);
            }
            return response;
          });
        }
        return fetch(event.request, { cache:'no-store' })
          .then((response)=>{
            if(response && response.ok){
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache)=>cache.put(event.request, copy)).catch(()=>null);
            }
            return response;
          })
          .catch(()=>caches.match(event.request, { ignoreSearch:true }));
      })
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
