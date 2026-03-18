// EPHONE Main OS Logic
const APP_MAP = {
  qq:         { title: 'QQ',             src: 'apps/qq.html' },
  chat:       { title: 'Chat',           src: 'apps/chat.html' },
  characters: { title: 'Contacts',       src: 'apps/characters.html' },
  settings:   { title: '设置',           src: 'apps/settings.html' },
  customize:  { title: '外观',           src: 'apps/customize.html' },
  worldbook:  { title: '世界书',         src: 'apps/worldbook.html' },
  offline:    { title: '线下模式',       src: 'apps/offline_mode.html', hideTopbar: true },
};
const HOME_ICON_DEFAULTS = {
  qq: 'QQ',
  settings: '设置',
  customize: '外观',
  worldbook: '世界书',
};
const PHONE_FRAME_STORAGE_KEY = 'phone_frame_visible';
const LIVE_DANMAKU_DEFAULTS = {
  '1': ['啊啊啊太可爱了','宝宝上线了','今天状态好好'],
  '2': ['蹲到你了','这张也太甜','晚安打卡'],
  '3': ['今日份心动','镜头感满分','路过被可爱到']
};
const LIVE_DANMAKU_ENABLED_KEY = 'home_live_danmaku_enabled';
const AI_BG_ENABLED_KEY = 'ai_bg_activity_enabled';
const AI_BG_INTERVAL_KEY = 'ai_bg_activity_interval_min';
const AI_BG_LAST_AT_KEY = 'ai_bg_activity_last_at';
const MOMENTS_POSTS_KEY = 'qq_moments_posts';
const OFFLINE_MINIMIZED_CHAR_KEY = 'offline_minimized_char';
const APP_BUILD_ID = '2026-03-17T21:18:00Z';
const REFRESH_RECALC_FLAG_KEY = 'refresh_recalc_needed_v1';
const UPDATE_PROMPT_DEDUPE_KEY = 'hosted_update_prompt_dedupe_v1';
const UPDATE_PROMPT_DEDUPE_MS = 8000;
const HOSTED_UPDATE_ACCEPTED_BUILD_KEY = 'hosted_update_accepted_build_v1';
const UPDATE_CHECK_THROTTLE_MS = 45 * 1000;
const GITHUB_UPDATE_OWNER = 'xzhu046-ctrl';
const GITHUB_UPDATE_REPO = '615';
const GITHUB_UPDATE_BRANCH = 'main';
const SERVICE_WORKER_PATH = 'sw.js';
let persistentStorageRequestStarted = false;
var widgetPreviewCache = {};
let pendingRemoteAppFingerprint = '';
let lastHostedUpdateCheckAt = 0;
let hostedUpdateLockedOpen = false;
let hostedUpdateRetryTimer = 0;
let swControllerRefreshPending = false;
let shownHostedUpdateFingerprint = '';
let hostedUpdateBootstrapped = false;
let hostedUpdateModalShown = false;
let chatInputFocusActive = false;
let chatReportedKeyboardShift = 0;

function getTopLevelChatKeyboardShift(){
  var vv = window.visualViewport;
  if(!vv) return 0;
  var viewportHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0) || 0;
  var visibleBottom = Math.round((vv.height || 0) + (vv.offsetTop || 0));
  var inset = Math.max(0, viewportHeight - visibleBottom);
  return inset >= 80 ? Math.min(420, inset) : 0;
}

function syncChatKeyboardShift(){
  if(currentApp !== 'chat'){
    setChatKeyboardShift(0);
    return;
  }
  var next = Math.max(
    chatInputFocusActive ? getTopLevelChatKeyboardShift() : 0,
    Number(chatReportedKeyboardShift) || 0
  );
  setChatKeyboardShift(next);
}

function offlineMinimizedStorageKey(){
  return mainScopedKey(OFFLINE_MINIMIZED_CHAR_KEY);
}

function getMinimizedOfflineCharId(){
  try{ return String(localStorage.getItem(offlineMinimizedStorageKey()) || '').trim(); }catch(e){ return ''; }
}

function offlineSessionStorageKeyMain(charId){
  return mainScopedKey('offline_meet_session_' + String(charId || '').trim());
}

function ensureOfflineMiniLauncher(){
  var existing = document.getElementById('offline-mini-launcher-shell');
  if(existing) return existing;
  var btn = document.createElement('button');
  btn.id = 'offline-mini-launcher-shell';
  btn.type = 'button';
  btn.title = '继续线下模式';
  btn.setAttribute('aria-label', '继续线下模式');
  btn.style.position = 'fixed';
  btn.style.left = '16px';
  btn.style.bottom = '22px';
  btn.style.zIndex = '1400';
  btn.style.display = 'none';
  btn.style.width = '68px';
  btn.style.height = '68px';
  btn.style.border = '2px solid #0a0a0a';
  btn.style.borderRadius = '999px';
  btn.style.background = '#fff';
  btn.style.boxShadow = '2px 2px 0 #0a0a0a';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.cursor = 'pointer';
  btn.innerHTML = '<img src="apps/assets/线下模式图标.png" alt="线下模式" style="width:42px;height:42px;object-fit:contain;filter:grayscale(1) contrast(1.06);pointer-events:none;">';
  btn.addEventListener('click', function(){
    var charId = getMinimizedOfflineCharId();
    if(!charId) return;
    try{
      var raw = localStorage.getItem(offlineSessionStorageKeyMain(charId));
      if(raw){
        var session = JSON.parse(raw);
        if(session && typeof session === 'object'){
          session.minimized = false;
          localStorage.setItem(offlineSessionStorageKeyMain(charId), JSON.stringify(session));
        }
      }
    }catch(e){}
    setMinimizedOfflineCharId('');
    openApp('offline');
  });
  document.body.appendChild(btn);
  return btn;
}

function renderOfflineMiniLauncher(){
  var btn = ensureOfflineMiniLauncher();
  if(!btn) return;
  btn.style.display = getMinimizedOfflineCharId() ? 'flex' : 'none';
}

function setMinimizedOfflineCharId(charId){
  try{
    var next = String(charId || '').trim();
    if(next) localStorage.setItem(offlineMinimizedStorageKey(), next);
    else localStorage.removeItem(offlineMinimizedStorageKey());
  }catch(e){}
  renderOfflineMiniLauncher();
}

function widgetPreviewStorageKey(charId){
  return scopedKeyForAccount('widget_preview_' + String(charId || ''), getActiveAccountId());
}

function storeWidgetPreview(charId, preview){
  if(!charId || !preview) return;
  var record = {
    content: String(preview.content || ''),
    type: normalizeChatPreviewType(preview.type || 'text'),
    at: Number(preview.at || Date.now()) || Date.now()
  };
  widgetPreviewCache[charId] = record;
  try{
    localStorage.setItem(widgetPreviewStorageKey(charId), JSON.stringify(record));
  }catch(e){}
}

function getWidgetPreview(charId){
  if(!charId) return null;
  if(widgetPreviewCache[charId]) return widgetPreviewCache[charId];
  try{
    var raw = localStorage.getItem(widgetPreviewStorageKey(charId));
    if(!raw) return null;
    var parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== 'object') return null;
    var record = {
      content: String(parsed.content || ''),
      type: normalizeChatPreviewType(parsed.type || 'text'),
      at: Number(parsed.at || 0) || 0
    };
    widgetPreviewCache[charId] = record;
    return record;
  }catch(e){
    return null;
  }
}

function loadLargeState(id){
  if(window.PhoneStorage && typeof window.PhoneStorage.getJson === 'function'){
    return window.PhoneStorage.getJson(id).catch(function(){ return null; });
  }
  return Promise.resolve(null);
}

function saveLargeState(id, data){
  if(window.PhoneStorage && typeof window.PhoneStorage.putJson === 'function'){
    return window.PhoneStorage.putJson(id, data).catch(function(){ return null; });
  }
  return Promise.resolve(data || null);
}

function requestPersistentStorageIfPossible(){
  if(persistentStorageRequestStarted) return;
  persistentStorageRequestStarted = true;
  if(window.PhoneStorage && typeof window.PhoneStorage.requestPersistentStorage === 'function'){
    window.PhoneStorage.requestPersistentStorage().catch(function(err){
      console.warn('Persistent storage request failed', err);
    });
  }
}
requestPersistentStorageIfPossible();

function hasSavedPhoneFramePreference(){
  const saved = localStorage.getItem(PHONE_FRAME_STORAGE_KEY);
  return saved === '0' || saved === '1';
}

function getDefaultPhoneFrameVisibility(){
  return false;
}

function getPhoneFrameVisibility(){
  const saved = localStorage.getItem(PHONE_FRAME_STORAGE_KEY);
  if(saved === '0') return false;
  if(saved === '1') return true;
  return getDefaultPhoneFrameVisibility();
}

function applyPhoneFrameVisibility(visible, persist){
  const outer = document.querySelector('.phone-outer');
  if(!outer) return;
  outer.classList.toggle('frame-off', !visible);
  if(persist){
    localStorage.setItem(PHONE_FRAME_STORAGE_KEY, visible ? '1' : '0');
  }
}

function isStandaloneMode(){
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}

let stableShellAppHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0) || 0;

function syncAppHeight(){
  const vv = window.visualViewport;
  const isStandalone = isStandaloneMode();
  const viewportWidth = Math.round(isStandalone ? window.innerWidth : (vv ? vv.width : window.innerWidth));
  const vvTopOffset = Math.round(vv ? Math.max(0, vv.offsetTop || 0) : 0);
  const rawBottomOffset = Math.round(vv ? Math.max(0, window.innerHeight - (vv.height + (vv.offsetTop || 0))) : 0);
  const keyboardLikelyOpen = rawBottomOffset > 120;
  const vvBottomOffset = keyboardLikelyOpen ? 0 : rawBottomOffset;
  const currentHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0) || 0;
  if(!stableShellAppHeight){
    stableShellAppHeight = currentHeight;
  }
  if(!keyboardLikelyOpen && currentHeight > stableShellAppHeight){
    stableShellAppHeight = currentHeight;
  }
  const viewportHeight = stableShellAppHeight || currentHeight;
  document.documentElement.style.setProperty('--app-height', viewportHeight + 'px');
  document.documentElement.style.setProperty('--vv-top-offset', vvTopOffset + 'px');
  document.documentElement.style.setProperty('--vv-bottom-offset', vvBottomOffset + 'px');
  const contentTopInset = isStandalone ? 6 : vvTopOffset;
  const contentBottomInset = 0;
  const mobileFrameDrop = isStandalone ? 18 : 0;
  const usableHeight = Math.max(1, viewportHeight - contentTopInset - contentBottomInset - mobileFrameDrop);
  const frameScale = Math.min(viewportWidth / 375, usableHeight / 780);
  document.documentElement.style.setProperty('--frameoff-top', contentTopInset + 'px');
  document.documentElement.style.setProperty('--mobile-frame-drop', mobileFrameDrop + 'px');
  document.documentElement.style.setProperty('--frameoff-scale', String(frameScale > 0 ? frameScale : 1));
}

function isGifDataUrl(dataUrl){
  return typeof dataUrl === 'string' && dataUrl.startsWith('data:image/gif');
}

function isGifFile(file){
  return !!file && ((file.type || '').toLowerCase() === 'image/gif' || /\.gif$/i.test(file.name || ''));
}

function loadStoredAsset(key){
  if(window.assetStore && typeof window.assetStore.load === 'function'){
    return window.assetStore.load(key);
  }
  try{
    return Promise.resolve(localStorage.getItem(key) || '');
  }catch(e){
    return Promise.resolve('');
  }
}

function saveStoredAsset(key, value){
  if(window.assetStore && typeof window.assetStore.saveOrFallback === 'function'){
    return window.assetStore.saveOrFallback(key, value);
  }
  try{
    if(value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
    return Promise.resolve(true);
  }catch(e){
    return Promise.resolve(false);
  }
}

function removeStoredAsset(key){
  if(window.assetStore && typeof window.assetStore.remove === 'function'){
    return window.assetStore.remove(key);
  }
  try{ localStorage.removeItem(key); }catch(e){}
  return Promise.resolve();
}

function normalizeHeartText(value){
  return typeof value === 'string' ? value.replace(/\u2665(\uFE0E|\uFE0F)?/g, '\u2665\uFE0E') : value;
}

function simpleStringFingerprint(text){
  var hash = 2166136261;
  var str = String(text || '');
  for(var i = 0; i < str.length; i += 1){
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function markHostedUpdatePromptShown(fingerprint){
  var value = String(fingerprint || pendingRemoteAppFingerprint || '').trim();
  if(!value) return;
  try{
    localStorage.setItem(UPDATE_PROMPT_DEDUPE_KEY, JSON.stringify({
      fingerprint: value,
      at: Date.now()
    }));
  }catch(e){}
}

function shouldSuppressHostedUpdatePrompt(fingerprint){
  var value = String(fingerprint || pendingRemoteAppFingerprint || '').trim();
  if(!value) return false;
  try{
    var raw = localStorage.getItem(UPDATE_PROMPT_DEDUPE_KEY);
    if(!raw) return false;
    var parsed = JSON.parse(raw);
    if(!parsed || String(parsed.fingerprint || '').trim() !== value) return false;
    var age = Date.now() - (Number(parsed.at || 0) || 0);
    return age >= 0 && age < UPDATE_PROMPT_DEDUPE_MS;
  }catch(e){
    return false;
  }
}

function getAcceptedHostedUpdateBuild(){
  try{
    return String(localStorage.getItem(HOSTED_UPDATE_ACCEPTED_BUILD_KEY) || '').trim();
  }catch(e){
    return '';
  }
}

function setAcceptedHostedUpdateBuild(fingerprint){
  var value = String(fingerprint || '').trim();
  if(!value) return;
  try{
    localStorage.setItem(HOSTED_UPDATE_ACCEPTED_BUILD_KEY, value);
  }catch(e){}
}

function clearAcceptedHostedUpdateBuildIfCurrent(){
  var accepted = getAcceptedHostedUpdateBuild();
  if(!accepted || accepted !== APP_BUILD_ID) return;
  try{ localStorage.removeItem(HOSTED_UPDATE_ACCEPTED_BUILD_KEY); }catch(e){}
}

function showHostedUpdateCard(){
  if(hostedUpdateModalShown) return;
  if(shouldSuppressHostedUpdatePrompt()) return;
  var card = document.getElementById('update-toast-card');
  if(card) card.hidden = false;
  hostedUpdateModalShown = true;
  hostedUpdateLockedOpen = true;
  markHostedUpdatePromptShown();
}

function announceHostedUpdate(fingerprint){
  var nextFingerprint = String(fingerprint || pendingRemoteAppFingerprint || '').trim();
  if(nextFingerprint) pendingRemoteAppFingerprint = nextFingerprint;
  if(!nextFingerprint){
    showHostedUpdateCard();
    return;
  }
  if(shownHostedUpdateFingerprint === nextFingerprint){
    return;
  }
  shownHostedUpdateFingerprint = nextFingerprint;
  showHostedUpdateCard();
}

function hideHostedUpdateCard(){
  if(hostedUpdateLockedOpen) return;
  var card = document.getElementById('update-toast-card');
  if(card) card.hidden = true;
}

function removeAppFromStack(appId){
  if(!appId) return;
  for(var i = appStack.length - 1; i >= 0; i -= 1){
    if(appStack[i] === appId) appStack.splice(i, 1);
  }
}

async function fetchTextWithTimeout(url, timeoutMs){
  var ms = Math.max(6000, Number(timeoutMs) || 15000);
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = null;
  if(controller){
    timer = setTimeout(function(){ controller.abort(); }, ms);
  }
  try{
    var res = await fetch(url, Object.assign({ cache:'no-store' }, controller ? { signal: controller.signal } : {}));
    if(!res.ok) throw new Error('fetch failed: ' + url);
    return await res.text();
  } finally {
    if(timer) clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(url, timeoutMs){
  var text = await fetchTextWithTimeout(url, timeoutMs);
  return JSON.parse(text);
}

function readBuildIdFromVersionPayload(data){
  return String(data && data.buildId || '').trim();
}

function decodeGithubContentsBuildId(payload){
  try{
    var encoded = String(payload && payload.content || '').replace(/\s+/g, '');
    if(!encoded) return '';
    var decoded = atob(encoded);
    return readBuildIdFromVersionPayload(JSON.parse(decoded));
  }catch(err){
    return '';
  }
}

async function buildRemoteAppFingerprint(){
  var stamp = Date.now();
  var remoteTasks = [
    function(){
      return fetchJsonWithTimeout('https://api.github.com/repos/' + GITHUB_UPDATE_OWNER + '/' + GITHUB_UPDATE_REPO + '/contents/version.json?ref=' + GITHUB_UPDATE_BRANCH + '&t=' + stamp, 12000)
        .then(function(data){ return decodeGithubContentsBuildId(data); });
    },
    function(){
      return fetchJsonWithTimeout('https://raw.githubusercontent.com/' + GITHUB_UPDATE_OWNER + '/' + GITHUB_UPDATE_REPO + '/' + GITHUB_UPDATE_BRANCH + '/version.json?t=' + stamp, 12000)
        .then(function(data){ return readBuildIdFromVersionPayload(data); });
    }
  ];
  for(var i = 0; i < remoteTasks.length; i += 1){
    try{
      var nextFingerprint = await remoteTasks[i]();
      if(nextFingerprint) return nextFingerprint;
    }catch(err){
      console.warn('[update-check] source skipped', err);
    }
  }
  if(/^https?:$/.test(window.location.protocol)){
    try{
      var sameOriginFingerprint = await fetchJsonWithTimeout(new URL('version.json?updateCheck=' + stamp, window.location.href).toString(), 15000).then(function(data){
        return String(data && data.buildId || '').trim();
      });
      if(sameOriginFingerprint) return sameOriginFingerprint;
    }catch(errSameOrigin){
      console.warn('[update-check] same-origin fallback skipped', errSameOrigin);
    }
  }
  return '';
}

function getServiceWorkerUrl(){
  return SERVICE_WORKER_PATH + '?build=' + encodeURIComponent(APP_BUILD_ID);
}

async function primeLatestCoreFiles(){
  if(!/^https?:$/.test(window.location.protocol)) return;
  var stamp = Date.now();
  var targets = [
    '',
    'index.html',
    'style.css',
    'main.js',
    'assetStore.js',
    'chatStorage.js',
    'avatar-frames.js',
    'manifest.webmanifest',
    'version.json',
    'apps/qq.html',
    'apps/chat.html',
    'apps/offline_mode.html'
  ];
  await Promise.all(targets.map(function(path){
    var url = new URL(path || './', window.location.href);
    url.searchParams.set('refreshBuild', String(stamp));
    return fetch(url.toString(), { cache:'reload' }).catch(function(){ return null; });
  }));
}

async function clearHostedUpdateCaches(){
  if('serviceWorker' in navigator){
    try{
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function(reg){ return reg.unregister().catch(function(){ return null; }); }));
    }catch(e){}
  }
  if(typeof caches !== 'undefined' && caches && typeof caches.keys === 'function'){
    try{
      var names = await caches.keys();
      await Promise.all(names.map(function(name){ return caches.delete(name).catch(function(){ return null; }); }));
    }catch(e){}
  }
}

function bindHostedServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  if(!window.isSecureContext) return;
  navigator.serviceWorker.register(getServiceWorkerUrl()).catch(function(err){
    console.warn('[sw] register failed', err);
  });
}

async function checkForHostedUpdate(){
  try{
    if(hostedUpdateLockedOpen && pendingRemoteAppFingerprint){
      return;
    }
    var remoteFingerprint = await buildRemoteAppFingerprint();
    if(remoteFingerprint && remoteFingerprint !== APP_BUILD_ID){
      if(getAcceptedHostedUpdateBuild() === remoteFingerprint){
        pendingRemoteAppFingerprint = '';
        shownHostedUpdateFingerprint = '';
        hostedUpdateModalShown = false;
        hostedUpdateLockedOpen = false;
        hideHostedUpdateCard();
        return;
      }
      pendingRemoteAppFingerprint = remoteFingerprint;
      announceHostedUpdate(remoteFingerprint);
      return;
    }
    if(remoteFingerprint && remoteFingerprint === APP_BUILD_ID){
      clearAcceptedHostedUpdateBuildIfCurrent();
      if(hostedUpdateLockedOpen && shownHostedUpdateFingerprint){
        return;
      }
      pendingRemoteAppFingerprint = '';
      shownHostedUpdateFingerprint = '';
      hostedUpdateModalShown = false;
      hostedUpdateLockedOpen = false;
      hideHostedUpdateCard();
      return;
    }
  }catch(err){
    console.warn('[update-check] skipped', err);
  }
}

function scheduleHostedUpdateCheck(force){
  var now = Date.now();
  if(!force && now - lastHostedUpdateCheckAt < UPDATE_CHECK_THROTTLE_MS) return;
  lastHostedUpdateCheckAt = now;
  checkForHostedUpdate();
}

function kickOffHostedUpdateRetries(){
  if(hostedUpdateLockedOpen && pendingRemoteAppFingerprint){
    return;
  }
  if(hostedUpdateRetryTimer){
    clearTimeout(hostedUpdateRetryTimer);
    hostedUpdateRetryTimer = 0;
  }
  scheduleHostedUpdateCheck(true);
}

function bootHostedUpdateCheck(){
  if(hostedUpdateBootstrapped) return;
  hostedUpdateBootstrapped = true;
  kickOffHostedUpdateRetries();
}

function refreshInstalledApp(evt){
  if(evt){
    try{ evt.preventDefault(); }catch(e){}
    try{ evt.stopPropagation(); }catch(e){}
  }
  setAcceptedHostedUpdateBuild(pendingRemoteAppFingerprint || shownHostedUpdateFingerprint || '');
  var finishReload = function(){
    hostedUpdateLockedOpen = false;
    pendingRemoteAppFingerprint = '';
    shownHostedUpdateFingerprint = '';
    hostedUpdateModalShown = false;
    try{ sessionStorage.setItem(REFRESH_RECALC_FLAG_KEY, '1'); }catch(e){}
    hideHostedUpdateCard();
    try{
      var url = new URL(window.location.href);
      url.searchParams.set('__appBuild', APP_BUILD_ID);
      url.searchParams.set('__ts', String(Date.now()));
      window.location.replace(url.toString());
      return;
    }catch(err){}
    window.location.reload();
  };
  Promise.resolve()
    .then(function(){ return clearHostedUpdateCaches(); })
    .then(function(){ return primeLatestCoreFiles(); })
    .then(function(){
      if(!('serviceWorker' in navigator)) return null;
      return navigator.serviceWorker.getRegistration().then(function(reg){
        if(!reg) return null;
        if(reg.waiting){
          reg.waiting.postMessage({ type:'SKIP_WAITING' });
          setTimeout(function(){
            if(!swControllerRefreshPending) finishReload();
          }, 1200);
          return 'waiting';
        }
        return reg.update().then(function(){ return 'updated'; }).catch(function(){ return null; });
      });
    })
    .then(function(result){
      if(result === 'waiting') return;
      finishReload();
    })
    .catch(function(err){
      console.warn('[update-check] refresh fallback', err);
      finishReload();
    });
}

function clearHostedRefreshParams(){
  try{
    var url = new URL(window.location.href);
    var hadRefreshParams = url.searchParams.has('__appBuild') || url.searchParams.has('__ts');
    if(!hadRefreshParams) return;
    url.searchParams.delete('__appBuild');
    url.searchParams.delete('__ts');
    window.history.replaceState({}, document.title, url.toString());
  }catch(err){}
}

function bindTextNormalization(){
  document.addEventListener('input', (evt)=>{
    const target = evt.target;
    if(!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
    if(!('value' in target)) return;
    const next = normalizeHeartText(target.value);
    if(next === target.value) return;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    target.value = next;
    try{ target.setSelectionRange(start, end); }catch(err){}
  }, true);
}

function getLiveDanmakuStorageKey(slotId){
  return 'home_live_danmaku_' + slotId;
}

function getLiveDanmakuEnabled(){
  const saved = localStorage.getItem(LIVE_DANMAKU_ENABLED_KEY);
  if(saved === '0') return false;
  if(saved === '1') return true;
  return true;
}

function mainScopedKey(base){
  try{
    if(window.AccountManager){
      window.AccountManager.ensure();
      return window.AccountManager.scopedKey(base);
    }
  }catch(e){}
  return base;
}

function applyLiveDanmakuVisibility(enabled){
  document.body.classList.toggle('live-danmaku-off', !enabled);
}

function getLiveDanmakuTexts(slotId){
  const defaults = LIVE_DANMAKU_DEFAULTS[String(slotId)] || ['直播开始','好喜欢','来了来了'];
  try{
    const saved = JSON.parse(localStorage.getItem(getLiveDanmakuStorageKey(slotId)) || 'null');
    if(Array.isArray(saved)){
      return defaults.map((text, idx)=>{
        const value = typeof saved[idx] === 'string' ? saved[idx].trim() : '';
        return value || text;
      });
    }
  }catch(e){}
  return defaults.slice();
}

function setLiveDanmakuTexts(textMap){
  ['1','2','3'].forEach((slotId)=>{
    const values = Array.isArray(textMap && textMap[slotId]) ? textMap[slotId] : [];
    const defaults = LIVE_DANMAKU_DEFAULTS[slotId];
    const next = defaults.map((text, idx)=>{
      const value = typeof values[idx] === 'string' ? values[idx].trim() : '';
      return value || text;
    });
    localStorage.setItem(getLiveDanmakuStorageKey(slotId), JSON.stringify(next));
    loadStoredAsset('home_slot_' + slotId).then((data)=>renderHomeSlot(slotId, data));
  });
}

function renderHomeAppIcon(app, icon){
  const btn = document.querySelector('.home-app-btn[data-app="' + app + '"]');
  if(!btn) return;
  const label = HOME_ICON_DEFAULTS[app] || app;
  if(typeof icon === 'string' && icon.startsWith('data:')){
    btn.classList.add('has-custom-icon');
    btn.innerHTML = '<span class="home-app-icon-wrap"><img class="home-app-icon-img" src="' + icon + '" alt="' + label + '"></span><span class="home-app-label">' + label + '</span>';
    return;
  }
  btn.classList.remove('has-custom-icon');
  btn.innerHTML = '<span class="home-app-icon-wrap home-app-icon-fallback"><span class="home-app-fallback-text">' + label + '</span></span><span class="home-app-label">' + label + '</span>';
}

function restoreHomeAppIcons(){
  Object.keys(HOME_ICON_DEFAULTS).forEach((app)=>{
    loadStoredAsset('icon_' + app).then((icon)=>{
      renderHomeAppIcon(app, icon);
    });
  });
}

function bindHomeAppPressState(){
  document.querySelectorAll('.home-app-btn').forEach((btn)=>{
    const clear = ()=>btn.classList.remove('pressed');
    btn.addEventListener('pointerdown', (evt)=>{
      if(evt.pointerType === 'mouse' && evt.button !== 0) return;
      btn.classList.add('pressed');
    });
    ['pointerup','pointercancel','pointerleave'].forEach((name)=>{
      btn.addEventListener(name, clear);
    });
  });
}

function slimChar(c){
  if(!c) return null;
  return {
    id:c.id, name:c.name, nickname:c.nickname, description:c.description, avatar:c.avatar,
    imageData:c.imageData,
    personality:c.personality, scenario:c.scenario, system_prompt:c.system_prompt,
    first_mes:c.first_mes, alternate_greetings:c.alternate_greetings,
    tags:c.tags, character_version:c.character_version, spec:c.spec, creator:c.creator,
    msgMin:c.msgMin, msgMax:c.msgMax
  };
}

function cacheAvatar(c){
  try{
    if(c?.id && c.imageData && c.imageData.startsWith('data:')){
      saveStoredAsset('char_avatar_' + c.id, c.imageData);
    }
  }catch(e){}
}

function scopedKeyForAccount(base, accountId){
  if(!accountId) return base;
  return base + '__acct_' + accountId;
}

function charBgEnabledKeyForAccount(charId, accountId){
  return scopedKeyForAccount('char_bg_activity_enabled_' + charId, accountId);
}

function isCharBgEnabled(charId, accountId){
  if(!charId) return true;
  try{
    var scoped = localStorage.getItem(charBgEnabledKeyForAccount(charId, accountId));
    if(scoped !== null) return scoped !== '0';
    var legacy = localStorage.getItem('char_bg_activity_enabled_' + charId);
    if(legacy !== null) return legacy !== '0';
  }catch(e){}
  return true;
}

function getDefaultAccountId(){
  try{
    if(window.AccountManager){
      window.AccountManager.ensure();
      return window.AccountManager.getDefaultId() || '';
    }
  }catch(e){}
  return '';
}

function getActiveAccountId(){
  try{
    if(window.AccountManager){
      window.AccountManager.ensure();
      var active = window.AccountManager.getActive();
      if(active && active.id) return active.id;
    }
  }catch(e){}
  return getDefaultAccountId();
}

function isDefaultAccountActive(){
  try{
    if(window.AccountManager){
      window.AccountManager.ensure();
      var active = window.AccountManager.getActive();
      return !!(active && active.isDefault);
    }
  }catch(e){}
  return true;
}

function getBackgroundCharacter(){
  var defaultId = getDefaultAccountId();
  if(!defaultId) return null;
  var chars = [];
  try{
    chars = JSON.parse(localStorage.getItem('characters') || '[]');
    if(!Array.isArray(chars)) chars = [];
  }catch(e){ chars = []; }
  chars.forEach(function(c){
    if(c && !c.ownerAccountId) c.ownerAccountId = defaultId;
  });
  var owned = chars.filter(function(c){ return c && c.ownerAccountId === defaultId; });
  var enabledOwned = owned.filter(function(c){ return isCharBgEnabled(c.id, defaultId); });
  var active = null;
  try{ active = JSON.parse(localStorage.getItem('activeCharacter') || 'null'); }catch(e){ active = null; }
  if(active && active.id){
    var found = enabledOwned.find(function(c){ return c.id === active.id; });
    if(found) return Object.assign({}, found, active);
  }
  return enabledOwned[0] || null;
}

async function readBackgroundChatHistory(charId, accountId){
  var scoped = scopedKeyForAccount('chat_' + charId, accountId);
  try{
    if(window.PhoneStorage && typeof window.PhoneStorage.get === 'function'){
      var record = await window.PhoneStorage.get('chats', scoped);
      var list = record && Array.isArray(record.history) ? record.history : [];
      if(Array.isArray(list) && list.length) return list;
    }
  }catch(e){}
  var raw = '';
  try{ raw = localStorage.getItem(scoped) || localStorage.getItem('chat_' + charId) || ''; }catch(e2){}
  if(!raw) return [];
  try{
    var parsed = JSON.parse(raw);
    var fallbackList = (parsed && (parsed.history || parsed.messages)) || [];
    return Array.isArray(fallbackList) ? fallbackList : [];
  }catch(e3){
    return [];
  }
}

async function writeBackgroundChatHistory(charId, accountId, messages){
  var scoped = scopedKeyForAccount('chat_' + charId, accountId);
  if(window.PhoneStorage && typeof window.PhoneStorage.put === 'function'){
    try{
      await window.PhoneStorage.put('chats', {
        id: scoped,
        charId: String(charId || ''),
        updatedAt: Date.now(),
        history: Array.isArray(messages) ? messages : []
      });
      try{ localStorage.removeItem(scoped); }catch(ignoreErr){}
      try{ localStorage.removeItem('chat_' + charId); }catch(ignoreErr2){}
      return;
    }catch(e){}
  }
  var payload = JSON.stringify({ history: messages, messages: messages });
  try{ localStorage.setItem(scoped, payload); }catch(e2){}
  try{ localStorage.setItem('chat_' + charId, payload); }catch(e3){}
}

async function readBackgroundMoments(accountId){
  var key = scopedKeyForAccount(MOMENTS_POSTS_KEY, accountId);
  var stored = await loadLargeState(key);
  if(Array.isArray(stored)) return stored;
  try{
    var parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  }catch(e){
    return [];
  }
}

async function writeBackgroundMoments(accountId, posts){
  var key = scopedKeyForAccount(MOMENTS_POSTS_KEY, accountId);
  if(window.PhoneStorage && typeof window.PhoneStorage.putJson === 'function'){
    await saveLargeState(key, Array.isArray(posts) ? posts : []);
    try{ localStorage.removeItem(key); }catch(ignoreErr){}
    return;
  }
  try{ localStorage.setItem(key, JSON.stringify(Array.isArray(posts) ? posts : [])); }catch(e){}
}

async function readBackgroundBlockState(charId, accountId){
  var key = scopedKeyForAccount('chat_block_state_' + charId, accountId);
  var stored = await loadLargeState(key);
  if(stored && typeof stored === 'object'){
    return {
      userBlocked: !!stored.userBlocked,
      charBlocked: !!stored.charBlocked,
      appealCount: parseInt(stored.appealCount || '0', 10) || 0,
      abuseCount: parseInt(stored.abuseCount || '0', 10) || 0,
      charBlockedAt: parseInt(stored.charBlockedAt || '0', 10) || 0,
      lastUserReAddAt: parseInt(stored.lastUserReAddAt || '0', 10) || 0
    };
  }
  var raw = null;
  try{
    raw = JSON.parse(localStorage.getItem(key) || localStorage.getItem('chat_block_state_' + charId) || 'null');
  }catch(e){ raw = null; }
  if(!raw || typeof raw !== 'object'){
    return { userBlocked:false, charBlocked:false, appealCount:0, abuseCount:0, charBlockedAt:0, lastUserReAddAt:0 };
  }
  return {
    userBlocked: !!raw.userBlocked,
    charBlocked: !!raw.charBlocked,
    appealCount: parseInt(raw.appealCount || '0', 10) || 0,
    abuseCount: parseInt(raw.abuseCount || '0', 10) || 0,
    charBlockedAt: parseInt(raw.charBlockedAt || '0', 10) || 0,
    lastUserReAddAt: parseInt(raw.lastUserReAddAt || '0', 10) || 0
  };
}

async function writeBackgroundBlockState(charId, accountId, state){
  var key = scopedKeyForAccount('chat_block_state_' + charId, accountId);
  var next = Object.assign({ userBlocked:false, charBlocked:false, appealCount:0, abuseCount:0, charBlockedAt:0, lastUserReAddAt:0 }, state || {});
  if(window.PhoneStorage && typeof window.PhoneStorage.putJson === 'function'){
    await saveLargeState(key, next);
    try{ localStorage.removeItem(key); }catch(ignoreErr){}
    try{ localStorage.removeItem('chat_block_state_' + charId); }catch(ignoreErr2){}
    return;
  }
  try{ localStorage.setItem(key, JSON.stringify(next)); }catch(e){}
  try{ localStorage.setItem('chat_block_state_' + charId, JSON.stringify(next)); }catch(e2){}
}

function getBackgroundProviderConfig(){
  var provider = localStorage.getItem('provider') || 'openai';
  var key = localStorage.getItem('key_' + provider) || '';
  if(!key && provider !== 'custom') return null;
  var model = localStorage.getItem('model_' + provider) || getDefaultModelForBg(provider);
  var temperature = parseFloat(localStorage.getItem('temp_' + provider) || '0.95');
  if(Number.isNaN(temperature)) temperature = 0.95;
  var customUrl = (localStorage.getItem('custom_url') || '').replace(/\/$/, '');
  if(provider === 'custom' && !customUrl) return null;
  return {
    provider: provider,
    key: key,
    model: model,
    temperature: temperature,
    customUrl: customUrl
  };
}

function getDefaultModelForBg(p){
  return {
    openai: 'gpt-4o-mini',
    claude: 'claude-haiku-4-5-20251001',
    gemini: 'gemini-2.0-flash',
    openrouter: 'openai/gpt-4o-mini',
    custom: ''
  }[p] || 'gpt-4o-mini';
}

function cleanBgJson(raw){
  var txt = String(raw || '').trim();
  if(!txt) return txt;
  if(txt.startsWith('```')){
    txt = txt.replace(/^```[a-zA-Z]*\s*/,'');
    if(txt.endsWith('```')) txt = txt.slice(0,-3);
  }
  return txt.trim();
}

function parseBgAction(raw){
  var txt = cleanBgJson(raw);
  if(!txt) return null;
  var data = null;
  try{ data = JSON.parse(txt); }catch(e){}
  if(Array.isArray(data)) data = data[0] || null;
  if(!data && txt.startsWith('{') && txt.endsWith('}')){
    try{ data = JSON.parse(txt); }catch(e){}
  }
  if(data && typeof data === 'object'){
    var act = String(data.action || data.type || '').trim().toLowerCase();
    var content = String(data.content || data.text || '').trim();
    var imageText = String(data.imageText || data.image_text || '').trim();
    if(act === '说说') act = 'say';
    if(act === '动态') act = 'dynamic';
    if(act === 'message' || act === 'say' || act === 'dynamic'){
      return {
        action: act,
        content: content || (act === 'message' ? '刚刚想到你了。' : '想把这一刻记下来。'),
        imageText: imageText || ''
      };
    }
  }
  return {
    action: 'message',
    content: txt.replace(/^\[[^\]]+\]\s*/, '').trim() || '刚刚想到你了。',
    imageText: ''
  };
}

function getCharacterAvatarForBg(character){
  if(character && character.imageData && String(character.imageData).startsWith('data:')) return String(character.imageData);
  var id = character && character.id ? character.id : '';
  if(id){
    try{
      var saved = localStorage.getItem('char_avatar_' + id) || '';
      if(saved && (saved.startsWith('data:') || saved.startsWith('http') || saved.startsWith('blob:') || saved.startsWith('/'))) return saved;
    }catch(e){}
  }
  if(character && character.avatar){
    var av = String(character.avatar);
    if(av.startsWith('data:') || av.startsWith('http') || av.startsWith('blob:') || av.startsWith('/')) return av;
  }
  return '';
}

async function appendBackgroundAiMessage(character, accountId, content){
  var history = await readBackgroundChatHistory(character.id, accountId);
  var now = Date.now();
  var entry = {
    id: 'm_' + now.toString(36) + '_' + Math.random().toString(36).slice(2,8),
    role: 'assistant',
    content: String(content || '').trim() || '刚刚想到你了。',
    type: 'text',
    replyToId: null,
    sentAt: now,
    readAt: null
  };
  history.push(entry);
  await writeBackgroundChatHistory(character.id, accountId, history);
  try{
    var f = document.getElementById('app-iframe');
    if(f && f.contentWindow){
      f.contentWindow.postMessage({ type:'BACKGROUND_AI_MESSAGE', payload:{ charId: character.id, entry: entry } }, '*');
    }
  }catch(e){}
}

async function appendBackgroundMoment(character, accountId, action, content, imageText){
  var posts = await readBackgroundMoments(accountId);
  var now = Date.now();
  var text = String(content || '').trim() || '想把这一刻记下来。';
  var aiName = String(character.nickname || character.name || 'AI');
  var aiAvatar = getCharacterAvatarForBg(character);
  posts.push({
    id: 'post_' + now + '_' + Math.random().toString(36).slice(2,7),
    type: action === 'dynamic' ? 'dynamic' : 'say',
    text: text,
    imageText: action === 'dynamic' ? (String(imageText || '').trim() || text) : '',
    createdAt: now,
    comments: [],
    likes: [],
    authorName: aiName,
    authorAvatar: aiAvatar
  });
  await writeBackgroundMoments(accountId, posts);
}

async function callAiForBackground(cfg, sysPrompt, userPrompt){
  if(cfg.provider === 'openai'){
    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + cfg.key },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        messages: [{ role:'system', content: sysPrompt }, { role:'user', content: userPrompt }]
      })
    });
    var d = await res.json();
    if(d.error) throw new Error(d.error.message || JSON.stringify(d.error));
    return d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : '';
  }
  if(cfg.provider === 'claude'){
    var resClaude = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        system: sysPrompt,
        messages: [{ role:'user', content: userPrompt }]
      })
    });
    var dc = await resClaude.json();
    if(dc.error) throw new Error(dc.error.message || JSON.stringify(dc.error));
    return dc.content && dc.content[0] ? dc.content[0].text : '';
  }
  if(cfg.provider === 'gemini'){
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + cfg.model + ':generateContent?key=' + cfg.key;
    var resGemini = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        contents: [
          { role:'user', parts:[{ text:'[系统提示]\\n' + sysPrompt }] },
          { role:'model', parts:[{ text:'好的，我会严格按 JSON 格式返回。' }] },
          { role:'user', parts:[{ text:userPrompt }] }
        ],
        generationConfig: { temperature: cfg.temperature }
      })
    });
    var dg = await resGemini.json();
    if(dg.error) throw new Error(dg.error.message || dg.error.status || JSON.stringify(dg.error));
    return dg.candidates && dg.candidates[0] && dg.candidates[0].content && dg.candidates[0].content.parts && dg.candidates[0].content.parts[0]
      ? dg.candidates[0].content.parts[0].text : '';
  }
  if(cfg.provider === 'openrouter'){
    var resOr = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + cfg.key,
        'HTTP-Referer':'https://ephone.app',
        'X-Title':'Ephone'
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        messages: [{ role:'system', content: sysPrompt }, { role:'user', content: userPrompt }]
      })
    });
    var dor = await resOr.json();
    if(dor.error) throw new Error(dor.error.message || JSON.stringify(dor.error));
    return dor.choices && dor.choices[0] && dor.choices[0].message ? dor.choices[0].message.content : '';
  }
  if(cfg.provider === 'custom'){
    var headers = { 'Content-Type':'application/json' };
    if(cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
    var resCustom = await fetch(cfg.customUrl + '/chat/completions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: localStorage.getItem('model_custom_manual') || cfg.model,
        temperature: cfg.temperature,
        messages: [{ role:'system', content: sysPrompt }, { role:'user', content: userPrompt }]
      })
    });
    var dcustom = await resCustom.json();
    if(dcustom.error) throw new Error(dcustom.error.message || JSON.stringify(dcustom.error));
    return dcustom.choices && dcustom.choices[0] && dcustom.choices[0].message ? dcustom.choices[0].message.content : '';
  }
  return '';
}

function parseBgUnblockDecision(raw){
  var text = String(raw || '').trim();
  if(!text) return { unblock:false, text:'' };
  if(text.startsWith('```')){
    text = text.replace(/^```[a-zA-Z]*\s*/, '');
    if(text.endsWith('```')) text = text.slice(0, -3);
    text = text.trim();
  }
  try{
    var obj = JSON.parse(text);
    if(obj && typeof obj === 'object'){
      var unblock = !!(obj.unblock || obj.forgive || obj.accept);
      var msg = String(obj.text || obj.message || obj.content || '').trim();
      return { unblock: unblock, text: msg };
    }
  }catch(e){}
  var loose = /解除|放出来|恢复|原谅|加回|unblock|forgive|accept/i.test(text);
  return { unblock: loose, text: text };
}

async function maybeUnblockFromBackground(cfg, character, accountId, history, shortHistory){
  var state = await readBackgroundBlockState(character.id, accountId);
  if(!state.charBlocked) return false;
  var now = Date.now();
  var idleAnchor = Math.max(state.lastUserReAddAt || 0, state.charBlockedAt || 0);
  if(!idleAnchor) idleAnchor = now;
  var idleMs = now - idleAnchor;
  if(idleMs < 8 * 60 * 1000) return false;
  var sysPrompt = [
    '你是聊天角色本人，请判断是否在“被你拉黑后很久没有好友申请”的情况下，主动解除拉黑。',
    '只返回 JSON，不要解释。',
    '格式：{"unblock":true|false,"text":"..."}',
    '如果 unblock=true，text 是你解除拉黑后主动发给用户的一句自然消息。'
  ].join('\n');
  var userPrompt = [
    '角色名：' + (character.nickname || character.name || '角色'),
    '角色本名：' + (character.name || '角色'),
    '角色人设：' + String(character.personality || character.description || '').slice(0, 1200),
    shortHistory ? ('最近聊天：\n' + shortHistory) : '最近聊天：无',
    '你已拉黑用户，距离用户上次好友申请已过去约 ' + Math.round(idleMs / 60000) + ' 分钟。',
    '请按人设决定：继续拉黑，或主动解除拉黑。'
  ].join('\n\n');
  var raw = await callAiForBackground(cfg, sysPrompt, userPrompt);
  var decision = parseBgUnblockDecision(raw);
  if(!decision.unblock) return false;
  state.charBlocked = false;
  state.appealCount = 0;
  state.charBlockedAt = 0;
  state.lastUserReAddAt = 0;
  await writeBackgroundBlockState(character.id, accountId, state);
  await appendBackgroundAiMessage(character, accountId, decision.text || '我把你从黑名单里放出来了。');
  return true;
}

async function runAiBackgroundActivity(){
  var enabled = localStorage.getItem(AI_BG_ENABLED_KEY) === '1';
  if(!enabled) return false;
  var defaultId = getDefaultAccountId();
  if(!defaultId) return false;
  var character = getBackgroundCharacter();
  if(!character || !character.id) return false;
  var cfg = getBackgroundProviderConfig();
  if(!cfg) return false;

  var history = (await readBackgroundChatHistory(character.id, defaultId)).slice(-8);
  var shortHistory = history.map(function(m){
    var role = m && m.role === 'user' ? 'User' : 'Char';
    var content = String((m && m.content) || '').replace(/\s+/g, ' ').trim();
    return role + ': ' + content;
  }).join('\n');
  var posts = (await readBackgroundMoments(defaultId)).slice(-3).map(function(p){
    var kind = p && p.type === 'dynamic' ? '动态' : '说说';
    return kind + '：' + String((p && (p.text || p.imageText)) || '').replace(/\s+/g, ' ').trim();
  }).join('\n');

  var state = await readBackgroundBlockState(character.id, defaultId);
  if(state.charBlocked){
    return await maybeUnblockFromBackground(cfg, character, defaultId, history, shortHistory);
  }

  var sysPrompt = [
    '你正在执行“后台活动”任务，请扮演聊天角色，输出一个严格 JSON 对象。',
    '你只能返回 JSON，不要返回任何解释、markdown、代码块。',
    'JSON 格式：{"action":"message|say|dynamic","content":"...","imageText":"..."}',
    'action=message 表示给用户主动发一条聊天消息；action=say 表示发朋友圈说说；action=dynamic 表示发朋友圈动态。',
    'content 必填，简短自然；imageText 只在 dynamic 时填写。',
    '如果 action=dynamic，则 content 和 imageText 都必须是图像描述（物体/场景/画面细节），不能是普通聊天句。'
  ].join('\n');
  var userPrompt = [
    '角色名：' + (character.nickname || character.name || '角色'),
    '角色本名：' + (character.name || '角色'),
    '角色人设：' + String(character.personality || character.description || '').slice(0, 1200),
    shortHistory ? ('最近聊天：\n' + shortHistory) : '最近聊天：无',
    posts ? ('最近朋友圈：\n' + posts) : '最近朋友圈：无',
    '请像真人一样在这三种动作里选一个最自然的：主动聊天 / 发说说 / 发动态。',
    '要求：不要机械，不要复读用户原话，不要出现“我是AI/不能发朋友圈”等元话。'
  ].join('\n\n');

  var rawReply = await callAiForBackground(cfg, sysPrompt, userPrompt);
  var parsed = parseBgAction(rawReply);
  if(!parsed) return false;
  if(parsed.action === 'message'){
    await appendBackgroundAiMessage(character, defaultId, parsed.content);
  }else{
    await appendBackgroundMoment(character, defaultId, parsed.action, parsed.content, parsed.imageText);
  }
  return true;
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('clock-display').innerHTML = h+':'+m+'<span class="clock-sun">☀︎</span>';
  document.getElementById('date-display').textContent = days[now.getDay()]+', '+months[now.getMonth()]+' '+now.getDate();
  document.getElementById('status-time').textContent = h+':'+m;
}
setInterval(updateClock,1000); updateClock();

let activeHomeSlot = null;
let topFrameDraftUrl = null;
let isTopFrameEditorOpen = false;
let topSlotPressTimer = null;
let topSlotLongPressFired = false;
const TOP_SLOT_LONG_PRESS_MS = 420;
let bondAvatarPressTimer = null;
let bondAvatarLongPressFired = false;
let bondAvatarLongPressRole = '';
let homePageIndex = 0;
let pagerStartX = 0;
let pagerStartY = 0;
let pagerDragging = false;
let pagerPointerId = null;
let activeBondBubble = 1;

function getHomePageWidth(){
  const pages = document.getElementById('home-pages');
  if(!pages) return 1;
  const page = pages.querySelector('.home-page');
  return page?.clientWidth || pages.clientWidth || 1;
}

function getHomePageGap(){
  const pages = document.getElementById('home-pages');
  if(!pages) return 0;
  const gap = pages.querySelector('.home-page-gap');
  return gap?.offsetWidth || 0;
}

function getHomePageStep(){
  return getHomePageWidth() + getHomePageGap();
}

function showHomeToast(text){
  const t = document.getElementById('home-toast');
  if(!t) return;
  t.textContent = text || '更换成功';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

function getCharNoteText(){
  return (localStorage.getItem('home_char_note') || 'Tap note').trim() || 'Tap note';
}

function getClockLocationText(){
  return (localStorage.getItem('home_clock_location') || '圣诞岛').trim() || '圣诞岛';
}

function getBondDaysText(){
  return (localStorage.getItem('bond_days_text') || '0615').trim() || '0615';
}

function getBondBubbleText(idx){
  const key = idx === 2 ? 'bond_bubble_2' : 'bond_bubble_1';
  return (localStorage.getItem(key) || '').trim() || '输入';
}

function getBondLinkText(idx){
  const key = idx === 2 ? 'bond_link_text_2' : 'bond_link_text_1';
  return localStorage.getItem(key) || '';
}

function renderCharNote(){
  const bubble = document.getElementById('char-note-bubble');
  if(!bubble) return;
  bubble.textContent = getCharNoteText();
}

function renderClockLocation(){
  const el = document.getElementById('clock-loc-text');
  if(!el) return;
  el.textContent = getClockLocationText();
}

function renderBondDays(){
  const el = document.getElementById('bond-days-number');
  if(el) el.textContent = getBondDaysText();
}

function renderBondBubbles(){
  const bubble1 = document.getElementById('bond-bubble-1');
  const bubble2 = document.getElementById('bond-bubble-2');
  if(bubble1) bubble1.textContent = getBondBubbleText(1);
  if(bubble2) bubble2.textContent = getBondBubbleText(2);
}
function getPageTwoMiniNoteText(){
  return (localStorage.getItem('page_two_mini_note') || '谁不爱听歌').trim() || '谁不爱听歌';
}
function renderPageTwoMiniNote(){
  const el = document.getElementById('page-two-mini-note-text');
  if(el) el.textContent = getPageTwoMiniNoteText();
}

function renderBondLinkInputs(){
  const input1 = document.getElementById('bond-link-input-1');
  const input2 = document.getElementById('bond-link-input-2');
  if(input1) input1.value = getBondLinkText(1);
  if(input2) input2.value = getBondLinkText(2);
}

function openCharNoteEditor(e){
  if(e && e.stopPropagation) e.stopPropagation();
  const editor = document.getElementById('char-note-editor');
  const input = document.getElementById('char-note-input');
  if(!editor || !input) return;
  input.value = localStorage.getItem('home_char_note') || '';
  editor.classList.add('open');
  setTimeout(()=>input.focus(), 20);
}

function closeCharNoteEditor(){
  const editor = document.getElementById('char-note-editor');
  if(editor) editor.classList.remove('open');
}

function saveCharNote(){
  const input = document.getElementById('char-note-input');
  if(!input) return;
  const value = (input.value || '').trim();
  if(value) localStorage.setItem('home_char_note', value);
  else localStorage.removeItem('home_char_note');
  renderCharNote();
  closeCharNoteEditor();
  showHomeToast('保存成功');
}

function bindCharNoteEditor(){
  const editor = document.getElementById('char-note-editor');
  const input = document.getElementById('char-note-input');
  if(editor){
    editor.addEventListener('click', (evt)=>{
      if(evt.target === editor) closeCharNoteEditor();
    });
  }
  if(input){
    input.addEventListener('keydown', (evt)=>{
      if((evt.ctrlKey || evt.metaKey) && evt.key === 'Enter'){
        evt.preventDefault();
        saveCharNote();
      }
    });
  }
}

function openClockLocationEditor(e){
  if(e && e.stopPropagation) e.stopPropagation();
  const editor = document.getElementById('clock-loc-editor');
  const input = document.getElementById('clock-loc-input');
  if(!editor || !input) return;
  input.value = localStorage.getItem('home_clock_location') || '';
  editor.classList.add('open');
  setTimeout(()=>input.focus(), 20);
}

function closeClockLocationEditor(){
  const editor = document.getElementById('clock-loc-editor');
  if(editor) editor.classList.remove('open');
}

function saveClockLocation(){
  const input = document.getElementById('clock-loc-input');
  if(!input) return;
  const value = (input.value || '').trim();
  if(value) localStorage.setItem('home_clock_location', value);
  else localStorage.removeItem('home_clock_location');
  renderClockLocation();
  closeClockLocationEditor();
  showHomeToast('保存成功');
}

function openBondDaysEditor(e){
  if(e && e.stopPropagation) e.stopPropagation();
  const editor = document.getElementById('bond-days-editor');
  const input = document.getElementById('bond-days-input');
  if(!editor || !input) return;
  input.value = getBondDaysText();
  editor.classList.add('open');
  setTimeout(()=>input.focus(), 20);
}

function closeBondDaysEditor(){
  const editor = document.getElementById('bond-days-editor');
  if(editor) editor.classList.remove('open');
}

function saveBondDays(){
  const input = document.getElementById('bond-days-input');
  if(!input) return;
  const value = (input.value || '').trim();
  if(value) localStorage.setItem('bond_days_text', value);
  else localStorage.removeItem('bond_days_text');
  renderBondDays();
  closeBondDaysEditor();
  showHomeToast('保存成功');
}

function openBondBubbleEditor(idx, e){
  if(e && e.stopPropagation) e.stopPropagation();
  activeBondBubble = idx === 2 ? 2 : 1;
  const editor = document.getElementById('bond-bubble-editor');
  const input = document.getElementById('bond-bubble-input');
  const title = document.getElementById('bond-bubble-title');
  if(!editor || !input || !title) return;
  title.textContent = '文字泡泡 ' + activeBondBubble;
  input.value = getBondBubbleText(activeBondBubble) === '输入' ? '' : getBondBubbleText(activeBondBubble);
  editor.classList.add('open');
  setTimeout(()=>input.focus(), 20);
}

function closeBondBubbleEditor(){
  const editor = document.getElementById('bond-bubble-editor');
  if(editor) editor.classList.remove('open');
}

function saveBondBubble(){
  const input = document.getElementById('bond-bubble-input');
  if(!input) return;
  const key = activeBondBubble === 2 ? 'bond_bubble_2' : 'bond_bubble_1';
  const value = (input.value || '').trim();
  if(value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
  renderBondBubbles();
  closeBondBubbleEditor();
  showHomeToast('保存成功');
}
function openPageTwoMiniNoteEditor(e){
  if(e && e.stopPropagation) e.stopPropagation();
  const editor = document.getElementById('page-two-mini-note-editor');
  const input = document.getElementById('page-two-mini-note-input');
  if(!editor || !input) return;
  input.value = localStorage.getItem('page_two_mini_note') || '';
  editor.classList.add('open');
  setTimeout(()=>input.focus(), 20);
}
function closePageTwoMiniNoteEditor(){
  const editor = document.getElementById('page-two-mini-note-editor');
  if(editor) editor.classList.remove('open');
}
function savePageTwoMiniNote(){
  const input = document.getElementById('page-two-mini-note-input');
  if(!input) return;
  const value = (input.value || '').trim();
  if(value) localStorage.setItem('page_two_mini_note', value);
  else localStorage.removeItem('page_two_mini_note');
  renderPageTwoMiniNote();
  closePageTwoMiniNoteEditor();
  showHomeToast('保存成功');
}

function bindClockLocationEditor(){
  const editor = document.getElementById('clock-loc-editor');
  const input = document.getElementById('clock-loc-input');
  if(editor){
    editor.addEventListener('click', (evt)=>{
      if(evt.target === editor) closeClockLocationEditor();
    });
  }
  if(input){
    input.addEventListener('keydown', (evt)=>{
      if((evt.ctrlKey || evt.metaKey) && evt.key === 'Enter'){
        evt.preventDefault();
        saveClockLocation();
      }
    });
  }
}

function bindBondEditors(){
  ['bond-days-editor','bond-bubble-editor','page-two-mini-note-editor'].forEach((id)=>{
    const editor = document.getElementById(id);
    if(editor){
      editor.addEventListener('click', (evt)=>{
        if(evt.target === editor){
          if(id === 'bond-days-editor') closeBondDaysEditor();
          else if(id === 'bond-bubble-editor') closeBondBubbleEditor();
          else closePageTwoMiniNoteEditor();
        }
      });
    }
  });
  const dayInput = document.getElementById('bond-days-input');
  if(dayInput){
    dayInput.addEventListener('keydown', (evt)=>{
      if((evt.ctrlKey || evt.metaKey) && evt.key === 'Enter'){
        evt.preventDefault();
        saveBondDays();
      }
    });
  }
  const bubbleInput = document.getElementById('bond-bubble-input');
  if(bubbleInput){
    bubbleInput.addEventListener('keydown', (evt)=>{
      if((evt.ctrlKey || evt.metaKey) && evt.key === 'Enter'){
        evt.preventDefault();
        saveBondBubble();
      }
    });
  }
  const miniNoteInput = document.getElementById('page-two-mini-note-input');
  if(miniNoteInput){
    miniNoteInput.addEventListener('keydown', (evt)=>{
      if((evt.ctrlKey || evt.metaKey) && evt.key === 'Enter'){
        evt.preventDefault();
        savePageTwoMiniNote();
      }
    });
  }
}

function bindBondLinkInputs(){
  ['1','2'].forEach((idx)=>{
    const input = document.getElementById('bond-link-input-' + idx);
    if(!input) return;
    input.addEventListener('input', ()=>{
      const value = input.value || '';
      const key = idx === '2' ? 'bond_link_text_2' : 'bond_link_text_1';
      if(value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    });
  });
}

function getTopAvatarFrameUrl(){
  const saved = localStorage.getItem('home_top_frame_url') || '';
  if(saved) return saved;
  try{
    if(typeof avatarFrames !== 'undefined' && Array.isArray(avatarFrames)){
      const first = avatarFrames.find((f)=>f && typeof f.url === 'string' && f.url.trim());
      if(first && first.url){
        localStorage.setItem('home_top_frame_url', first.url);
        return first.url;
      }
    }
  }catch(e){}
  return '';
}

function getTopFrameChoices(){
  const out = [{ id: 'none', url: '', name: '无' }];
  try{
    if(typeof avatarFrames !== 'undefined' && Array.isArray(avatarFrames)){
      avatarFrames.forEach((f, idx)=>{
        if(!f || typeof f.url !== 'string') return;
        const url = f.url.trim();
        if(!url) return;
        out.push({ id: f.id || ('f_' + idx), url, name: f.name || String(idx + 1) });
      });
    }
  }catch(e){}
  return out;
}

function getTopFrameVisual(url){
  let cfg = { scale: 1.26, offsetX: 0, offsetY: -7 };
  try{
    if(typeof avatarFrames !== 'undefined' && Array.isArray(avatarFrames)){
      const found = avatarFrames.find((f)=>f && f.url === url);
      if(found){
        cfg = {
          scale: Number(found.scale) || cfg.scale,
          offsetX: Number(found.offsetX) || 0,
          offsetY: Number(found.offsetY) || cfg.offsetY,
        };
      }
    }
  }catch(e){}
  return cfg;
}

function getActiveTopFrameUrl(){
  if(isTopFrameEditorOpen) return topFrameDraftUrl || '';
  return getTopAvatarFrameUrl();
}

function getBondAvatarFrameStorageKey(role){
  return role === 'user' ? 'bond_user_frame_url' : 'bond_char_frame_url';
}

function getBondAvatarFrameUrl(role){
  return localStorage.getItem(getBondAvatarFrameStorageKey(role)) || '';
}

function getActiveBondAvatarFrameUrl(role){
  if(isTopFrameEditorOpen && activeHomeSlot === ('bond-frame-' + role)) return topFrameDraftUrl || '';
  return getBondAvatarFrameUrl(role);
}

function renderHomePages(immediate){
  const pages = document.getElementById('home-pages');
  if(!pages) return;
  const offsetPx = homePageIndex * getHomePageStep();
  if(immediate){
    const prev = pages.style.transition;
    pages.style.transition = 'none';
    pages.style.transform = `translateX(${-offsetPx}px)`;
    renderHomePageIndicator();
    pages.offsetHeight;
    pages.style.transition = prev || '';
    return;
  }
  pages.style.transform = `translateX(${-offsetPx}px)`;
  renderHomePageIndicator();
}

function setHomePage(index, immediate){
  homePageIndex = Math.max(0, Math.min(1, index));
  try{ localStorage.setItem('home_page_index', String(homePageIndex)); }catch(e){}
  renderHomePages(immediate);
}

function renderHomePageIndicator(){
  const dots = document.querySelectorAll('.home-page-dot');
  dots.forEach((dot, idx)=>{
    dot.classList.toggle('active', idx === homePageIndex);
  });
}

function bindHomePager(){
  const pages = document.getElementById('home-pages');
  const surface = document.getElementById('home-content') || pages;
  if(!pages || !surface) return;
  surface.addEventListener('pointerdown', (evt)=>{
    if(evt.pointerType === 'mouse' && evt.button !== 0) return;
    pagerPointerId = evt.pointerId;
    pagerStartX = evt.clientX;
    pagerStartY = evt.clientY;
    pagerDragging = false;
  });
  surface.addEventListener('pointermove', (evt)=>{
    if(pagerPointerId !== evt.pointerId) return;
    const dx = evt.clientX - pagerStartX;
    const dy = evt.clientY - pagerStartY;
    if(!pagerDragging){
      if(Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return;
      pagerDragging = true;
      surface.setPointerCapture(evt.pointerId);
    }
    evt.preventDefault();
    const offset = -(homePageIndex * getHomePageStep()) + dx;
    pages.style.transition = 'none';
    pages.style.transform = `translateX(${offset}px)`;
  });
  const finish = (evt)=>{
    if(pagerPointerId !== evt.pointerId) return;
    const dx = evt.clientX - pagerStartX;
    const width = getHomePageWidth();
    if(pagerDragging){
      pages.style.transition = '';
      const passed = Math.abs(dx) > Math.min(90, width * 0.18);
      if(passed){
        setHomePage(homePageIndex + (dx < 0 ? 1 : -1));
      } else {
        setHomePage(homePageIndex);
      }
    }
    pagerStartX = 0;
    pagerStartY = 0;
    pagerDragging = false;
    pagerPointerId = null;
  };
  surface.addEventListener('pointerup', finish);
  surface.addEventListener('pointercancel', finish);
}

function openPlaceholderMiniApp(idx){
  showHomeToast('占位' + idx + ' 暂未设置');
}

function getActiveCharacterData(){
  try{
    var scoped = scopedKeyForAccount('activeCharacter', getActiveAccountId());
    var scopedActive = JSON.parse(localStorage.getItem(scoped) || 'null');
    if(scopedActive && scopedActive.id) return scopedActive;
  }catch(e){
  }
  try{
    var globalActive = JSON.parse(localStorage.getItem('activeCharacter') || 'null');
    if(globalActive && globalActive.id) return globalActive;
  }catch(e){
    return null;
  }
  return null;
}

function getChatUserName(charId){
  if(!charId) return 'USER';
  var activeId = getActiveAccountId();
  var scoped = scopedKeyForAccount('user_name_' + charId, activeId);
  return (localStorage.getItem(scoped) || localStorage.getItem('user_name_' + charId) || '').trim() || 'USER';
}

function getChatUserAvatar(charId){
  var activeId = getActiveAccountId();
  var keys = [];
  if(charId) keys.push(scopedKeyForAccount('user_avatar_' + charId, activeId));
  keys.push(scopedKeyForAccount('user_avatar', activeId));
  if(charId) keys.push('user_avatar_' + charId);
  keys.push('user_avatar');
  keys.push(scopedKeyForAccount('qq_profile_avatar_asset', activeId));
  keys.push('qq_profile_avatar_asset');
  function loadAt(idx){
    if(idx >= keys.length){
      try{
        if(window.AccountManager){
          var acct = window.AccountManager.getActive();
          var avatar = String((acct && acct.avatar) || '').trim();
          if(avatar) return Promise.resolve(avatar);
        }
      }catch(e){}
      return Promise.resolve('');
    }
    return loadStoredAsset(keys[idx]).then(function(src){
      if(src && src.startsWith('data:')) return src;
      return loadAt(idx + 1);
    });
  }
  return loadAt(0);
}

function getStoredChatMessages(charId){
  if(!charId) return [];
  try{
    function normalizeStoredMessage(entry){
      if(Array.isArray(entry)){
        return {
          id: String(entry[0] || ''),
          role: String(entry[1] || 'assistant'),
          type: normalizeChatPreviewType(entry[2] || 'text'),
          content: typeof entry[3] === 'string' ? entry[3] : String(entry[3] || ''),
          sentAt: Number(entry[4] || 0) || 0,
          readAt: Number(entry[5] || 0) || 0,
          replyToId: entry[6] ? String(entry[6]) : null,
          hidden: !!entry[7]
        };
      }
      if(entry && typeof entry === 'object'){
        return {
          id: String(entry.id || ''),
          role: String(entry.role || 'assistant'),
          type: normalizeChatPreviewType(entry.type || 'text'),
          content: typeof entry.content === 'string' ? entry.content : String(entry.content || ''),
          sentAt: Number(entry.sentAt || 0) || 0,
          readAt: Number(entry.readAt || 0) || 0,
          replyToId: entry.replyToId ? String(entry.replyToId) : null,
          hidden: !!entry.hidden
        };
      }
      return null;
    }
    function normalizeStoredHistory(list){
      return (Array.isArray(list) ? list : []).map(normalizeStoredMessage).filter(Boolean);
    }
    var scoped = scopedKeyForAccount('chat_' + charId, getActiveAccountId());
    var candidates = [
      localStorage.getItem(scoped) || '',
      localStorage.getItem('chat_' + charId) || ''
    ];
    for(var i=0; i<localStorage.length; i++){
      var key = localStorage.key(i) || '';
      if(key.indexOf('chat_' + charId + '__acct_') === 0){
        candidates.push(localStorage.getItem(key) || '');
      }
    }
    function historyStamp(list){
      var entries = Array.isArray(list) ? list : [];
      var lastTs = 0;
      entries.forEach(function(entry){
        var ts = Number((entry && (entry.sentAt || entry.readAt)) || 0) || 0;
        if(ts > lastTs) lastTs = ts;
      });
      return { lastTs:lastTs, count:entries.length };
    }
    function chooseBetter(bestRecord, nextRecord){
      if(!nextRecord || !Array.isArray(nextRecord.history) || !nextRecord.history.length) return bestRecord;
      if(!bestRecord || !Array.isArray(bestRecord.history) || !bestRecord.history.length) return nextRecord;
      var bestStamp = historyStamp(bestRecord.history);
      var nextStamp = historyStamp(nextRecord.history);
      var bestUpdatedAt = Number(bestRecord.updatedAt || 0) || 0;
      var nextUpdatedAt = Number(nextRecord.updatedAt || 0) || 0;
      if(nextUpdatedAt > bestUpdatedAt) return nextRecord;
      if(nextUpdatedAt === bestUpdatedAt && nextStamp.lastTs > bestStamp.lastTs) return nextRecord;
      if(nextUpdatedAt === bestUpdatedAt && nextStamp.lastTs === bestStamp.lastTs && nextStamp.count > bestStamp.count) return nextRecord;
      return bestRecord;
    }
    var best = null;
    candidates.forEach(function(raw){
      if(!raw) return;
      try{
        var parsed = JSON.parse(raw);
        var list = normalizeStoredHistory((parsed && (parsed.history || parsed.messages)) || []);
        if(Array.isArray(list) && list.length){
          best = chooseBetter(best, {
            history: list,
            updatedAt: parsed && parsed.updatedAt
          });
        }
      }catch(e){}
    });
    return Array.isArray(best && best.history) ? best.history : [];
  }catch(e){
    return [];
  }
}

async function getStoredChatMessagesAsync(charId){
  var localList = getStoredChatMessages(charId);
  if(window.PhoneStorage && typeof window.PhoneStorage.get === 'function' && charId){
    try{
      var scoped = scopedKeyForAccount('chat_' + charId, getActiveAccountId());
      var record = await window.PhoneStorage.get('chats', scoped);
      var history = Array.isArray(record && record.history) ? record.history.map(function(entry){
        if(Array.isArray(entry)){
          return {
            id: String(entry[0] || ''),
            role: String(entry[1] || 'assistant'),
            type: normalizeChatPreviewType(entry[2] || 'text'),
            content: typeof entry[3] === 'string' ? entry[3] : String(entry[3] || ''),
            sentAt: Number(entry[4] || 0) || 0,
            readAt: Number(entry[5] || 0) || 0,
            replyToId: entry[6] ? String(entry[6]) : null,
            hidden: !!entry[7]
          };
        }
        return entry && typeof entry === 'object' ? entry : null;
      }).filter(Boolean) : [];
      if(history.length){
        var localLastTs = 0;
        localList.forEach(function(entry){
          var ts = Number((entry && (entry.sentAt || entry.readAt)) || 0) || 0;
          if(ts > localLastTs) localLastTs = ts;
        });
        var idbLastTs = 0;
        history.forEach(function(entry){
          var ts = Number((entry && (entry.sentAt || entry.readAt)) || 0) || 0;
          if(ts > idbLastTs) idbLastTs = ts;
        });
        if(idbLastTs > localLastTs) return history;
        if(idbLastTs === localLastTs && history.length >= localList.length) return history;
      }
    }catch(e){}
  }
  return localList;
}

function renderBondWidget(character){
  const c = character || getActiveCharacterData();
  const charName = document.getElementById('bond-char-name');
  const userName = document.getElementById('bond-user-name');
  const charAvatar = document.getElementById('bond-char-avatar');
  const userAvatar = document.getElementById('bond-user-avatar');
  if(charName) charName.textContent = c ? (c.nickname || c.name || 'CHAR') : 'CHAR';
  if(userName) userName.textContent = getChatUserName(c && c.id);
  if(charAvatar){
    const applyCharAvatar = (override)=>{
      const baseHtml = override && override.startsWith('data:')
        ? '<span class="bond-avatar-base"><img src="' + override + '" alt=""></span>'
        : c && c.imageData
          ? '<span class="bond-avatar-base"><img src="' + c.imageData + '" alt=""></span>'
          : '<span class="bond-avatar-base">' + (c ? (c.avatar || '✿') : '✿') + '</span>';
      const frameUrl = getActiveBondAvatarFrameUrl('char');
      if(frameUrl){
        const frameVisual = getTopFrameVisual(frameUrl);
        const frameStyle = '--frame-scale:' + frameVisual.scale + ';--frame-offset-x:' + frameVisual.offsetX + 'px;--frame-offset-y:' + frameVisual.offsetY + 'px;';
        charAvatar.innerHTML = baseHtml + '<img class="bond-avatar-frame" style="' + frameStyle + '" src="' + frameUrl + '" alt="">';
      } else {
        charAvatar.innerHTML = baseHtml;
      }
    };
    applyCharAvatar('');
    if(c && c.id) loadStoredAsset('char_avatar_' + c.id).then(applyCharAvatar);
  }
  if(userAvatar){
    const applyUserAvatar = (src)=>{
      const baseHtml = src && src.startsWith('data:')
        ? '<span class="bond-avatar-base"><img src="' + src + '" alt=""></span>'
        : '<span class="bond-avatar-base">你</span>';
      const frameUrl = getActiveBondAvatarFrameUrl('user');
      if(frameUrl){
        const frameVisual = getTopFrameVisual(frameUrl);
        const frameStyle = '--frame-scale:' + frameVisual.scale + ';--frame-offset-x:' + frameVisual.offsetX + 'px;--frame-offset-y:' + frameVisual.offsetY + 'px;';
        userAvatar.innerHTML = baseHtml + '<img class="bond-avatar-frame" style="' + frameStyle + '" src="' + frameUrl + '" alt="">';
      } else {
        userAvatar.innerHTML = baseHtml;
      }
    };
    applyUserAvatar('');
    getChatUserAvatar(c && c.id).then(applyUserAvatar);
  }
}

function applyBondWidgetPreview(payload){
  var preview = payload && typeof payload === 'object' ? payload : {};
  var c = preview.char || getActiveCharacterData();
  if(c){
    setWidgetCharacter(c);
    renderBondWidget(c);
  }else{
    renderBondWidget(null);
  }
  var userNameEl = document.getElementById('bond-user-name');
  if(userNameEl && typeof preview.userName === 'string'){
    userNameEl.textContent = preview.userName.trim() || 'USER';
  }
  if(typeof preview.userAvatar === 'string'){
    var userAvatarEl = document.getElementById('bond-user-avatar');
    if(userAvatarEl){
      var src = preview.userAvatar.trim();
      var baseHtml = src && src.startsWith('data:')
        ? '<span class="bond-avatar-base"><img src="' + src + '" alt=""></span>'
        : '<span class="bond-avatar-base">你</span>';
      var frameUrl = getActiveBondAvatarFrameUrl('user');
      if(frameUrl){
        var frameVisual = getTopFrameVisual(frameUrl);
        var frameStyle = '--frame-scale:' + frameVisual.scale + ';--frame-offset-x:' + frameVisual.offsetX + 'px;--frame-offset-y:' + frameVisual.offsetY + 'px;';
        userAvatarEl.innerHTML = baseHtml + '<img class="bond-avatar-frame" style="' + frameStyle + '" src="' + frameUrl + '" alt="">';
      } else {
        userAvatarEl.innerHTML = baseHtml;
      }
    }
  }
}

function onTopSlotTap(e){
  if(e && e.stopPropagation) e.stopPropagation();
  if(topSlotLongPressFired){
    topSlotLongPressFired = false;
    return;
  }
  pickHomeSlot('top');
}

function onBondAvatarTap(e, role){
  if(e && e.stopPropagation) e.stopPropagation();
  if(bondAvatarLongPressFired && bondAvatarLongPressRole === role){
    bondAvatarLongPressFired = false;
    bondAvatarLongPressRole = '';
    return;
  }
  const active = getActiveCharacterData();
  if(!active || !active.id){
    openApp('characters');
    return;
  }
  openApp('chat');
}

function onBondNameTap(e, role){
  if(e && e.stopPropagation) e.stopPropagation();
  const active = getActiveCharacterData();
  if(!active || !active.id){
    openApp('characters');
    return;
  }
  openApp('chat');
}

function bindTopSlotPressBehavior(){
  const topSlot = document.querySelector('.slot-picker[data-slot="top"]');
  if(!topSlot) return;
  const clearPressTimer = ()=>{
    if(topSlotPressTimer){
      clearTimeout(topSlotPressTimer);
      topSlotPressTimer = null;
    }
  };
  topSlot.addEventListener('pointerdown', (evt)=>{
    if(evt.pointerType === 'mouse' && evt.button !== 0) return;
    clearPressTimer();
    topSlotLongPressFired = false;
    if(!localStorage.getItem('home_slot_top')) return;
    topSlotPressTimer = setTimeout(()=>{
      topSlotLongPressFired = true;
      openTopFrameEditor();
    }, TOP_SLOT_LONG_PRESS_MS);
  });
  ['pointerup','pointercancel','pointerleave'].forEach((name)=>{
    topSlot.addEventListener(name, clearPressTimer);
  });
}

function openBondAvatarFrameEditor(role){
  activeHomeSlot = 'bond-frame-' + role;
  isTopFrameEditorOpen = true;
  topFrameDraftUrl = getBondAvatarFrameUrl(role);
  const editor = document.getElementById('top-frame-editor');
  if(editor) editor.classList.add('open');
  renderTopFrameChoices();
  renderBondWidget();
}

function bindBondAvatarPressBehavior(){
  const clearPressTimer = ()=>{
    if(bondAvatarPressTimer){
      clearTimeout(bondAvatarPressTimer);
      bondAvatarPressTimer = null;
    }
  };
  document.querySelectorAll('.bond-avatar[data-bond-avatar]').forEach((avatar)=>{
    avatar.addEventListener('pointerdown', (evt)=>{
      if(evt.pointerType === 'mouse' && evt.button !== 0) return;
      clearPressTimer();
      bondAvatarLongPressFired = false;
      bondAvatarLongPressRole = '';
      const role = avatar.getAttribute('data-bond-avatar') || 'char';
      bondAvatarPressTimer = setTimeout(()=>{
        bondAvatarLongPressFired = true;
        bondAvatarLongPressRole = role;
        openBondAvatarFrameEditor(role);
      }, TOP_SLOT_LONG_PRESS_MS);
    });
    ['pointerup','pointercancel','pointerleave'].forEach((name)=>{
      avatar.addEventListener(name, clearPressTimer);
    });
  });
}

function renderTopFrameChoices(){
  const host = document.getElementById('top-frame-grid');
  if(!host) return;
  const list = getTopFrameChoices();
  host.innerHTML = list.map((it)=>{
    const active = (it.url || '') === (topFrameDraftUrl || '');
    if(!it.url){
      return '<button class="frame-chip' + (active ? ' active' : '') + '" type="button" onclick="pickTopFrame(\'\')">无</button>';
    }
    return '<button class="frame-chip' + (active ? ' active' : '') + '" type="button" onclick="pickTopFrame(\'' + it.url.replace(/'/g, "\\'") + '\')"><img src="' + it.url + '" alt=""></button>';
  }).join('');
}

function openTopFrameEditor(){
  loadStoredAsset('home_slot_top').then((topImage)=>{
    if(!topImage){
      showHomeToast('先上传圆形图片');
      return;
    }
    activeHomeSlot = 'top';
    isTopFrameEditorOpen = true;
    topFrameDraftUrl = localStorage.getItem('home_top_frame_url') || '';
    const editor = document.getElementById('top-frame-editor');
    if(editor) editor.classList.add('open');
    renderTopFrameChoices();
    renderHomeSlot('top', topImage);
  });
}

function closeTopFrameEditor(){
  isTopFrameEditorOpen = false;
  topFrameDraftUrl = null;
  const editor = document.getElementById('top-frame-editor');
  if(editor) editor.classList.remove('open');
  if(activeHomeSlot === 'top'){
    loadStoredAsset('home_slot_top').then((data)=>renderHomeSlot('top', data));
  } else if(activeHomeSlot === 'bond-frame-char' || activeHomeSlot === 'bond-frame-user'){
    renderBondWidget();
  }
  activeHomeSlot = null;
}

function pickTopFrame(url){
  topFrameDraftUrl = url || '';
  renderTopFrameChoices();
  if(activeHomeSlot === 'top'){
    loadStoredAsset('home_slot_top').then((data)=>renderHomeSlot('top', data));
  } else if(activeHomeSlot === 'bond-frame-char' || activeHomeSlot === 'bond-frame-user'){
    renderBondWidget();
  }
}

function saveTopFrame(){
  const url = topFrameDraftUrl || '';
  if(activeHomeSlot === 'top'){
    if(url) localStorage.setItem('home_top_frame_url', url);
    else localStorage.removeItem('home_top_frame_url');
  } else if(activeHomeSlot === 'bond-frame-char' || activeHomeSlot === 'bond-frame-user'){
    const role = activeHomeSlot === 'bond-frame-user' ? 'user' : 'char';
    const key = getBondAvatarFrameStorageKey(role);
    if(url) localStorage.setItem(key, url);
    else localStorage.removeItem(key);
  }
  isTopFrameEditorOpen = false;
  topFrameDraftUrl = null;
  const editor = document.getElementById('top-frame-editor');
  if(editor) editor.classList.remove('open');
  if(activeHomeSlot === 'top'){
    loadStoredAsset('home_slot_top').then((data)=>renderHomeSlot('top', data));
  } else if(activeHomeSlot === 'bond-frame-char' || activeHomeSlot === 'bond-frame-user'){
    renderBondWidget();
  }
  activeHomeSlot = null;
  showHomeToast('保存成功');
}

function bindTopFrameEditor(){
  const editor = document.getElementById('top-frame-editor');
  if(!editor) return;
  editor.addEventListener('click', (evt)=>{
    if(evt.target === editor) closeTopFrameEditor();
  });
}

function renderHomeSlot(slotId, dataUrl){
  const el = document.querySelector('.slot-picker[data-slot="' + slotId + '"]');
  if(!el) return;
  if(dataUrl && dataUrl.startsWith('data:')){
    el.classList.add('has-image');
    if(slotId === 'top'){
      const frameUrl = getActiveTopFrameUrl();
      const baseHtml = '<span class="slot-base-mask"><img class="slot-base" src="' + dataUrl + '" alt=""></span>';
      if(frameUrl){
        const frameVisual = getTopFrameVisual(frameUrl);
        const frameStyle = '--frame-scale:' + frameVisual.scale + ';--frame-offset-x:' + frameVisual.offsetX + 'px;--frame-offset-y:' + frameVisual.offsetY + 'px;';
        el.innerHTML = baseHtml + '<img class="slot-frame" style="' + frameStyle + '" src="' + frameUrl + '" alt="">';
      }else{
        el.innerHTML = baseHtml;
      }
    }else if(slotId === 'musicAlbum'){
      el.innerHTML = '<img src="' + dataUrl + '" alt=""><span class="slot-plus">+</span>';
    }else if(slotId === '1' || slotId === '2' || slotId === '3'){
      const liveTexts = getLiveDanmakuTexts(slotId);
      el.innerHTML =
        '<img src="' + dataUrl + '" alt="">' +
        '<span class="live-overlay live-variant-' + slotId + '">' +
          '<span class="live-danmaku danmaku-a">' + liveTexts[0] + '</span>' +
          '<span class="live-danmaku danmaku-b">' + liveTexts[1] + '</span>' +
          '<span class="live-danmaku danmaku-c">' + liveTexts[2] + '</span>' +
          '<span class="live-like like-a">♥</span>' +
          '<span class="live-like like-b">♥</span>' +
          '<span class="live-like like-c">♥</span>' +
        '</span>';
    }else{
      el.innerHTML = '<img src="' + dataUrl + '" alt="">';
    }
  } else {
    el.classList.remove('has-image');
    el.innerHTML = '<span class="slot-plus">+</span>';
  }
}

function setHomeSlotImage(slotId, dataUrl){
  const key = 'home_slot_' + slotId;
  return saveStoredAsset(key, dataUrl && dataUrl.startsWith('data:') ? dataUrl : '').then((ok)=>{
    if(ok) renderHomeSlot(slotId, dataUrl);
    return ok;
  });
}

function restoreHomeSlots(){
  ['top','1','2','3','photo1','photo2','musicAlbum'].forEach((id)=>{
    loadStoredAsset('home_slot_' + id).then((dataUrl)=>{
      renderHomeSlot(id, dataUrl);
    });
  });
}

function pickHomeSlot(slotId){
  activeHomeSlot = slotId;
  const input = document.getElementById('home-slot-file');
  if(!input) return;
  input.value = '';
  input.click();
}

function bindHomeSlotInput(){
  const input = document.getElementById('home-slot-file');
  if(!input) return;
  input.addEventListener('change', async (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f || !activeHomeSlot) return;
    try{
      const rawData = await fileToDataUrl(f);
      const optimized = isGifFile(f) ? rawData : await optimizeImageDataUrl(rawData);
      let ok = await setHomeSlotImage(activeHomeSlot, optimized);
      // Fallback once more with stronger compression when storage is tight.
      if(!ok && !isGifFile(f)){
        const smaller = await optimizeImageDataUrl(rawData, { maxSide: 420, quality: 0.58 });
        ok = await setHomeSlotImage(activeHomeSlot, smaller);
      }
      showHomeToast(ok ? '更换成功' : '图片过大，换一张试试');
    }catch(err){
      showHomeToast('图片读取失败');
    }
    activeHomeSlot = null;
  });
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = (evt)=>resolve(evt.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function optimizeImageDataUrl(dataUrl, opts){
  return new Promise((resolve)=>{
    if(isGifDataUrl(dataUrl)){
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = ()=>{
      const maxSide = (opts && opts.maxSide) || 640;
      const quality = (opts && opts.quality) || 0.72;
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if(!ctx){ resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = ()=>resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Maintain a simple app navigation stack so Back can return to the previous app
const appStack=[];
let currentApp=null;
let appTransitionPromise = Promise.resolve();

function runAppTransition(task){
  appTransitionPromise = appTransitionPromise.then(task).catch(function(err){
    console.error('app transition failed', err);
  });
  return appTransitionPromise;
}

async function flushCurrentAppState(){
  try{
    const f = document.getElementById('app-iframe');
    if(!f || !f.contentWindow) return;
    try{
      if(typeof f.contentWindow.waitForPendingChatSave === 'function'){
        await f.contentWindow.waitForPendingChatSave();
      }
    }catch(err){}
    try{
      if(typeof f.contentWindow.saveChat === 'function'){
        await f.contentWindow.saveChat(true);
      }else if(typeof f.contentWindow.persistChatBeforeLeave === 'function'){
        var result = f.contentWindow.persistChatBeforeLeave();
        if(result && typeof result.then === 'function') await result;
      }
    }catch(err){}
    try{
      f.contentWindow.postMessage({ type:'APP_CLOSING' }, '*');
    }catch(err){}
  }catch(err){}
}

async function performCloseApp(){
  await flushCurrentAppState();
  appStack.length = 0;
  currentApp = null;
  const outer = document.querySelector('.phone-outer');
  if(outer){
    outer.classList.remove('app-open');
    outer.classList.remove('chat-shell-open');
    outer.style.removeProperty('--chat-shell-bg-image');
    outer.style.removeProperty('--chat-shell-bg-color');
  }
  document.documentElement.classList.remove('app-open-mode');
  document.body.classList.remove('app-open-mode');
  document.body.classList.remove('chat-shell-open');
  var container = document.getElementById('app-container');
  if(container){
    container.classList.remove('open');
    container.style.removeProperty('--chat-keyboard-shift');
  }
  chatInputFocusActive = false;
  chatReportedKeyboardShift = 0;
  document.getElementById('home-screen').classList.remove('hidden');
  try{
    const c = getActiveCharacterData();
    if(c) setWidgetCharacter(c);
    renderBondWidget(c);
  }catch(e){
    renderBondWidget(null);
  }
  setTimeout(()=>{ document.getElementById('app-iframe').src=''; },400);
}

function renderApp(id){
  const a=APP_MAP[id]; if(!a) return;
  currentApp=id;
  const outer = document.querySelector('.phone-outer');
  const container = document.getElementById('app-container');
  if(outer){
    outer.classList.add('app-open');
    outer.classList.toggle('chat-shell-open', id === 'chat');
    if(id !== 'chat'){
      outer.style.removeProperty('--chat-shell-bg-image');
      outer.style.removeProperty('--chat-shell-bg-color');
    }
  }
  document.documentElement.classList.add('app-open-mode');
  document.body.classList.add('app-open-mode');
  document.body.classList.toggle('chat-shell-open', id === 'chat');
  document.getElementById('app-title-label').textContent=a.title;
  if(container){
    container.classList.toggle('no-topbar', !!a.hideTopbar);
    container.dataset.appId = id;
    if(id !== 'chat'){
      container.style.removeProperty('--chat-keyboard-shift');
      chatInputFocusActive = false;
      chatReportedKeyboardShift = 0;
    }
  }
  document.getElementById('app-iframe').src=a.src;
  document.getElementById('app-container').classList.add('open');
  document.getElementById('home-screen').classList.add('hidden');
}

function setChatShellBackground(src){
  var outer = document.querySelector('.phone-outer');
  if(!outer) return;
  var clean = String(src || '').trim();
  if(clean){
    outer.style.setProperty('--chat-shell-bg-image', 'url("' + clean.replace(/"/g, '\\"') + '")');
    outer.style.setProperty('--chat-shell-bg-color', '#f7f7f7');
  }else{
    outer.style.removeProperty('--chat-shell-bg-image');
    outer.style.removeProperty('--chat-shell-bg-color');
  }
}

function setChatKeyboardShift(value){
  var container = document.getElementById('app-container');
  if(!container) return;
  var shift = Math.max(0, Math.min(420, Number(value) || 0));
  if(shift){
    container.style.setProperty('--chat-keyboard-shift', shift + 'px');
  }else{
    container.style.removeProperty('--chat-keyboard-shift');
  }
}

function applyIframeSafeAreaOverrides(){
  try{
    var frame = document.getElementById('app-iframe');
    if(!frame) return;
    var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
    if(!doc || !doc.documentElement || !doc.body) return;
    if(doc.getElementById('codex-safearea-reset')) return;
    var style = doc.createElement('style');
    style.id = 'codex-safearea-reset';
    style.textContent = [
      ':root{--vv-top-offset:0px !important;--vv-bottom-offset:0px !important;--keyboard-inset:0px !important;}',
      'html,body{margin-bottom:0 !important;scroll-padding-bottom:0 !important;}',
      '#chatBottomUnderlay,.chat-bottom-underlay{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(style);
    var staleUnderlays = doc.querySelectorAll('#chatBottomUnderlay, .chat-bottom-underlay');
    staleUnderlays.forEach(function(node){
      try{ node.remove(); }catch(err){}
    });
  }catch(err){
    console.warn('safe area override skipped', err);
  }
}

function openApp(id) {
  if(!APP_MAP[id]) return Promise.resolve();
  return runAppTransition(async function(){
    if(currentApp === id){
      if(appStack[appStack.length-1] !== id) appStack.push(id);
      return;
    }
    if(currentApp){
      await flushCurrentAppState();
    }
    if(appStack[appStack.length-1]!==id) appStack.push(id);
    renderApp(id);
  });
}

function replaceApp(id){
  if(!APP_MAP[id]) return Promise.resolve();
  return runAppTransition(async function(){
    if(currentApp){
      await flushCurrentAppState();
    }
    if(appStack.length){
      appStack[appStack.length - 1] = id;
    }else{
      appStack.push(id);
    }
    currentApp = null;
    renderApp(id);
  });
}

function closeApp() {
  return runAppTransition(async function(){
    await performCloseApp();
  });
}

function handleBack(){
  return runAppTransition(async function(){
    if(appStack.length>1){
      await flushCurrentAppState();
      appStack.pop();
      renderApp(appStack[appStack.length-1]);
      return;
    }
    await performCloseApp();
  });
}

function goHome(){ return closeApp(); }

async function clearPersistedPhoneData(){
  try{ localStorage.clear(); }catch(e){}
  try{ sessionStorage.clear(); }catch(e){}
  try{
    if(window.PhoneStorage && typeof window.PhoneStorage.deleteDatabase === 'function'){
      await window.PhoneStorage.deleteDatabase();
    }else if(window.PhoneStorage && typeof window.PhoneStorage.clearAll === 'function'){
      await window.PhoneStorage.clearAll();
    }
  }catch(e){}
  try{
    if(window.assetStore && typeof window.assetStore.clearAll === 'function'){
      await window.assetStore.clearAll();
    }
  }catch(e){}
}

async function formatEphone(){
  await clearPersistedPhoneData();
  // Reset UI
  closeApp();
  applyPhoneFrameVisibility(getDefaultPhoneFrameVisibility(), false);
  setWidgetCharacter({ name:'No companion yet', description:'Tap to import a character card!' });
  setWallpaper('default');
  restoreHomeAppIcons();
  document.getElementById('wgt-avatar').textContent='✿';
  document.getElementById('wgt-name').textContent='No companion yet';
  document.getElementById('wgt-sub').textContent='Tap to import a character card!';
  ['top','1','2','3'].forEach((id)=>renderHomeSlot(id, null));
  renderCharNote();
  renderClockLocation();
  renderBondDays();
  renderBondBubbles();
  renderBondWidget(null);
  applyLiveDanmakuVisibility(true);
  setHomePage(0, true);
}

window.addEventListener('message',(e)=>{
  const {type,payload}=e.data||{};
  const postToChat = (msg)=>{
    try {
      const f = document.getElementById('app-iframe');
      if(f && f.contentWindow) f.contentWindow.postMessage(msg,'*');
    } catch(err){}
  };
  if(type==='SET_ACTIVE_CHARACTER'){
    const slim = slimChar(payload);
    setWidgetCharacter(payload);
    if(isDefaultAccountActive()){
      try{ localStorage.setItem('activeCharacter',JSON.stringify(slim)); }catch(e){}
    }
    try{ localStorage.setItem(scopedKeyForAccount('activeCharacter', getActiveAccountId()), JSON.stringify(slim)); }catch(e){}
    cacheAvatar(payload);
    renderBondWidget(payload);
    renderHomeDockBadges();
    postToChat({ type:'SET_ACTIVE_CHARACTER', payload: slim });
  }
  if(type==='BOND_WIDGET_PREVIEW'){
    applyBondWidgetPreview(payload);
  }
  if(type==='CHARACTER_IMPORTED'){
    // When a card is imported, immediately reflect it on the home widget.
    const slim = slimChar(payload);
    cacheAvatar(payload);
    setWidgetCharacter(payload);
    if(isDefaultAccountActive()){
      try{ localStorage.setItem('activeCharacter',JSON.stringify(slim)); }catch(e){}
    }
    try{ localStorage.setItem(scopedKeyForAccount('activeCharacter', getActiveAccountId()), JSON.stringify(slim)); }catch(e){}
    renderBondWidget(payload);
    renderHomeDockBadges();
  }
  if(type==='OPEN_CHAT_WITH'){
    openApp('chat');
    const slim = slimChar(payload);
    if(isDefaultAccountActive()){
      try{ localStorage.setItem('activeCharacter',JSON.stringify(slim)); }catch(e){}
    }
    try{ localStorage.setItem(scopedKeyForAccount('activeCharacter', getActiveAccountId()), JSON.stringify(slim)); }catch(e){}
    setWidgetCharacter(payload);
    renderBondWidget(payload);
    try{ localStorage.setItem('pendingChatChar',JSON.stringify(slim)); }catch(e){}
    postToChat({ type:'SET_ACTIVE_CHARACTER', payload: slim });
  }
  if(type==='OPEN_APP_WITH'){
    var appId=payload.app;
    if(payload.charId) localStorage.setItem('wbCharId', payload.charId);
    openApp(appId);
  }
  if(type==='OFFLINE_MINIMIZED'){
    setMinimizedOfflineCharId(payload && payload.charId ? payload.charId : '');
    openApp('chat');
  }
  if(type==='OFFLINE_EXITED'){
    setMinimizedOfflineCharId('');
    removeAppFromStack('offline');
  }
  if(type==='OPEN_APP'){ openApp(payload); }
  if(type==='OPEN_APP_REPLACE'){ replaceApp(payload); }
  if(type==='SET_CHAT_SHELL_BACKGROUND'){
    setChatShellBackground(payload);
  }
  if(type==='SET_CHAT_KEYBOARD_SHIFT'){
    chatReportedKeyboardShift = Math.max(0, Math.min(420, Number(payload) || 0));
    syncChatKeyboardShift();
  }
  if(type==='CHAT_INPUT_FOCUS'){
    chatInputFocusActive = true;
    syncChatKeyboardShift();
    [80, 180, 320, 480].forEach(function(delay){
      setTimeout(syncChatKeyboardShift, delay);
    });
  }
  if(type==='CHAT_INPUT_BLUR'){
    chatInputFocusActive = false;
    chatReportedKeyboardShift = 0;
    setTimeout(syncChatKeyboardShift, 60);
    setTimeout(syncChatKeyboardShift, 220);
  }
  if(type==='SET_APP_ICON'){
    const app = payload && payload.app;
    if(app) renderHomeAppIcon(app, payload.icon);
  }
  if(type==='SET_PHONE_FRAME'){
    applyPhoneFrameVisibility(!!payload, true);
  }
  if(type==='SET_LIVE_DANMAKU'){
    setLiveDanmakuTexts(payload || {});
    showHomeToast('弹幕已保存');
  }
  if(type==='SET_LIVE_DANMAKU_ENABLED'){
    const next = !!payload;
    localStorage.setItem(LIVE_DANMAKU_ENABLED_KEY, next ? '1' : '0');
    applyLiveDanmakuVisibility(next);
    showHomeToast(next ? '弹幕已开启' : '弹幕已关闭');
  }
  if(type==='SHOW_HOME_TOAST'){ showHomeToast(payload); }
  if(type==='SET_WALLPAPER'){ setWallpaper(payload); }
  if(type==='CLOSE_APP'){ closeApp(); }
  if(type==='FORMAT_EPHONE'){ formatEphone(); }
  if(type==='SETTINGS_SAVED'){
    setupAiBgScheduler();
    maybeRunAiBgTick(false);
  }
  if(type==='CHAT_UPDATED'){
    // Always sync to the latest chatted character/widget state.
    delete qqUnreadCountCache[getActiveAccountId()];
    if(payload && payload.id){
      storeWidgetPreview(payload.id, {
        content: String(payload.last || ''),
        type: normalizeChatPreviewType(payload.lastType || 'text'),
        at: Date.now()
      });
    }
    var nextChar = payload && payload.data ? payload.data : null;
    if(nextChar && nextChar.id){
      if(isDefaultAccountActive()){
        try{ localStorage.setItem('activeCharacter', JSON.stringify(nextChar)); }catch(e){}
      }
      try{ localStorage.setItem(scopedKeyForAccount('activeCharacter', getActiveAccountId()), JSON.stringify(nextChar)); }catch(e){}
      setWidgetCharacter(nextChar);
      renderBondWidget(nextChar);
    }else{
      var ac = getActiveCharacterData();
      if(ac) renderBondWidget(ac);
    }
    var picked = payload && Object.prototype.hasOwnProperty.call(payload, 'last')
      ? { content: (payload.last || ''), type: normalizeChatPreviewType(payload.lastType || 'text') }
      : payload && payload.id
        ? pickLatestPreview(getStoredChatMessages(payload.id))
        : { content: '', type: 'text' };
    var subText = picked.content || payload.last || '';
    var lastType = normalizeChatPreviewType(picked.type || payload.lastType || 'text');
    if(lastType === 'voice'){
      var dur = Math.max(1, Math.min(60, Math.ceil((subText||'').length/6)));
      subText = '语音消息 ' + dur + "''";
    } else if(lastType === 'image'){
      subText = '【图片】';
    }
    var subEl = document.getElementById('wgt-sub');
    if(subEl) subEl.textContent = formatCharSub(subText);
    renderHomeDockBadges();
  }
});

const WALLPAPERS={
  default:'#f7f7f7',
  sakura:'linear-gradient(160deg,#ffe0ec 0%,#ffb3d1 40%,#ff85b3 70%,#d4608a 100%)',
  midnight:'linear-gradient(160deg,#0a0a2e 0%,#1a1060 40%,#2d1880 70%,#5a3080 100%)',
  ocean:'linear-gradient(160deg,#0a1a3e 0%,#1040a0 40%,#2060c0 70%,#60a0e0 100%)',
  cotton:'linear-gradient(160deg,#fff0f6 0%,#ffe0f0 30%,#f0d0ff 60%,#d0e8ff 100%)',
  sunset:'linear-gradient(160deg,#3e0a1a 0%,#a01040 40%,#e04060 70%,#ffa060 100%)',
};
function setWallpaper(t){
  const el=document.getElementById('wallpaper-gradient');
  const frameBg = document.getElementById('frame-wallpaper');
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const setGlobalBg = (bg)=>{
    try{
      document.body.style.background = '';
      document.documentElement.style.background = '';
      if(root) root.style.setProperty('--viewport-bg', '#f7f7f7');
      if(themeMeta){
        themeMeta.setAttribute('content', '#f7f7f7');
      }
    }catch(e){}
  };
  if(WALLPAPERS[t]){
    const bg = WALLPAPERS[t];
    if(el) el.style.background = 'transparent';
    if(frameBg) frameBg.style.background = bg;
    setGlobalBg(bg);
    localStorage.setItem('wallpaper',t);
    removeStoredAsset('wallpaper_custom');
    return;
  }
  if(typeof t==='string' && (t.startsWith('data:') || t.startsWith('http'))){
    const bg = `center / cover no-repeat url(${t})`;
    if(el) el.style.background = 'transparent';
    if(frameBg) frameBg.style.background = bg;
    setGlobalBg(bg);
    localStorage.setItem('wallpaper','custom');
    saveStoredAsset('wallpaper_custom', t);
    return;
  }
}

function compactCharKey(key){
  try{
    var raw = localStorage.getItem(key);
    if(!raw) return;
    var obj = JSON.parse(raw);
    var slim = slimChar(obj);
    if(slim) localStorage.setItem(key, JSON.stringify(slim));
  }catch(e){}
}

function normalizeChatPreviewType(type){
  if(type === 'voice_message' || type === 'voice') return 'voice';
  if(type === 'image_message' || type === 'image_card' || type === 'image') return 'image';
  if(type === 'family_card' || type === 'familycard') return 'familycard';
  if(type === 'money_packet' || type === 'moneypacket' || type === 'transfer') return 'moneypacket';
  return 'text';
}

function normalizePreviewMessage(msg){
  var next = msg && typeof msg === 'object' ? msg : { content:'', type:'text' };
  var kind = normalizeChatPreviewType(next.type || 'text');
  if(kind === 'familycard'){
    return { content: '【亲属卡】', type: 'text' };
  }
  if(kind === 'moneypacket'){
    try{
      var parsed = typeof next.content === 'string' ? JSON.parse(next.content) : next.content;
      var mode = String((parsed && parsed.mode) || 'red_packet');
      var amount = Number((parsed && parsed.amount) || 0);
      var label = mode === 'transfer' ? '【转账】' : '【红包】';
      if(amount > 0) label += amount.toFixed(2) + '元';
      return { content: label, type: 'text' };
    }catch(e){
      return { content: '【红包】', type: 'text' };
    }
  }
  if(kind === 'text' && typeof next.content === 'string' && next.content.trim().startsWith('{')){
    try{
      var parsed = JSON.parse(next.content);
      if(parsed && typeof parsed === 'object' && parsed.content){
        return { content: parsed.content, type: normalizeChatPreviewType(parsed.type || 'text') };
      }
    }catch(e){}
  }
  return { content: next.content || '', type: kind };
}

function isAssistantPreviewMessage(msg){
  var role = String((msg && (msg.role || msg.sender || msg.from || '')) || '').toLowerCase();
  return role === 'assistant' || role === 'ai' || role === 'character' || role === 'bot';
}

function pickLatestPreview(messages){
  var list = Array.isArray(messages) ? messages : [];
  if(!list.length) return { content:'', type:'text' };
  for(var i = list.length - 1; i >= 0; i--){
    var entry = list[i] || {};
    if(entry.hidden) continue;
    return normalizePreviewMessage(entry);
  }
  return normalizePreviewMessage(list[list.length - 1]);
}

// Clamp long character descriptions to keep the widget tidy while showing the tail.
function formatCharSub(text){
  const limit = 36; // clamp to last 36 chars for compact widget
  if(!text) return '';
  return text.length > limit ? '…' + text.slice(-limit) : text;
}

function getPreviewTextForWidget(preview){
  var next = preview && typeof preview === 'object' ? preview : { content:'', type:'text' };
  var kind = normalizeChatPreviewType(next.type || 'text');
  if(kind === 'voice'){
    var duration = Math.max(1, Math.min(60, Math.ceil((next.content || '').length / 6)));
    return '语音消息 ' + duration + "''";
  }
  if(kind === 'image'){
    return '【图片】';
  }
  return next.content || '';
}

function getPreviewStampFromMessages(messages){
  var list = Array.isArray(messages) ? messages : [];
  var lastTs = 0;
  list.forEach(function(entry){
    var ts = Number((entry && (entry.sentAt || entry.readAt)) || 0) || 0;
    if(ts > lastTs) lastTs = ts;
  });
  return lastTs;
}

function setWidgetCharacter(c){
  const displayName = c?.nickname || c?.name || '';
  document.getElementById('wgt-name').textContent = displayName;
  function applyWidgetSub(messages){
    var lastLine = '';
    try{
      var eventPreview = c && c.id ? getWidgetPreview(c.id) : null;
      var latestStamp = getPreviewStampFromMessages(messages);
      if(eventPreview && eventPreview.at >= latestStamp && (eventPreview.content || normalizeChatPreviewType(eventPreview.type || 'text') !== 'text')){
        lastLine = getPreviewTextForWidget(eventPreview);
      }else if(Array.isArray(messages) && messages.length){
        var lastMsg = pickLatestPreview(messages);
        lastLine = getPreviewTextForWidget(lastMsg);
        if(c && c.id && (lastMsg.content || normalizeChatPreviewType(lastMsg.type || 'text') !== 'text')){
          storeWidgetPreview(c.id, {
            content: lastMsg.content || '',
            type: lastMsg.type || 'text',
            at: latestStamp || Date.now()
          });
        }
      }
    }catch(e){}
    var sub = lastLine || c?.description || '';
    document.getElementById('wgt-sub').textContent = formatCharSub(sub);
  }
  applyWidgetSub(c?.id ? getStoredChatMessages(c.id) : []);
  if(c?.id){
    getStoredChatMessagesAsync(c.id).then(function(msgs){
      var active = getActiveCharacterData();
      if(!active || active.id !== c.id) return;
      applyWidgetSub(msgs);
    });
  }
  const avEl = document.getElementById('wgt-avatar');
  if (c?.imageData) {
    avEl.innerHTML = '<img src="'+c.imageData+'" style="width:100%;height:100%;object-fit:cover">';
  } else {
    avEl.textContent = c?.avatar || '✿';
  }
  if(c?.id){
    loadStoredAsset('char_avatar_' + c.id).then((override)=>{
      if(override && override.startsWith('data:')){
        avEl.innerHTML = '<img src="'+override+'" style="width:100%;height:100%;object-fit:cover">';
      }
    });
  }
}

function normalizeUnreadBadgeCount(n){
  if(!n || n < 1) return '';
  return n > 9 ? '9+' : String(n);
}

var qqUnreadCountCache = {};
var qqUnreadRefreshToken = 0;

function getQqUnreadCountForActive(){
  var activeId = '';
  try{
    if(window.AccountManager){
      var active = window.AccountManager.getActive();
      activeId = (active && active.id) || '';
    }
  }catch(e){}
  var chars = [];
  try{
    chars = JSON.parse(localStorage.getItem('characters') || '[]');
    if(!Array.isArray(chars)) chars = [];
  }catch(e){ chars = []; }
  var defaultId = '';
  try{ defaultId = window.AccountManager ? (window.AccountManager.getDefaultId() || '') : ''; }catch(e){ defaultId = ''; }
  chars = chars.map(function(c){
    if(c && typeof c === 'object' && !c.ownerAccountId && defaultId){
      c.ownerAccountId = defaultId;
    }
    return c;
  });
  if(activeId){
    chars = chars.filter(function(c){ return c && c.ownerAccountId === activeId; });
  }
  if(activeId && Object.prototype.hasOwnProperty.call(qqUnreadCountCache, activeId)){
    return Number(qqUnreadCountCache[activeId] || 0) || 0;
  }
  var total = 0;
  chars.forEach(function(c){
    if(!c || !c.id) return;
    try{
      var saved = JSON.parse(localStorage.getItem(mainScopedKey('chat_' + c.id)) || 'null');
      var list = (saved && (saved.messages || saved.history)) || [];
      if(!Array.isArray(list)) return;
      list.forEach(function(m){
        if(m && m.role === 'assistant' && !m.readAt) total++;
      });
    }catch(e){}
  });
  return total;
}

async function refreshQqUnreadCountCache(){
  if(!(window.PhoneStorage && typeof window.PhoneStorage.list === 'function')) return;
  var activeId = '';
  try{
    if(window.AccountManager){
      var active = window.AccountManager.getActive();
      activeId = (active && active.id) || '';
    }
  }catch(e){}
  if(!activeId) return;
  var token = ++qqUnreadRefreshToken;
  try{
    var records = await window.PhoneStorage.list('chats');
    if(token !== qqUnreadRefreshToken) return;
    var suffix = '__acct_' + activeId;
    var total = 0;
    (Array.isArray(records) ? records : []).forEach(function(record){
      if(!record || typeof record !== 'object') return;
      var recordId = String(record.id || '');
      if(recordId.indexOf('chat_') !== 0 || recordId.indexOf(suffix) === -1) return;
      var list = Array.isArray(record.history) ? record.history : [];
      list.forEach(function(m){
        if(m && m.role === 'assistant' && !m.readAt) total++;
      });
    });
    qqUnreadCountCache[activeId] = total;
    renderHomeDockBadges();
  }catch(e){}
}

function renderHomeDockBadges(){
  var qqBtn = document.querySelector('.home-app-btn[data-app="qq"]');
  if(!qqBtn) return;
  var badge = qqBtn.querySelector('.home-app-badge');
  if(!badge){
    badge = document.createElement('span');
    badge.className = 'home-app-badge';
    qqBtn.appendChild(badge);
  }
  var count = getQqUnreadCountForActive();
  if(count > 0){
    badge.textContent = normalizeUnreadBadgeCount(count);
    badge.classList.add('show');
  }else{
    badge.textContent = '';
    badge.classList.remove('show');
  }
}

let aiBgTickTimer = null;
let aiBgRunning = false;

function getAiBgIntervalMs(){
  var min = parseInt(localStorage.getItem(AI_BG_INTERVAL_KEY) || '6', 10);
  if(Number.isNaN(min)) min = 6;
  min = Math.max(1, Math.min(120, min));
  return min * 60 * 1000;
}

async function maybeRunAiBgTick(force){
  if(aiBgRunning) return;
  if(localStorage.getItem(AI_BG_ENABLED_KEY) !== '1') return;
  var now = Date.now();
  var lastAt = parseInt(localStorage.getItem(AI_BG_LAST_AT_KEY) || '0', 10);
  if(!force && now - lastAt < getAiBgIntervalMs()) return;
  aiBgRunning = true;
  try{
    var ok = await runAiBackgroundActivity();
    if(ok){
      localStorage.setItem(AI_BG_LAST_AT_KEY, String(Date.now()));
    }
  }catch(err){
    console.error('[ai-bg] run failed:', err);
  }finally{
    aiBgRunning = false;
  }
}

function setupAiBgScheduler(){
  if(aiBgTickTimer){
    clearInterval(aiBgTickTimer);
    aiBgTickTimer = null;
  }
  aiBgTickTimer = setInterval(function(){
    maybeRunAiBgTick(false);
  }, 20000);
  setTimeout(function(){ maybeRunAiBgTick(false); }, 1200);
}

function restoreState(){
  const safeAreaCover = document.querySelector('.ios-safe-area-cover');
  if(safeAreaCover) safeAreaCover.remove();
  compactCharKey('activeCharacter');
  compactCharKey('pendingChatChar');
  bindTextNormalization();
  renderOfflineMiniLauncher();
  bindHostedServiceWorker();
  syncAppHeight();
  applyPhoneFrameVisibility(getPhoneFrameVisibility(), false);
  bindHomePager();
  bindHomeSlotInput();
  bindCharNoteEditor();
  bindClockLocationEditor();
  bindBondEditors();
  bindBondLinkInputs();
  bindTopSlotPressBehavior();
  bindBondAvatarPressBehavior();
  bindTopFrameEditor();
  bindHomeAppPressState();
  applyLiveDanmakuVisibility(getLiveDanmakuEnabled());
  restoreHomeSlots();
  restoreHomeAppIcons();
  renderCharNote();
  renderClockLocation();
  renderBondDays();
  renderBondBubbles();
  renderPageTwoMiniNote();
  renderBondLinkInputs();
  const wp=localStorage.getItem('wallpaper');
  if(wp==='custom'){
    loadStoredAsset('wallpaper_custom').then((c)=>{
      if(c) setWallpaper(c); else setWallpaper('default');
    });
  } else if(wp) setWallpaper(wp);
  try{ const c = getActiveCharacterData();
    if(c){ setWidgetCharacter(c); }
    renderBondWidget(c);
  }catch(e){}
  renderHomeDockBadges();
  refreshQqUnreadCountCache();
  try{
    homePageIndex = Math.max(0, Math.min(1, Number(localStorage.getItem('home_page_index') || '0') || 0));
  }catch(e){
    homePageIndex = 0;
  }
  renderHomePages(true);
  setupAiBgScheduler();
  try{
    if(sessionStorage.getItem(REFRESH_RECALC_FLAG_KEY) === '1'){
      sessionStorage.removeItem(REFRESH_RECALC_FLAG_KEY);
      [80, 260, 520, 900].forEach(function(delay){
        setTimeout(function(){
          syncAppHeight();
          renderHomePages(true);
        }, delay);
      });
    }
  }catch(e){}
}

window.addEventListener('resize', ()=>{
  syncAppHeight();
  if(!hasSavedPhoneFramePreference()){
    applyPhoneFrameVisibility(getDefaultPhoneFrameVisibility(), false);
  }
});

window.addEventListener('load', ()=>{
  clearHostedRefreshParams();
  syncAppHeight();
  renderHomePages(true);
  bootHostedUpdateCheck();
  var frame = document.getElementById('app-iframe');
  if(frame){
    frame.addEventListener('load', function(){
      applyIframeSafeAreaOverrides();
      setTimeout(applyIframeSafeAreaOverrides, 120);
    });
  }
});

window.addEventListener('pageshow', ()=>{
  syncAppHeight();
  renderHomePages(true);
  setTimeout(function(){
    syncAppHeight();
    renderHomePages(true);
  }, 180);
});

window.addEventListener('orientationchange', ()=>{
  setTimeout(function(){
    stableShellAppHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0) || stableShellAppHeight;
    syncAppHeight();
    renderHomePages(true);
  }, 120);
});

if(window.visualViewport){
  window.visualViewport.addEventListener('resize', ()=>{
    var vv = window.visualViewport;
    var rawBottomOffset = Math.round(vv ? Math.max(0, window.innerHeight - (vv.height + (vv.offsetTop || 0))) : 0);
    var keyboardLikelyOpen = rawBottomOffset > 120;
    syncChatKeyboardShift();
    if(keyboardLikelyOpen) return;
    syncAppHeight();
    renderHomePages(true);
  });
  window.visualViewport.addEventListener('scroll', syncChatKeyboardShift);
}

restoreState();

window.addEventListener('focus', ()=>renderBondWidget());
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden){
    renderBondWidget();
    renderHomeDockBadges();
    refreshQqUnreadCountCache();
    maybeRunAiBgTick(false);
  }
});
window.addEventListener('resize', ()=>renderHomePages(true));
window.addEventListener('resize', syncChatKeyboardShift);
setInterval(()=>{
  renderHomeDockBadges();
  refreshQqUnreadCountCache();
}, 2500);
