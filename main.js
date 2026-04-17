// EPHONE Main OS Logic
const APP_MAP = {
  qq:         { title: 'QQ',             src: 'apps/qq.html', hideTopbar: true },
  chat:       { title: 'Chat',           src: 'apps/chat.html', hideTopbar: true },
  characters: { title: 'Contacts',       src: 'apps/characters.html' },
  settings:   { title: '设置',           src: 'apps/settings.html' },
  customize:  { title: '外观',           src: 'apps/customize.html' },
  worldbook:  { title: '档案',           src: 'apps/worldbook.html' },
  schedule:   { title: '日程',           src: 'apps/schedule.html', hideTopbar: true },
  backend:    { title: '后台',           src: 'apps/backend.html' },
  map6:       { title: '地图',           src: 'apps/map6.html' },
};
const HOME_ICON_DEFAULTS = {
  qq: 'QQ',
  settings: '设置',
  customize: '外观',
  worldbook: '档案',
  offline: '约会',
  schedule: '日程',
  backend: '后台',
  map6: '地图',
};
const PHONE_FRAME_STORAGE_KEY = 'phone_frame_visible';
const LIVE_DANMAKU_DEFAULTS = {
  '1': ['啊啊啊太可爱了','宝宝上线了','今天状态好好'],
  '2': ['蹲到你了','这张也太甜','晚安打卡'],
  '3': ['今日份心动','镜头感满分','路过被可爱到'],
  '4': ['刷到你啦','直播感拉满','小心心掉满屏']
};
const LIVE_DANMAKU_ENABLED_KEY = 'home_live_danmaku_enabled';
const AI_BG_ENABLED_KEY = 'ai_bg_activity_enabled';
const AI_BG_INTERVAL_KEY = 'ai_bg_activity_interval_min';
const AI_BG_LAST_AT_KEY = 'ai_bg_activity_last_at';
const MOMENTS_POSTS_KEY = 'qq_moments_posts';
const WIDGET_TEXT_OVERRIDE_CHAR_KEY = 'widget_text_override_char';
const WIDGET_TEXT_OVERRIDE_USER_KEY = 'widget_text_override_user';
const WIDGET_LAST_CHAT_CHAR_KEY = 'widget_last_chat_char';
const MOMENTS_POSTS_ALT_KEY = 'moments_posts';
const MOMENTS_LAST_SEEN_KEY = 'qq_moments_last_seen';
const WIDGET_CHARACTER_BG_KEY = 'widget_character_bg';
const DEFAULT_MOMENTS_FREQ = 'medium';
const OFFLINE_MINIMIZED_CHAR_KEY = 'offline_minimized_char';
const OFFLINE_LAUNCH_LATEST_KEY = 'offline_launch_latest';
const BACKEND_LOG_STORAGE_KEY = 'backend_runtime_logs_v1';
const BACKEND_LOG_MAX = 1000;
const APP_BUILD_ID = '2026-04-17T23:00:56Z';
const HOME_WIDGET_MINI_ORB_KEY = 'home_widget_mini_orb_image';
const HOME_CLOCK_WIDGET_ART_KEY = 'home_clock_widget_art';
const REFRESH_RECALC_FLAG_KEY = 'refresh_recalc_needed_v1';
const UPDATE_PROMPT_DEDUPE_KEY = 'hosted_update_prompt_dedupe_v1';
const UPDATE_PROMPT_DEDUPE_MS = 8000;
const HOSTED_UPDATE_ACCEPTED_BUILD_KEY = 'hosted_update_accepted_build_v1';
const HOSTED_UPDATE_ACCEPTED_AT_KEY = 'hosted_update_accepted_at_v1';
const HOSTED_UPDATE_LAST_SEEN_REMOTE_KEY = 'hosted_update_last_seen_remote_v1';
const UPDATE_CHECK_THROTTLE_MS = 45 * 1000;
const GITHUB_UPDATE_OWNER = 'xzhu046-ctrl';
const GITHUB_UPDATE_REPO = '615';

const GITHUB_UPDATE_BRANCH = 'main';
const SERVICE_WORKER_PATH = 'sw.js';
const HOME_MUSIC_STATE_KEY = 'home_music_state_v1';
const HOME_MUSIC_TRACK_PREFIX = 'home_music_track_';
const HOME_MUSIC_PROXY_BASE_KEY = 'home_music_proxy_base_v1';
const HOME_MUSIC_PLAY_MODE_KEY = 'home_music_play_mode_v1';
const HOME_MUSIC_FLOATING_ENABLED_KEY = 'home_music_floating_enabled_v1';
const HOME_MUSIC_FLOATING_ICON_KEY = 'home_music_floating_icon_v1';
const HOME_MUSIC_FLOATING_SIZE_KEY = 'home_music_floating_size_v1';
const HOME_MUSIC_THIRD_PARTY_BASE = 'https://api.vkeys.cn/v2/music/tencent';
let persistentStorageRequestStarted = false;
var widgetPreviewCache = {};
let pendingRemoteAppFingerprint = '';
let lastHostedUpdateCheckAt = 0;
let hostedUpdateLockedOpen = false;
let hostedUpdateRetryTimer = 0;
let swControllerRefreshPending = false;
let pendingHostedRefreshBuild = '';
let hostedRefreshInFlight = false;
let shownHostedUpdateFingerprint = '';
let hostedUpdateBootstrapped = false;
let hostedUpdateModalShown = false;
let hostedUpdatePromptDedupeFingerprint = '';
let hostedUpdatePromptDedupeAt = 0;
let hostedUpdateCardPending = false;
let lastHostedUpdateCheckStatus = '';
let chatInputFocusActive = false;
let chatReportedKeyboardShift = 0;
var shellActiveCharacterCache = {};
var shellActiveChatIdCache = {};
var backendLogBroadcastQueued = false;
var shellConsoleBridgeInstalled = false;

function getBackendLogStorageKey(){
  return BACKEND_LOG_STORAGE_KEY;
}

function trimBackendLogText(value, maxLen){
  var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if(!text) return '';
  if(text.length <= maxLen) return text;
  return text.slice(0, Math.max(0, maxLen - 1)) + '…';
}

function summarizeBackendLogDetail(detail){
  if(detail == null) return '';
  if(detail instanceof Error){
    return trimBackendLogText((detail.name || 'Error') + ': ' + (detail.message || ''), 400);
  }
  if(typeof detail === 'string') return trimBackendLogText(detail, 400);
  try{
    return trimBackendLogText(JSON.stringify(detail), 400);
  }catch(err){
    return trimBackendLogText(String(detail), 400);
  }
}

function readBackendLogs(){
  try{
    var raw = localStorage.getItem(getBackendLogStorageKey()) || '[]';
    var list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  }catch(err){
    return [];
  }
}

function writeBackendLogs(logs){
  var safeList = Array.isArray(logs) ? logs.slice(-BACKEND_LOG_MAX) : [];
  try{
    localStorage.setItem(getBackendLogStorageKey(), JSON.stringify(safeList));
    return true;
  }catch(err){
    try{
      localStorage.setItem(getBackendLogStorageKey(), JSON.stringify(safeList.slice(-120)));
      return true;
    }catch(innerErr){
      return false;
    }
  }
}

function sanitizeBackendLogEntry(entry){
  entry = entry && typeof entry === 'object' ? entry : {};
  var level = String(entry.level || 'info').trim().toLowerCase();
  if(level !== 'error' && level !== 'warn') level = 'info';
  return {
    id: String(entry.id || (Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8))),
    ts: Number(entry.ts || Date.now()) || Date.now(),
    level: level,
    app: trimBackendLogText(entry.app || currentApp || 'shell', 32) || 'shell',
    source: trimBackendLogText(entry.source || 'runtime', 80) || 'runtime',
    message: trimBackendLogText(entry.message || entry.text || '(empty)', 240) || '(empty)',
    detail: summarizeBackendLogDetail(entry.detail || '')
  };
}

function broadcastBackendLogUpdate(entry){
  try{
    window.dispatchEvent(new CustomEvent('backend-log-updated', { detail: entry || null }));
  }catch(err){}
  if(backendLogBroadcastQueued) return;
  backendLogBroadcastQueued = true;
  setTimeout(function(){
    backendLogBroadcastQueued = false;
    try{
      var frame = document.getElementById('app-iframe');
      if(frame && frame.contentWindow){
        frame.contentWindow.postMessage({ type:'BACKEND_LOG_UPDATED' }, '*');
      }
    }catch(err){}
  }, 0);
}

function pushBackendLogEntry(entry){
  var safeEntry = sanitizeBackendLogEntry(entry);
  var logs = readBackendLogs();
  logs.push(safeEntry);
  writeBackendLogs(logs);
  broadcastBackendLogUpdate(safeEntry);
  return safeEntry;
}

function clearBackendLogs(){
  try{ localStorage.removeItem(getBackendLogStorageKey()); }catch(err){}
  broadcastBackendLogUpdate(null);
}

function formatBackendConsoleMessage(argsLike){
  return Array.prototype.map.call(argsLike || [], function(part){
    if(part instanceof Error){
      return (part.name || 'Error') + ': ' + (part.message || '');
    }
    if(typeof part === 'string') return part;
    if(typeof part === 'object'){
      try{ return JSON.stringify(part, null, 2); }catch(err){ return String(part); }
    }
    return String(part);
  }).join(' ');
}

function installShellConsoleBridge(){
  if(shellConsoleBridgeInstalled || !window.console) return;
  shellConsoleBridgeInstalled = true;
  ['log', 'info', 'warn', 'error'].forEach(function(method){
    var original = typeof console[method] === 'function' ? console[method].bind(console) : null;
    try{
      console[method] = function(){
        try{
          pushBackendLogEntry({
            level: method === 'error' ? 'error' : (method === 'warn' ? 'warn' : 'info'),
            app: 'shell',
            source: 'console.' + method,
            message: formatBackendConsoleMessage(arguments) || '(empty console ' + method + ')'
          });
        }catch(logErr){}
        if(original) return original.apply(console, arguments);
      };
    }catch(err){}
  });
}

function installBackendLogBridge(targetWindow, appId){
  try{
    if(!targetWindow || targetWindow.__backendLogBridgeInstalled) return;
    Object.defineProperty(targetWindow, '__backendLogBridgeInstalled', {
      value: true,
      configurable: true
    });
    targetWindow.__pushBackendLog = function(entry){
      entry = entry && typeof entry === 'object' ? entry : {};
      pushBackendLogEntry(Object.assign({}, entry, {
        app: entry.app || appId || 'app'
      }));
    };
    var originalConsole = targetWindow.console || {};
    ['log', 'info', 'warn', 'error'].forEach(function(method){
      var original = typeof originalConsole[method] === 'function' ? originalConsole[method].bind(originalConsole) : null;
      try{
        originalConsole[method] = function(){
          var text = formatBackendConsoleMessage(arguments);
          pushBackendLogEntry({
            level: method === 'error' ? 'error' : (method === 'warn' ? 'warn' : 'info'),
            app: appId || 'app',
            source: 'console.' + method,
            message: text || '(empty console ' + method + ')'
          });
          if(original) return original.apply(originalConsole, arguments);
        };
      }catch(err){}
    });
    targetWindow.addEventListener('error', function(evt){
      pushBackendLogEntry({
        level: 'error',
        app: appId || 'app',
        source: 'window.error',
        message: trimBackendLogText((evt && evt.message) || '未知错误', 220) || '未知错误',
        detail: evt && evt.error ? evt.error : ''
      });
    });
    targetWindow.addEventListener('unhandledrejection', function(evt){
      pushBackendLogEntry({
        level: 'error',
        app: appId || 'app',
        source: 'unhandledrejection',
        message: trimBackendLogText(summarizeBackendLogDetail(evt && evt.reason ? evt.reason : 'Promise rejected'), 220) || 'Promise rejected',
        detail: evt && evt.reason ? evt.reason : ''
      });
    });
  }catch(err){
    pushBackendLogEntry({
      level: 'warn',
      app: appId || 'app',
      source: 'bridge.install',
      message: '后台日志桥接失败',
      detail: err
    });
  }
}

window.BackstageRuntime = {
  getLogs: readBackendLogs,
  clearLogs: clearBackendLogs,
  push: pushBackendLogEntry
};

installShellConsoleBridge();

function getTopLevelChatKeyboardShift(){
  var vv = window.visualViewport;
  if(!vv) return 0;
  var viewportHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0) || 0;
  var visibleBottom = Math.round((vv.height || 0) + (vv.offsetTop || 0));
  var inset = Math.max(0, viewportHeight - visibleBottom);
  return inset >= 80 ? Math.min(420, inset) : 0;
}

function getFallbackChatKeyboardShift(){
  try{
    var isTouch = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if(!isTouch) return 0;
  }catch(err){
    return 0;
  }
  return 160;
}

function syncChatKeyboardShift(){
  if(currentApp !== 'chat'){
    setChatKeyboardShift(0);
    return;
  }
  var viewportShift = chatInputFocusActive ? getTopLevelChatKeyboardShift() : 0;
  var reportedShift = Number(chatReportedKeyboardShift) || 0;
  var fallbackShift = chatInputFocusActive ? getFallbackChatKeyboardShift() : 0;
  var next = Math.max(viewportShift, reportedShift, fallbackShift);
  setChatKeyboardShift(next);
}

function offlineMinimizedStorageKey(){
  return mainScopedKey(OFFLINE_MINIMIZED_CHAR_KEY);
}
function latestOfflineLaunchStorageKeyMain(){
  return mainScopedKey(OFFLINE_LAUNCH_LATEST_KEY);
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
    try{ localStorage.removeItem(latestOfflineLaunchStorageKeyMain()); }catch(e){}
    try{ localStorage.removeItem('offline_launch_latest'); }catch(e){}
    setMinimizedOfflineCharId('');
    try{ localStorage.setItem(scopedKeyForAccount('activeOfflineCharacterId', getActiveAccountId()), charId); }catch(e){}
    try{ localStorage.setItem('activeOfflineCharacterId', charId); }catch(e){}
    pendingOpenOfflineCharId = String(charId || '').trim();
    pendingOpenOfflineNonce = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8);
    pendingOpenOfflineLaunchMode = 'resume';
    pendingOpenOfflineLaunchToken = '';
    replaceApp('offline');
  });
  document.body.appendChild(btn);
  return btn;
}

function renderOfflineMiniLauncher(){
  var btn = document.getElementById('offline-mini-launcher-shell');
  if(btn) btn.remove();
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

function getStoredCharactersSnapshot(){
  if(window.MetadataStore && typeof window.MetadataStore.getCharactersSync === 'function'){
    return window.MetadataStore.getCharactersSync();
  }
  try{
    var list = JSON.parse(localStorage.getItem('characters') || '[]');
    return Array.isArray(list) ? list : [];
  }catch(err){
    return [];
  }
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
if(window.MetadataStore && typeof window.MetadataStore.init === 'function'){
  window.MetadataStore.init().catch(function(err){
    console.warn('MetadataStore init failed', err);
  });
}

function shellActiveCharacterStorageId(accountId){
  return 'shell_active_character_' + String(accountId || 'default');
}

function shellActiveChatIdStorageId(accountId){
  return 'shell_active_chat_id_' + String(accountId || 'default');
}

function getShellAccountCacheKey(accountId){
  return String(accountId || getActiveAccountId() || 'default');
}

function hydrateShellActiveCharacterState(){
  var accountId = getActiveAccountId();
  var cacheKey = getShellAccountCacheKey(accountId);
  return Promise.all([
    loadLargeState(shellActiveCharacterStorageId(accountId)),
    loadLargeState(shellActiveChatIdStorageId(accountId))
  ]).then(function(results){
    var charData = results[0];
    var chatId = String(results[1] || '').trim();
    if(charData && typeof charData === 'object' && charData.id){
      shellActiveCharacterCache[cacheKey] = charData;
    }
    if(chatId) shellActiveChatIdCache[cacheKey] = chatId;
    return {
      character: shellActiveCharacterCache[cacheKey] || null,
      chatId: shellActiveChatIdCache[cacheKey] || ''
    };
  }).catch(function(){
    return { character:null, chatId:'' };
  });
}

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

function isRenderableHomeSlotSource(value){
  var text = String(value || '').trim();
  return !!(text && (
    text.startsWith('data:') ||
    text.startsWith('http') ||
    text.startsWith('blob:') ||
    text.startsWith('assets/') ||
    text.startsWith('./') ||
    text.startsWith('/')
  ));
}

function normalizeShellAssetSrc(value){
  var text = String(value || '').trim();
  if(!text) return '';
  if(text.indexOf('assets/') === 0) return 'apps/' + text;
  if(text.indexOf('./assets/') === 0) return 'apps/' + text.slice(2);
  if(text.indexOf('../assets/') === 0) return 'apps/' + text.slice(3);
  return text;
}

function isRenderableShellAvatarSrc(value){
  var text = normalizeShellAssetSrc(value);
  return !!(text && /^(data:|https?:|blob:|\/|\.\.?\/|apps\/)/i.test(text));
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
  hostedUpdatePromptDedupeFingerprint = value;
  hostedUpdatePromptDedupeAt = Date.now();
  try{
    localStorage.setItem(UPDATE_PROMPT_DEDUPE_KEY, JSON.stringify({
      fingerprint: value,
      at: hostedUpdatePromptDedupeAt
    }));
  }catch(e){}
}

function hydrateHostedUpdatePromptDedupe(fingerprint){
  var value = String(fingerprint || '').trim();
  if(!value) return;
  if(hostedUpdatePromptDedupeFingerprint === value && hostedUpdatePromptDedupeAt > 0) return;
  try{
    var raw = localStorage.getItem(UPDATE_PROMPT_DEDUPE_KEY) || '';
    if(!raw) return;
    var parsed = JSON.parse(raw);
    var nextFingerprint = String(parsed && parsed.fingerprint || '').trim();
    var nextAt = Number(parsed && parsed.at || 0) || 0;
    if(!nextFingerprint || !nextAt) return;
    hostedUpdatePromptDedupeFingerprint = nextFingerprint;
    hostedUpdatePromptDedupeAt = nextAt;
  }catch(e){}
}

function shouldSuppressHostedUpdatePrompt(fingerprint){
  var value = String(fingerprint || pendingRemoteAppFingerprint || '').trim();
  if(!value) return false;
  hydrateHostedUpdatePromptDedupe(value);
  if(hostedUpdatePromptDedupeFingerprint !== value) return false;
  var age = Date.now() - (Number(hostedUpdatePromptDedupeAt || 0) || 0);
  return age >= 0 && age < UPDATE_PROMPT_DEDUPE_MS;
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
    localStorage.setItem(HOSTED_UPDATE_ACCEPTED_AT_KEY, String(Date.now()));
  }catch(e){}
}

function getLastSeenHostedRemoteBuild(){
  try{
    return String(localStorage.getItem(HOSTED_UPDATE_LAST_SEEN_REMOTE_KEY) || '').trim();
  }catch(e){
    return '';
  }
}

function setLastSeenHostedRemoteBuild(fingerprint){
  var value = String(fingerprint || '').trim();
  if(!value) return;
  try{
    localStorage.setItem(HOSTED_UPDATE_LAST_SEEN_REMOTE_KEY, value);
  }catch(e){}
}

function clearAcceptedHostedUpdateBuildIfCurrent(){
  var accepted = getAcceptedHostedUpdateBuild();
  if(!accepted || accepted !== APP_BUILD_ID) return;
  try{
    localStorage.removeItem(HOSTED_UPDATE_ACCEPTED_BUILD_KEY);
    localStorage.removeItem(HOSTED_UPDATE_ACCEPTED_AT_KEY);
  }catch(e){}
}

function isAcceptedHostedRemoteBuild(fingerprint){
  var value = String(fingerprint || '').trim();
  if(!value) return false;
  return value === getAcceptedHostedUpdateBuild();
}

function showHostedUpdateCard(){
  if(hostedUpdateModalShown) return;
  var fingerprint = String(pendingRemoteAppFingerprint || getLastSeenHostedRemoteBuild() || '').trim();
  if(shouldSuppressHostedUpdatePrompt(fingerprint)) return;
  var card = document.getElementById('update-toast-card');
  if(!card){
    hostedUpdateCardPending = true;
    return;
  }
  updateHostedUpdateMeta();
  card.hidden = false;
  hostedUpdateCardPending = false;
  hostedUpdateModalShown = true;
  hostedUpdateLockedOpen = true;
  markHostedUpdatePromptShown(fingerprint);
}

function updateHostedUpdateMeta(remoteFingerprint){
  var meta = document.getElementById('update-toast-meta');
  if(!meta) return;
  var remote = String(remoteFingerprint || pendingRemoteAppFingerprint || getLastSeenHostedRemoteBuild() || '').trim();
  var lines = [
    '当前版本：' + APP_BUILD_ID,
    '远端版本：' + (remote || '未读到')
  ];
  if(lastHostedUpdateCheckStatus){
    lines.push('检查状态：' + lastHostedUpdateCheckStatus);
  }
  meta.innerHTML = lines.map(function(line){
    return line.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }).join('<br>');
}

function compareHostedBuildIds(a, b){
  var left = String(a || '').trim();
  var right = String(b || '').trim();
  if(!left && !right) return 0;
  if(!left) return -1;
  if(!right) return 1;
  var leftTime = Date.parse(left);
  var rightTime = Date.parse(right);
  if(Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime){
    return leftTime > rightTime ? 1 : -1;
  }
  if(left === right) return 0;
  return left > right ? 1 : -1;
}

function announceHostedUpdate(fingerprint){
  var nextFingerprint = String(fingerprint || pendingRemoteAppFingerprint || '').trim();
  if(!nextFingerprint) return;
  pendingRemoteAppFingerprint = nextFingerprint;
  if(compareHostedBuildIds(nextFingerprint, APP_BUILD_ID) <= 0) return;
  if(isAcceptedHostedRemoteBuild(nextFingerprint)) return;
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
  hostedUpdateCardPending = false;
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

function readBuildIdFromMainJsText(text){
  try{
    var match = String(text || '').match(/APP_BUILD_ID\s*=\s*['"]([^'"]+)['"]/);
    return String(match && match[1] || '').trim();
  }catch(err){
    return '';
  }
}

function readBuildIdFromServiceWorkerUrl(url){
  try{
    if(!url) return '';
    var parsed = new URL(String(url), window.location.href);
    return String(parsed.searchParams.get('build') || '').trim();
  }catch(err){
    return '';
  }
}

function getNewestServiceWorkerBuild(reg){
  if(!reg) return '';
  var builds = [
    readBuildIdFromServiceWorkerUrl(reg.waiting && reg.waiting.scriptURL),
    readBuildIdFromServiceWorkerUrl(reg.installing && reg.installing.scriptURL),
    readBuildIdFromServiceWorkerUrl(reg.active && reg.active.scriptURL)
  ].filter(Boolean);
  var newest = '';
  builds.forEach(function(build){
    if(!newest || compareHostedBuildIds(build, newest) > 0){
      newest = build;
    }
  });
  return newest;
}

function syncHostedUpdateFromServiceWorker(reg){
  var swBuild = getNewestServiceWorkerBuild(reg);
  if(!swBuild || compareHostedBuildIds(swBuild, APP_BUILD_ID) <= 0){
    return false;
  }
  pendingRemoteAppFingerprint = swBuild;
  setLastSeenHostedRemoteBuild(swBuild);
  if(isAcceptedHostedRemoteBuild(swBuild)){
    lastHostedUpdateCheckStatus = reg && reg.waiting ? '检测到新壳版本' : '检测到新版本';
    updateHostedUpdateMeta(swBuild);
    return true;
  }
  lastHostedUpdateCheckStatus = reg && reg.waiting ? '检测到新壳版本' : '检测到新版本';
  updateHostedUpdateMeta(swBuild);
  announceHostedUpdate(swBuild);
  return true;
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
    },
    function(){
      return fetchJsonWithTimeout('https://cdn.jsdelivr.net/gh/' + GITHUB_UPDATE_OWNER + '/' + GITHUB_UPDATE_REPO + '@' + GITHUB_UPDATE_BRANCH + '/version.json?t=' + stamp, 12000)
        .then(function(data){ return readBuildIdFromVersionPayload(data); });
    },
    function(){
      return fetchTextWithTimeout('https://raw.githubusercontent.com/' + GITHUB_UPDATE_OWNER + '/' + GITHUB_UPDATE_REPO + '/' + GITHUB_UPDATE_BRANCH + '/main.js?t=' + stamp, 12000)
        .then(function(text){ return readBuildIdFromMainJsText(text); });
    },
    function(){
      return fetchTextWithTimeout('https://cdn.jsdelivr.net/gh/' + GITHUB_UPDATE_OWNER + '/' + GITHUB_UPDATE_REPO + '@' + GITHUB_UPDATE_BRANCH + '/main.js?t=' + stamp, 12000)
        .then(function(text){ return readBuildIdFromMainJsText(text); });
    }
  ];
  if(/^https?:$/.test(window.location.protocol)){
    remoteTasks.push(function(){
      return fetchJsonWithTimeout(new URL('version.json?updateCheck=' + stamp, window.location.href).toString(), 15000)
        .then(function(data){ return String(data && data.buildId || '').trim(); });
    });
    remoteTasks.push(function(){
      return fetchTextWithTimeout(new URL('main.js?updateCheck=' + stamp, window.location.href).toString(), 15000)
        .then(function(text){ return readBuildIdFromMainJsText(text); });
    });
  }
  var results = await Promise.all(remoteTasks.map(function(task){
    return Promise.resolve()
      .then(task)
      .then(function(value){ return String(value || '').trim(); })
      .catch(function(err){
        console.warn('[update-check] source skipped', err);
        return '';
      });
  }));
  var newest = '';
  results.forEach(function(value){
    if(!value) return;
    if(!newest || compareHostedBuildIds(value, newest) > 0){
      newest = value;
    }
  });
  if(newest) return newest;
  if(/^https?:$/.test(window.location.protocol)){
    try{
      var sameOriginFingerprint = await fetchJsonWithTimeout(new URL('version.json?updateCheck=' + stamp, window.location.href).toString(), 15000).then(function(data){
        return String(data && data.buildId || '').trim();
      });
      if(sameOriginFingerprint) return sameOriginFingerprint;
    }catch(errSameOrigin){
      console.warn('[update-check] same-origin fallback skipped', errSameOrigin);
    }
    try{
      var sameOriginMainFingerprint = await fetchTextWithTimeout(new URL('main.js?updateCheck=' + stamp, window.location.href).toString(), 15000).then(function(text){
        return readBuildIdFromMainJsText(text);
      });
      if(sameOriginMainFingerprint) return sameOriginMainFingerprint;
    }catch(errSameOriginMain){
      console.warn('[update-check] same-origin main fallback skipped', errSameOriginMain);
    }
  }
  return '';
}

function getRequestedHostedBuild(){
  try{
    var url = new URL(window.location.href);
    var asked = String(url.searchParams.get('__appBuild') || '').trim();
    if(asked && compareHostedBuildIds(asked, APP_BUILD_ID) > 0){
      return asked;
    }
  }catch(err){}
  return '';
}

function getServiceWorkerUrl(buildOverride){
  var build = String(buildOverride || getRequestedHostedBuild() || APP_BUILD_ID).trim() || APP_BUILD_ID;
  return SERVICE_WORKER_PATH + '?build=' + encodeURIComponent(build);
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
    'scheduleShared.js',
    'promptManager.js',
    'accountManager.js',
    'presenceShared.js',
    'sunnySupport.js',
    'manifest.webmanifest',
    'version.json',
    'apps/qq.html',
    'apps/chat.html',
    'apps/schedule.html',
    'apps/map6.html',
    'apps/offline_archive.html'
  ];
  await Promise.all(targets.map(function(path){
    var url = new URL(path || './', window.location.href);
    url.searchParams.set('refreshBuild', String(stamp));
    return fetch(url.toString(), { cache:'reload' }).catch(function(){ return null; });
  }));
}

async function clearHostedUpdateCaches(){
  if(typeof caches !== 'undefined' && caches && typeof caches.keys === 'function'){
    try{
      var names = await caches.keys();
      await Promise.all(names
        .filter(function(name){ return String(name || '').indexOf('phone-shell') === 0; })
        .map(function(name){ return caches.delete(name).catch(function(){ return null; }); }));
    }catch(e){}
  }
}

function bindHostedServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  if(!window.isSecureContext) return;
  navigator.serviceWorker.register(getServiceWorkerUrl(), { updateViaCache:'none' }).then(function(reg){
    var triggerUpdateSignal = function(){
      var handledBySw = syncHostedUpdateFromServiceWorker(reg);
      scheduleHostedUpdateCheck(true);
      if(reg && reg.waiting && !handledBySw){
        var waitingBuild = String(
          readBuildIdFromServiceWorkerUrl(reg.waiting && reg.waiting.scriptURL)
          || pendingRemoteAppFingerprint
          || getLastSeenHostedRemoteBuild()
          || ''
        ).trim();
        if(waitingBuild && compareHostedBuildIds(waitingBuild, APP_BUILD_ID) > 0){
          pendingRemoteAppFingerprint = waitingBuild;
          setLastSeenHostedRemoteBuild(waitingBuild);
          lastHostedUpdateCheckStatus = '检测到新壳版本';
          updateHostedUpdateMeta(waitingBuild);
          if(!isAcceptedHostedRemoteBuild(waitingBuild)){
            announceHostedUpdate(waitingBuild);
          }
        }
      }
    };
    if(reg){
      syncHostedUpdateFromServiceWorker(reg);
      if(reg.waiting){
        triggerUpdateSignal();
      }
      reg.addEventListener('updatefound', function(){
        triggerUpdateSignal();
        var installing = reg.installing;
        if(installing){
          installing.addEventListener('statechange', function(){
            if(installing.state === 'installed' || installing.state === 'activating'){
              triggerUpdateSignal();
            }
          });
        }
      });
      Promise.resolve()
        .then(function(){ return reg.update(); })
        .then(function(){
          syncHostedUpdateFromServiceWorker(reg);
          scheduleHostedUpdateCheck(true);
        })
        .catch(function(err){
          console.warn('[sw] update ping failed', err);
        });
    }
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      syncHostedUpdateFromServiceWorker(reg);
      scheduleHostedUpdateCheck(true);
      if(swControllerRefreshPending){
        swControllerRefreshPending = false;
        var targetBuild = String(pendingHostedRefreshBuild || pendingRemoteAppFingerprint || shownHostedUpdateFingerprint || APP_BUILD_ID).trim() || APP_BUILD_ID;
        pendingHostedRefreshBuild = '';
        hostedUpdateLockedOpen = false;
        pendingRemoteAppFingerprint = '';
        shownHostedUpdateFingerprint = '';
        hostedUpdateModalShown = false;
        try{ sessionStorage.setItem(REFRESH_RECALC_FLAG_KEY, '1'); }catch(e){}
        hideHostedUpdateCard();
        try{
          var nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set('__appBuild', targetBuild);
          nextUrl.searchParams.set('__ts', String(Date.now()));
          window.location.replace(nextUrl.toString());
          return;
        }catch(err){}
        window.location.reload();
      }
    });
    return reg;
  }).catch(function(err){
    console.warn('[sw] register failed', err);
  });
}

async function checkForHostedUpdate(){
  try{
    if(hostedUpdateLockedOpen && pendingRemoteAppFingerprint){
      return;
    }
    var remoteFingerprint = await buildRemoteAppFingerprint();
    if(remoteFingerprint && compareHostedBuildIds(remoteFingerprint, APP_BUILD_ID) > 0){
      lastHostedUpdateCheckStatus = '检测到新版本';
      setLastSeenHostedRemoteBuild(remoteFingerprint);
      if(isAcceptedHostedRemoteBuild(remoteFingerprint)){
        updateHostedUpdateMeta(remoteFingerprint);
        return;
      }
      pendingRemoteAppFingerprint = remoteFingerprint;
      updateHostedUpdateMeta(remoteFingerprint);
      announceHostedUpdate(remoteFingerprint);
      return;
    }
    if(remoteFingerprint && compareHostedBuildIds(remoteFingerprint, APP_BUILD_ID) <= 0){
      lastHostedUpdateCheckStatus = '已是最新';
      setLastSeenHostedRemoteBuild(remoteFingerprint);
      clearAcceptedHostedUpdateBuildIfCurrent();
      if(compareHostedBuildIds(remoteFingerprint, APP_BUILD_ID) < 0){
        try{ localStorage.removeItem(HOSTED_UPDATE_LAST_SEEN_REMOTE_KEY); }catch(e){}
      }
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
    lastHostedUpdateCheckStatus = '未读到远端版本';
    updateHostedUpdateMeta(remoteFingerprint);
  }catch(err){
    lastHostedUpdateCheckStatus = '检查失败';
    updateHostedUpdateMeta('');
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
  var cachedRemoteFingerprint = getLastSeenHostedRemoteBuild();
  updateHostedUpdateMeta(cachedRemoteFingerprint);
  if(cachedRemoteFingerprint && compareHostedBuildIds(cachedRemoteFingerprint, APP_BUILD_ID) > 0 && !isAcceptedHostedRemoteBuild(cachedRemoteFingerprint)){
    pendingRemoteAppFingerprint = cachedRemoteFingerprint;
    announceHostedUpdate(cachedRemoteFingerprint);
  }else if(cachedRemoteFingerprint && compareHostedBuildIds(cachedRemoteFingerprint, APP_BUILD_ID) <= 0){
    try{ localStorage.removeItem(HOSTED_UPDATE_LAST_SEEN_REMOTE_KEY); }catch(e){}
  }
  kickOffHostedUpdateRetries();
  [1200, 3200, 6500, 11000, 18000].forEach(function(delay){
    setTimeout(function(){
      scheduleHostedUpdateCheck(true);
    }, delay);
  });
  window.addEventListener('focus', function(){
    scheduleHostedUpdateCheck(true);
  });
  window.addEventListener('pageshow', function(){
    scheduleHostedUpdateCheck(true);
  });
  window.addEventListener('online', function(){
    scheduleHostedUpdateCheck(true);
  });
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible'){
      scheduleHostedUpdateCheck(true);
    }
  });
}

function refreshInstalledApp(evt){
  if(evt){
    try{ evt.preventDefault(); }catch(e){}
    try{ evt.stopPropagation(); }catch(e){}
  }
  if(hostedRefreshInFlight) return;
  hostedRefreshInFlight = true;
  var refreshBtn = document.getElementById('update-toast-btn');
  if(refreshBtn){
    refreshBtn.disabled = true;
    refreshBtn.textContent = '刷新中...';
  }
  var targetBuild = String(pendingRemoteAppFingerprint || shownHostedUpdateFingerprint || getLastSeenHostedRemoteBuild() || APP_BUILD_ID).trim() || APP_BUILD_ID;
  setAcceptedHostedUpdateBuild(targetBuild);
  markHostedUpdatePromptShown(targetBuild);
  var finishReload = function(){
    swControllerRefreshPending = false;
    hostedRefreshInFlight = false;
    hostedUpdateLockedOpen = false;
    pendingRemoteAppFingerprint = '';
    shownHostedUpdateFingerprint = '';
    hostedUpdateModalShown = false;
    pendingHostedRefreshBuild = '';
    if(refreshBtn){
      refreshBtn.disabled = false;
      refreshBtn.textContent = '刷新';
    }
    try{ sessionStorage.setItem(REFRESH_RECALC_FLAG_KEY, '1'); }catch(e){}
    hideHostedUpdateCard();
    setAcceptedHostedUpdateBuild(String(targetBuild || APP_BUILD_ID).trim() || APP_BUILD_ID);
    markHostedUpdatePromptShown(String(targetBuild || APP_BUILD_ID).trim() || APP_BUILD_ID);
    try{
      var url = new URL(window.location.href);
      url.searchParams.set('__appBuild', String(targetBuild || APP_BUILD_ID));
      url.searchParams.set('__ts', String(Date.now()));
      window.location.replace(url.toString());
      return;
    }catch(err){}
    window.location.reload();
  };
  Promise.resolve()
    .then(function(){ return flushCurrentAppState(); })
    .then(function(){ return clearHostedUpdateCaches(); })
    .then(function(){ return primeLatestCoreFiles(); })
    .then(function(){
      if(!('serviceWorker' in navigator)) return null;
      return navigator.serviceWorker.ready.catch(function(){ return null; }).then(function(readyReg){
        return readyReg || navigator.serviceWorker.getRegistration();
      }).then(function(reg){
        if(!reg) return null;
        var waitingOrKnownBuild = String(
          readBuildIdFromServiceWorkerUrl(reg.waiting && reg.waiting.scriptURL)
          || pendingRemoteAppFingerprint
          || shownHostedUpdateFingerprint
          || getLastSeenHostedRemoteBuild()
          || targetBuild
          || APP_BUILD_ID
        ).trim() || APP_BUILD_ID;
        targetBuild = waitingOrKnownBuild;
        setAcceptedHostedUpdateBuild(targetBuild);
        markHostedUpdatePromptShown(targetBuild);
        if(reg.waiting){
          swControllerRefreshPending = true;
          pendingHostedRefreshBuild = String(targetBuild || readBuildIdFromServiceWorkerUrl(reg.waiting && reg.waiting.scriptURL) || APP_BUILD_ID);
          reg.waiting.postMessage({ type:'SKIP_WAITING' });
          setTimeout(function(){
            if(swControllerRefreshPending){
              finishReload();
            }
          }, 2000);
          return 'waiting';
        }
        return reg.update().then(function(){
          if(reg.waiting){
            swControllerRefreshPending = true;
            pendingHostedRefreshBuild = String(targetBuild || readBuildIdFromServiceWorkerUrl(reg.waiting && reg.waiting.scriptURL) || APP_BUILD_ID);
            reg.waiting.postMessage({ type:'SKIP_WAITING' });
            setTimeout(function(){
              if(swControllerRefreshPending){
                finishReload();
              }
            }, 2000);
            return 'waiting';
          }
          return navigator.serviceWorker.register(getServiceWorkerUrl(targetBuild), { updateViaCache:'none' }).then(function(nextReg){
            if(nextReg && nextReg.waiting){
              swControllerRefreshPending = true;
              pendingHostedRefreshBuild = String(targetBuild || readBuildIdFromServiceWorkerUrl(nextReg.waiting && nextReg.waiting.scriptURL) || APP_BUILD_ID);
              nextReg.waiting.postMessage({ type:'SKIP_WAITING' });
              setTimeout(function(){
                if(swControllerRefreshPending){
                  finishReload();
                }
              }, 2000);
              return 'waiting';
            }
            if(nextReg && nextReg.installing){
              return new Promise(function(resolve){
                var installing = nextReg.installing;
                var settled = false;
                var settle = function(value){
                  if(settled) return;
                  settled = true;
                  resolve(value);
                };
                installing.addEventListener('statechange', function(){
                  if(installing.state === 'installed' && nextReg.waiting){
                    swControllerRefreshPending = true;
                    pendingHostedRefreshBuild = String(targetBuild || readBuildIdFromServiceWorkerUrl(nextReg.waiting && nextReg.waiting.scriptURL) || APP_BUILD_ID);
                    nextReg.waiting.postMessage({ type:'SKIP_WAITING' });
                    setTimeout(function(){
                      if(swControllerRefreshPending){
                        finishReload();
                      }
                    }, 2000);
                    settle('waiting');
                    return;
                  }
                  if(installing.state === 'redundant'){
                    settle('updated');
                  }
                });
                setTimeout(function(){
                  settle('updated');
                }, 2500);
              });
            }
            return 'updated';
          });
        }).catch(function(){ return null; });
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
window.refreshInstalledApp = refreshInstalledApp;
window.compareHostedBuildIds = compareHostedBuildIds;
window.announceHostedUpdate = announceHostedUpdate;
window.buildRemoteAppFingerprint = buildRemoteAppFingerprint;
window.checkForHostedUpdate = checkForHostedUpdate;

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
  ['1','2','3','4'].forEach((slotId)=>{
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
  const label = HOME_ICON_DEFAULTS[app] || app;
  document.querySelectorAll('[data-app="' + app + '"]').forEach((btn)=>{
    if(!btn) return;
    if(typeof icon === 'string' && icon.startsWith('data:')){
      btn.classList.add('has-custom-icon');
      btn.innerHTML = '<span class="home-app-icon-wrap"><img class="home-app-icon-img" src="' + icon + '" alt="' + label + '"></span><span class="home-app-label">' + label + '</span>';
      return;
    }
    btn.classList.remove('has-custom-icon');
    btn.innerHTML = '<span class="home-app-icon-wrap home-app-icon-fallback"><span class="home-app-fallback-text">' + label + '</span></span><span class="home-app-label">' + label + '</span>';
  });
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
  var imageData = String(c.imageData || '').trim();
  if(/^data:/i.test(imageData)) imageData = '';
  var userPersonaProfile = String(c.userPersonaProfile || '');
  if(userPersonaProfile.length > 240) userPersonaProfile = '';
  return {
    id:c.id, name:c.name, nickname:c.nickname, avatar:c.avatar,
    imageData:imageData,
    msgMin:c.msgMin, msgMax:c.msgMax,
    chatRenderPageSize:c.chatRenderPageSize,
    contextWindow:c.contextWindow,
    summaryEvery:c.summaryEvery,
    manualSummarySize:c.manualSummarySize,
    memoryMergeThreshold:c.memoryMergeThreshold,
    autoSummaryEnabled:c.autoSummaryEnabled,
    translationEnabled:!!c.translationEnabled,
    replyLanguage:String(c.replyLanguage||c.language||'zh'),
    translationMode:String(c.translationMode||'ondemand'),
    allowNarrator:c.allowNarrator !== false,
    avatarVisionEnabled:!!c.avatarVisionEnabled,
    charAvatarAutoEnabled:!!c.charAvatarAutoEnabled,
    chatSignature:String(c.chatSignature||''),
    userNameProfile:String(c.userNameProfile||''),
    userNicknameNote:String(c.userNicknameNote||''),
    userPersonaProfile:userPersonaProfile
  };
}

function cacheAvatar(c){
  try{
    if(c?.id && c.imageData && /^(data:|https?:|blob:|\/|\.\.?\/|assets\/)/i.test(String(c.imageData || '').trim())){
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

function isGlobalAiBgEnabled(){
  try{
    return localStorage.getItem(AI_BG_ENABLED_KEY) === '1';
  }catch(e){}
  return false;
}

function getCharBgOverride(charId, accountId){
  if(!charId) return null;
  try{
    var scoped = localStorage.getItem(charBgEnabledKeyForAccount(charId, accountId));
    if(scoped !== null) return scoped !== '0';
    var legacy = localStorage.getItem('char_bg_activity_enabled_' + charId);
    if(legacy !== null) return legacy !== '0';
  }catch(e){}
  return null;
}

function isCharBgEnabled(charId, accountId){
  if(!charId) return isGlobalAiBgEnabled();
  var override = getCharBgOverride(charId, accountId);
  if(override === null) return isGlobalAiBgEnabled();
  return !!override;
}

function hasAnyAiBgActivityEnabled(accountId){
  if(isGlobalAiBgEnabled()) return true;
  var chars = getStoredCharactersSnapshot();
  return chars.some(function(c){
    var ownerId = c && c.ownerAccountId ? c.ownerAccountId : accountId;
    return !!(c && c.id && ownerId === accountId && getCharBgOverride(c.id, accountId) === true);
  });
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

function normalizeShellMomentsFreq(value){
  var v = String(value || '').toLowerCase();
  if(v === 'low' || v === 'high' || v === 'medium') return v;
  return DEFAULT_MOMENTS_FREQ;
}

function loadShellCharMomentsFreq(charId, accountId){
  charId = String(charId || '').trim();
  if(!charId) return DEFAULT_MOMENTS_FREQ;
  try{
    var scoped = scopedKeyForAccount('char_moments_freq_' + charId, accountId || getActiveAccountId());
    return normalizeShellMomentsFreq(localStorage.getItem(scoped) || localStorage.getItem('char_moments_freq_' + charId) || DEFAULT_MOMENTS_FREQ);
  }catch(err){
    return DEFAULT_MOMENTS_FREQ;
  }
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

async function getBackgroundCharacter(){
  var defaultId = getDefaultAccountId();
  if(!defaultId) return null;
  var chars = getStoredCharactersSnapshot();
  chars.forEach(function(c){
    if(c && !c.ownerAccountId) c.ownerAccountId = defaultId;
  });
  var owned = chars.filter(function(c){ return c && c.ownerAccountId === defaultId; });
  var enabledOwned = owned.filter(function(c){ return isCharBgEnabled(c.id, defaultId); });
  if(!enabledOwned.length) return null;
  var active = null;
  try{
    active = JSON.parse(
      localStorage.getItem(scopedKeyForAccount('activeCharacter', defaultId))
      || localStorage.getItem('activeCharacter')
      || 'null'
    );
  }catch(e){ active = null; }
  if(active && active.id){
    var found = enabledOwned.find(function(c){ return c.id === active.id; });
    if(found) return Object.assign({}, found, active);
  }
  var latest = null;
  for(var i = 0; i < enabledOwned.length; i++){
    var candidate = enabledOwned[i];
    var history = await readBackgroundChatHistory(candidate.id, defaultId);
    var last = Array.isArray(history) && history.length ? history[history.length - 1] : null;
    var ts = Number(last && (last.sentAt || last.readAt || 0)) || 0;
    if(!latest || ts > latest.ts){
      latest = { ts: ts, character: candidate };
    }
  }
  return latest && latest.character ? latest.character : (enabledOwned[0] || null);
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
    try{ localStorage.setItem(key, JSON.stringify(Array.isArray(posts) ? posts : [])); }catch(ignoreErr){}
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
    if(act === '打电话' || act === '来电' || act === 'voice_call') act = 'call';
    if(act === 'message' || act === 'say' || act === 'dynamic' || act === 'call'){
      return {
        action: act,
        content: content || (act === 'message' ? '刚刚想到你了。' : (act === 'call' ? '忽然很想听听你的声音。' : '想把这一刻记下来。')),
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

function summarizeBgConversationState(history){
  var list = Array.isArray(history) ? history.filter(Boolean) : [];
  if(!list.length){
    return {
      waitingForReply: false,
      unreadAssistantCount: 0,
      lastRole: '',
      lastUserAt: 0,
      lastAssistantAt: 0,
      lastAnyAt: 0,
      idleMs: 0
    };
  }
  var now = Date.now();
  var unreadAssistantCount = 0;
  var lastUserAt = 0;
  var lastAssistantAt = 0;
  for(var i = 0; i < list.length; i++){
    var item = list[i] || {};
    var ts = Number(item.sentAt || item.readAt || 0) || 0;
    if(item.role === 'user') lastUserAt = Math.max(lastUserAt, ts);
    if(item.role === 'assistant'){
      lastAssistantAt = Math.max(lastAssistantAt, ts);
      if(!item.readAt) unreadAssistantCount += 1;
    }
  }
  var last = list[list.length - 1] || {};
  var lastAnyAt = Number(last.sentAt || last.readAt || 0) || Math.max(lastUserAt, lastAssistantAt, 0);
  return {
    waitingForReply: !!(lastUserAt && lastUserAt > lastAssistantAt),
    unreadAssistantCount: unreadAssistantCount,
    lastRole: String(last.role || ''),
    lastUserAt: lastUserAt,
    lastAssistantAt: lastAssistantAt,
    lastAnyAt: lastAnyAt,
    idleMs: lastAnyAt ? Math.max(0, now - lastAnyAt) : 0
  };
}

function coerceBgAction(parsed, convoState){
  var next = Object.assign({}, parsed || {});
  var waitingForReply = !!(convoState && convoState.waitingForReply);
  var unreadAssistantCount = Math.max(0, Number(convoState && convoState.unreadAssistantCount) || 0);
  var idleMs = Math.max(0, Number(convoState && convoState.idleMs) || 0);
  if(waitingForReply){
    next.action = 'message';
    return next;
  }
  if(next.action === 'call'){
    if(unreadAssistantCount > 0){
      next.action = 'message';
      return next;
    }
    if(idleMs && idleMs < 25 * 60 * 1000){
      next.action = 'message';
      return next;
    }
    return next;
  }
  if(unreadAssistantCount >= 2 && next.action === 'message'){
    next.action = Math.random() < 0.7 ? 'say' : 'dynamic';
    return next;
  }
  if(idleMs >= 2 * 60 * 60 * 1000 && next.action !== 'message'){
    next.action = 'message';
    return next;
  }
  return next;
}

function getCharacterAvatarForBg(character){
  if(character && character.imageData){
    var current = normalizeShellAssetSrc(character.imageData);
    if(isRenderableShellAvatarSrc(current)) return current;
  }
  var id = character && character.id ? character.id : '';
  if(id){
    try{
      var saved = normalizeShellAssetSrc(localStorage.getItem('char_avatar_' + id) || '');
      if(isRenderableShellAvatarSrc(saved)) return saved;
    }catch(e){}
  }
  if(character && character.avatar){
    var av = normalizeShellAssetSrc(character.avatar);
    if(isRenderableShellAvatarSrc(av)) return av;
  }
  return '';
}

function shouldSuppressChatNotification(charId){
  if(currentApp !== 'chat') return false;
  var foreground = getCurrentForegroundCharacter();
  return !!(foreground && String(foreground.id || '') === String(charId || ''));
}

var SHELL_NOTIFY_ENABLED_KEY = 'shell_notify_enabled';
var SHELL_NOTIFY_APP_NAME_KEY = 'shell_notify_app_name';
var SHELL_NOTIFY_VIBRATION_ENABLED_KEY = 'shell_notify_vibration_enabled';
var SHELL_NOTIFY_VIBRATION_PATTERN_KEY = 'shell_notify_vibration_pattern';
var SHELL_NOTIFY_NOTIFY_IN_CHAT_KEY = 'shell_notify_in_chat_page';
var SHELL_NOTIFY_DISABLE_INTERNAL_KEY = 'shell_notify_disable_internal';
var SHELL_NOTIFY_SETTINGS_RECORD_ID = 'shell_notify_settings';
var shellNotificationSettingsCache = null;

function normalizeShellNotificationSettings(raw){
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: raw.enabled == null ? true : !!raw.enabled,
    appName: String(raw.appName || raw.displayName || localStorage.getItem(SHELL_NOTIFY_APP_NAME_KEY) || '0615').trim() || '0615',
    vibrationEnabled: raw.vibrationEnabled == null
      ? (localStorage.getItem(SHELL_NOTIFY_VIBRATION_ENABLED_KEY) == null ? true : localStorage.getItem(SHELL_NOTIFY_VIBRATION_ENABLED_KEY) === '1')
      : !!raw.vibrationEnabled,
    vibrationPattern: String(raw.vibrationPattern || localStorage.getItem(SHELL_NOTIFY_VIBRATION_PATTERN_KEY) || 'medium').trim() || 'medium',
    notifyInChat: raw.notifyInChat == null ? localStorage.getItem(SHELL_NOTIFY_NOTIFY_IN_CHAT_KEY) === '1' : !!raw.notifyInChat,
    disableInternal: raw.disableInternal == null ? localStorage.getItem(SHELL_NOTIFY_DISABLE_INTERNAL_KEY) === '1' : !!raw.disableInternal
  };
}

async function hydrateShellNotificationSettingsCache(){
  try{
    if(window.PhoneStorage && typeof window.PhoneStorage.get === 'function'){
      var record = await window.PhoneStorage.get('kv', SHELL_NOTIFY_SETTINGS_RECORD_ID).catch(function(){ return null; });
      if(record && typeof record === 'object'){
        shellNotificationSettingsCache = normalizeShellNotificationSettings(record.value || record.data || record.settings || {});
        return shellNotificationSettingsCache;
      }
    }
  }catch(err){}
  shellNotificationSettingsCache = normalizeShellNotificationSettings(null);
  return shellNotificationSettingsCache;
}

function getShellNotificationSettings(){
  if(shellNotificationSettingsCache) return normalizeShellNotificationSettings(shellNotificationSettingsCache);
  return normalizeShellNotificationSettings(null);
}

function getShellNotificationVibration(pattern){
  var key = String(pattern || '').trim();
  if(key === 'short') return [160];
  if(key === 'long') return [220, 90, 220, 90, 220];
  return [180, 70, 180];
}

function getShellNotificationIcon(){
  try{
    return new URL('./apps/assets/海边小屋.webp', window.location.href).toString();
  }catch(err){
    return './apps/assets/海边小屋.webp';
  }
}

function triggerShellNotificationVibration(pattern){
  try{
    if(typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    var pulse = Array.isArray(pattern) && pattern.length ? pattern : getShellNotificationVibration(getShellNotificationSettings().vibrationPattern);
    navigator.vibrate(pulse);
    return true;
  }catch(err){
    return false;
  }
}

async function resolveShellNotificationAvatar(charId, preferredAvatar){
  var direct = normalizeShellAssetSrc(preferredAvatar || '');
  if(isRenderableShellAvatarSrc(direct)) return direct;
  var id = String(charId || '').trim();
  if(!id) return '';
  var candidates = [];
  var foreground = getCurrentForegroundCharacter();
  if(foreground && String(foreground.id || '') === id) candidates.push(foreground);
  if(persistedShellActiveCharacter && String(persistedShellActiveCharacter.id || '') === id) candidates.push(persistedShellActiveCharacter);
  getStoredCharactersSnapshot().forEach(function(item){
    if(item && String(item.id || '') === id) candidates.push(item);
  });
  for(var idx = 0; idx < candidates.length; idx += 1){
    var src = getCharacterAvatarForBg(candidates[idx]);
    if(isRenderableShellAvatarSrc(src)) return src;
  }
  try{
    var stored = await loadStoredAsset('char_avatar_' + id).catch(function(){ return ''; });
    stored = normalizeShellAssetSrc(stored || '');
    if(isRenderableShellAvatarSrc(stored)) return stored;
  }catch(err){}
  try{
    var scopedKey = '';
    try{
      if(window.AccountManager && typeof window.AccountManager.scopedKey === 'function'){
        scopedKey = String(window.AccountManager.scopedKey('char_avatar_' + id) || '').trim();
      }
    }catch(err){}
    var mirrored = normalizeShellAssetSrc((scopedKey ? localStorage.getItem(scopedKey) : '') || localStorage.getItem('char_avatar_' + id) || '');
    if(isRenderableShellAvatarSrc(mirrored)) return mirrored;
  }catch(err){}
  return '';
}

function getShellNotificationPermissionInfo(){
  var permission = (typeof Notification !== 'undefined' && Notification && Notification.permission) ? Notification.permission : 'unsupported';
  return {
    permission: permission,
    granted: permission === 'granted',
    supported: permission !== 'unsupported'
  };
}

async function ensureShellNotificationPermission(){
  try{
    if(typeof window === 'undefined' || !('Notification' in window)) return false;
    if(Notification.permission === 'granted') return true;
    if(Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  }catch(err){
    return false;
  }
}

async function showSystemShellNotification(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  try{
    var settings = getShellNotificationSettings();
    if(payload.force !== true && !settings.enabled){
      pushBackendLogEntry({
        level: 'info',
        app: 'shell',
        source: 'notify.skip',
        message: '系统通知已关闭，跳过发送'
      });
      return false;
    }
    if(!(await ensureShellNotificationPermission())){
      pushBackendLogEntry({
        level: 'warn',
        app: 'shell',
        source: 'notify.permission',
        message: '系统通知权限未通过'
      });
      return false;
    }
    var appName = String(settings.appName || '0615').trim() || '0615';
    var senderName = String(payload.name || '角色').trim() || '角色';
    var title = String(payload.title || (appName + ' - ' + senderName)).trim() || appName;
    var text = String(payload.text || '').trim() || '有新动静';
    var app = String(payload.app || 'chat').trim() || 'chat';
    var charId = String(payload.charId || '').trim();
    var heroAvatar = normalizeShellAssetSrc(payload.avatar || '');
    var notifyData = {
      type: 'shell-app-notify',
      app: app,
      charId: charId,
      name: senderName,
      text: text
    };
    var options = {
      body: text,
      icon: getShellNotificationIcon(),
      badge: getShellNotificationIcon(),
      tag: 'shell-' + app + '-' + (charId || 'generic') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      requireInteraction: true,
      renotify: true,
      vibrate: settings.vibrationEnabled ? getShellNotificationVibration(settings.vibrationPattern) : [],
      silent: false,
      timestamp: Date.now(),
      actions: [
        { action: 'open', title: '打开' },
        { action: 'dismiss', title: '关闭' }
      ],
      data: notifyData
    };
    if(isRenderableShellAvatarSrc(heroAvatar) && String(heroAvatar).length < 120000){
      options.image = heroAvatar;
    }
    var shown = false;
    if(typeof navigator !== 'undefined' && 'serviceWorker' in navigator){
      try{
        var reg = await navigator.serviceWorker.ready.catch(function(){ return null; });
        if(reg && typeof reg.showNotification === 'function'){
          await reg.showNotification(title, options);
          shown = true;
        }
      }catch(err){
        pushBackendLogEntry({
          level: 'error',
          app: 'shell',
          source: 'notify.service_worker',
          message: 'Service Worker 系统通知发送失败',
          detail: err
        });
        console.warn('[shell-notify] service worker notification failed', err);
      }
    }
    if(!shown && typeof Notification !== 'undefined' && Notification.permission === 'granted'){
      try{
        var fallback = new Notification(title, options);
        fallback.onclick = function(){
          try{ openShellNotificationPayload(notifyData); }catch(err){}
          try{ fallback.close(); }catch(err){}
        };
        shown = true;
      }catch(err){
        pushBackendLogEntry({
          level: 'error',
          app: 'shell',
          source: 'notify.constructor',
          message: 'Notification 构造器发送失败',
          detail: err
        });
        console.warn('[shell-notify] notification constructor failed', err);
      }
    }
    if(shown && settings.vibrationEnabled){
      triggerShellNotificationVibration(options.vibrate);
    }
    if(shown){
      pushBackendLogEntry({
        level: 'info',
        app: 'shell',
        source: 'notify.sent',
        message: '系统通知已发送',
        detail: {
          app: app,
          charId: charId,
          title: title
        }
      });
    }
    return shown;
  }catch(err){
    pushBackendLogEntry({
      level: 'error',
      app: 'shell',
      source: 'notify.fail',
      message: '系统通知发送异常',
      detail: err
    });
    console.warn('[shell-notify] system notification failed', err);
    return false;
  }
}

function maybeShowShellActivityNotification(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var kind = String(payload.kind || '').trim();
  var charId = String(payload.charId || '').trim();
  var text = String(payload.text || '').trim();
  var settings = getShellNotificationSettings();
  if(!settings.enabled) return;
  if(!kind || !text) return;
  if(kind === 'chat' && shouldSuppressChatNotification(charId) && !settings.notifyInChat) return;
  if(kind === 'schedule' && currentApp === 'schedule') return;
  if(kind === 'moments' && currentApp === 'qq') return;
  var chars = getStoredCharactersSnapshot();
  var character = chars.find(function(item){ return item && String(item.id || '') === charId; }) || null;
  var name = String((character && (character.nickname || character.name)) || payload.name || '角色').trim() || '角色';
  var appName = kind === 'moments' ? 'moments' : (kind === 'schedule' ? 'schedule' : 'chat');
  Promise.resolve(resolveShellNotificationAvatar(charId, payload.avatar || getCharacterAvatarForBg(character || { id: charId }) || ''))
    .catch(function(){ return ''; })
    .then(function(avatar){
      if(!settings.disableInternal){
        showAppNotificationCard({
          app: appName,
          charId: charId,
          name: name,
          avatar: avatar,
          text: text
        });
      }
      pushBackendLogEntry({
        level: 'info',
        app: appName,
        source: 'notify.queue',
        message: name + ' 有新的' + (kind === 'moments' ? '朋友圈' : (kind === 'schedule' ? '日程动态' : '消息')),
        detail: text
      });
      showSystemShellNotification({
        app: appName,
        charId: charId,
        name: name,
        avatar: avatar,
        text: text
      }).catch(function(){});
    });
}

async function testShellNotification(kind){
  var type = String(kind || 'chat').trim() || 'chat';
  var activeCharId = String((getCurrentForegroundCharacter() && getCurrentForegroundCharacter().id) || (persistedShellActiveCharacter && persistedShellActiveCharacter.id) || '');
  var avatar = await resolveShellNotificationAvatar(activeCharId, '').catch(function(){ return ''; });
  var payload = {
    kind: type === 'moments' ? 'moments' : (type === 'schedule' ? 'schedule' : 'chat'),
    charId: activeCharId,
    name: '测试角色',
    text: type === 'schedule' ? '刚刚改了一条日程' : (type === 'moments' ? '刚刚发了一条朋友圈' : '给你发来了一条新消息')
  };
  var settings = getShellNotificationSettings();
  if(!settings.disableInternal){
    showAppNotificationCard({
      app: payload.kind === 'moments' ? 'moments' : (payload.kind === 'schedule' ? 'schedule' : 'chat'),
      charId: payload.charId,
      name: payload.name,
      avatar: avatar,
      text: payload.text
    });
  }
  return showSystemShellNotification({
    app: payload.kind === 'moments' ? 'moments' : (payload.kind === 'schedule' ? 'schedule' : 'chat'),
    charId: payload.charId,
    name: payload.name,
    avatar: avatar,
    text: payload.text,
    force: true
  });
}

window.notificationManager = {
  init: async function(){
    try{
      if(typeof navigator !== 'undefined' && navigator.serviceWorker){
        await navigator.serviceWorker.ready.catch(function(){ return null; });
      }
      return true;
    }catch(err){
      return false;
    }
  },
  checkPermission: async function(){
    return getShellNotificationPermissionInfo();
  },
  requestPermission: async function(){
    return ensureShellNotificationPermission();
  },
  showNotification: async function(title, options){
    options = options && typeof options === 'object' ? options : {};
    return showSystemShellNotification({
      title: title,
      name: options.name || title || '角色',
      text: options.body || options.text || '有新消息',
      charId: options.charId || '',
      avatar: options.avatar || options.icon || '',
      app: options.app || 'chat',
      force: true
    });
  },
  notifyNewMessage: async function(chatName, messageContent, chatId){
    var avatar = await resolveShellNotificationAvatar(chatId, '').catch(function(){ return ''; });
    return showSystemShellNotification({
      title: (getShellNotificationSettings().appName || '0615') + ' - ' + String(chatName || '角色'),
      name: chatName,
      text: messageContent,
      charId: chatId,
      avatar: avatar,
      app: 'chat',
      force: true
    });
  },
  notifySystem: async function(message){
    return showSystemShellNotification({
      title: getShellNotificationSettings().appName || '0615',
      name: getShellNotificationSettings().appName || '0615',
      text: message,
      app: 'chat',
      force: true
    });
  },
  testNotification: async function(){
    return testShellNotification('chat');
  },
  getPermissionStatus: function(){
    var permission = getShellNotificationPermissionInfo();
    return {
      permission: permission.permission,
      granted: permission.granted,
      initialized: true
    };
  }
};

async function debugShellNotification(){
  var settings = getShellNotificationSettings();
  var permission = getShellNotificationPermissionInfo();
  return [
    '[shell-notify-debug]',
    'enabled=' + settings.enabled,
    'appName=' + settings.appName,
    'vibrationEnabled=' + settings.vibrationEnabled,
    'vibrationPattern=' + settings.vibrationPattern,
    'notifyInChat=' + settings.notifyInChat,
    'disableInternal=' + settings.disableInternal,
    'permission=' + permission.permission,
    'currentApp=' + String(currentApp || ''),
    'foregroundChar=' + String((getCurrentForegroundCharacter() && getCurrentForegroundCharacter().id) || '')
  ].join('\n');
}

async function appendBackgroundAiMessage(character, accountId, content){
  if(!character || !character.id) return false;
  if(!isCharBgEnabled(character.id, accountId || getDefaultAccountId())) return false;
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
  renderHomeDockBadges();
  try{
    var f = document.getElementById('app-iframe');
    if(f && f.contentWindow){
      f.contentWindow.postMessage({ type:'BACKGROUND_AI_MESSAGE', payload:{ charId: character.id, entry: entry } }, '*');
    }
  }catch(e){}
  maybeShowShellActivityNotification({
    kind:'chat',
    charId: character.id,
    text: String(entry.content || '').trim()
  });
  return true;
}

async function appendBackgroundMoment(character, accountId, action, content, imageText){
  if(!character || !character.id) return false;
  if(!isCharBgEnabled(character.id, accountId || getDefaultAccountId())) return false;
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
    authorAvatar: aiAvatar,
    charId: String((character && character.id) || ''),
    translationEnabled: !!(character && character.translationEnabled),
    replyLanguage: String((character && (character.replyLanguage || character.language)) || 'zh'),
    translationMode: String((character && character.translationMode) || 'ondemand')
  });
  await writeBackgroundMoments(accountId, posts);
  renderHomeDockBadges();
  maybeShowShellActivityNotification({
    kind:'moments',
    charId: character.id,
    text: action === 'dynamic' ? '发了一条新动态' : '发了一条新说说'
  });
  return true;
}

function buildBackgroundReplyLanguagePrompt(character){
  var enabled = !!(character && character.translationEnabled);
  var language = String((character && (character.replyLanguage || character.language)) || 'zh').trim().toLowerCase();
  if(!enabled || !language || language === 'zh') return '';
  var labels = {
    en:'English',
    fr:'Francais',
    ja:'日本语',
    ko:'한국어',
    yue:'广东话',
    de:'Deutsch'
  };
  var label = labels[language] || language;
  return [
    '【语言模式】',
    '所有面向用户可见的正文都使用' + label + '原文。',
    '不要额外附上中文翻译，不要解释你正在使用哪种语言。'
  ].join('\n');
}

function getScheduleWorldbookContext(){
  var data = {};
  try{
    if(window.MetadataStore && typeof window.MetadataStore.getWorldbooksSync === 'function'){
      data = window.MetadataStore.getWorldbooksSync() || {};
    }else{
      data = JSON.parse(localStorage.getItem('worldbooks') || '{}') || {};
    }
  }catch(err){
    data = {};
  }
  var lines = [];
  var seen = {};
  function pushLine(title, content){
    var safeTitle = String(title || '').trim();
    var safeContent = String(content || '').trim();
    if(!safeContent) return;
    var key = (safeTitle + '::' + safeContent).slice(0, 220);
    if(seen[key]) return;
    seen[key] = true;
    lines.push((safeTitle ? (safeTitle + '：') : '') + safeContent);
  }
  function walk(node, fallbackTitle){
    if(!node) return;
    if(Array.isArray(node)){
      node.forEach(function(item){ walk(item, fallbackTitle); });
      return;
    }
    if(typeof node !== 'object') return;
    var title = String(node.title || node.name || node.label || fallbackTitle || '').trim();
    if(typeof node.content === 'string'){
      pushLine(title, node.content);
    }
    if(Array.isArray(node.entries)) walk(node.entries, title);
    if(Array.isArray(node.books)) walk(node.books, title);
    if(Array.isArray(node.items)) walk(node.items, title);
    if(node.data && typeof node.data === 'object') walk(node.data, title);
  }
  Object.keys(data || {}).forEach(function(key){
    walk(data[key], key);
  });
  return lines.slice(0, 18).join('\n').slice(0, 2600);
}

function getScheduleUserName(charId){
  var safeId = String(charId || '').trim();
  if(safeId){
    try{
      var chars = getStoredCharactersSnapshot();
      var hit = Array.isArray(chars) ? chars.find(function(item){ return item && String(item.id || '').trim() === safeId; }) : null;
      var embedded = String((hit && hit.userNameProfile) || '').trim();
      if(embedded) return embedded;
    }catch(err){}
  }
  var activeId = getActiveAccountId();
  var scoped = scopedKeyForAccount('user_name_' + safeId, activeId);
  var scopedValue = String(localStorage.getItem(scoped) || localStorage.getItem('user_name_' + safeId) || '').trim();
  if(scopedValue) return scopedValue;
  if(safeId) return 'USER';
  return String(localStorage.getItem('user_name') || 'USER').trim() || 'USER';
}

function getScheduleUserPersona(charId){
  var safeId = String(charId || '').trim();
  if(safeId){
    try{
      var chars = getStoredCharactersSnapshot();
      var hit = Array.isArray(chars) ? chars.find(function(item){ return item && String(item.id || '').trim() === safeId; }) : null;
      var embedded = String((hit && hit.userPersonaProfile) || '').trim();
      if(embedded) return embedded;
    }catch(err){}
  }
  try{
    var active = window.AccountManager && window.AccountManager.getActive ? window.AccountManager.getActive() : null;
    if(active && !active.isDefault) return '';
  }catch(err){}
  if(safeId){
    var activeId = getActiveAccountId();
    var scoped = scopedKeyForAccount('user_persona_' + safeId, activeId);
    var scopedValue = String(localStorage.getItem(scoped) || localStorage.getItem('user_persona_' + safeId) || '').trim();
    if(scopedValue) return scopedValue;
    return '';
  }
  return String(localStorage.getItem('user_persona') || '').trim();
}

function getSchedulePresenceContext(character){
  if(!(window.PresenceShared && character && character.id && typeof window.PresenceShared.getPresenceSnapshot === 'function')) return '';
  try{
    var snapshot = window.PresenceShared.getPresenceSnapshot(character, Date.now());
    if(!(snapshot && snapshot.char && snapshot.user)) return '';
    var userLabel = String(snapshot.user.label || '').trim() || String(snapshot.user.cityId || '').trim() || '用户所在城市';
    var charCityName = snapshot.char.city && snapshot.char.city.name ? String(snapshot.char.city.name).trim() : '';
    var charCountry = snapshot.char.city && snapshot.char.city.country ? String(snapshot.char.city.country).trim() : '';
    var charPlace = String(snapshot.char.placeLabel || '').trim();
    var charActivity = String(snapshot.char.activityLabel || '').trim();
    var charClock = String(snapshot.char.localTimeLabel || '').trim();
    var distanceLabel = String(snapshot.distanceLabel || '').trim();
    var sameCity = !!(snapshot.user.cityId && snapshot.char.city && snapshot.char.city.id && String(snapshot.user.cityId) === String(snapshot.char.city.id));
    var lines = [
      '用户当前地理位置：' + userLabel,
      '角色当前地理位置：' + [charCountry, charCityName, charPlace].filter(Boolean).join(' · '),
      charClock ? ('角色当前当地时间：' + charClock) : '',
      charActivity ? ('角色当前状态：' + charActivity) : '',
      distanceLabel ? ('双方距离：' + distanceLabel) : ''
    ].filter(Boolean);
    if(charCityName){
      lines.push('今天所有地点、行动距离感、移动方式，都必须锁定在这个角色当前所在城市或它合理的附近区域：' + [charCountry, charCityName].filter(Boolean).join(' · ') + '。不要无故跳到别的省市国家，更不要把东京写成江西这种完全无关的地点。');
    }
    if(sameCity || Number(snapshot.travel && snapshot.travel.distanceKm || 0) < 35){
      lines.push('双方当前就在同城/同地范围。默认按本地活动距离来写，不要再写买飞机票、坐飞机飞来、跨城跨国赶来这种异地剧情。');
    }
    if(snapshot.travel && Number(snapshot.travel.distanceKm || 0) >= 8){
      lines.push('如果双方距离明显不近，就不要乱写“已经在用户家里 / 顺路到她家 / 送她回家 / 站在她楼下”这种已经同处一地的剧情，除非用户当天公开行程明确写了见面、接送、同城同行。地点、互动距离感、移动方式都必须服从这里的地理设定。');
    }
    return lines.join('\n');
  }catch(err){
    return '';
  }
}

function buildScheduleWeatherPresenceContext(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var user = payload.userWeather && typeof payload.userWeather === 'object' ? payload.userWeather : null;
  var char = payload.charWeather && typeof payload.charWeather === 'object' ? payload.charWeather : null;
  if(!(user || char)) return '';
  function displayPlace(setting, fallback){
    if(!(setting && typeof setting === 'object')) return String(fallback || '').trim();
    return String(setting.aliasName || '').trim() || String(setting.realName || '').trim() || String(setting.resolvedName || '').trim() || String(fallback || '').trim();
  }
  var lines = [
    user ? ('用户当前显示地理位置：' + displayPlace(user, '用户所在城市')) : '',
    char ? ('角色当前显示地理位置：' + displayPlace(char, '角色所在城市')) : ''
  ].filter(Boolean);
  if(user && String(user.timezone || '').trim()){
    lines.push('用户当前当地时区：' + String(user.timezone || '').trim());
  }
  if(char && String(char.timezone || '').trim()){
    lines.push('角色当前当地时区：' + String(char.timezone || '').trim());
  }
  if(user && char){
    var userPlace = displayPlace(user, '');
    var charPlace = displayPlace(char, '');
    var sameCountry = !!String(user.country || '').trim() && String(user.country || '').trim() === String(char.country || '').trim();
    var sameCity = !!(String(user.cityId || '').trim() && String(char.cityId || '').trim() && String(user.cityId || '').trim() === String(char.cityId || '').trim());
    if(user.aliasName || char.aliasName){
      lines.push('如果设置里同时存在真实定位城市和显示城市，所有会展示给用户看的地点名称一律使用显示城市，不要说出真实定位城市名。');
    }
    if(sameCity){
      lines.push('双方当前就在同一个城市。默认按同城/本地活动来写，不要再写买机票、坐飞机、飞过来、跨城赶来这种异地剧情。');
    }
    if(userPlace && charPlace && userPlace !== charPlace){
      lines.push('双方当前不在同一个城市。除非用户当天公开日程明确写了见面或同行，否则不要写成已经见面、同住、一起吃饭、一起散步、顺路接送、在她家、在他家这种同地实体互动。');
    }
    if(!sameCountry){
      lines.push('双方当前甚至不在同一个国家，默认只能写远程互动、想念、寄东西、准备票这类跨地区互动，不要硬写现实碰面。');
    }
  }
  return lines.join('\n');
}

function loadScheduleWeatherSettingByCharId(role, charId){
  var safeRole = role === 'char' ? 'char' : 'user';
  var safeCharId = String(charId || '').trim();
  if(!safeCharId) return null;
  var baseKey = (safeRole === 'char' ? 'real_weather_char_' : 'real_weather_user_') + safeCharId;
  var keys = [scopedKeyForAccount(baseKey, getActiveAccountId()), baseKey].filter(Boolean);
  for(var i = 0; i < keys.length; i++){
    try{
      var raw = localStorage.getItem(keys[i]);
      if(!raw) continue;
      var parsed = JSON.parse(raw);
      if(parsed && typeof parsed === 'object') return parsed;
    }catch(err){}
  }
  return null;
}

function buildSchedulePresenceContextForCharId(charId, character){
  var payload = {
    userWeather: loadScheduleWeatherSettingByCharId('user', charId),
    charWeather: loadScheduleWeatherSettingByCharId('char', charId)
  };
  var weatherText = buildScheduleWeatherPresenceContext(payload);
  if(weatherText) return weatherText;
  return getSchedulePresenceContext(character);
}

function getScheduleLocalClockParts(nowMs, timezoneName, timezoneOffset){
  var safeNow = Number(nowMs || Date.now()) || Date.now();
  var safeName = String(timezoneName || '').trim();
  function fromParts(parts){
    var year = parseInt(parts.year || '0', 10) || 0;
    var month = parseInt(parts.month || '0', 10) || 0;
    var day = parseInt(parts.day || '0', 10) || 0;
    var hour = parseInt(parts.hour || '0', 10) || 0;
    var minute = parseInt(parts.minute || '0', 10) || 0;
    return {
      dateKey: year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
      nowTime: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0')
    };
  }
  if(safeName){
    try{
      var partMap = {};
      new Intl.DateTimeFormat('en-CA', {
        timeZone: safeName,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(new Date(safeNow)).forEach(function(part){
        if(part.type !== 'literal') partMap[part.type] = part.value;
      });
      return fromParts(partMap);
    }catch(err){}
  }
  var shifted = new Date(safeNow + (Number(timezoneOffset || 0) || 0) * 3600000);
  return fromParts({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes()
  });
}

function buildScheduleLocalNowContextForCharacter(character, nowMs){
  var safeNow = Number(nowMs || Date.now()) || Date.now();
  if(!(window.PresenceShared && character && character.id && typeof window.PresenceShared.getPresenceSnapshot === 'function')){
    var fallbackNow = new Date(safeNow);
    var fallbackDateKey = window.ScheduleShared ? window.ScheduleShared.toDateKey(fallbackNow) : '';
    var fallbackTime = String(fallbackNow.getHours()).padStart(2, '0') + ':' + String(fallbackNow.getMinutes()).padStart(2, '0');
    return {
      user: { dateKey: fallbackDateKey, nowTime: fallbackTime },
      char: { dateKey: fallbackDateKey, nowTime: fallbackTime },
      presence: null
    };
  }
  var snapshot = window.PresenceShared.getPresenceSnapshot(character, safeNow);
  var user = snapshot && snapshot.user ? snapshot.user : {};
  var charPresence = snapshot && snapshot.char ? snapshot.char : {};
  var userOffset = 0;
  try{
    if(user.cityId && typeof window.PresenceShared.getCity === 'function'){
      userOffset = Number((window.PresenceShared.getCity(user.cityId) || {}).tz || 0) || 0;
    }
  }catch(err){}
  return {
    user: getScheduleLocalClockParts(safeNow, user.timezone, userOffset),
    char: getScheduleLocalClockParts(safeNow, charPresence.timezoneName, charPresence.timezoneOffset),
    presence: snapshot || null
  };
}

function normalizeScheduleTimelineItems(items){
  return (Array.isArray(items) ? items : []).map(function(item){
    item = item && typeof item === 'object' ? item : {};
    return {
      id: String(item.id || ('timeline_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7))),
      start: String(item.start || item.time || '').trim(),
      end: String(item.end || '').trim(),
      title: String(item.title || '').trim(),
      note: String(item.note || '').trim(),
      location: String(item.location || '').trim(),
      kind: String(item.kind || 'char').trim() || 'char',
      secret: !!item.secret,
      secretPassword: String(item.secretPassword || '').replace(/\D+/g, '').slice(0, 4),
      secretHint: String(item.secretHint || '').trim(),
      publicMask: String(item.publicMask || item.maskedTitle || '').trim(),
      comments: Array.isArray(item.comments) ? item.comments.map(function(comment){
        comment = comment && typeof comment === 'object' ? comment : {};
        return {
          id: String(comment.id || ('comment_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7))),
          author: String(comment.author || comment.role || 'char').trim() || 'char',
          text: String(comment.text || comment.content || '').trim(),
          createdAt: Number(comment.createdAt || Date.now()) || Date.now()
        };
      }).filter(function(comment){ return comment.text; }) : []
    };
  }).filter(function(item){
    return item.start || item.title || item.note;
  });
}

function normalizeScheduleQuoteDrafts(items){
  return (Array.isArray(items) ? items : []).map(function(item){
    item = item && typeof item === 'object' ? item : {};
    return {
      id: String(item.id || ('quote_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7))),
      title: String(item.title || '').trim(),
      excerpt: String(item.excerpt || '').trim(),
      reply: String(item.reply || '').trim(),
      sourceId: String(item.sourceId || '').trim(),
      sourceType: String(item.sourceType || '').trim()
    };
  }).filter(function(item){
    return item.title || item.excerpt || item.reply;
  }).slice(0, 4);
}

function parseScheduleDayResult(raw, payload){
  var txt = cleanBgJson(raw);
  var parsed = null;
  try{ parsed = JSON.parse(txt); }catch(err){}
  parsed = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    date: String((parsed.date || payload.dateKey) || '').trim() || String(payload.dateKey || ''),
    diary: String(parsed.diary || parsed.dayDiary || '').trim(),
    calendarNote: String(parsed.calendarNote || parsed.calendar_note || '').trim(),
    comment: String(parsed.comment || parsed.todoComment || '').trim(),
    generatedAt: Date.now(),
    timeline: normalizeScheduleTimelineItems(parsed.timeline || parsed.schedule || []),
    todos: (Array.isArray(parsed.todos || parsed.todoList) ? (parsed.todos || parsed.todoList) : []).map(function(item){
      item = item && typeof item === 'object' ? item : {};
      return {
        id: String(item.id || ('chartodo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7))),
        text: String(item.text || item.title || '').trim(),
        note: String(item.note || '').trim(),
        done: !!item.done,
        comments: Array.isArray(item.comments) ? item.comments.map(function(comment){
          comment = comment && typeof comment === 'object' ? comment : {};
          return {
            id: String(comment.id || ('comment_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7))),
            author: String(comment.author || comment.role || 'char').trim() || 'char',
            text: String(comment.text || comment.content || '').trim(),
            createdAt: Number(comment.createdAt || Date.now()) || Date.now()
          };
        }).filter(function(comment){ return comment.text; }) : []
      };
    }).filter(function(item){ return item.text; }),
    quoteDrafts: normalizeScheduleQuoteDrafts(parsed.quoteDrafts || parsed.chatQuotes || [])
  };
}

function isScheduleLocationTooGeneric(location){
  var text = String(location || '').trim();
  if(!text) return true;
  var normalized = text.replace(/\s+/g, '');
  if(normalized.length <= 2) return true;
  return /^(家里|家中|家附近|外面|学校|校园|公司|办公室|食堂|教室|图书馆|宿舍|路上|路边|地铁上|公交上|商场|超市|咖啡店|餐厅)$/.test(normalized);
}

function isScheduleEventNoteTooWeak(item){
  item = item && typeof item === 'object' ? item : {};
  var note = String(item.note || '').trim();
  var title = String(item.title || '').trim();
  var location = String(item.location || '').trim();
  if(!note) return true;
  var normalizedNote = note.replace(/\s+/g, '');
  var normalizedTitle = title.replace(/\s+/g, '');
  var normalizedLocation = location.replace(/\s+/g, '');
  if(normalizedNote.length < 5) return true;
  if(normalizedNote === normalizedTitle) return true;
  if(normalizedLocation && normalizedNote === normalizedLocation) return true;
  return false;
}

function getScheduleOtherCharacterNames(currentCharId){
  var safeCurrent = String(currentCharId || '').trim();
  var seen = {};
  var names = [];
  try{
    var chars = getStoredCharactersSnapshot();
    (Array.isArray(chars) ? chars : []).forEach(function(item){
      if(!item) return;
      var id = String(item.id || '').trim();
      if(!id || id === safeCurrent) return;
      [item.nickname, item.name].forEach(function(raw){
        var text = String(raw || '').trim();
        if(!text || seen[text]) return;
        seen[text] = true;
        names.push(text);
      });
    });
  }catch(err){}
  return names;
}

function isScheduleFarDistance(character){
  if(!(window.PresenceShared && character && character.id && typeof window.PresenceShared.getPresenceSnapshot === 'function')) return false;
  try{
    var snapshot = window.PresenceShared.getPresenceSnapshot(character, Date.now());
    return !!(snapshot && snapshot.travel && Number(snapshot.travel.distanceKm || 0) >= 8);
  }catch(err){}
  return false;
}

function getScheduleWeatherDistanceKm(user, char){
  if(!(user && char)) return 0;
  var lat1 = Number(user.latitude);
  var lon1 = Number(user.longitude);
  var lat2 = Number(char.latitude);
  var lon2 = Number(char.longitude);
  if(!isFinite(lat1) || !isFinite(lon1) || !isFinite(lat2) || !isFinite(lon2)) return 0;
  var toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad;
  var dLon = (lon2 - lon1) * toRad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function hasForbiddenOtherCharReference(item, otherNames){
  var text = [
    String(item && item.title || ''),
    String(item && item.note || ''),
    String(item && item.location || '')
  ].join(' ');
  return (Array.isArray(otherNames) ? otherNames : []).some(function(name){
    return name && text.indexOf(name) !== -1;
  });
}

function hasInvalidDistantInteraction(item){
  var text = [
    String(item && item.title || ''),
    String(item && item.note || ''),
    String(item && item.location || '')
  ].join(' ');
  return /(住一起|同住|同居|在她家|在他家|在你家|在我家|一起吃(?:饭|午饭|晚饭)|一起散步|面对面|顺路接|送她回家|送他回家|见面了|已经见到|当面|楼下等|一起通勤)/.test(text);
}

function getSchedulePresenceLocaleGuard(character, payload){
  var allowed = [];
  var otherNames = [];
  function pushToken(value){
    value = String(value || '').trim();
    if(!value || value.length < 2) return;
    if(allowed.indexOf(value) === -1) allowed.push(value);
  }
  function pushOtherName(value){
    value = String(value || '').trim();
    if(!value || value.length < 2) return;
    if(otherNames.indexOf(value) === -1) otherNames.push(value);
  }
  payload = payload && typeof payload === 'object' ? payload : {};
  var userWeather = payload.userWeather && typeof payload.userWeather === 'object' ? payload.userWeather : null;
  var charWeather = payload.charWeather && typeof payload.charWeather === 'object' ? payload.charWeather : null;
  if(userWeather || charWeather){
    [userWeather, charWeather].forEach(function(setting){
      if(!(setting && typeof setting === 'object')) return;
      pushToken(setting.aliasName);
      pushToken(setting.realName);
      pushToken(setting.resolvedName);
      pushToken(setting.admin1);
      pushToken(setting.country);
    });
  }else if(window.PresenceShared && character && character.id && typeof window.PresenceShared.getPresenceSnapshot === 'function'){
    try{
      var snapshot = window.PresenceShared.getPresenceSnapshot(character, Date.now());
      if(snapshot && snapshot.user && snapshot.char){
        pushToken(snapshot.user.label);
        pushToken(snapshot.user.weatherName);
        try{
          if(snapshot.user.cityId && typeof window.PresenceShared.getCity === 'function'){
            var userCity = window.PresenceShared.getCity(snapshot.user.cityId);
            pushToken(userCity && userCity.name);
            pushToken(userCity && userCity.country);
          }
        }catch(err){}
        pushToken(snapshot.char.city && snapshot.char.city.name);
        pushToken(snapshot.char.city && snapshot.char.city.country);
        pushToken(snapshot.char.placeLabel);
      }
    }catch(err){}
  }
  try{
    var chars = getStoredCharactersSnapshot();
    (Array.isArray(chars) ? chars : []).forEach(function(item){
      if(!item || String(item.id || '').trim() === String(character && character.id || '').trim()) return;
      pushOtherName(item.nickname || item.name);
      pushOtherName(item.name);
    });
  }catch(err){}
  var farDistance = false;
  if(userWeather && charWeather){
    farDistance = getScheduleWeatherDistanceKm(userWeather, charWeather) >= 8;
    if(!farDistance){
      var userPlace = String(userWeather.aliasName || userWeather.realName || userWeather.resolvedName || '').trim();
      var charPlace = String(charWeather.aliasName || charWeather.realName || charWeather.resolvedName || '').trim();
      if(userPlace && charPlace && userPlace !== charPlace) farDistance = true;
      if(String(userWeather.country || '').trim() && String(charWeather.country || '').trim() && String(userWeather.country || '').trim() !== String(charWeather.country || '').trim()) farDistance = true;
    }
  }else{
    farDistance = isScheduleFarDistance(character);
  }
  return { allowed: allowed, otherNames: otherNames, farDistance: farDistance };
}

function textHasForeignLocaleDrift(text, guard){
  text = String(text || '').trim();
  guard = guard && typeof guard === 'object' ? guard : null;
  if(!text || !(guard && Array.isArray(guard.allowed) && guard.allowed.length)) return false;
  var allowed = guard.allowed;
  var watched = [
    '中国','Canada','加拿大','USA','美国','Japan','日本','Tokyo','东京','Beijing','北京','Shanghai','上海',
    'Seoul','首尔','Korea','韩国','Edmonton','埃德蒙顿','Calgary','卡尔加里','Vancouver','温哥华','Toronto','多伦多'
  ];
  var mentioned = watched.filter(function(token){
    return token && text.indexOf(token) !== -1;
  });
  if(!mentioned.length) return false;
  return mentioned.some(function(token){
    return !allowed.some(function(ok){
      ok = String(ok || '').trim();
      return ok && (ok.indexOf(token) !== -1 || token.indexOf(ok) !== -1);
    });
  });
}

function scheduleDayPlanNeedsRepair(result, character, payload){
  var guard = getSchedulePresenceLocaleGuard(character, payload);
  var timeline = Array.isArray(result && result.timeline) ? result.timeline : [];
  var todos = Array.isArray(result && result.todos) ? result.todos : [];
  return timeline.some(function(item){
    var text = [item && item.title, item && item.note, item && item.location].filter(Boolean).join(' ');
    return (!!guard && textHasForeignLocaleDrift(text, guard))
      || hasForbiddenOtherCharReference(item, guard && guard.otherNames)
      || (!!(guard && guard.farDistance) && hasInvalidDistantInteraction(item));
  }) || todos.some(function(item){
    var text = [item && item.text, item && item.note].filter(Boolean).join(' ');
    return (!!guard && textHasForeignLocaleDrift(text, guard))
      || hasForbiddenOtherCharReference(item, guard && guard.otherNames);
  });
}

async function repairGeneratedScheduleDayPlan(cfg, userPrompt, result, character, payload){
  var guard = getSchedulePresenceLocaleGuard(character, payload);
  var sysPrompt = [
    '你正在修正一份角色当日日程 JSON。',
    '只返回严格 JSON，不要 markdown，不要解释。',
    '保持原来的人设和大方向，只修正地理位置、距离感、互动方式。',
    '地点、寄送对象、互动方式必须服从现实地理位置设定；不要无故跳到别的国家城市。',
    (guard && guard.farDistance) ? '如果双方现实很远，严禁写成已经见面、一起吃饭、在对方家里、接送、面对面互动。' : '',
    guard && guard.allowed && guard.allowed.length ? ('这次允许出现的地点语境只有：' + guard.allowed.join('、') + '。') : '',
    guard && guard.otherNames && guard.otherNames.length ? ('绝对不要提到这些别的角色名字：' + guard.otherNames.join('、') + '。') : ''
  ].filter(Boolean).join('\n');
  var repairPrompt = [
    userPrompt,
    '下面是需要修正的结果：',
    JSON.stringify(result || {})
  ].join('\n\n');
  try{
    var raw = await callAiForBackground(cfg, sysPrompt, repairPrompt);
    return parseScheduleDayResult(raw, { dateKey: result && result.date });
  }catch(err){
    return result;
  }
}

function needsUserDayPlanPolish(result, guard){
  var events = Array.isArray(result && result.events) ? result.events : [];
  if(!events.length) return true;
  return events.some(function(item){
    return isScheduleLocationTooGeneric(item && item.location)
      || isScheduleEventNoteTooWeak(item)
      || hasForbiddenOtherCharReference(item, guard && guard.otherNames)
      || (!!(guard && guard.farDistance) && hasInvalidDistantInteraction(item));
  });
}

async function polishGeneratedUserDayPlan(cfg, userPrompt, result, guard){
  var current = result && typeof result === 'object' ? result : { events:[], todos:[] };
  var sysPrompt = [
    '你正在修正一份用户日程 JSON。',
    '只返回严格 JSON，不要 markdown，不要解释。',
    '格式：{"events":[{"start":"08:30","end":"09:20","title":"...","note":"...","location":"...","visibleToChar":true,"publicMask":"","secretHint":"","secretPassword":""}],"todos":[{"text":"...","note":"...","done":false,"remindEnabled":false,"remindAt":""}]}',
    '不要推翻整天安排，只修正不够细的 location 和不够像小解释的 note。',
    '每条 event 都必须有更具体的地点 location，不能只是学校、图书馆、公司、家里这种大类地点。',
    '每条 event 的 note 都必须是一句小解释，说明这段安排正在做什么、为什么这样排、或者这件事背后的心思，不能留空，也不能只重复 title 或 location。',
    '自动生成的用户行程一律公开，不允许秘密行程。',
    Array.isArray(guard && guard.otherNames) && guard.otherNames.length ? ('绝对不要提到这些别的角色名字：' + guard.otherNames.join('、') + '。') : '',
    guard && guard.farDistance ? '双方现实位置很远，所以严禁写成住一起、同住、面对面见面、一起吃饭、一起散步、顺路接送这些同地互动。' : ''
  ].join('\n');
  var repairPrompt = [
    userPrompt,
    '下面是第一次生成出来的结果，请在不改变这一天大方向的前提下把 location 和 note 修细：',
    JSON.stringify(current)
  ].join('\n\n');
  try{
    var repairedRaw = await callAiForBackground(cfg, sysPrompt, repairPrompt);
    var repairedTxt = String(repairedRaw || '').replace(/^```[a-zA-Z]*\s*/,'').replace(/```$/,'').trim();
    var repaired = JSON.parse(repairedTxt);
    repaired = repaired && typeof repaired === 'object' ? repaired : {};
    return {
      events: Array.isArray(repaired.events) ? repaired.events : current.events,
      todos: Array.isArray(repaired.todos) ? repaired.todos : current.todos
    };
  }catch(err){
    return current;
  }
}

async function generateScheduleDayPlan(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var charId = String(payload.charId || '').trim();
  if(!charId) throw new Error('缺少角色');
  var chars = getStoredCharactersSnapshot();
  var character = chars.find(function(item){ return item && String(item.id || '') === charId; }) || null;
  var payloadChar = payload.charSnapshot && typeof payload.charSnapshot === 'object' ? payload.charSnapshot : null;
  if(payloadChar && String(payloadChar.id || '') === charId){
    character = Object.assign({}, character || {}, payloadChar);
  }
  if(!character) throw new Error('找不到角色');
  var cfg = getBackgroundProviderConfig();
  if(!cfg) throw new Error('请先在设置里配置模型');
  var dateKey = String(payload.dateKey || '').trim();
  var dateObj = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? new Date(dateKey + 'T12:00:00') : new Date();
  var weekday = ['周日','周一','周二','周三','周四','周五','周六'][dateObj.getDay()];
  var eventLines = (Array.isArray(payload.events) ? payload.events : []).map(function(item){
    var hidden = item && item.visibleToChar === false;
    return [
      String(item.start || '').trim() || '未设时间',
      hidden ? (String(item.publicMask || '').trim() || '这个时间段有安排') : String(item.title || '').trim(),
      hidden ? '这是用户没有公开细节的安排' : String(item.location || '').trim(),
      hidden ? '' : String(item.note || '').trim(),
      hidden ? '只知道这个时间段忙，不能擅自知道具体内容' : (item.remindChar ? '用户希望你记住并提醒' : '')
    ].filter(Boolean).join(' | ');
  });
  var todoLines = (Array.isArray(payload.todos) ? payload.todos : []).map(function(item){
    return [
      item.done ? '已完成' : '待做',
      String(item.text || '').trim(),
      String(item.note || '').trim()
    ].filter(Boolean).join(' | ');
  });
  var specialLines = []
    .concat((Array.isArray(payload.specialDates) ? payload.specialDates : []).map(function(item){
      return [String(item.title || '').trim(), String(item.note || '').trim()].filter(Boolean).join(' | ');
    }))
    .concat((Array.isArray(payload.holidays) ? payload.holidays : []).map(function(item){
      return [String(item.title || '').trim(), String(item.note || '').trim()].filter(Boolean).join(' | ');
    }));
  var sysPrompt = [
    '你正在生成一个日程 app 里的角色当日日程。',
    '只返回严格 JSON，不要 markdown，不要解释。',
    'JSON 结构：{"date":"YYYY-MM-DD","diary":"...","calendarNote":"...","comment":"...","timeline":[{"start":"08:30","end":"09:20","title":"...","note":"...","location":"...","secret":false,"publicMask":"","secretHint":"","secretPassword":""}],"todos":[{"text":"...","note":"...","done":false}],"quoteDrafts":[{"title":"待办引用","excerpt":"...","reply":"...","sourceType":"todo|event","sourceId":"..."}]}',
    '所有字段都必须使用简体中文输出，不要夹英文标题，不要夹外语对白，也不要因为角色语言设置改成别的语言。',
    '语言固定是简体中文，但行程安排、语气、态度、细节、作息风格必须服从角色人设。',
    'timeline 是现实里会发生的一天，至少 6 条，不设上限。每条都要带一个尽量具体的地点 location 和一句简短 note。地点不要只写“家里”“外面”“学校”“公司”，要更像真人会去的落点，比如“图书馆三楼自习区”“宿舍楼下便利店”“公司楼下咖啡店靠窗那排”。',
    '如果位置设置里同时有真实定位城市和显示城市，location 一律写显示城市语境下的地点，不要把真实定位城市名直接写出来。',
    'todos 是这个角色今天自己心里或手边会记着的待办，至少 3 条，不设上限，语气和内容都按人设来。',
    '如果角色这一天有不想直接说开的安排，允许最多生成 1 条 secret=true 的秘密行程；这种时候 title/note 仍然写真实内容，同时额外提供 publicMask（给对方看到的模糊标题，比如“有点私事”）、secretHint（很短的密码线索，必须真的和 secretPassword 有关，比如“是今天的日期”“末尾两位”这类）和 secretPassword（严格 4 位数字密码）。如果没有秘密行程，就把这些字段留空。',
    'diary 是角色今天的一句日记，要有人设感。',
    'calendarNote 是写在日历边上的一句留言。',
    'comment 是角色看见用户待办或行程后的点评。',
    'quoteDrafts 只有在值得主动提起时才返回，最多 2 条，reply 要像聊天里会发出去的话。'
  ].join('\n');
  var userPrompt = [
    '日期：' + dateKey + ' ' + weekday,
    '角色名：' + String(character.nickname || character.name || '角色'),
    '角色人设：' + String(character.personality || character.description || '').slice(0, 2000),
    character.scenario ? ('角色情境：' + String(character.scenario || '').slice(0, 900)) : '',
    character.system_prompt ? ('角色系统约束：' + String(character.system_prompt || '').slice(0, 900)) : '',
    getScheduleWorldbookContext() ? ('世界书摘要：\n' + getScheduleWorldbookContext()) : '',
    '用户名字：' + String(payload.userName || getScheduleUserName(charId) || 'USER'),
    String(payload.userPersona || getScheduleUserPersona(charId) || '').trim() ? ('用户设定：' + String(payload.userPersona || getScheduleUserPersona(charId) || '').trim().slice(0, 900)) : '',
    buildScheduleWeatherPresenceContext(payload) ? ('现实地理位置 / 距离感：\n' + buildScheduleWeatherPresenceContext(payload)) : (getSchedulePresenceContext(character) ? ('现实地理位置 / 距离感：\n' + getSchedulePresenceContext(character)) : ''),
    '务必同时认真读取角色人设和用户设定，再决定今天的安排、互动方式和对用户生活状态的理解，不要脱离双方设定乱写。',
    '先直接读懂用户完整设定里的身份、生活状态、作息、处境和日常节奏，再决定和用户有关的互动方式，不要用死板标签套人设。',
    '角色今天的安排可以自然地和用户有关，但要服从现实距离和关系状态：异地可以是远程一起吃饭、寄东西、偷偷准备车票/机票；同城或住一起才可以出现接送、一起吃饭、顺手照顾之类的互动，而且要自然，不要刻意硬塞。',
    '如果现实距离明显很远，就严格禁止写成已经见面、一起吃午饭、一起散步、在她家、送她回家、顺路接她、一起通勤、面对面说话这种同地实体互动；最多写成远程互动、准备票、惦记、寄东西、约之后再见。只有用户当天公开日程明确写了见面/出行/同城同行，才允许写实体见面。',
    '如果双方现实位置很远，宁可写成互相惦记、远程一起做同一件事，也不要偷写现实碰面。',
    '严格时间感知总开关：' + (payload.globalTimeAwareness === false ? '关闭' : '开启'),
    '这个角色的时间感知覆盖：' + (payload.charOverride && payload.charOverride.timeAwarenessEnabled === false ? '关闭' : '开启'),
    specialLines.length ? ('当天节日 / 纪念日：\n- ' + specialLines.join('\n- ')) : '当天没有额外节日或纪念日。',
    eventLines.length ? ('用户当天写下的日程：\n- ' + eventLines.join('\n- ')) : '用户当天没有额外公开日程。',
    todoLines.length ? ('用户当天待办：\n- ' + todoLines.join('\n- ')) : '用户当天没有额外待办。',
    '请像真人一样安排这一天：有人认真规划，有人拖延熬夜，有人松弛散漫，都按人设来。',
    '今天的安排里应该自然能看出他和用户之间的联系、牵挂、互动、准备或关照，但要服从双方人设、关系状态、现实距离和当天公开安排，不要机械凑数，也不要像在完成任务。',
    '如果用户有行程或待办，可以在 comment 或 quoteDrafts 里自然地关心、提醒、吃醋、吐槽，但不要脱离人设。'
  ].filter(Boolean).join('\n\n');
  var raw = await callAiForBackground(cfg, sysPrompt, userPrompt);
  var result = parseScheduleDayResult(raw, payload);
  if(scheduleDayPlanNeedsRepair(result, character, payload)){
    result = await repairGeneratedScheduleDayPlan(cfg, userPrompt, result, character, payload);
  }
  if(!result.timeline.length) throw new Error('没有生成出有效时间轴');
  if(!result.diary) result.diary = '今天像被轻轻摁住的一页纸，直到最后还是有一点在想你。';
  return result;
}

async function sendScheduleQuote(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var charId = String(payload.charId || '').trim();
  if(!charId) return false;
  var now = Date.now();
  var accountIds = [];
  function pushAccountId(id){
    id = String(id || '').trim();
    if(!id) return;
    if(accountIds.indexOf(id) === -1) accountIds.push(id);
  }
  pushAccountId(getActiveAccountId());
  pushAccountId(getDefaultAccountId());
  if(!accountIds.length) return false;
  var entry = {
    id: 'm_' + now.toString(36) + '_' + Math.random().toString(36).slice(2,8),
    role: String(payload.role || 'assistant').trim() === 'user' ? 'user' : 'assistant',
    content: JSON.stringify({
      title: String(payload.title || '日程引用'),
      excerpt: String(payload.excerpt || ''),
      reply: String(payload.reply || ''),
      dateKey: String(payload.dateKey || '')
    }),
    type: 'schedulequote',
    replyToId: null,
    sentAt: now,
    readAt: String(payload.role || 'assistant').trim() === 'user' ? now : null
  };
  for(var i = 0; i < accountIds.length; i++){
    var history = await readBackgroundChatHistory(charId, accountIds[i]);
    history.push(Object.assign({}, entry));
    await writeBackgroundChatHistory(charId, accountIds[i], history);
  }
  renderHomeDockBadges();
  try{
    var f = document.getElementById('app-iframe');
    if(f && f.contentWindow){
      f.contentWindow.postMessage({ type:'BACKGROUND_AI_MESSAGE', payload:{ charId: charId, entry: entry } }, '*');
    }
  }catch(err){}
  return true;
}

async function appendScheduleSystemNotice(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var charId = String(payload.charId || '').trim();
  if(!charId) return false;
  var now = Date.now();
  var text = String(payload.text || '').trim();
  if(!text) return false;
  var accountIds = [];
  function pushAccountId(id){
    id = String(id || '').trim();
    if(!id) return;
    if(accountIds.indexOf(id) === -1) accountIds.push(id);
  }
  pushAccountId(getActiveAccountId());
  pushAccountId(getDefaultAccountId());
  if(!accountIds.length) return false;
  var entry = {
    id: 'm_' + now.toString(36) + '_' + Math.random().toString(36).slice(2,8),
    role: 'system',
    content: text,
    type: 'text',
    replyToId: null,
    sentAt: now,
    readAt: null
  };
  var wrote = false;
  for(var i = 0; i < accountIds.length; i++){
    var accountId = accountIds[i];
    var history = await readBackgroundChatHistory(charId, accountId);
    history.push(Object.assign({}, entry));
    await writeBackgroundChatHistory(charId, accountId, history);
    wrote = true;
  }
  if(!wrote) return false;
  renderHomeDockBadges();
  try{
    var f = document.getElementById('app-iframe');
    if(f && f.contentWindow){
      f.contentWindow.postMessage({ type:'BACKGROUND_AI_MESSAGE', payload:{ charId: charId, entry: entry } }, '*');
    }
  }catch(err){}
  maybeShowShellActivityNotification({
    kind:'chat',
    charId: charId,
    text: text
  });
  return true;
}

async function appendScheduleChatMessage(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var charId = String(payload.charId || '').trim();
  if(!charId) return false;
  var now = Date.now();
  var text = String(payload.text || '').trim();
  if(!text) return false;
  var accountIds = [];
  function pushAccountId(id){
    id = String(id || '').trim();
    if(!id) return;
    if(accountIds.indexOf(id) === -1) accountIds.push(id);
  }
  pushAccountId(getActiveAccountId());
  pushAccountId(getDefaultAccountId());
  if(!accountIds.length) return false;
  var role = String(payload.role || 'assistant').trim() === 'user' ? 'user' : 'assistant';
  var entry = {
    id: 'm_' + now.toString(36) + '_' + Math.random().toString(36).slice(2,8),
    role: role,
    content: text,
    type: 'text',
    replyToId: null,
    sentAt: now,
    readAt: role === 'user' ? now : null,
    silentPeek: !!payload.silentPeek
  };
  for(var i = 0; i < accountIds.length; i++){
    var history = await readBackgroundChatHistory(charId, accountIds[i]);
    history.push(Object.assign({}, entry));
    await writeBackgroundChatHistory(charId, accountIds[i], history);
  }
  renderHomeDockBadges();
  try{
    var f = document.getElementById('app-iframe');
    if(f && f.contentWindow){
      f.contentWindow.postMessage({ type:'BACKGROUND_AI_MESSAGE', payload:{ charId: charId, entry: entry } }, '*');
    }
  }catch(err){}
  if(role !== 'user'){
    maybeShowShellActivityNotification({
      kind:'chat',
      charId: charId,
      text: text
    });
  }
  return true;
}

async function generateScheduleInlineComment(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var charId = String(payload.charId || '').trim();
  if(!charId) throw new Error('缺少角色');
  var chars = getStoredCharactersSnapshot();
  var character = chars.find(function(item){ return item && String(item.id || '') === charId; }) || null;
  if(!character) throw new Error('找不到角色');
  var cfg = getBackgroundProviderConfig();
  if(!cfg) throw new Error('请先在设置里配置模型');
  var item = payload.item && typeof payload.item === 'object' ? payload.item : {};
  var comments = Array.isArray(payload.comments) ? payload.comments : [];
  var localClock = buildScheduleLocalNowContextForCharacter(character, Date.now());
  var userNow = localClock && localClock.user ? localClock.user : null;
  var charNow = localClock && localClock.char ? localClock.char : null;
  var sysPrompt = [
    '你现在只负责给日程页上的某一条安排写一句短留言。',
    '只返回纯文本，不要 JSON，不要解释。',
    '这句留言会显示在日程页的小便利贴里，所以要短、自然、有活人感。',
    '用简体中文。',
    '要严格符合角色 persona，不要像客服，不要像 AI，总长度控制在 10 到 38 个字。',
    '如果额外上下文或当前时刻判断提到这条安排已经过去、正在发生、还没开始，你必须服从这个时间状态来回应，不要装作没发生。',
    '允许短碎句、停顿、情绪、小别扭、小关心、小吐槽，但不要写成模板话，不要每次都像“我看到了”“记得哦”这种机械句。'
  ].join('\n');
  var userPrompt = [
    '角色名：' + String(character.nickname || character.name || '角色'),
    '角色人设：' + String(character.personality || character.description || '').slice(0, 1200),
    character.scenario ? ('角色情境：' + String(character.scenario || '').slice(0, 700)) : '',
    buildSchedulePresenceContextForCharId(charId, character) ? ('现实地理位置 / 距离感：\n' + buildSchedulePresenceContextForCharId(charId, character)) : '',
    userNow ? ('用户当地日期时间：' + String(userNow.dateKey || '') + ' ' + String(userNow.nowTime || '')) : '',
    charNow ? ('角色当地日期时间：' + String(charNow.dateKey || '') + ' ' + String(charNow.nowTime || '')) : '',
    '今天日期：' + String(payload.dateKey || ''),
    '这条安排属于：' + (payload.owner === 'user' ? '用户' : '角色本人'),
    payload.owner === 'user'
      ? '硬规则：这条安排是用户的，不是你的。不要把它说成你自己的待办或你本人要去做的事。'
      : '硬规则：这条安排是你自己的，不是用户的。不要把它误认成用户要做的事，也不要反问“你还没做吗”。',
    '安排标题：' + String(item.title || item.text || '').trim(),
    item.start ? ('时间：' + String(item.start || '') + (item.end ? (' - ' + String(item.end || '')) : '')) : '',
    item.note ? ('备注：' + String(item.note || '')) : '',
    payload.timeStatus ? ('当前时刻判断：' + String(payload.timeStatus || '')) : '',
    comments.length ? ('已经有的留言：\n- ' + comments.map(function(comment){ return String(comment.author || '') + '：' + String(comment.text || '').trim(); }).join('\n- ')) : '还没有留言。',
    payload.extraContext ? ('额外上下文：' + String(payload.extraContext || '').trim()) : '',
    payload.owner === 'user'
      ? '请像这个角色看见用户日程后的自然反应，可能是提醒、吃醋、吐槽、关心。'
      : '请像这个角色在记录自己行程时，顺手留下的一句心情或补充。'
  ].filter(Boolean).join('\n\n');
  var raw = await callAiForBackground(cfg, sysPrompt, userPrompt);
  return String(raw || '').replace(/^```[a-zA-Z]*\s*/,'').replace(/```$/,'').trim();
}

async function generateScheduleChatBurst(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var charId = String(payload.charId || '').trim();
  if(!charId) throw new Error('缺少角色');
  var chars = getStoredCharactersSnapshot();
  var character = chars.find(function(item){ return item && String(item.id || '') === charId; }) || null;
  if(!character) throw new Error('找不到角色');
  var cfg = getBackgroundProviderConfig();
  if(!cfg) throw new Error('请先在设置里配置模型');
  var localClock = buildScheduleLocalNowContextForCharacter(character, Date.now());
  var userNow = localClock && localClock.user ? localClock.user : null;
  var charNow = localClock && localClock.char ? localClock.char : null;
  var sysPrompt = [
    '你现在要替这个角色生成一小串真的会发去聊天里的消息。',
    '只返回严格 JSON，不要 markdown，不要解释。',
    '格式：{"messages":["...","..."]}',
    'messages 最少 2 条，最多 4 条。',
    '每条都要短一点、像聊天，不要写成长段，不要像汇报总结。',
    '要有连续感，像真人连续发消息，不要四条都一个句型。',
    '必须严格符合角色人设，用简体中文。'
  ].join('\n');
  var userPrompt = [
    '角色名：' + String(character.nickname || character.name || '角色'),
    '角色人设：' + String(character.personality || character.description || '').slice(0, 1400),
    character.scenario ? ('角色情境：' + String(character.scenario || '').slice(0, 800)) : '',
    buildSchedulePresenceContextForCharId(charId, character) ? ('现实地理位置 / 距离感：\n' + buildSchedulePresenceContextForCharId(charId, character)) : '',
    userNow ? ('用户当地日期时间：' + String(userNow.dateKey || '') + ' ' + String(userNow.nowTime || '')) : '',
    charNow ? ('角色当地日期时间：' + String(charNow.dateKey || '') + ' ' + String(charNow.nowTime || '')) : '',
    payload.context ? ('这次触发背景：' + String(payload.context || '').trim()) : '',
    payload.targets ? ('你刚刚看过的日程内容：\n' + String(payload.targets || '').trim()) : '',
    payload.actions ? ('你刚刚已经做过的动作：\n' + String(payload.actions || '').trim()) : '',
    payload.secretNotice ? ('秘密行程相关：' + String(payload.secretNotice || '').trim()) : '',
    '请把这些自然揉进 2 到 4 条真实聊天消息里。可以有停顿、转折、小情绪、小吐槽、小关心，不要像系统播报，也不要每条都重复信息。'
  ].filter(Boolean).join('\n\n');
  var raw = await callAiForBackground(cfg, sysPrompt, userPrompt);
  var txt = String(raw || '').replace(/^```[a-zA-Z]*\s*/,'').replace(/```$/,'').trim();
  var parsed = null;
  try{ parsed = JSON.parse(txt); }catch(err){}
  var messages = parsed && Array.isArray(parsed.messages) ? parsed.messages : [];
  messages = messages.map(function(item){ return String(item || '').trim(); }).filter(Boolean).slice(0, 4);
  if(messages.length >= 2) return messages;
  if(messages.length === 1) return messages;
  return [];
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
  var defaultId = getDefaultAccountId();
  if(!defaultId) return false;
  if(!hasAnyAiBgActivityEnabled(defaultId)) return false;
  var character = await getBackgroundCharacter();
  if(!character || !character.id) return false;
  var cfg = getBackgroundProviderConfig();
  if(!cfg) return false;

  var history = (await readBackgroundChatHistory(character.id, defaultId)).slice(-8);
  var convoState = summarizeBgConversationState(history);
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
    'JSON 格式：{"action":"message|say|dynamic|call","content":"...","imageText":"..."}',
    'action=message 表示给用户主动发一条聊天消息；action=say 表示发朋友圈说说；action=dynamic 表示发朋友圈动态。',
    'action=call 表示想主动给用户打一通电话；content 写来电时会说的一句自然理由。',
    'content 必填，简短自然；imageText 只在 dynamic 时填写。',
    '如果 action=dynamic，则 content 和 imageText 都必须是图像描述（物体/场景/画面细节），不能是普通聊天句。',
    '如果 action=call，不要写系统提示，不要写“拨号中”，而要写像真人会说的来电理由。',
    '如果用户其实正在等你回，或你们已经隔了一阵子没说话，优先选 message，不要用发朋友圈糊弄过去。',
    '只有在真的更像这个角色会去发动态/说说的时候，才选 say 或 dynamic；只有在真的会忍不住想直接听到对方声音时，才选 call。'
  ].join('\n');
  var userPrompt = [
    '角色名：' + (character.nickname || character.name || '角色'),
    '角色本名：' + (character.name || '角色'),
    '角色人设：' + String(character.personality || character.description || '').slice(0, 1200),
    shortHistory ? ('最近聊天：\n' + shortHistory) : '最近聊天：无',
    posts ? ('最近朋友圈：\n' + posts) : '最近朋友圈：无',
    convoState.waitingForReply
      ? '现在的关键事实：用户上一条消息之后，你还没正经回他。请更像真人一点，优先主动发消息找他，不要假装去发动态。'
      : ('现在距离上一次互动已经过去了大约 ' + Math.max(1, Math.round(convoState.idleMs / 60000)) + ' 分钟。'),
    convoState.unreadAssistantCount > 0
      ? ('你这边已经累计有 ' + convoState.unreadAssistantCount + ' 条未读主动消息了，别一直刷屏。')
      : '目前没有你发出后还没被对方看到的主动消息。',
    '请像真人一样在这三种动作里选一个最自然的：主动聊天 / 发说说 / 发动态。',
    '要求：不要机械，不要复读用户原话，不要出现“我是AI/不能发朋友圈”等元话；如果选 message，要有一点“主动来找对方”的感觉。',
    buildBackgroundReplyLanguagePrompt(character) || ''
  ].join('\n\n');

  var rawReply = await callAiForBackground(cfg, sysPrompt, userPrompt);
  if(!isCharBgEnabled(character.id, defaultId)) return false;
  var parsed = coerceBgAction(parseBgAction(rawReply), convoState);
  if(!parsed) return false;
  if(parsed.action !== 'message' && parsed.action !== 'call' && loadShellCharMomentsFreq(character.id, defaultId) === 'low'){
    return false;
  }
  if(parsed.action === 'call') parsed.action = 'message';
  if(parsed.action === 'message'){
    return await appendBackgroundAiMessage(character, defaultId, parsed.content);
  }else{
    return await appendBackgroundMoment(character, defaultId, parsed.action, parsed.content, parsed.imageText);
  }
}

function getScheduleCommentLatestAt(item, author){
  var latest = 0;
  (Array.isArray(item && item.comments) ? item.comments : []).forEach(function(comment){
    if(String(comment && comment.author || '').trim() !== String(author || '').trim()) return;
    var at = Number(comment && comment.createdAt || 0) || 0;
    if(at > latest) latest = at;
  });
  return latest;
}

function scheduleItemNeedsCharReply(item){
  if(!(item && typeof item === 'object')) return false;
  var latestUser = getScheduleCommentLatestAt(item, 'user');
  var latestChar = getScheduleCommentLatestAt(item, 'char');
  if(latestUser > latestChar) return true;
  return !(Array.isArray(item.comments) && item.comments.some(function(comment){
    return String(comment && comment.author || '').trim() === 'char';
  }));
}

function buildSchedulePromptItemFromState(kind, item){
  item = item && typeof item === 'object' ? item : {};
  if(kind === 'event' && item.visibleToChar === false){
    return {
      title: String(item.publicMask || '这个时间段有安排').trim(),
      note: '这是用户没有公开细节的安排，不能擅自知道具体内容。',
      location: '',
      start: String(item.start || '').trim(),
      end: String(item.end || '').trim()
    };
  }
  if(kind === 'timeline' && item.secret){
    return {
      title: String(item.publicMask || '这段时间有安排').trim(),
      note: '这是一条秘密行程，不能泄露真实内容。',
      location: '',
      start: String(item.start || '').trim(),
      end: String(item.end || '').trim()
    };
  }
  return {
    title: String(item.title || item.text || '').trim(),
    note: String(item.note || '').trim(),
    location: String(item.location || '').trim(),
    start: String(item.start || '').trim(),
    end: String(item.end || '').trim()
  };
}

function getScheduleEntryTimeStatusText(item, owner, dateKey, localClock){
  item = item && typeof item === 'object' ? item : {};
  owner = String(owner || '').trim() === 'char' ? 'char' : 'user';
  localClock = localClock && typeof localClock === 'object' ? localClock : {};
  if(item.done) return '这条安排已经完成，或者被顺手改掉了。';
  var liveDateKey = owner === 'char'
    ? String(localClock.char && localClock.char.dateKey || '')
    : String(localClock.user && localClock.user.dateKey || '');
  if(!liveDateKey || String(dateKey || '') !== liveDateKey) return '';
  var liveNow = owner === 'char'
    ? String(localClock.char && localClock.char.nowTime || '')
    : String(localClock.user && localClock.user.nowTime || '');
  var nowParts = liveNow.split(':');
  var nowMinutes = nowParts.length === 2 ? ((parseInt(nowParts[0], 10) || 0) * 60 + (parseInt(nowParts[1], 10) || 0)) : -1;
  if(nowMinutes < 0) return '';
  var start = String(item.start || '').trim();
  var end = String(item.end || '').trim();
  var startParts = start.split(':');
  var endParts = end.split(':');
  var startMinutes = startParts.length === 2 ? ((parseInt(startParts[0], 10) || 0) * 60 + (parseInt(startParts[1], 10) || 0)) : -1;
  var endMinutes = endParts.length === 2 ? ((parseInt(endParts[0], 10) || 0) * 60 + (parseInt(endParts[1], 10) || 0)) : -1;
  if(startMinutes < 0) return '当前已经是这一天里的稍后时段。';
  if(endMinutes < startMinutes) endMinutes = startMinutes + 59;
  if(nowMinutes > endMinutes) return '这条安排的时间已经过去了。';
  if(nowMinutes >= startMinutes && nowMinutes <= endMinutes) return '这条安排现在正在发生。';
  if(nowMinutes < startMinutes) return '这条安排还没开始。';
  return '';
}

function summarizeScheduleItemsForPrompt(list, owner){
  return (Array.isArray(list) ? list : []).map(function(item){
    item = item && typeof item === 'object' ? item : {};
    return [
      owner === 'char' ? '角色' : '用户',
      String(item.start || '').trim() || '未定时间',
      String(item.title || item.text || '').trim(),
      String(item.location || '').trim(),
      String(item.note || '').trim(),
      item.done ? '已完成' : ''
    ].filter(Boolean).join(' | ');
  }).filter(Boolean).slice(0, 18).join('\n- ');
}

function inferFallbackSchedulePlanFromUserText(userText){
  var text = String(userText || '').replace(/\s+/g, ' ').trim();
  if(!text) return null;
  var normalized = text
    .replace(/^[好嗯哦啊呀诶欸，。！？!?\s]+/, '')
    .replace(/(记得|别忘了|待会|一会儿|一会|等会|等下|回头|稍后|抽空|顺手|帮我|麻烦你|记一下|你去|你先|你得)/g, '')
    .replace(/^[你你先请麻烦]+/, '')
    .trim();
  if(!normalized) return null;
  if(/(你|麻烦你|帮我|记得|别忘了|待会|一会|等会|等下|顺手|抽空)/.test(text)){
    return {
      charTodoAdd: {
        text: normalized.slice(0, 24),
        note: '这是聊天里顺手答应下来的事。'
      },
      chatContext: '我顺手把刚刚答应你的事记进待办里了。'
    };
  }
  if(/(我|我要|我得|我会|我准备|我今天|我待会|我一会|我等会)/.test(text)){
    return {
      userTodoAdd: {
        text: normalized.slice(0, 24),
        note: '这是用户在聊天里提到、值得记下来的安排。'
      },
      chatContext: '我顺手记下了你刚刚提到的那件事。'
    };
  }
  return null;
}

function buildScheduleHeuristicPlanFromUserText(userText, localClock, speaker){
  var text = String(userText || '').replace(/\s+/g, ' ').trim();
  var role = String(speaker || 'user').trim().toLowerCase();
  if(!text) return null;
  var clean = text
    .replace(/^[嗯啊哦诶欸呀呢吧啦哈嘿哎呀，。！？!?\s]+/, '')
    .replace(/[。！？!?]+$/g, '')
    .trim();
  if(!clean) return null;
  var plan = {
    userTodoAdd: null,
    userEventAdd: null,
    completeCharTodo: false,
    charTodoAdd: null,
    completeCharTimeline: false,
    charTimelineAdd: null,
    charTimelineComment: '',
    chatContext: ''
  };
  var hasCharAsk = /(记得|别忘了|待会|一会|等会|等下|回头|稍后|抽空|顺手|麻烦你|帮我|你去|你先|你得|提醒我|记一下|替我|去一趟|去做|顺便|顺路)/.test(text);
  var hasUserPlan = /(我待会|我一会|我等会|我等下|我今天|我要|我得|我准备|我会去|我打算|我得去|我可能会|我之后)/.test(text);
  var hasCharCommit = role === 'assistant' && /(我(会|去|来|先|顺手|帮你|给你|替你|记下|记住|安排|补上|处理|改一下|看看|留意|提醒)|好(的|呀|啊|呢|哦)?|行(吧|啊|呀)?|知道了|记住了|我来|我去|我帮你|我给你|我待会|我一会|我等会|我等下|我之后)/.test(text);
  var hasTimeCue = /(早上|上午|中午|下午|傍晚|晚上|夜里|今晚|今天|明天|待会|一会|等会|等下|稍后|回头|\d{1,2}[:：]\d{2})/.test(text);
  var shortClean = clean.slice(0, 28);
  function nextTimeSlot(offsetMinutes, durationMinutes){
    var nowText = String(localClock && localClock.char && localClock.char.nowTime || '');
    var match = nowText.match(/^(\d{1,2}):(\d{2})$/);
    var nowMinutes = match ? ((parseInt(match[1], 10) || 0) * 60 + (parseInt(match[2], 10) || 0)) : 12 * 60;
    var startMinutes = Math.max(0, Math.min(23 * 60 + 20, nowMinutes + Math.max(10, offsetMinutes || 30)));
    var endMinutes = Math.max(startMinutes + 20, Math.min(23 * 60 + 59, startMinutes + Math.max(35, durationMinutes || 60)));
    function pad(n){ return String(n).padStart(2, '0'); }
    return {
      start: pad(Math.floor(startMinutes / 60)) + ':' + pad(startMinutes % 60),
      end: pad(Math.floor(endMinutes / 60)) + ':' + pad(endMinutes % 60)
    };
  }
  if(hasCharAsk){
    plan.charTodoAdd = {
      text: shortClean || '刚刚答应你的那件事',
      note: '这是聊天里顺手答应下来的事。'
    };
    if(hasTimeCue){
      var slot = nextTimeSlot(25, 70);
      plan.charTimelineAdd = {
        start: slot.start,
        end: slot.end,
        title: shortClean || '顺手处理刚刚答应你的事',
        note: '这是聊天里临时加进来的安排。',
        location: ''
      };
    }
    plan.chatContext = '我把刚刚答应你的事顺手记进日程了。';
  }
  if(hasCharCommit){
    plan.charTodoAdd = {
      text: shortClean || '刚刚在聊天里答应你的那件事',
      note: '这是角色刚刚亲口答应下来的安排。'
    };
    if(hasTimeCue){
      var commitSlot = nextTimeSlot(20, 70);
      plan.charTimelineAdd = {
        start: commitSlot.start,
        end: commitSlot.end,
        title: shortClean || '把刚刚答应你的事安排进去',
        note: '这是角色在聊天里顺手加进今天的新安排。',
        location: ''
      };
    }
    plan.chatContext = '我把刚刚答应你的事真的记进今天了。';
  }
  if(hasUserPlan){
    if(hasTimeCue){
      var userSlot = nextTimeSlot(20, 90);
      plan.userEventAdd = {
        start: userSlot.start,
        end: userSlot.end,
        title: shortClean || '你刚刚提到的安排',
        note: '这是你在聊天里提到、值得记下来的安排。',
        location: '',
        visibleToChar: true
      };
    }else{
      plan.userTodoAdd = {
        text: shortClean || '你刚刚提到的那件事',
        note: '这是你在聊天里提到、值得记下来的待办。'
      };
    }
    if(!plan.chatContext) plan.chatContext = '我顺手把你刚刚提到的安排记下来了。';
  }
  return schedulePlanHasActions(plan) ? plan : null;
}

function mergeSchedulePlans(primary, secondary){
  primary = primary && typeof primary === 'object' ? primary : {};
  secondary = secondary && typeof secondary === 'object' ? secondary : {};
  if(!schedulePlanHasActions(secondary) && !String(secondary.chatContext || '').trim()) return primary;
  return {
    userTodoAdd: primary.userTodoAdd && String(primary.userTodoAdd.text || '').trim() ? primary.userTodoAdd : secondary.userTodoAdd,
    userEventAdd: primary.userEventAdd && String(primary.userEventAdd.title || '').trim() ? primary.userEventAdd : secondary.userEventAdd,
    completeCharTodo: !!(primary.completeCharTodo || secondary.completeCharTodo),
    charTodoAdd: primary.charTodoAdd && String(primary.charTodoAdd.text || '').trim() ? primary.charTodoAdd : secondary.charTodoAdd,
    completeCharTimeline: !!(primary.completeCharTimeline || secondary.completeCharTimeline),
    charTimelineAdd: primary.charTimelineAdd && String(primary.charTimelineAdd.title || '').trim() ? primary.charTimelineAdd : secondary.charTimelineAdd,
    charTimelineComment: String(primary.charTimelineComment || '').trim() || String(secondary.charTimelineComment || '').trim(),
    chatContext: String(primary.chatContext || '').trim() || String(secondary.chatContext || '').trim()
  };
}

function schedulePlanHasActions(plan){
  if(!(plan && typeof plan === 'object')) return false;
  return !!(
    (plan.userTodoAdd && String(plan.userTodoAdd.text || '').trim()) ||
    (plan.userEventAdd && String(plan.userEventAdd.title || '').trim()) ||
    plan.completeCharTodo ||
    (plan.charTodoAdd && String(plan.charTodoAdd.text || '').trim()) ||
    plan.completeCharTimeline ||
    (plan.charTimelineAdd && String(plan.charTimelineAdd.title || '').trim()) ||
    String(plan.charTimelineComment || '').trim()
  );
}

async function generateScheduleChatSyncPlan(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var charId = String(payload.charId || '').trim();
  var userText = String(payload.userText || '').trim();
  var speaker = String(payload.speaker || 'user').trim().toLowerCase();
  if(!charId || !userText) return null;
  var chars = getStoredCharactersSnapshot();
  var character = chars.find(function(item){ return item && String(item.id || '').trim() === charId; }) || null;
  if(!character) return null;
  var cfg = getBackgroundProviderConfig();
  if(!cfg) return null;
  var localClock = buildScheduleLocalNowContextForCharacter(character, Date.now());
  var sysPrompt = [
    '你正在根据聊天内容，轻微地改动一个角色的日程 app。',
    '只返回严格 JSON，不要 markdown，不要解释。',
    '格式：{"userTodoAdd":{"text":"...","note":"..."}|null,"userEventAdd":{"start":"09:00","end":"10:00","title":"...","note":"...","location":"...","visibleToChar":true}|null,"completeCharTodo":true|false,"charTodoAdd":{"text":"...","note":"..."}|null,"completeCharTimeline":true|false,"charTimelineAdd":{"start":"18:30","end":"19:20","title":"...","note":"...","location":"..."}|null,"charTimelineComment":"...","chatContext":"..."}',
    '这是轻微调整，不要大改整天计划，不要重写所有内容。',
    '只有当最新聊天内容真的值得记下来、提醒、改计划、临时插入安排时，才返回对应字段；否则返回 null 或 false。',
    '如果用户在聊天里提到“记得/提醒/稍后/待会/别忘了/要去做”，可以顺手给用户加一条待办或短行程。',
    '如果角色因为聊天内容想顺手改一下自己的安排、加一条待办、补一条临时行程，甚至划掉当前一条安排再补一条新的，都可以自然返回。',
    '地点、互动距离感、移动方式必须服从现实地理位置设定；异地不要偷写成已经见面、一起吃饭、在对方家里。',
    '不要泄露任何秘密行程。',
    'chatContext 是一句给后续聊天生成看的中文摘要，说明你刚刚在日程 app 里顺手做了什么。'
  ].join('\n');
  var userPrompt = [
    '角色名：' + String(character.nickname || character.name || '角色'),
    '角色人设：' + String(character.personality || character.description || '').slice(0, 1600),
    character.scenario ? ('角色情境：' + String(character.scenario || '').slice(0, 800)) : '',
    String(getScheduleUserPersona(charId) || '').trim() ? ('用户设定：' + String(getScheduleUserPersona(charId) || '').trim().slice(0, 1000)) : '',
    buildSchedulePresenceContextForCharId(charId, character) ? ('现实地理位置 / 距离感：\n' + buildSchedulePresenceContextForCharId(charId, character)) : '',
    localClock.user ? ('用户当地时间：' + String(localClock.user.dateKey || '') + ' ' + String(localClock.user.nowTime || '')) : '',
    localClock.char ? ('角色当地时间：' + String(localClock.char.dateKey || '') + ' ' + String(localClock.char.nowTime || '')) : '',
    speaker === 'assistant' ? ('角色刚刚在聊天里亲口说的话：' + userText) : ('最新用户聊天内容：' + userText),
    payload.userEvents ? ('用户今天行程：\n- ' + summarizeScheduleItemsForPrompt(payload.userEvents, 'user')) : '用户今天行程：无',
    payload.userTodos ? ('用户今天待办：\n- ' + summarizeScheduleItemsForPrompt(payload.userTodos, 'user')) : '用户今天待办：无',
    payload.charTimeline ? ('角色今天行程：\n- ' + summarizeScheduleItemsForPrompt(payload.charTimeline, 'char')) : '角色今天行程：无',
    payload.charTodos ? ('角色今天待办：\n- ' + summarizeScheduleItemsForPrompt(payload.charTodos, 'char')) : '角色今天待办：无',
    '请只做自然、轻微、符合人设的改动，不要为了改而改。'
  ].filter(Boolean).join('\n\n');
  try{
    var raw = await callAiForBackground(cfg, sysPrompt, userPrompt);
    var txt = cleanBgJson(raw);
    var parsed = JSON.parse(txt || '{}');
    return parsed && typeof parsed === 'object' ? parsed : null;
  }catch(err){
    return null;
  }
}

async function syncScheduleActivityFromChat(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var charId = String(payload.charId || '').trim();
  var userText = String(payload.userText || '').trim();
  var speaker = String(payload.speaker || 'user').trim().toLowerCase();
  if(!charId || !userText) return { changed:false, messages:0 };
  var accountId = getActiveAccountId() || getDefaultAccountId();
  if(!isCharBgEnabled(charId, accountId)) return { changed:false, messages:0 };
  var shared = getScheduleSharedApi();
  if(!shared) return { changed:false, messages:0 };
  var chars = getStoredCharactersSnapshot();
  var character = chars.find(function(item){ return item && String(item.id || '').trim() === charId; }) || null;
  if(!character) return { changed:false, messages:0 };
  var localClock = buildScheduleLocalNowContextForCharacter(character, Date.now());
  var localeGuard = getSchedulePresenceLocaleGuard(character, {
    userWeather: loadScheduleWeatherSettingByCharId('user', charId),
    charWeather: loadScheduleWeatherSettingByCharId('char', charId)
  });
  var dateKey = String(localClock.user && localClock.user.dateKey || shared.toDateKey(new Date()));
  var state = shared.normalizeState(await shared.loadState());
  var charState = shared.getCharState(state, charId);
  var day = charState.charDays && charState.charDays[dateKey]
    ? shared.normalizeCharDay(charState.charDays[dateKey], dateKey)
    : shared.normalizeCharDay({ date:dateKey }, dateKey);
  var userEvents = (Array.isArray(charState.events) ? charState.events : []).filter(function(item){ return String(item && item.date || '') === dateKey; });
  var userTodos = (Array.isArray(charState.todos) ? charState.todos : []).filter(function(item){ return String(item && item.date || '') === dateKey; });
  var pendingUserTargets = []
    .concat(userEvents.map(function(item){ return { kind:'event', item:item }; }))
    .concat(userTodos.map(function(item){ return { kind:'todo', item:item }; }))
    .concat((Array.isArray(day.timeline) ? day.timeline : []).map(function(item){ return { kind:'timeline', item:item }; }))
    .concat((Array.isArray(day.todos) ? day.todos : []).map(function(item){ return { kind:'chartodo', item:item }; }))
    .filter(function(ref){ return scheduleItemNeedsCharReply(ref.item); })
    .slice(0, 8);
  var actionNotes = [];
  var changed = false;

  for(var i = 0; i < pendingUserTargets.length; i += 1){
    var ref = pendingUserTargets[i];
    var item = ref.item;
      var noteText = await generateScheduleInlineComment({
        charId: charId,
        dateKey: dateKey,
        owner: (ref.kind === 'timeline' || ref.kind === 'chartodo') ? 'char' : 'user',
        item: buildSchedulePromptItemFromState(ref.kind, item),
        comments: Array.isArray(item.comments) ? item.comments : [],
        timeStatus: getScheduleEntryTimeStatusText(item, (ref.kind === 'timeline' || ref.kind === 'chartodo') ? 'char' : 'user', dateKey, localClock),
        extraContext: [
          '你现在是在聊天之余，顺手看了一眼日程 app。',
          (ref.kind === 'timeline' || ref.kind === 'chartodo')
            ? '这是你自己的一条安排或待办，但用户在上面留了话。你要像真人一样知道对方在看你的日程，并自然接住。'
            : '这条安排属于用户，不是你自己。如果用户在这条安排上留过话，要像真人一样把它接住；如果只是他新写下来的安排或待办，也可以自然留一句。'
        ].join('\n')
      }).catch(function(){ return ''; });
    noteText = String(noteText || '').trim();
    if(!noteText) continue;
    item = Object.assign({}, item);
    item.comments = Array.isArray(item.comments) ? item.comments.slice() : [];
    item.comments.push({
      id: shared.createId('comment'),
      author: 'char',
      text: noteText,
      createdAt: Date.now()
    });
    if(ref.kind === 'event'){
      charState.events = (Array.isArray(charState.events) ? charState.events : []).map(function(entry){
        if(String(entry && entry.date || '') !== dateKey) return entry;
        return String(entry && entry.id || '') === String(item.id || '') ? item : entry;
      });
    }else if(ref.kind === 'todo'){
      charState.todos = (Array.isArray(charState.todos) ? charState.todos : []).map(function(entry){
        if(String(entry && entry.date || '') !== dateKey) return entry;
        return String(entry && entry.id || '') === String(item.id || '') ? item : entry;
      });
    }else if(ref.kind === 'timeline'){
      day.timeline = (Array.isArray(day.timeline) ? day.timeline : []).map(function(entry){
        return String(entry && entry.id || '') === String(item.id || '') ? item : entry;
      });
    }else if(ref.kind === 'chartodo'){
      day.todos = (Array.isArray(day.todos) ? day.todos : []).map(function(entry){
        return String(entry && entry.id || '') === String(item.id || '') ? item : entry;
      });
    }
    changed = true;
    actionNotes.push('我在日程里回了你关于「' + String(item.title || item.text || '这件事') + '」的留言。');
  }

  var plan = await generateScheduleChatSyncPlan({
    charId: charId,
    userText: userText,
    speaker: speaker,
    userEvents: userEvents,
    userTodos: userTodos,
    charTimeline: day.timeline,
    charTodos: day.todos
  });
  var heuristicPlan = mergeSchedulePlans(
    speaker === 'user' ? (inferFallbackSchedulePlanFromUserText(userText) || null) : null,
    buildScheduleHeuristicPlanFromUserText(userText, localClock, speaker) || null
  );
  if(schedulePlanHasActions(plan)){
    plan = mergeSchedulePlans(plan, heuristicPlan || null);
  }else{
    plan = heuristicPlan || plan || null;
  }

  if(plan && plan.userTodoAdd && String(plan.userTodoAdd.text || '').trim()){
    charState.todos = Array.isArray(charState.todos) ? charState.todos.slice() : [];
    charState.todos.unshift(shared.normalizeTodo({
      date: dateKey,
      text: String(plan.userTodoAdd.text || '').trim(),
      note: String(plan.userTodoAdd.note || '').trim(),
      visibleToChar: true,
      source: 'user'
    }));
    changed = true;
    actionNotes.push('我顺手帮你记了一条待办。');
  }
  if(plan && plan.userEventAdd && String(plan.userEventAdd.title || '').trim()){
    var userEventLocaleText = [plan.userEventAdd.title, plan.userEventAdd.note, plan.userEventAdd.location].filter(Boolean).join(' ');
    if(!(localeGuard && textHasForeignLocaleDrift(userEventLocaleText, localeGuard))){
    charState.events = Array.isArray(charState.events) ? charState.events.slice() : [];
    charState.events.unshift(shared.normalizeEvent({
      date: dateKey,
      start: String(plan.userEventAdd.start || '').trim(),
      end: String(plan.userEventAdd.end || '').trim(),
      title: String(plan.userEventAdd.title || '').trim(),
      note: String(plan.userEventAdd.note || '').trim(),
      location: String(plan.userEventAdd.location || '').trim(),
      visibleToChar: plan.userEventAdd.visibleToChar !== false,
      source: 'user'
    }));
    changed = true;
    actionNotes.push('我还顺手给你补了一条行程。');
    }
  }
  if(plan && plan.completeCharTodo){
    var nextTodo = (Array.isArray(day.todos) ? day.todos : []).find(function(item){ return item && !item.done; }) || null;
    if(nextTodo){
      day.todos = (Array.isArray(day.todos) ? day.todos : []).map(function(item){
        if(String(item && item.id || '') !== String(nextTodo.id || '')) return item;
        item = Object.assign({}, item);
        item.done = true;
        return item;
      });
      changed = true;
      actionNotes.push('我把自己的一条待办做完了。');
    }
  }
  if(plan && plan.completeCharTimeline){
    var currentTimeline = (Array.isArray(day.timeline) ? day.timeline : []).find(function(item){
      return item && !item.done && getScheduleEntryTimeStatusText(item, 'char', dateKey, localClock) === '这条安排现在正在发生。';
    }) || (Array.isArray(day.timeline) ? day.timeline : []).find(function(item){ return item && !item.done; }) || null;
    if(currentTimeline){
      day.timeline = (Array.isArray(day.timeline) ? day.timeline : []).map(function(item){
        if(String(item && item.id || '') !== String(currentTimeline.id || '')) return item;
        item = Object.assign({}, item);
        item.done = true;
        return item;
      });
      changed = true;
      actionNotes.push('我把刚刚那段安排顺手划掉，又改了下节奏。');
    }
  }
  if(plan && plan.charTodoAdd && String(plan.charTodoAdd.text || '').trim()){
    var charTodoLocaleText = [plan.charTodoAdd.text, plan.charTodoAdd.note].filter(Boolean).join(' ');
    if(!(localeGuard && textHasForeignLocaleDrift(charTodoLocaleText, localeGuard))){
    day.todos = Array.isArray(day.todos) ? day.todos.slice() : [];
    day.todos.unshift({
      id: shared.createId('chartodo'),
      text: String(plan.charTodoAdd.text || '').trim(),
      note: String(plan.charTodoAdd.note || '').trim(),
      done: false,
      comments: [],
      createdAt: Date.now()
    });
    changed = true;
    actionNotes.push('我给自己补了一条待办。');
    }
  }
  if(plan && plan.charTimelineAdd && String(plan.charTimelineAdd.title || '').trim()){
    var charTimelineLocaleText = [plan.charTimelineAdd.title, plan.charTimelineAdd.note, plan.charTimelineAdd.location].filter(Boolean).join(' ');
    if(!(localeGuard && textHasForeignLocaleDrift(charTimelineLocaleText, localeGuard))){
    day.timeline = Array.isArray(day.timeline) ? day.timeline.slice() : [];
    day.timeline.push({
      id: shared.createId('timeline'),
      start: String(plan.charTimelineAdd.start || '').trim(),
      end: String(plan.charTimelineAdd.end || '').trim(),
      title: String(plan.charTimelineAdd.title || '').trim(),
      note: String(plan.charTimelineAdd.note || '').trim(),
      location: String(plan.charTimelineAdd.location || '').trim(),
      done: false,
      kind: 'char',
      secret: false,
      secretPassword: '',
      secretHint: '',
      publicMask: '',
      comments: []
    });
    day.timeline.sort(function(a, b){
      return String(a && a.start || '99:99').localeCompare(String(b && b.start || '99:99'));
    });
    changed = true;
    actionNotes.push('我把今天的安排临时改了一下。');
    }
  }
  if(plan && String(plan.charTimelineComment || '').trim()){
    var timelineTarget = (Array.isArray(day.timeline) ? day.timeline : []).find(function(item){
      return item && getScheduleEntryTimeStatusText(item, 'char', dateKey, localClock) === '这条安排现在正在发生。';
    }) || ((Array.isArray(day.timeline) ? day.timeline : [])[0] || null);
    if(timelineTarget){
      day.timeline = (Array.isArray(day.timeline) ? day.timeline : []).map(function(item){
        if(String(item && item.id || '') !== String(timelineTarget.id || '')) return item;
        item = Object.assign({}, item);
        item.comments = Array.isArray(item.comments) ? item.comments.slice() : [];
        item.comments.push({
          id: shared.createId('comment'),
          author: 'char',
          text: String(plan.charTimelineComment || '').trim(),
          createdAt: Date.now()
        });
        return item;
      });
      changed = true;
      actionNotes.push('我顺手又看了看自己的安排。');
    }
  }

  if(changed){
    charState.charDays = charState.charDays || {};
    charState.charDays[dateKey] = shared.normalizeCharDay(day, dateKey);
    state = shared.setCharState(state, charId, charState);
    await shared.saveState(state);
    try{
      var scheduleFrame = document.getElementById('app-iframe');
      if(scheduleFrame && scheduleFrame.contentWindow){
        scheduleFrame.contentWindow.postMessage({
          type: 'SCHEDULE_STATE_DIRTY',
          payload: {
            charId: charId,
            dateKey: dateKey,
            changedAt: Date.now()
          }
        }, '*');
      }
    }catch(err){}
    maybeShowShellActivityNotification({
      kind:'schedule',
      charId: charId,
      text: actionNotes.slice(0, 2).join(' ') || '悄悄改了今日日程'
    });
  }

  var burstTargets = pendingUserTargets.map(function(ref){
    var target = ref.item || {};
    return '- ' + String(target.title || target.text || '这件事');
  }).slice(0, 6).join('\n');
  var burstMessages = [];
  if(actionNotes.length || (plan && String(plan.chatContext || '').trim())){
    burstMessages = await generateScheduleChatBurst({
      charId: charId,
      context: '这是角色在聊天时顺手看过日程 app 之后，真的要发去聊天里的几条消息。最新用户聊天内容：' + userText,
      targets: burstTargets,
      actions: actionNotes.concat(String(plan && plan.chatContext || '').trim() ? [String(plan.chatContext || '').trim()] : []).join('\n')
    }).catch(function(){ return []; });
    burstMessages = Array.isArray(burstMessages) ? burstMessages.map(function(text){ return String(text || '').trim(); }).filter(Boolean) : [];
  }
  for(var msgIndex = 0; msgIndex < burstMessages.length; msgIndex += 1){
    await appendScheduleChatMessage({
      charId: charId,
      role: 'assistant',
      text: burstMessages[msgIndex]
    }).catch(function(){});
  }
  return { changed: changed, messages: burstMessages.length };
}

window.ScheduleShell = {
  generateDayPlan: generateScheduleDayPlan,
  sendScheduleQuote: sendScheduleQuote,
  appendSystemNotice: appendScheduleSystemNotice,
  generateChatBurst: generateScheduleChatBurst,
  appendChatMessage: appendScheduleChatMessage,
  generateInlineComment: generateScheduleInlineComment,
  syncChatBackground: syncScheduleActivityFromChat
};

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

let appNotifyTimer = 0;
let appNotifyPayload = null;
let appNotifyQueue = [];
let appNotifyPointerStartY = 0;
let appNotifyPointerDragging = false;

function dismissAppNotification(){
  var shell = document.getElementById('app-notify-shell');
  if(!shell) return;
  shell.classList.remove('show');
  if(appNotifyTimer){
    clearTimeout(appNotifyTimer);
    appNotifyTimer = 0;
  }
  setTimeout(function(){
    if(!shell.classList.contains('show')){
      shell.hidden = true;
      if(appNotifyQueue.length){
        showAppNotificationCard(appNotifyQueue.shift());
      }
    }
  }, 220);
}

function openAppNotificationTarget(){
  var payload = appNotifyPayload || {};
  openShellNotificationPayload(payload);
}

function openShellNotificationPayload(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  dismissAppNotification();
  if(payload.app === 'schedule'){
    openApp('schedule');
    return;
  }
  if(payload.app === 'moments'){
    openApp('qq');
    return;
  }
  if(payload.app === 'chat' && payload.charId){
    var chars = getStoredCharactersSnapshot();
    var match = chars.find(function(item){ return item && String(item.id || '') === String(payload.charId || ''); }) || { id: payload.charId, name: payload.name || '角色' };
    const slim = persistShellActiveCharacter(match) || slimChar(match);
    try{ localStorage.setItem('pendingChatChar', JSON.stringify(slim)); }catch(err){}
    try{ localStorage.setItem('pendingChatCharId', String((slim && slim.id) || '')); }catch(err){}
    pendingOpenChatCharId = String((slim && slim.id) || '').trim();
    pendingOpenChatNonce = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8);
    replaceApp('chat');
  }
}

function showAppNotificationCard(payload){
  payload = payload && typeof payload === 'object' ? payload : {};
  var shell = document.getElementById('app-notify-shell');
  var card = document.getElementById('app-notify-card');
  var avatar = document.getElementById('app-notify-avatar');
  var name = document.getElementById('app-notify-name');
  var body = document.getElementById('app-notify-body');
  if(!shell || !card || !avatar || !name || !body) return;
  var title = String(payload.name || '角色').trim() || '角色';
  var text = String(payload.text || '').trim() || '有新动静';
  var avatarSrc = String(payload.avatar || '').trim();
  if(shell.classList.contains('show')){
    appNotifyQueue.push(payload);
    return;
  }
  appNotifyPayload = payload;
  name.textContent = title;
  body.textContent = text;
  avatar.style.backgroundImage = avatarSrc ? ('url("' + avatarSrc.replace(/"/g, '&quot;') + '")') : '';
  avatar.textContent = avatarSrc ? '' : String(title || '角').slice(0, 1);
  shell.hidden = false;
  requestAnimationFrame(function(){ shell.classList.add('show'); });
  if(appNotifyTimer) clearTimeout(appNotifyTimer);
  appNotifyTimer = setTimeout(dismissAppNotification, 5200);
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
  return '';
}

function getTopFrameChoices(){
  return [{ id: 'none', url: '', name: '无' }];
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

function hashAvatarFrameSeed(input){
  var str = String(input || '');
  var hash = 0;
  for(var i = 0; i < str.length; i += 1){
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash || 1);
}

function buildAvatarFrameFallbackMarkup(url, className, styleText){
  var safeUrl = String(url || '').trim();
  if(!safeUrl) return '';
  var seed = hashAvatarFrameSeed(safeUrl);
  var motifs = ['heart', 'star', 'flower', 'ribbon'];
  var paletteSets = [
    { stroke:'#111111', fill:'#ffd6e7', accent:'#ff6fa7' },
    { stroke:'#111111', fill:'#d7efff', accent:'#5aa8ff' },
    { stroke:'#111111', fill:'#fff0c7', accent:'#ffbf3c' },
    { stroke:'#111111', fill:'#e2f4d8', accent:'#6fbe58' },
    { stroke:'#111111', fill:'#f0ddff', accent:'#b16dff' }
  ];
  var motif = motifs[seed % motifs.length];
  var palette = paletteSets[seed % paletteSets.length];
  var badge = motif === 'heart' ? '♥' : (motif === 'star' ? '★' : (motif === 'flower' ? '✿' : '🎀'));
  var dots = '';
  for(var i = 0; i < 8; i += 1){
    dots += '<span class="avatar-frame-dot avatar-frame-dot-' + i + '"></span>';
  }
  var attrs = [
    'class="' + (className ? (className + ' ') : '') + 'avatar-frame-inline avatar-frame-fallback"',
    'aria-hidden="true"',
    'style="--frame-stroke:' + palette.stroke + ';--frame-fill:' + palette.fill + ';--frame-accent:' + palette.accent + ';' + (styleText || '') + '"'
  ].join(' ');
  return ''
    + '<span ' + attrs + '>'
    + '<span class="avatar-frame-fallback__outer"></span>'
    + '<span class="avatar-frame-fallback__inner"></span>'
    + '<span class="avatar-frame-fallback__dash"></span>'
    + dots
    + '<span class="avatar-frame-fallback__badge">' + badge + '</span>'
    + '</span>';
}

function escapeHtmlAttr(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtml(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAvatarFrameFallbackDataUrl(url){
  var safeUrl = String(url || '').trim();
  if(!safeUrl) return '';
  var seed = hashAvatarFrameSeed(safeUrl);
  var motifs = ['heart', 'star', 'flower', 'ribbon'];
  var paletteSets = [
    { stroke:'#111111', fill:'#ffd6e7', accent:'#ff6fa7' },
    { stroke:'#111111', fill:'#d7efff', accent:'#5aa8ff' },
    { stroke:'#111111', fill:'#fff0c7', accent:'#ffbf3c' },
    { stroke:'#111111', fill:'#e2f4d8', accent:'#6fbe58' },
    { stroke:'#111111', fill:'#f0ddff', accent:'#b16dff' }
  ];
  var motif = motifs[seed % motifs.length];
  var palette = paletteSets[seed % paletteSets.length];
  var dots = '';
  for(var i = 0; i < 12; i += 1){
    var angle = (Math.PI * 2 * i) / 12;
    var cx = 60 + Math.cos(angle) * 46;
    var cy = 60 + Math.sin(angle) * 46;
    dots += '<circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="2.8" fill="' + palette.accent + '" opacity="0.92"/>';
  }
  var ornament = '';
  if(motif === 'heart'){
    ornament = '<path d="M60 26 C56 18 42 18 42 31 C42 42 52 48 60 56 C68 48 78 42 78 31 C78 18 64 18 60 26 Z" fill="' + palette.accent + '" stroke="' + palette.stroke + '" stroke-width="2.4"/>';
  }else if(motif === 'star'){
    ornament = '<path d="M60 22 L65.3 35.5 L80 36.2 L68.6 45.5 L72.5 59.4 L60 51.5 L47.5 59.4 L51.4 45.5 L40 36.2 L54.7 35.5 Z" fill="' + palette.accent + '" stroke="' + palette.stroke + '" stroke-width="2.2" stroke-linejoin="round"/>';
  }else if(motif === 'flower'){
    ornament = '<circle cx="60" cy="40" r="7" fill="#fff7b8" stroke="' + palette.stroke + '" stroke-width="2.2"/>' +
      '<circle cx="49" cy="40" r="7.8" fill="' + palette.accent + '" opacity="0.95" stroke="' + palette.stroke + '" stroke-width="1.8"/>' +
      '<circle cx="71" cy="40" r="7.8" fill="' + palette.accent + '" opacity="0.95" stroke="' + palette.stroke + '" stroke-width="1.8"/>' +
      '<circle cx="60" cy="29" r="7.8" fill="' + palette.accent + '" opacity="0.95" stroke="' + palette.stroke + '" stroke-width="1.8"/>' +
      '<circle cx="60" cy="51" r="7.8" fill="' + palette.accent + '" opacity="0.95" stroke="' + palette.stroke + '" stroke-width="1.8"/>';
  }else{
    ornament = '<path d="M33 25 C44 22 52 26 56 33 C50 33 43 37 39 45 C34 39 32 31 33 25 Z" fill="' + palette.accent + '" stroke="' + palette.stroke + '" stroke-width="2"/>' +
      '<path d="M87 25 C76 22 68 26 64 33 C70 33 77 37 81 45 C86 39 88 31 87 25 Z" fill="' + palette.accent + '" stroke="' + palette.stroke + '" stroke-width="2"/>' +
      '<rect x="53" y="24" width="14" height="8" rx="3.6" fill="' + palette.fill + '" stroke="' + palette.stroke + '" stroke-width="2"/>';
  }
  var svg = ''
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">'
    + '<circle cx="60" cy="60" r="57" fill="none" stroke="' + palette.stroke + '" stroke-width="5.2"/>'
    + '<circle cx="60" cy="60" r="52.5" fill="none" stroke="' + palette.fill + '" stroke-width="9.5"/>'
    + '<circle cx="60" cy="60" r="46.8" fill="none" stroke="' + palette.stroke + '" stroke-width="2.2" stroke-dasharray="2.6 7.2" opacity="0.7"/>'
    + dots
    + ornament
    + '</svg>';
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function getAvatarFrameRenderSrc(url){
  var safeUrl = String(url || '').trim();
  if(!safeUrl) return '';
  if(/^data:/i.test(safeUrl)) return safeUrl;
  if(/^https?:\/\/i\.postimg\.cc\//i.test(safeUrl)) return buildAvatarFrameFallbackDataUrl(safeUrl);
  return safeUrl;
}

function buildAvatarFrameImg(className, url, styleText){
  return '';
}

function getActiveTopFrameUrl(){
  if(isTopFrameEditorOpen) return topFrameDraftUrl || '';
  return getTopAvatarFrameUrl();
}

function getBondAvatarFrameStorageKey(role){
  return role === 'user' ? 'bond_user_frame_url' : 'bond_char_frame_url';
}

function getBondAvatarFrameUrl(role){
  return '';
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
  if(Number(idx) === 3){
    openApp('schedule');
    return;
  }
  if(Number(idx) === 5){
    showHomeToast('约会正在重新制作');
    return;
  }
  if(Number(idx) === 4){
    openApp('backend');
    return;
  }
  if(Number(idx) === 6){
    openApp('map6');
    return;
  }
  if(Number(idx) === 7){
    showHomeToast('档案馆正在重新制作');
    return;
  }
  showHomeToast('占位' + idx + ' 暂未设置');
}

function resolveShellCharacterById(charId, fallback){
  var safeId = String(charId || '').trim();
  if(!safeId) return fallback || null;
  try{
    var list = getStoredCharactersSnapshot();
    var activeAcctId = getActiveAccountId();
    var match = list.find(function(item){
      if(!item || String(item.id || '') !== safeId) return false;
      if(!activeAcctId) return true;
      return !item.ownerAccountId || String(item.ownerAccountId) === activeAcctId;
    });
    if(!match){
      match = list.find(function(item){
        return item && String(item.id || '') === safeId;
      }) || null;
    }
    if(match) return Object.assign({}, match, fallback && String(fallback.id || '') === safeId ? fallback : {});
  }catch(e){}
  return fallback || null;
}

function getActiveCharacterData(){
  var cacheKey = getShellAccountCacheKey(getActiveAccountId());
  var scopedActive = shellActiveCharacterCache[cacheKey] || null;
  var scopedChatId = String(shellActiveChatIdCache[cacheKey] || '').trim();
  if(scopedChatId){
    var scopedResolved = resolveShellCharacterById(scopedChatId, scopedActive);
    if(scopedResolved && scopedResolved.id) return scopedResolved;
  }
  if(scopedActive && scopedActive.id) return resolveShellCharacterById(scopedActive.id, scopedActive) || scopedActive;
  return null;
}

function persistShellActiveCharacter(character){
  var slim = slimChar(character);
  if(!slim || !slim.id) return null;
  var resolvedAvatar = getCharacterAvatarForBg(character);
  if(resolvedAvatar) slim.imageData = resolvedAvatar;
  var accountId = getActiveAccountId();
  var cacheKey = getShellAccountCacheKey(accountId);
  shellActiveCharacterCache[cacheKey] = slim;
  shellActiveChatIdCache[cacheKey] = String((slim && slim.id) || '');
  saveLargeState(shellActiveCharacterStorageId(accountId), slim).catch(function(){ return null; });
  saveLargeState(shellActiveChatIdStorageId(accountId), String((slim && slim.id) || '')).catch(function(){ return null; });
  if(isDefaultAccountActive()){
    try{ localStorage.setItem('activeCharacter', JSON.stringify(slim)); }catch(e){}
    try{ localStorage.setItem('activeChatCharacterId', String((slim && slim.id) || '')); }catch(e){}
  }
  try{ localStorage.setItem(scopedKeyForAccount('activeCharacter', getActiveAccountId()), JSON.stringify(slim)); }catch(e){}
  try{ localStorage.setItem(scopedKeyForAccount('activeChatCharacterId', getActiveAccountId()), String((slim && slim.id) || '')); }catch(e){}
  return slim;
}

function getCurrentForegroundCharacter(){
  try{
    var frame = document.getElementById('app-iframe');
    var win = frame && frame.contentWindow ? frame.contentWindow : null;
    if(win && currentApp === 'chat'){
      var liveChar = win.character;
      if(liveChar && liveChar.id){
        var slim = slimChar(liveChar);
        try{
          var selectors = ['#chatExportIdcAvatar img', '#idcAvatar img', '#csCharAvatar img', '#hdrAvatar img'];
          for(var i = 0; i < selectors.length; i++){
            var node = win.document ? win.document.querySelector(selectors[i]) : null;
            var src = String((node && node.getAttribute && node.getAttribute('src')) || (node && node.src) || '').trim();
            if(src){
              slim.imageData = src;
              break;
            }
          }
        }catch(err){}
        return slim;
      }
    }
  }catch(e){}
  return getActiveCharacterData();
}

function getChatUserName(charId){
  if(!charId) return 'USER';
  try{
    var chars = getStoredCharactersSnapshot();
    var hit = Array.isArray(chars) ? chars.find(function(item){ return item && String(item.id || '').trim() === String(charId || '').trim(); }) : null;
    var embedded = String((hit && hit.userNameProfile) || '').trim();
    if(embedded) return embedded;
  }catch(err){}
  var activeId = getActiveAccountId();
  var scoped = scopedKeyForAccount('user_name_' + charId, activeId);
  return (localStorage.getItem(scoped) || localStorage.getItem('user_name_' + charId) || '').trim() || 'USER';
}

function getBondWidgetUserName(charData, fallbackName){
  var c = charData && typeof charData === 'object' ? charData : null;
  var note = String((c && c.userNicknameNote) || '').trim();
  if(note) return note;
  var fallback = String(fallbackName || '').trim();
  if(fallback) return fallback;
  var chatUser = getChatUserName(c && c.id);
  return String(chatUser || 'USER').trim() || 'USER';
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
  if(userName) userName.textContent = getBondWidgetUserName(c, '');
  if(charAvatar){
    const applyCharAvatar = (override)=>{
      const safeOverride = normalizeShellAssetSrc(override || '');
      const safeImage = normalizeShellAssetSrc(c && c.imageData || '');
      const baseHtml = isRenderableShellAvatarSrc(safeOverride)
        ? '<span class="bond-avatar-base"><img src="' + safeOverride + '" alt=""></span>'
        : isRenderableShellAvatarSrc(safeImage)
          ? '<span class="bond-avatar-base"><img src="' + safeImage + '" alt=""></span>'
          : '<span class="bond-avatar-base">' + (c ? (c.avatar || '✿') : '✿') + '</span>';
      const frameUrl = getActiveBondAvatarFrameUrl('char');
      if(frameUrl){
        const frameVisual = getTopFrameVisual(frameUrl);
        const frameStyle = '--frame-scale:' + frameVisual.scale + ';--frame-offset-x:' + frameVisual.offsetX + 'px;--frame-offset-y:' + frameVisual.offsetY + 'px;';
        charAvatar.innerHTML = baseHtml + buildAvatarFrameImg('bond-avatar-frame', frameUrl, frameStyle);
      } else {
        charAvatar.innerHTML = baseHtml;
      }
    };
    applyCharAvatar('');
    if(c && c.id) loadStoredAsset('char_avatar_' + c.id).then(applyCharAvatar);
  }
  if(userAvatar){
    const applyUserAvatar = (src)=>{
      const baseHtml = src && /^(data:|https?:|blob:|\/|\.\.?\/)/i.test(String(src || '').trim())
        ? '<span class="bond-avatar-base"><img src="' + src + '" alt=""></span>'
        : '<span class="bond-avatar-base">你</span>';
      const frameUrl = getActiveBondAvatarFrameUrl('user');
      if(frameUrl){
        const frameVisual = getTopFrameVisual(frameUrl);
        const frameStyle = '--frame-scale:' + frameVisual.scale + ';--frame-offset-x:' + frameVisual.offsetX + 'px;--frame-offset-y:' + frameVisual.offsetY + 'px;';
        userAvatar.innerHTML = baseHtml + buildAvatarFrameImg('bond-avatar-frame', frameUrl, frameStyle);
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
  if(userNameEl){
    userNameEl.textContent = getBondWidgetUserName(c, typeof preview.userName === 'string' ? preview.userName : '');
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
        userAvatarEl.innerHTML = baseHtml + buildAvatarFrameImg('bond-avatar-frame', frameUrl, frameStyle);
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
  return;
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
  host.innerHTML = '<div class="sub" style="text-align:center;color:#111;">头像框已移除</div>';
}

function openTopFrameEditor(){
  return;
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
  return;
}

function saveTopFrame(){
  try{ localStorage.removeItem('home_top_frame_url'); }catch(e){}
  try{ localStorage.removeItem('bond_char_frame_url'); }catch(e){}
  try{ localStorage.removeItem('bond_user_frame_url'); }catch(e){}
  closeTopFrameEditor();
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
        el.innerHTML = baseHtml + buildAvatarFrameImg('slot-frame', frameUrl, frameStyle);
      }else{
        el.innerHTML = baseHtml;
      }
    }else if(slotId === 'musicAlbum'){
      homeMusicAlbumCoverSrc = dataUrl;
      el.innerHTML = '<img src="' + dataUrl + '" alt=""><span class="slot-plus">+</span>';
      renderHomeMusicCover();
    }else if(slotId === '1' || slotId === '2' || slotId === '3' || slotId === '4'){
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
    if(slotId === 'musicAlbum'){
      homeMusicAlbumCoverSrc = '';
      renderHomeMusicCover();
    }
    el.innerHTML = '<span class="slot-plus">+</span>';
  }
}

function setHomeSlotImage(slotId, dataUrl){
  const key = 'home_slot_' + slotId;
  return saveStoredAsset(key, isRenderableHomeSlotSource(dataUrl) ? String(dataUrl).trim() : '').then((ok)=>{
    if(ok) renderHomeSlot(slotId, dataUrl);
    return ok;
  });
}

function restoreHomeSlots(){
  ['top','1','2','3','4','photo1','photo2','musicAlbum'].forEach((id)=>{
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

var homeMusicState = {
  tracks: [],
  currentTrackId: '',
  currentTime: 0,
  bubbleX: null,
  bubbleY: null,
  proxyBase: '',
  searchResults: [],
  parsedLyrics: [],
  currentLyricIndex: -1,
  objectUrl: '',
  isReady: false,
  isPlaying: false,
  searchQuery: '',
  lyricHidden: false,
  floatingEnabled: true,
  customBubbleIcon: '',
  bubbleScale: 1
};
var homeMusicDragState = null;
var homeMusicBubbleMoved = false;
var homeMusicAlbumCoverSrc = '';
var homeMusicBubbleClickTimer = 0;
var homeMusicBubbleLastTapAt = 0;
var homeMusicRenameIndex = -1;
var homeMusicSearchBusy = false;

function normalizeHomeMusicStorageText(value, limit){
  var text = String(value == null ? '' : value).trim();
  if(!text) return '';
  var maxLen = Math.max(0, Number(limit) || 0);
  if(!maxLen || text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function normalizeHomeMusicBubbleScale(value){
  var num = Number(value);
  if(!isFinite(num)) return 1;
  return Math.max(0.75, Math.min(1.6, Math.round(num * 100) / 100));
}

function normalizeHomeMusicDurationSeconds(value){
  var num = Number(value);
  if(!isFinite(num) || num <= 0) return 0;
  if(num > 7200) num = num / 1000;
  return Math.max(0, Math.round(num));
}

function sanitizeHomeMusicTrackForStorage(track){
  var safe = track && typeof track === 'object' ? track : {};
  return {
    id: normalizeHomeMusicStorageText(safe.id || createTrackId('track'), 80),
    source: (function(){
      var val = String(safe.source || '').trim();
      if(val === 'local' || val === 'search' || val === 'proxy') return val;
      return 'local';
    })(),
    remoteId: normalizeHomeMusicStorageText(safe.remoteId || '', 160),
    name: normalizeHomeMusicStorageText(safe.name || '未命名歌曲', 180) || '未命名歌曲',
    artist: normalizeHomeMusicStorageText(safe.artist || '本地导入', 180) || '本地导入',
    cover: normalizeHomeMusicStorageText(safe.cover || '', 2000),
    remoteUrl: normalizeHomeMusicStorageText(safe.remoteUrl || '', 2000),
    lyricsText: normalizeHomeMusicStorageText(safe.lyricsText || '', 18000),
    duration: normalizeHomeMusicDurationSeconds(safe.duration),
    mimeType: normalizeHomeMusicStorageText(safe.mimeType || '', 80),
    size: Math.max(0, Number(safe.size) || 0),
    fileName: normalizeHomeMusicStorageText(safe.fileName || '', 200)
  };
}

function getHomeMusicLargeStateStorageId(){
  return mainScopedKey(HOME_MUSIC_STATE_KEY + '_large');
}

function applyHydratedHomeMusicState(parsed){
  if(!parsed || typeof parsed !== 'object') return;
  homeMusicState.tracks = Array.isArray(parsed.tracks) ? parsed.tracks.map(function(track){
    return sanitizeHomeMusicTrackForStorage(track);
  }).filter(function(track){
    return !!String(track && track.id || '').trim();
  }) : [];
  homeMusicState.currentTrackId = normalizeHomeMusicStorageText(parsed.currentTrackId || '', 80);
  homeMusicState.currentTime = Math.max(0, Number(parsed.currentTime) || 0);
  homeMusicState.bubbleX = typeof parsed.bubbleX === 'number' ? parsed.bubbleX : null;
  homeMusicState.bubbleY = typeof parsed.bubbleY === 'number' ? parsed.bubbleY : null;
  homeMusicState.proxyBase = normalizeHomeMusicStorageText(parsed.proxyBase || localStorage.getItem(HOME_MUSIC_PROXY_BASE_KEY) || '', 420);
  homeMusicState.lyricHidden = !!parsed.lyricHidden;
  homeMusicState.bubbleScale = normalizeHomeMusicBubbleScale(
    parsed.bubbleScale != null ? parsed.bubbleScale : localStorage.getItem(HOME_MUSIC_FLOATING_SIZE_KEY)
  );
  if(typeof parsed.floatingEnabled === 'boolean'){
    homeMusicState.floatingEnabled = parsed.floatingEnabled;
  }else{
    var storedEnabled = localStorage.getItem(HOME_MUSIC_FLOATING_ENABLED_KEY);
    homeMusicState.floatingEnabled = storedEnabled === '0' ? false : true;
  }
}

function getHomeMusicPlaylistTrackById(trackId){
  var tracks = Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks : [];
  return tracks.find(function(track){ return track && track.id === trackId; }) || null;
}

function getHomeMusicPlaylistTrackByRemoteId(remoteId){
  var key = String(remoteId || '').trim();
  if(!key) return null;
  var tracks = Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks : [];
  return tracks.find(function(track){
    return track && String(track.remoteId || '').trim() === key;
  }) || null;
}

function createTrackId(prefix){
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function getHomeMusicAudio(){
  return document.getElementById('home-music-audio');
}

function formatHomeMusicTime(seconds){
  var total = Math.max(0, Math.floor(Number(seconds) || 0));
  var mins = Math.floor(total / 60);
  var secs = String(total % 60).padStart(2, '0');
  return mins + ':' + secs;
}

function serializeHomeMusicState(){
  var currentTrack = getHomeMusicPlaylistTrackById(homeMusicState.currentTrackId);
  return JSON.stringify({
    tracks: Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks.map(function(track){
      return sanitizeHomeMusicTrackForStorage(track);
    }) : [],
    currentTrackId: currentTrack ? currentTrack.id : '',
    currentTime: Math.max(0, Number(homeMusicState.currentTime) || 0),
    bubbleX: typeof homeMusicState.bubbleX === 'number' ? homeMusicState.bubbleX : null,
    bubbleY: typeof homeMusicState.bubbleY === 'number' ? homeMusicState.bubbleY : null,
    proxyBase: String(homeMusicState.proxyBase || ''),
    lyricHidden: !!homeMusicState.lyricHidden,
    floatingEnabled: homeMusicState.floatingEnabled !== false,
    bubbleScale: normalizeHomeMusicBubbleScale(homeMusicState.bubbleScale)
  });
}

function persistHomeMusicState(){
  var stateJson = '';
  var stateObject = null;
  try{
    stateJson = serializeHomeMusicState();
    stateObject = JSON.parse(stateJson);
  }catch(err){
    stateJson = '';
    stateObject = null;
  }
  try{
    if(stateJson) localStorage.setItem(HOME_MUSIC_STATE_KEY, stateJson);
    localStorage.setItem(HOME_MUSIC_PROXY_BASE_KEY, String(homeMusicState.proxyBase || ''));
    localStorage.setItem(HOME_MUSIC_FLOATING_SIZE_KEY, String(normalizeHomeMusicBubbleScale(homeMusicState.bubbleScale)));
  }catch(err){}
  if(stateObject){
    saveLargeState(getHomeMusicLargeStateStorageId(), stateObject).catch(function(){ return null; });
  }
}

function hydrateHomeMusicState(){
  try{
    var raw = localStorage.getItem(HOME_MUSIC_STATE_KEY);
    var storedEnabled = localStorage.getItem(HOME_MUSIC_FLOATING_ENABLED_KEY);
    if(raw){
      var parsed = JSON.parse(raw);
      if(parsed && typeof parsed === 'object'){
        applyHydratedHomeMusicState(parsed);
      }
    }else{
      homeMusicState.proxyBase = localStorage.getItem(HOME_MUSIC_PROXY_BASE_KEY) || '';
      homeMusicState.floatingEnabled = storedEnabled === '0' ? false : true;
      homeMusicState.bubbleScale = normalizeHomeMusicBubbleScale(localStorage.getItem(HOME_MUSIC_FLOATING_SIZE_KEY));
    }
  }catch(err){}
  try{
    if(typeof homeMusicState.floatingEnabled === 'boolean'){
      localStorage.setItem(HOME_MUSIC_FLOATING_ENABLED_KEY, homeMusicState.floatingEnabled ? '1' : '0');
    }
    localStorage.setItem(HOME_MUSIC_FLOATING_SIZE_KEY, String(normalizeHomeMusicBubbleScale(homeMusicState.bubbleScale)));
  }catch(storageErr){}
  homeMusicState.previewTrack = null;
  homeMusicState.searchResults = [];
  loadLargeState(getHomeMusicLargeStateStorageId()).then(function(parsed){
    if(!parsed || typeof parsed !== 'object') return;
    if(Array.isArray(homeMusicState.tracks) && homeMusicState.tracks.length) return;
    applyHydratedHomeMusicState(parsed);
    if(typeof renderHomeMusic === 'function') renderHomeMusic();
  }).catch(function(){ return null; });
}

function getCurrentHomeMusicTrack(){
  var track = getHomeMusicPlaylistTrackById(homeMusicState.currentTrackId);
  if(track) return track;
  if(homeMusicState.previewTrack && homeMusicState.previewTrack.id === homeMusicState.currentTrackId){
    return homeMusicState.previewTrack;
  }
  return null;
}

function getHomeMusicProvider(){
  return {
    local: {
      async importAudioFiles(files){
        var added = [];
        for(var i = 0; i < files.length; i++){
          var file = files[i];
          if(!file) continue;
          var parsedName = parseHomeMusicNameArtistFromFileName(file.name || '');
          var id = createTrackId('local');
          if(window.assetStore && typeof window.assetStore.set === 'function'){
            await window.assetStore.set(HOME_MUSIC_TRACK_PREFIX + id, file);
          }else{
            await saveStoredAsset(HOME_MUSIC_TRACK_PREFIX + id, await fileToDataUrl(file));
          }
          added.push({
            id: id,
            source: 'local',
            name: parsedName.name,
            artist: parsedName.artist,
            mimeType: file.type || 'audio/mpeg',
            duration: 0,
            lyricsText: '',
            size: Number(file.size) || 0,
            fileName: file.name || ''
          });
        }
        return added;
      }
    },
    proxy: {
      async searchTracks(query){
        var base = String(homeMusicState.proxyBase || '').trim().replace(/\/+$/, '');
        if(!base) throw new Error('请先填写 Proxy URL');
        var res = await fetch(base + '/api/music/search?q=' + encodeURIComponent(query));
        if(!res.ok) throw new Error('搜索失败：' + res.status);
        var payload = await res.json();
        var list = Array.isArray(payload) ? payload : (payload.songs || payload.data || []);
        return list.map(function(item, idx){
          var fallbackName = String(query || '').trim() || ('歌曲 ' + String(idx + 1));
          var normalizedPair = splitHomeMusicNameAndArtist(item.name || item.title || '未命名歌曲', item.artist || item.author || item.singer || '未知歌手');
          if(isHomeMusicUnknownName(normalizedPair.name)) normalizedPair.name = fallbackName;
          return {
            id: createTrackId('proxy'),
            source: 'proxy',
            remoteId: item.id || '',
            name: normalizedPair.name,
            artist: normalizedPair.artist,
            cover: item.cover || item.pic || item.coverUrl || '',
            remoteUrl: item.url || item.streamUrl || item.playUrl || '',
            lyricsText: item.lyrics || item.lrc || '',
            duration: Math.max(0, Number(item.duration || item.interval || item.time || 0) || 0)
          };
        });
      }
    },
    search: {
      async searchTracks(query){
        var res = await fetch(HOME_MUSIC_THIRD_PARTY_BASE + '?word=' + encodeURIComponent(query), {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store'
        });
        if(!res.ok) throw new Error('搜索失败：' + res.status);
        var payload = await res.json();
        return normalizeHomeMusicThirdPartySearchPayload(payload, query);
      }
    }
  };
}

function getHomeMusicNestedValue(source, path){
  var current = source;
  for(var i = 0; i < path.length; i += 1){
    if(!current || typeof current !== 'object') return undefined;
    current = current[path[i]];
  }
  return current;
}

function getHomeMusicFirstTruthy(source, paths){
  for(var i = 0; i < paths.length; i += 1){
    var value = getHomeMusicNestedValue(source, paths[i]);
    if(value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function findHomeMusicSearchItems(payload){
  var candidates = [
    ['data', 'list'],
    ['data', 'song', 'list'],
    ['data', 'songs'],
    ['data', 'data'],
    ['songs'],
    ['list'],
    ['result', 'songs'],
    ['result', 'list']
  ];
  for(var i = 0; i < candidates.length; i += 1){
    var found = getHomeMusicNestedValue(payload, candidates[i]);
    if(Array.isArray(found) && found.length) return found;
  }
  var queue = [payload];
  var visited = new Set();
  while(queue.length){
    var node = queue.shift();
    if(!node || typeof node !== 'object' || visited.has(node)) continue;
    visited.add(node);
    if(Array.isArray(node)){
      if(node.length && node.some(function(item){ return item && typeof item === 'object'; })){
        return node;
      }
      node.forEach(function(item){ queue.push(item); });
      continue;
    }
    Object.keys(node).forEach(function(key){ queue.push(node[key]); });
  }
  return [];
}

function joinHomeMusicArtists(value){
  if(!value) return '';
  if(typeof value === 'string') return value;
  if(Array.isArray(value)){
    return value.map(function(item){
      if(!item) return '';
      if(typeof item === 'string') return item;
      return item.name || item.title || item.singerName || item.artistName || '';
    }).filter(Boolean).join(' / ');
  }
  if(typeof value === 'object'){
    return value.name || value.title || value.singerName || value.artistName || '';
  }
  return '';
}

function splitHomeMusicNameAndArtist(name, artist){
  var title = String(name || '').trim();
  var singer = String(artist || '').trim();
  var looksUnknown = !singer || singer === '未知歌手' || singer === '本地导入';
  if(looksUnknown){
    var match = title.match(/^(.+?)\s*(?:-|—|–|｜|\|)\s*(.+)$/);
    if(match){
      var maybeName = String(match[1] || '').trim();
      var maybeArtist = String(match[2] || '').trim();
      if(maybeName && maybeArtist){
        title = maybeName;
        singer = maybeArtist;
      }
    }
  }
  return {
    name: title || '未命名歌曲',
    artist: singer || (looksUnknown ? '未知歌手' : singer)
  };
}

function isHomeMusicUnknownName(value){
  var text = String(value || '').trim();
  if(!text) return true;
  return text === '未命名歌曲' || text === '未知歌曲' || /^untitled$/i.test(text);
}

function parseHomeMusicNameArtistFromFileName(filename){
  var raw = String(filename || '').trim();
  if(!raw) return { name:'未命名歌曲', artist:'本地导入' };
  var base = raw.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  var parsed = splitHomeMusicNameAndArtist(base, '');
  return {
    name: parsed.name || '未命名歌曲',
    artist: parsed.artist && parsed.artist !== '未知歌手' ? parsed.artist : '本地导入'
  };
}

function normalizeHomeMusicThirdPartySearchPayload(payload, queryHint){
  var fallbackBase = String(queryHint || '').trim();
  var list = findHomeMusicSearchItems(payload);
  return list.map(function(item, idx){
    var remoteId = String(
      getHomeMusicFirstTruthy(item, [
        ['id'], ['songid'], ['songId'], ['mid'], ['songmid'], ['media_mid'], ['musicid'], ['musicId'], ['rid'], ['hash'], ['contentid']
      ]) || ''
    ).trim();
    var name = String(
      getHomeMusicFirstTruthy(item, [
        ['name'], ['title'], ['songname'], ['songName']
      ]) || '未命名歌曲'
    ).trim();
    var artist = joinHomeMusicArtists(
      getHomeMusicFirstTruthy(item, [
        ['artist'], ['artists'], ['author'], ['singer'], ['singers'], ['singername']
      ])
    ) || '未知歌手';
    var cover = String(
      getHomeMusicFirstTruthy(item, [
        ['cover'], ['pic'], ['coverUrl'], ['album', 'pic'], ['album', 'cover']
      ]) || ''
    ).trim();
    var remoteUrl = String(
      getHomeMusicFirstTruthy(item, [
        ['url'], ['playUrl'], ['streamUrl'], ['src'], ['music_url'], ['musicUrl'], ['purl'], ['link'],
        ['data', 'url'], ['data', 'playUrl'], ['data', 'streamUrl'], ['data', 'src'], ['data', 'music_url'], ['data', 'musicUrl']
      ]) || ''
    ).trim();
    if(!remoteUrl) remoteUrl = String(findHomeMusicDeepAudioUrl(item) || '').trim();
    var normalizedPair = splitHomeMusicNameAndArtist(name, artist);
    if(isHomeMusicUnknownName(normalizedPair.name)){
      normalizedPair.name = fallbackBase || ('歌曲 ' + String(idx + 1));
    }
    return {
      id: createTrackId('search'),
      source: 'search',
      remoteId: remoteId || ('search_' + idx),
      name: normalizedPair.name,
      artist: normalizedPair.artist,
      cover: cover,
      remoteUrl: remoteUrl,
      lyricsText: '',
      duration: (function(){
        var direct = normalizeHomeMusicDurationSeconds(getHomeMusicFirstTruthy(item, [['duration'], ['interval'], ['dt'], ['time'], ['songTime'], ['duration_ms']]) || 0);
        return direct > 0 ? direct : findHomeMusicDeepDuration(item);
      })()
    };
  }).filter(function(item){
    return !!String(item.name || '').trim();
  });
}

function extractHomeMusicLyricText(payload){
  var direct = getHomeMusicFirstTruthy(payload, [
    ['lyric'],
    ['lrc'],
    ['data', 'lyric'],
    ['data', 'lrc'],
    ['data']
  ]);
  if(typeof direct === 'string') return direct;
  if(direct && typeof direct === 'object'){
    return String(getHomeMusicFirstTruthy(direct, [['lyric'], ['lrc'], ['content']]) || '');
  }
  return '';
}

function findHomeMusicDeepAudioUrl(payload){
  var queue = [payload];
  var visited = new Set();
  while(queue.length){
    var node = queue.shift();
    if(!node) continue;
    if(typeof node === 'string'){
      var text = String(node || '').trim();
      if(/^https?:\/\//i.test(text) && /(?:audio|music|song|play|stream|m4a|mp3|aac|flac|wav|ogg)/i.test(text)){
        return text;
      }
      continue;
    }
    if(typeof node !== 'object' || visited.has(node)) continue;
    visited.add(node);
    if(Array.isArray(node)){
      node.forEach(function(item){ queue.push(item); });
      continue;
    }
    Object.keys(node).forEach(function(key){
      var value = node[key];
      if(typeof value === 'string'){
        var text = String(value || '').trim();
        if(/^https?:\/\//i.test(text) && /(?:audio|music|song|play|stream|m4a|mp3|aac|flac|wav|ogg)/i.test(text)){
          queue.unshift(text);
          return;
        }
      }
      queue.push(value);
    });
  }
  return '';
}

function findHomeMusicDeepDuration(payload){
  var queue = [payload];
  var visited = new Set();
  while(queue.length){
    var node = queue.shift();
    if(node === null || node === undefined) continue;
    if(typeof node === 'number'){
      var numeric = normalizeHomeMusicDurationSeconds(node);
      if(numeric > 0) return numeric;
      continue;
    }
    if(typeof node !== 'object' || visited.has(node)) continue;
    visited.add(node);
    if(Array.isArray(node)){
      node.forEach(function(item){ queue.push(item); });
      continue;
    }
    Object.keys(node).forEach(function(key){
      var value = node[key];
      if(/duration|interval|songtime|duration_ms|time|dt/i.test(String(key || ''))){
        var numeric = normalizeHomeMusicDurationSeconds(value);
        if(numeric > 0){
          queue.unshift(numeric);
          return;
        }
      }
      queue.push(value);
    });
  }
  return 0;
}

function extractHomeMusicAudioUrl(payload){
  var direct = String(getHomeMusicFirstTruthy(payload, [
    ['url'],
    ['playUrl'],
    ['streamUrl'],
    ['music_url'],
    ['musicUrl'],
    ['play_url'],
    ['purl'],
    ['link'],
    ['src'],
    ['songurl'],
    ['data', 'url'],
    ['data', 'playUrl'],
    ['data', 'streamUrl'],
    ['data', 'music_url'],
    ['data', 'musicUrl'],
    ['data', 'play_url'],
    ['data', 'purl'],
    ['data', 'link'],
    ['data', 'src']
  ]) || '').trim();
  if(direct) return direct;
  return String(findHomeMusicDeepAudioUrl(payload) || '').trim();
}

function extractHomeMusicCoverUrl(payload){
  return String(getHomeMusicFirstTruthy(payload, [
    ['cover'],
    ['pic'],
    ['coverUrl'],
    ['data', 'cover'],
    ['data', 'pic'],
    ['data', 'coverUrl']
  ]) || '').trim();
}

function extractHomeMusicDuration(payload){
  var direct = normalizeHomeMusicDurationSeconds(getHomeMusicFirstTruthy(payload, [
    ['duration'],
    ['interval'],
    ['dt'],
    ['time'],
    ['songTime'],
    ['duration_ms'],
    ['data', 'duration'],
    ['data', 'interval'],
    ['data', 'dt'],
    ['data', 'time'],
    ['data', 'songTime'],
    ['data', 'duration_ms']
  ]) || 0);
  if(direct > 0) return direct;
  return findHomeMusicDeepDuration(payload);
}

async function hydrateHomeMusicThirdPartyTrack(track){
  if(!track || !track.remoteId) return track;
  if(!track.remoteUrl){
    var detailRes = await fetch(HOME_MUSIC_THIRD_PARTY_BASE + '?id=' + encodeURIComponent(track.remoteId), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store'
    });
    if(!detailRes.ok) throw new Error('试听失败：' + detailRes.status);
    var detailPayload = await detailRes.json();
    track.remoteUrl = extractHomeMusicAudioUrl(detailPayload) || track.remoteUrl || '';
    track.cover = extractHomeMusicCoverUrl(detailPayload) || track.cover || '';
    track.lyricsText = extractHomeMusicLyricText(detailPayload) || track.lyricsText || '';
    track.artist = String(track.artist || getHomeMusicFirstTruthy(detailPayload, [['artist'], ['data', 'artist']]) || '未知歌手');
    track.duration = extractHomeMusicDuration(detailPayload) || track.duration || 0;
  }
  if(!track.lyricsText){
    try{
      var lyricRes = await fetch(HOME_MUSIC_THIRD_PARTY_BASE + '/lyric?id=' + encodeURIComponent(track.remoteId), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store'
      });
      if(lyricRes.ok){
        var lyricPayload = await lyricRes.json();
        track.lyricsText = extractHomeMusicLyricText(lyricPayload) || '';
      }
    }catch(err){}
  }
  track.duration = normalizeHomeMusicDurationSeconds(track.duration);
  return track;
}

function cloneHomeMusicTrack(track){
  return JSON.parse(JSON.stringify(track || {}));
}

function parseHomeMusicLrc(text){
  var lines = String(text || '').split(/\r?\n/);
  var parsed = [];
  lines.forEach(function(line){
    var content = line.replace(/\[[^\]]+\]/g, '').trim();
    var matches = line.match(/\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g);
    if(!matches || !content) return;
    matches.forEach(function(mark){
      var parts = mark.match(/\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/);
      if(!parts) return;
      var minute = parseInt(parts[1], 10) || 0;
      var second = parseInt(parts[2], 10) || 0;
      var milli = parseInt((parts[3] || '0').padEnd(3, '0').slice(0, 3), 10) || 0;
      parsed.push({
        time: minute * 60 + second + milli / 1000,
        text: content
      });
    });
  });
  parsed.sort(function(a, b){ return a.time - b.time; });
  return parsed;
}

function setHomeMusicLyricsForCurrentTrack(text){
  var track = getCurrentHomeMusicTrack();
  if(!track) return;
  track.lyricsText = String(text || '');
  homeMusicState.parsedLyrics = parseHomeMusicLrc(track.lyricsText);
  homeMusicState.currentLyricIndex = -1;
  persistHomeMusicState();
  renderHomeMusic();
}

function getHomeMusicDisplayLyric(){
  var parsed = Array.isArray(homeMusicState.parsedLyrics) ? homeMusicState.parsedLyrics : [];
  var idx = homeMusicState.currentLyricIndex;
  if(parsed.length && idx >= 0 && parsed[idx] && parsed[idx].text){
    return parsed[idx].text;
  }
  if(parsed.length && parsed[0] && parsed[0].text){
    return parsed[0].text;
  }
  var track = getCurrentHomeMusicTrack();
  if(!track || !track.lyricsText) return '';
  return String(track.lyricsText)
    .split(/\r?\n/)
    .map(function(line){ return line.trim(); })
    .filter(Boolean)[0] || '';
}

function getHomeMusicFloatingLineText(){
  var track = getCurrentHomeMusicTrack();
  if(!track) return '';
  var lyricText = getHomeMusicDisplayLyric();
  if(lyricText) return lyricText;
  return track.source === 'local' ? '\u{1F3B5}' : '';
}

function updateHomeMusicLyricByTime(currentTime){
  var parsed = Array.isArray(homeMusicState.parsedLyrics) ? homeMusicState.parsedLyrics : [];
  var lineEl = document.getElementById('home-music-lyric-line');
  if(!lineEl) return;
  var lyricText = '';
  if(!parsed.length){
    setHomeMusicTickerText(lineEl, getHomeMusicFloatingLineText());
    syncHomeMusicLyricCardWidth();
    return;
  }
  var nextIndex = -1;
  for(var i = 0; i < parsed.length; i++){
    if(currentTime >= parsed[i].time){
      nextIndex = i;
    }else{
      break;
    }
  }
  homeMusicState.currentLyricIndex = nextIndex;
  if(nextIndex < 0){
    lyricText = parsed[0] && parsed[0].text ? parsed[0].text : getHomeMusicFloatingLineText();
    setHomeMusicTickerText(lineEl, lyricText);
    syncHomeMusicLyricCardWidth();
    return;
  }
  lyricText = parsed[nextIndex] && parsed[nextIndex].text ? parsed[nextIndex].text : '';
  setHomeMusicTickerText(lineEl, lyricText || getHomeMusicFloatingLineText());
  syncHomeMusicLyricCardWidth();
}

function setHomeMusicTickerText(el, text){
  if(!el) return;
  var safeText = String(text || '').trim();
  if(!safeText){
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '<span class="home-music-lyric-text">' + escapeHtml(safeText) + '</span>';
}

function applyHomeMusicEqualizerState(){
  var eq = document.getElementById('bond-music-eq');
  if(!eq) return;
  eq.classList.toggle('is-playing', !!homeMusicState.isPlaying);
  var track = getCurrentHomeMusicTrack();
  eq.setAttribute('data-song', track ? String(track.name || '').trim() : '');
}

function getHomeMusicPlayMode(){
  var mode = String(homeMusicState.playMode || '');
  return mode === 'shuffle' || mode === 'repeat-one' ? mode : 'repeat-all';
}

function renderHomeMusicModeButton(){
  var btn = document.getElementById('home-music-mode-btn');
  if(!btn) return;
  var mode = getHomeMusicPlayMode();
  if(mode === 'shuffle'){
    btn.innerHTML = '<span class="music-icon music-icon-shuffle"><span class="music-icon-shuffle-tail"></span></span>';
    btn.setAttribute('aria-label', '随机播放');
    return;
  }
  if(mode === 'repeat-one'){
    btn.innerHTML = '<span class="music-icon music-icon-repeat-one"><i>1</i></span>';
    btn.setAttribute('aria-label', '单曲循环');
    return;
  }
  btn.innerHTML = '<span class="music-icon music-icon-repeat"></span>';
  btn.setAttribute('aria-label', '列表循环');
}

function isRenderableHomeMusicFloatingIcon(src){
  var text = String(src || '').trim();
  return !!(text && (
    text.indexOf('data:') === 0 ||
    text.indexOf('http://') === 0 ||
    text.indexOf('https://') === 0 ||
    text.indexOf('blob:') === 0 ||
    text.indexOf('/') === 0 ||
    text.indexOf('./') === 0 ||
    text.indexOf('../') === 0 ||
    text.indexOf('assets/') === 0 ||
    text.indexOf('apps/assets/') === 0
  ));
}

function applyHomeMusicBubbleAppearance(){
  var bubble = document.getElementById('home-music-bubble');
  if(!bubble) return;
  var scale = normalizeHomeMusicBubbleScale(homeMusicState.bubbleScale);
  var floating = document.getElementById('home-music-floating');
  bubble.style.setProperty('--home-music-bubble-scale', String(scale));
  if(floating) floating.style.setProperty('--home-music-bubble-scale', String(scale));
  try{ document.documentElement.style.setProperty('--home-music-bubble-scale', String(scale)); }catch(err){}
  var src = String(homeMusicState.customBubbleIcon || '').trim();
  if(isRenderableHomeMusicFloatingIcon(src)){
    bubble.classList.add('is-custom-image');
    bubble.innerHTML = '<img class="home-music-bubble-custom-image" src="' + escapeHtml(src) + '" alt="音乐悬浮球">';
    bubble.style.minWidth = (44 * scale) + 'px';
    bubble.style.minHeight = (44 * scale) + 'px';
    bubble.style.width = 'auto';
    bubble.style.height = 'auto';
    var img = bubble.querySelector('.home-music-bubble-custom-image');
    if(img){
      img.style.width = (60 * scale) + 'px';
      img.style.height = (60 * scale) + 'px';
      img.style.maxWidth = Math.min(window.innerWidth * 0.2, 72 * scale) + 'px';
      img.style.maxHeight = Math.min(window.innerWidth * 0.2, 72 * scale) + 'px';
    }
    return;
  }
  bubble.classList.remove('is-custom-image');
  bubble.innerHTML = '<span class="home-music-bubble-icon">♪</span>';
  bubble.style.minWidth = '';
  bubble.style.minHeight = '';
  bubble.style.width = (44 * scale) + 'px';
  bubble.style.height = (44 * scale) + 'px';
}

function hydrateHomeMusicFloatingIcon(){
  return loadStoredAsset(HOME_MUSIC_FLOATING_ICON_KEY).then(function(src){
    homeMusicState.customBubbleIcon = String(src || '').trim();
    applyHomeMusicBubbleAppearance();
    applyHomeMusicBubblePosition();
    return homeMusicState.customBubbleIcon;
  }).catch(function(){
    homeMusicState.customBubbleIcon = '';
    applyHomeMusicBubbleAppearance();
    applyHomeMusicBubblePosition();
    return '';
  });
}

function saveHomeMusicFloatingSettings(payload){
  var data = payload && typeof payload === 'object' ? payload : {};
  if(Object.prototype.hasOwnProperty.call(data, 'enabled')){
    homeMusicState.floatingEnabled = !!data.enabled;
    try{ localStorage.setItem(HOME_MUSIC_FLOATING_ENABLED_KEY, homeMusicState.floatingEnabled ? '1' : '0'); }catch(err){}
  }
  if(Object.prototype.hasOwnProperty.call(data, 'icon')){
    var icon = String(data.icon || '').trim();
    homeMusicState.customBubbleIcon = icon;
    if(icon){
      saveStoredAsset(HOME_MUSIC_FLOATING_ICON_KEY, icon).catch(function(){});
    }else{
      removeStoredAsset(HOME_MUSIC_FLOATING_ICON_KEY).catch(function(){});
    }
  }
  if(Object.prototype.hasOwnProperty.call(data, 'size')){
    homeMusicState.bubbleScale = normalizeHomeMusicBubbleScale(data.size);
    try{ localStorage.setItem(HOME_MUSIC_FLOATING_SIZE_KEY, String(homeMusicState.bubbleScale)); }catch(err){}
  }
  persistHomeMusicState();
  renderHomeMusic();
  applyHomeMusicBubbleAppearance();
  requestAnimationFrame(function(){
    syncHomeMusicBubbleLayout();
  });
  setTimeout(function(){
    syncHomeMusicBubbleLayout();
  }, 80);
}

function applyHomeMusicBubblePosition(){
  var floating = document.getElementById('home-music-floating');
  if(!floating) return;
  var host = floating.offsetParent || floating.parentElement || document.querySelector('.screen') || document.body;
  var hostRect = host && typeof host.getBoundingClientRect === 'function'
    ? host.getBoundingClientRect()
    : { left:0, top:0, width:Number(window.innerWidth || 0), height:Number(window.innerHeight || 0) };
  var viewportLeft = 0;
  var viewportTop = 0;
  var viewportWidth = Math.max(0, Number(hostRect.width || 0));
  var viewportHeight = Math.max(0, Number(hostRect.height || 0));
  var margin = 6;
  var minX = viewportLeft + margin;
  var minY = viewportTop + margin;
  var maxX = Math.max(minX, viewportLeft + viewportWidth - floating.offsetWidth - margin);
  var maxY = Math.max(minY, viewportTop + viewportHeight - floating.offsetHeight - margin);
  var x = typeof homeMusicState.bubbleX === 'number' ? homeMusicState.bubbleX : maxX;
  var y = typeof homeMusicState.bubbleY === 'number' ? homeMusicState.bubbleY : Math.max(minY, maxY - 92);
  x = Math.max(minX, Math.min(maxX, x));
  y = Math.max(minY, Math.min(maxY, y));
  homeMusicState.bubbleX = x;
  homeMusicState.bubbleY = y;
  floating.style.left = x + 'px';
  floating.style.top = y + 'px';
  floating.style.right = 'auto';
  floating.style.bottom = 'auto';
}

function syncHomeMusicBubbleLayout(){
  applyHomeMusicBubbleAppearance();
  requestAnimationFrame(function(){
    applyHomeMusicBubblePosition();
  });
}

function renderHomeMusicPlaylist(){
  var listEl = document.getElementById('home-music-playlist');
  if(!listEl) return;
  var tracks = Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks : [];
  if(!tracks.length){
    listEl.innerHTML = '<div class="home-music-track"><div class="home-music-track-inner"><div><div class="home-music-track-name">空空如也，请亲爱的User导入</div><div class="home-music-track-meta">导入本地歌曲后，这里会出现你的播放列表</div></div></div></div>';
    return;
  }
  listEl.innerHTML = tracks.map(function(track, idx){
    var active = track.id === homeMusicState.currentTrackId;
    var sourceLabel = track.source === 'proxy' ? '代理接口' : track.source === 'search' ? '搜索添加' : '本地导入';
    return (
      '<div class="home-music-track' + (active ? ' is-active' : '') + '" data-track-index="' + idx + '">' +
        '<div class="home-music-track-swipe">' +
          '<button class="home-music-track-delete" type="button" onclick="deleteHomeMusicTrack(' + idx + ')">删除</button>' +
        '</div>' +
        '<div class="home-music-track-inner" onclick="playHomeMusicTrackByIndex(' + idx + ')">' +
          '<div class="home-music-track-topline">' +
            '<div class="home-music-track-name">' + escapeHtml(track.name || '未命名歌曲') + '</div>' +
            '<div class="home-music-track-meta">' + escapeHtml(sourceLabel) + '</div>' +
          '</div>' +
          '<div class="home-music-track-actions">' +
            '<button class="home-music-track-btn home-music-track-edit" type="button" onclick="event.stopPropagation();editHomeMusicTrackName(' + idx + ')">改名</button>' +
            '<button class="home-music-track-btn" type="button" onclick="event.stopPropagation();playHomeMusicTrackByIndex(' + idx + ')">' + (active ? '播放中' : '播放') + '</button>' +
            '<button class="home-music-track-btn home-music-track-delete-inline" type="button" onclick="event.stopPropagation();deleteHomeMusicTrack(' + idx + ')">删</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }).join('');
  bindHomeMusicTrackSwipe();
}

function renderHomeMusicCover(){
  var cover = document.getElementById('home-music-cover');
  if(!cover) return;
  var track = getCurrentHomeMusicTrack();
  if(homeMusicAlbumCoverSrc){
    cover.innerHTML = '<img src="' + homeMusicAlbumCoverSrc + '" alt="">';
  }else if(track && track.cover){
    cover.innerHTML = '<img src="' + track.cover + '" alt="">';
  }else{
    cover.innerHTML = '<span>♪</span>';
  }
}

function renderHomeMusicPlaybackUi(){
  var title = document.getElementById('home-music-title');
  var subtitle = document.getElementById('home-music-subtitle');
  var toggleBtn = document.getElementById('home-music-toggle-btn');
  var progress = document.getElementById('home-music-progress');
  var currentTimeEl = document.getElementById('home-music-current-time');
  var totalTimeEl = document.getElementById('home-music-total-time');
  var track = getCurrentHomeMusicTrack();
  if(title) title.textContent = track ? (track.name || '未命名歌曲') : '还没有歌曲';
  if(subtitle) subtitle.textContent = track ? (track.artist || '本地导入') : '先导入本地歌曲，或者搜索喜欢的歌';
  if(toggleBtn){
    toggleBtn.innerHTML = homeMusicState.isPlaying
      ? '<span class="music-icon music-icon-pause"></span>'
      : '<span class="music-icon music-icon-play"></span>';
  }
  if(currentTimeEl) currentTimeEl.textContent = formatHomeMusicTime(homeMusicState.currentTime);
  var duration = track ? Number(track.duration) || 0 : 0;
  if(totalTimeEl) totalTimeEl.textContent = formatHomeMusicTime(duration);
  if(progress){
    progress.max = 1000;
    progress.value = duration > 0 ? Math.max(0, Math.min(1000, Math.round((homeMusicState.currentTime / duration) * 1000))) : 0;
  }
  updateHomeMusicLyricByTime(homeMusicState.currentTime);
  applyHomeMusicEqualizerState();
}

function renderHomeMusic(){
  var floating = document.getElementById('home-music-floating');
  var panel = document.getElementById('home-music-panel');
  var floatingEnabled = homeMusicState.floatingEnabled !== false;
  if(floating) floating.hidden = !floatingEnabled;
  if(floating) floating.classList.toggle('lyric-hidden', !!homeMusicState.lyricHidden);
  if(panel && !floatingEnabled){
    panel.dataset.open = '';
  }
  if(panel) panel.hidden = !panel.dataset.open;
  applyHomeMusicBubbleAppearance();
  renderHomeMusicPlaybackUi();
  renderHomeMusicPlaylist();
  if(floatingEnabled){
    applyHomeMusicBubblePosition();
  }
  syncHomeMusicLyricCardWidth();
  renderHomeMusicModeButton();
}

function syncHomeMusicLyricCardWidth(){
  var card = document.getElementById('home-music-lyric-card');
  if(!card || homeMusicState.lyricHidden) return;
  card.style.width = '';
}

function editHomeMusicTrackName(index){
  var track = Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks[index] : null;
  if(!track) return;
  var editor = document.getElementById('home-music-rename-editor');
  var input = document.getElementById('home-music-rename-input');
  homeMusicRenameIndex = index;
  if(input) input.value = track.name || '';
  if(editor) editor.style.display = 'flex';
  if(input) setTimeout(function(){ input.focus(); input.select(); }, 30);
}

function closeHomeMusicRenameEditor(){
  var editor = document.getElementById('home-music-rename-editor');
  if(editor) editor.style.display = 'none';
  homeMusicRenameIndex = -1;
}

function saveHomeMusicRename(){
  var track = Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks[homeMusicRenameIndex] : null;
  var input = document.getElementById('home-music-rename-input');
  var next = input ? String(input.value || '').trim() : '';
  if(!track || !next){
    closeHomeMusicRenameEditor();
    return;
  }
  track.name = next;
  persistHomeMusicState();
  renderHomeMusic();
  closeHomeMusicRenameEditor();
}

function renderHomeMusicSearchResults(message){
  var root = document.getElementById('home-music-search-results');
  if(!root) return;
  if(homeMusicSearchBusy){
    root.innerHTML = '<div class="home-music-search-empty">正在帮你找歌...</div>';
    return;
  }
  if(message){
    root.innerHTML = '<div class="home-music-search-empty">' + escapeHtml(message) + '</div>';
    return;
  }
  var results = Array.isArray(homeMusicState.searchResults) ? homeMusicState.searchResults : [];
  if(!results.length){
    if(!message){
      root.innerHTML = '';
      return;
    }
    root.innerHTML = '<div class="home-music-search-empty">没有搜到，换个关键词试试看</div>';
    return;
  }
  root.innerHTML = results.map(function(track, idx){
    return (
      '<div class="home-music-search-item">' +
        '<div class="home-music-search-item-top">' +
          '<div class="home-music-search-item-copy">' +
            '<div class="home-music-search-item-name">' + escapeHtml(track.name || '未命名歌曲') + '</div>' +
            '<div class="home-music-search-item-artist">' + escapeHtml(track.artist || '未知歌手') + '</div>' +
          '</div>' +
          '<div class="home-music-search-item-tag">QQ MUSIC</div>' +
        '</div>' +
        '<div class="home-music-search-item-actions">' +
          '<button class="home-music-search-item-btn" type="button" onclick="previewHomeMusicSearchResult(' + idx + ')">试听</button>' +
          '<button class="home-music-search-item-btn primary" type="button" onclick="addHomeMusicSearchResult(' + idx + ')">添加</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function openHomeMusicSearchEditor(){
  var editor = document.getElementById('home-music-search-editor');
  var input = document.getElementById('home-music-search-input');
  if(editor) editor.classList.add('open');
  if(input) setTimeout(function(){ input.focus(); input.select(); }, 30);
  renderHomeMusicSearchResults('');
}

function closeHomeMusicSearchEditor(){
  var editor = document.getElementById('home-music-search-editor');
  if(editor) editor.classList.remove('open');
}

async function submitHomeMusicSearch(){
  var input = document.getElementById('home-music-search-input');
  var query = input ? String(input.value || '').trim() : '';
  if(!query){
    renderHomeMusicSearchResults('先输入歌名或歌手名吧');
    return;
  }
  homeMusicState.searchQuery = query;
  homeMusicSearchBusy = true;
  renderHomeMusicSearchResults();
  try{
    var provider = getHomeMusicProvider().search;
    homeMusicState.searchResults = await provider.searchTracks(query);
    homeMusicSearchBusy = false;
    if(!homeMusicState.searchResults.length){
      renderHomeMusicSearchResults('没有搜到，换个关键词试试看');
      showHomeToast('这次没搜到歌');
    }else{
      renderHomeMusicSearchResults();
    }
  }catch(err){
    console.error('[home-music] search failed', err);
    var message = err && err.message ? err.message : '搜索失败，请稍后再试';
    homeMusicSearchBusy = false;
    renderHomeMusicSearchResults(message);
    showHomeToast(message);
  }finally{
    homeMusicSearchBusy = false;
  }
}

async function previewHomeMusicSearchResult(index){
  var candidate = Array.isArray(homeMusicState.searchResults) ? homeMusicState.searchResults[index] : null;
  if(!candidate) return;
  var existing = getHomeMusicPlaylistTrackByRemoteId(candidate.remoteId);
  if(existing){
    setCurrentHomeMusicTrack(existing.id, true);
    closeHomeMusicSearchEditor();
    return;
  }
  try{
    var previewTrack = cloneHomeMusicTrack(candidate);
    await hydrateHomeMusicThirdPartyTrack(previewTrack);
    if(!String(previewTrack.remoteUrl || '').trim()) throw new Error('歌曲地址获取失败');
    previewTrack.id = previewTrack.id || createTrackId('search_preview');
    homeMusicState.previewTrack = previewTrack;
    homeMusicState.currentTrackId = previewTrack.id;
    homeMusicState.currentTime = 0;
    homeMusicState.currentLyricIndex = -1;
    renderHomeMusic();
    await ensureHomeMusicTrackLoaded(previewTrack, true);
    closeHomeMusicSearchEditor();
    showHomeToast('正在试听');
  }catch(err){
    console.error('[home-music] preview failed', err);
    showHomeToast(err && err.message ? err.message : '试听失败');
  }
}

async function addHomeMusicSearchResult(index){
  var candidate = Array.isArray(homeMusicState.searchResults) ? homeMusicState.searchResults[index] : null;
  if(!candidate) return;
  var existing = getHomeMusicPlaylistTrackByRemoteId(candidate.remoteId);
  if(existing){
    setCurrentHomeMusicTrack(existing.id, true);
    closeHomeMusicSearchEditor();
    showHomeToast('这首已经在歌单里啦');
    return;
  }
  try{
    var track = sanitizeHomeMusicTrackForStorage(cloneHomeMusicTrack(candidate));
    track.id = createTrackId('search');
    await hydrateHomeMusicThirdPartyTrack(track);
    if(!String(track.remoteUrl || '').trim()) throw new Error('歌曲地址获取失败');
    track = sanitizeHomeMusicTrackForStorage(track);
    if(isHomeMusicUnknownName(track.name)){
      track.name = String((candidate && candidate.name) || homeMusicState.searchQuery || track.remoteId || '歌曲').trim() || '歌曲';
    }
    var wasPreviewingSame = !!(homeMusicState.previewTrack && String(homeMusicState.previewTrack.remoteId || '') === String(track.remoteId || ''));
    homeMusicState.tracks = [track].concat(homeMusicState.tracks);
    if(wasPreviewingSame){
      homeMusicState.previewTrack = null;
      homeMusicState.currentTrackId = track.id;
      homeMusicState.currentTime = 0;
      homeMusicState.currentLyricIndex = -1;
    }else if(!homeMusicState.currentTrackId || !getCurrentHomeMusicTrack()){
      homeMusicState.currentTrackId = track.id;
      homeMusicState.currentTime = 0;
      homeMusicState.currentLyricIndex = -1;
    }
    persistHomeMusicState();
    renderHomeMusic();
    closeHomeMusicSearchEditor();
    showHomeToast('已添加到歌单');
  }catch(err){
    console.error('[home-music] add search track failed', err);
    showHomeToast(err && err.message ? err.message : '添加失败');
  }
}

async function deleteHomeMusicTrack(index){
  var tracks = Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks : [];
  var track = tracks[index];
  if(!track) return;
  tracks.splice(index, 1);
  if(track.source === 'local'){
    try{
      if(window.assetStore && typeof window.assetStore.remove === 'function'){
        await window.assetStore.remove(HOME_MUSIC_TRACK_PREFIX + track.id);
      }else{
        await saveStoredAsset(HOME_MUSIC_TRACK_PREFIX + track.id, '');
      }
    }catch(err){}
  }
  if(homeMusicState.currentTrackId === track.id){
    homeMusicState.previewTrack = null;
    homeMusicState.currentTrackId = tracks[0] ? tracks[0].id : '';
    homeMusicState.currentTime = 0;
    homeMusicState.parsedLyrics = [];
    var audio = getHomeMusicAudio();
    if(audio){
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if(homeMusicState.currentTrackId){
      ensureHomeMusicTrackLoaded(getCurrentHomeMusicTrack(), false);
    }
  }
  persistHomeMusicState();
  renderHomeMusic();
  showHomeToast('已删除歌曲');
}

function bindHomeMusicTrackSwipe(){
  var tracks = document.querySelectorAll('.home-music-track[data-track-index]');
  tracks.forEach(function(node){
    if(node.dataset.swipeBound === '1') return;
    node.dataset.swipeBound = '1';
    var inner = node.querySelector('.home-music-track-inner');
    if(!inner) return;
    var startX = 0;
    var startY = 0;
    var dx = 0;
    var dragging = false;
    var swiping = false;
    var touchId = null;
    var reset = function(keepOpen){
      inner.style.transform = keepOpen ? 'translateX(-76px)' : '';
      dragging = false;
      swiping = false;
      touchId = null;
      dx = keepOpen ? -76 : 0;
    };
    node.addEventListener('touchstart', function(evt){
      var touch = evt.changedTouches && evt.changedTouches[0];
      if(!touch || evt.target.closest('button')) return;
      touchId = touch.identifier;
      startX = touch.clientX;
      startY = touch.clientY;
      dragging = true;
      swiping = false;
      dx = 0;
    }, { passive: true });
    node.addEventListener('touchmove', function(evt){
      if(!dragging) return;
      var touch = null;
      for(var i = 0; i < (evt.changedTouches ? evt.changedTouches.length : 0); i += 1){
        if(evt.changedTouches[i].identifier === touchId){
          touch = evt.changedTouches[i];
          break;
        }
      }
      if(!touch) return;
      var moveX = touch.clientX - startX;
      var moveY = touch.clientY - startY;
      if(!swiping && Math.abs(moveY) > 10 && Math.abs(moveY) >= Math.abs(moveX)){
        dragging = false;
        touchId = null;
        dx = 0;
        inner.style.transform = '';
        return;
      }
      if(moveX > 0 || Math.abs(moveX) < 18 || Math.abs(moveX) <= (Math.abs(moveY) + 10)) return;
      swiping = true;
      evt.preventDefault();
      dx = Math.min(0, Math.max(-76, moveX));
      inner.style.transform = 'translateX(' + dx + 'px)';
    }, { passive: false });
    ['touchend','touchcancel'].forEach(function(name){
      node.addEventListener(name, function(evt){
        if(!dragging && !swiping) return;
        var matched = false;
        for(var i = 0; i < (evt.changedTouches ? evt.changedTouches.length : 0); i += 1){
          if(evt.changedTouches[i].identifier === touchId){
            matched = true;
            break;
          }
        }
        if(!matched && touchId !== null) return;
        var shouldOpen = dx <= -38;
        reset(shouldOpen);
      });
    });
  });
}

async function resolveHomeMusicTrackUrl(track){
  if(!track) return '';
  if(track.source === 'search'){
    await hydrateHomeMusicThirdPartyTrack(track);
    if(!track.remoteUrl) throw new Error('歌曲地址获取失败');
    return track.remoteUrl;
  }
  if(track.source === 'proxy'){
    if(track.remoteUrl) return track.remoteUrl;
    var base = String(homeMusicState.proxyBase || '').trim().replace(/\/+$/, '');
    if(!base) throw new Error('未配置 Proxy URL');
    var res = await fetch(base + '/api/music/song?id=' + encodeURIComponent(track.remoteId || track.id));
    if(!res.ok) throw new Error('歌曲地址获取失败');
    var payload = await res.json();
    track.remoteUrl = payload.url || payload.streamUrl || '';
    if(payload.lyrics && !track.lyricsText) track.lyricsText = payload.lyrics;
    if(payload.cover && !track.cover) track.cover = payload.cover;
    persistHomeMusicState();
    return track.remoteUrl;
  }
  var stored = await loadStoredAsset(HOME_MUSIC_TRACK_PREFIX + track.id);
  if(!stored) throw new Error('本地歌曲读取失败');
  if(typeof stored === 'string') return stored;
  if(homeMusicState.objectUrl){
    try{ URL.revokeObjectURL(homeMusicState.objectUrl); }catch(err){}
    homeMusicState.objectUrl = '';
  }
  homeMusicState.objectUrl = URL.createObjectURL(stored);
  return homeMusicState.objectUrl;
}

async function ensureHomeMusicTrackLoaded(track, autoplay){
  var audio = getHomeMusicAudio();
  if(!audio || !track) return;
  try{
    var src = await resolveHomeMusicTrackUrl(track);
    if(audio.src !== src) audio.src = src;
    homeMusicState.parsedLyrics = parseHomeMusicLrc(track.lyricsText || '');
    audio.load();
    if(homeMusicState.currentTime > 0){
      try{ audio.currentTime = homeMusicState.currentTime; }catch(err){}
    }
    if(autoplay){
      await audio.play();
    }
  }catch(err){
    console.error('[home-music] load failed', err);
    showHomeToast(err && err.message ? err.message : '歌曲加载失败');
  }
}

function setCurrentHomeMusicTrack(trackId, autoplay){
  homeMusicState.previewTrack = null;
  homeMusicState.currentTrackId = trackId || '';
  homeMusicState.currentTime = 0;
  homeMusicState.currentLyricIndex = -1;
  persistHomeMusicState();
  renderHomeMusic();
  ensureHomeMusicTrackLoaded(getCurrentHomeMusicTrack(), autoplay);
}

function openHomeMusicImport(){
  var input = document.getElementById('home-music-file');
  if(input){
    input.value = '';
    input.click();
  }
}

async function importHomeMusicFiles(files){
  var provider = getHomeMusicProvider().local;
  var tracks = await provider.importAudioFiles(files);
  if(!tracks.length){
    showHomeToast('没有读到歌曲');
    return;
  }
  homeMusicState.tracks = tracks.concat(homeMusicState.tracks);
  if(!homeMusicState.currentTrackId && tracks[0]) homeMusicState.currentTrackId = tracks[0].id;
  persistHomeMusicState();
  renderHomeMusic();
  ensureHomeMusicTrackLoaded(getCurrentHomeMusicTrack(), false);
  showHomeToast('已导入 ' + tracks.length + ' 首歌曲');
}

function openHomeMusicPanel(){
  if(homeMusicState.floatingEnabled === false){
    return;
  }
  var panel = document.getElementById('home-music-panel');
  if(panel){
    panel.dataset.open = '1';
    panel.hidden = false;
  }
  renderHomeMusic();
}

function closeHomeMusicPanel(){
  var panel = document.getElementById('home-music-panel');
  if(panel){
    panel.dataset.open = '';
    panel.hidden = true;
  }
}

async function toggleHomeMusicPlayback(){
  var audio = getHomeMusicAudio();
  var track = getCurrentHomeMusicTrack();
  if(!audio) return;
  if(!track){
    openHomeMusicPanel();
    showHomeToast('先导入一首歌');
    return;
  }
  if(!audio.src){
    await ensureHomeMusicTrackLoaded(track, true);
    return;
  }
  try{
    if(audio.paused){
      await audio.play();
    }else{
      audio.pause();
    }
  }catch(err){
    console.error('[home-music] toggle failed', err);
  }
}

function playHomeMusicTrackByIndex(index){
  var track = Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks[index] : null;
  if(!track) return;
  setCurrentHomeMusicTrack(track.id, true);
}

function playPrevHomeMusic(){
  var tracks = Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks : [];
  if(!tracks.length) return;
  var idx = tracks.findIndex(function(track){ return track.id === homeMusicState.currentTrackId; });
  if(idx < 0) idx = 0;
  idx = (idx - 1 + tracks.length) % tracks.length;
  setCurrentHomeMusicTrack(tracks[idx].id, true);
}

function playNextHomeMusic(){
  var tracks = Array.isArray(homeMusicState.tracks) ? homeMusicState.tracks : [];
  if(!tracks.length) return;
  if(getHomeMusicPlayMode() === 'shuffle' && tracks.length > 1){
    var currentIndex = tracks.findIndex(function(track){ return track.id === homeMusicState.currentTrackId; });
    var nextIndex = currentIndex;
    while(nextIndex === currentIndex){
      nextIndex = Math.floor(Math.random() * tracks.length);
    }
    setCurrentHomeMusicTrack(tracks[nextIndex].id, true);
    return;
  }
  var idx = tracks.findIndex(function(track){ return track.id === homeMusicState.currentTrackId; });
  if(idx < 0) idx = -1;
  idx = (idx + 1) % tracks.length;
  setCurrentHomeMusicTrack(tracks[idx].id, true);
}

function cycleHomeMusicPlayMode(){
  var current = getHomeMusicPlayMode();
  homeMusicState.playMode = current === 'repeat-all'
    ? 'repeat-one'
    : current === 'repeat-one'
      ? 'shuffle'
      : 'repeat-all';
  persistHomeMusicState();
  renderHomeMusic();
  showHomeToast(
    homeMusicState.playMode === 'repeat-one'
      ? '单曲循环'
      : homeMusicState.playMode === 'shuffle'
        ? '随机播放'
        : '列表循环'
  );
}

function bindHomeMusicSystem(){
  hydrateHomeMusicState();
  var bubble = document.getElementById('home-music-bubble');
  var floating = document.getElementById('home-music-floating');
  var panel = document.getElementById('home-music-panel');
  var renameEditor = document.getElementById('home-music-rename-editor');
  var searchEditor = document.getElementById('home-music-search-editor');
  var fileInput = document.getElementById('home-music-file');
  var audio = getHomeMusicAudio();
  var progress = document.getElementById('home-music-progress');
  var screen = document.querySelector('.screen');
  if(screen){
    if(floating && floating.parentElement !== screen) screen.appendChild(floating);
    if(panel && panel.parentElement !== screen) screen.appendChild(panel);
    if(renameEditor && renameEditor.parentElement !== screen) screen.appendChild(renameEditor);
    if(searchEditor && searchEditor.parentElement !== screen) screen.appendChild(searchEditor);
  }
  if(floating){
    floating.hidden = homeMusicState.floatingEnabled === false;
    floating.addEventListener('pointerdown', function(evt){
      homeMusicBubbleMoved = false;
      homeMusicDragState = {
        pointerId: evt.pointerId,
        startX: evt.clientX,
        startY: evt.clientY,
        originX: typeof homeMusicState.bubbleX === 'number' ? homeMusicState.bubbleX : 0,
        originY: typeof homeMusicState.bubbleY === 'number' ? homeMusicState.bubbleY : 0
      };
      try{ floating.setPointerCapture(evt.pointerId); }catch(err){}
    });
    floating.addEventListener('pointermove', function(evt){
      if(!homeMusicDragState || evt.pointerId !== homeMusicDragState.pointerId) return;
      var dx = evt.clientX - homeMusicDragState.startX;
      var dy = evt.clientY - homeMusicDragState.startY;
      if(Math.abs(dx) > 4 || Math.abs(dy) > 4) homeMusicBubbleMoved = true;
      homeMusicState.bubbleX = homeMusicDragState.originX + dx;
      homeMusicState.bubbleY = homeMusicDragState.originY + dy;
      applyHomeMusicBubblePosition();
    });
    ['pointerup','pointercancel'].forEach(function(name){
      floating.addEventListener(name, function(evt){
        if(!homeMusicDragState || evt.pointerId !== homeMusicDragState.pointerId) return;
        persistHomeMusicState();
        homeMusicDragState = null;
      });
    });
  }
  if(window.visualViewport && !window.visualViewport.__homeMusicBound){
    window.visualViewport.__homeMusicBound = true;
    window.visualViewport.addEventListener('resize', applyHomeMusicBubblePosition);
    window.visualViewport.addEventListener('scroll', applyHomeMusicBubblePosition);
  }
  if(!window.__homeMusicResizeBound){
    window.__homeMusicResizeBound = true;
    window.addEventListener('resize', applyHomeMusicBubblePosition);
  }
  if(bubble){
    bubble.addEventListener('click', function(evt){
      if(homeMusicBubbleMoved){
        evt.preventDefault();
        return;
      }
      var now = Date.now();
      if(now - homeMusicBubbleLastTapAt < 260){
        homeMusicBubbleLastTapAt = 0;
        if(homeMusicBubbleClickTimer){
          clearTimeout(homeMusicBubbleClickTimer);
          homeMusicBubbleClickTimer = 0;
        }
        homeMusicState.lyricHidden = !homeMusicState.lyricHidden;
        persistHomeMusicState();
        renderHomeMusic();
        return;
      }
      homeMusicBubbleLastTapAt = now;
      if(homeMusicBubbleClickTimer){
        clearTimeout(homeMusicBubbleClickTimer);
        homeMusicBubbleClickTimer = 0;
      }
      homeMusicBubbleClickTimer = setTimeout(function(){
        homeMusicBubbleClickTimer = 0;
        homeMusicBubbleLastTapAt = 0;
        if(panel && panel.dataset.open){
          closeHomeMusicPanel();
        }else{
          openHomeMusicPanel();
        }
      }, 180);
    });
  }
  if(panel){
    panel.addEventListener('click', function(evt){
      if(evt.target === panel) closeHomeMusicPanel();
    });
  }
  ['home-music-rename-editor', 'home-music-search-editor'].forEach(function(id){
    var editor = document.getElementById(id);
    if(!editor) return;
    editor.addEventListener('click', function(evt){
      if(evt.target !== editor) return;
      if(id === 'home-music-rename-editor') closeHomeMusicRenameEditor();
      if(id === 'home-music-search-editor') closeHomeMusicSearchEditor();
    });
  });
  if(fileInput){
    fileInput.addEventListener('change', function(evt){
      var files = Array.prototype.slice.call((evt.target && evt.target.files) || []);
      if(!files.length) return;
      importHomeMusicFiles(files).catch(function(err){
        console.error('[home-music] import failed', err);
        showHomeToast('歌曲导入失败');
      });
    });
  }
  var searchInput = document.getElementById('home-music-search-input');
  if(searchInput){
    searchInput.addEventListener('keydown', function(evt){
      if(evt.key === 'Enter'){
        evt.preventDefault();
        submitHomeMusicSearch();
      }
    });
  }
  if(audio){
    audio.addEventListener('loadedmetadata', function(){
      var track = getCurrentHomeMusicTrack();
      if(track){
        track.duration = Number(audio.duration) || track.duration || 0;
        persistHomeMusicState();
      }
      try{
        if(homeMusicState.currentTime > 0) audio.currentTime = homeMusicState.currentTime;
      }catch(err){}
      renderHomeMusic();
    });
    audio.addEventListener('timeupdate', function(){
      homeMusicState.currentTime = Number(audio.currentTime) || 0;
      renderHomeMusicPlaybackUi();
    });
    audio.addEventListener('play', function(){
      homeMusicState.isPlaying = true;
      renderHomeMusicPlaybackUi();
    });
    audio.addEventListener('pause', function(){
      homeMusicState.isPlaying = false;
      renderHomeMusicPlaybackUi();
    });
    audio.addEventListener('ended', function(){
      if(getHomeMusicPlayMode() === 'repeat-one'){
        audio.currentTime = 0;
        audio.play().catch(function(){});
        return;
      }
      playNextHomeMusic();
    });
  }
  if(progress){
    progress.addEventListener('input', function(){
      var audioEl = getHomeMusicAudio();
      var track = getCurrentHomeMusicTrack();
      if(!audioEl || !track || !(Number(track.duration) > 0)) return;
      var nextTime = (Number(progress.value) / 1000) * Number(track.duration);
      audioEl.currentTime = nextTime;
      homeMusicState.currentTime = nextTime;
      renderHomeMusicPlaybackUi();
    });
  }
  renderHomeMusic();
  hydrateHomeMusicFloatingIcon();
  loadStoredAsset('home_slot_musicAlbum').then(function(src){
    homeMusicAlbumCoverSrc = typeof src === 'string' ? src : '';
    renderHomeMusicCover();
  });
  if(homeMusicState.currentTrackId){
    ensureHomeMusicTrackLoaded(getCurrentHomeMusicTrack(), false);
  }
}

window.openHomeMusicImport = openHomeMusicImport;
window.openHomeMusicSearchEditor = openHomeMusicSearchEditor;
window.closeHomeMusicSearchEditor = closeHomeMusicSearchEditor;
window.submitHomeMusicSearch = submitHomeMusicSearch;
window.previewHomeMusicSearchResult = previewHomeMusicSearchResult;
window.addHomeMusicSearchResult = addHomeMusicSearchResult;
window.closeHomeMusicPanel = closeHomeMusicPanel;
window.toggleHomeMusicPlayback = toggleHomeMusicPlayback;
window.playPrevHomeMusic = playPrevHomeMusic;
window.playNextHomeMusic = playNextHomeMusic;
window.cycleHomeMusicPlayMode = cycleHomeMusicPlayMode;
window.playHomeMusicTrackByIndex = playHomeMusicTrackByIndex;
window.editHomeMusicTrackName = editHomeMusicTrackName;
window.closeHomeMusicRenameEditor = closeHomeMusicRenameEditor;
window.saveHomeMusicRename = saveHomeMusicRename;
window.deleteHomeMusicTrack = deleteHomeMusicTrack;

// Maintain a simple app navigation stack so Back can return to the previous app
const appStack=[];
let currentApp=null;
let pendingOpenChatCharId='';
let pendingOpenChatNonce='';
let pendingOpenOfflineCharId='';
let pendingOpenOfflineNonce='';
let pendingOpenOfflineLaunchMode='';
let pendingOpenOfflineLaunchToken='';
let pendingOpenOfflineLaunchRecord=null;
let appTransitionPromise = Promise.resolve();

function clonePendingOfflineLaunchRecord(record){
  if(!record || typeof record !== 'object') return null;
  try{
    return JSON.parse(JSON.stringify(record));
  }catch(err){
    return null;
  }
}

function consumePendingOfflineLaunchRecord(options){
  var record = clonePendingOfflineLaunchRecord(pendingOpenOfflineLaunchRecord);
  if(!record) return null;
  var requestedToken = String(options && options.launchToken || '').trim();
  var requestedCharId = String(options && options.charId || '').trim();
  var recordToken = String(record.launchToken || '').trim();
  var recordCharId = String(record.charId || '').trim();
  if(requestedToken && recordToken && requestedToken !== recordToken) return null;
  if(requestedCharId && recordCharId && requestedCharId !== recordCharId) return null;
  pendingOpenOfflineLaunchRecord = null;
  return record;
}

window.consumePendingOfflineLaunchRecord = consumePendingOfflineLaunchRecord;

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
  var foregroundChar = getCurrentForegroundCharacter();
  if(foregroundChar && foregroundChar.id){
    persistShellActiveCharacter(foregroundChar);
  }
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
    const c = foregroundChar && foregroundChar.id ? foregroundChar : getActiveCharacterData();
    if(c) setWidgetCharacter(c);
    renderBondWidget(c);
  }catch(e){
    renderBondWidget(null);
  }
  setTimeout(()=>{ document.getElementById('app-iframe').src=''; },400);
}

function buildAppFrameUrl(src){
  try{
    var url = new URL(String(src || ''), window.location.href);
    url.searchParams.set('__appBuild', APP_BUILD_ID);
    if(/\/apps\/worldbook\.html$/i.test(url.pathname || '')){
      url.searchParams.set('__ts', String(Date.now()));
    }
    if(/\/apps\/chat\.html$/i.test(url.pathname || '') && pendingOpenChatCharId){
      url.searchParams.set('char', String(pendingOpenChatCharId || '').trim());
      if(pendingOpenChatNonce){
        url.searchParams.set('__chatNav', String(pendingOpenChatNonce || ''));
      }
    }
    if(/\/apps\/offline_mode\.html$/i.test(url.pathname || '') && pendingOpenOfflineCharId){
      url.searchParams.set('char', String(pendingOpenOfflineCharId || '').trim());
      if(pendingOpenOfflineNonce){
        url.searchParams.set('__offlineNav', String(pendingOpenOfflineNonce || ''));
      }
      if(pendingOpenOfflineLaunchMode){
        url.searchParams.set('__offlineSource', String(pendingOpenOfflineLaunchMode || '').trim());
      }
      if(pendingOpenOfflineLaunchToken){
        url.searchParams.set('__offlineLaunchToken', String(pendingOpenOfflineLaunchToken || '').trim());
      }
    }
    return url.toString();
  }catch(err){
    return String(src || '');
  }
}

var shellLoadingHideTimer = 0;
var shellLoadingForceTimer = 0;
function showShellLoadingOverlay(kind){
  var overlay = document.getElementById('shell-loading-overlay');
  var image = document.getElementById('shell-loading-image');
  var copy = document.getElementById('shell-loading-copy');
  if(!overlay || !image || !copy) return;
  if(shellLoadingHideTimer){
    clearTimeout(shellLoadingHideTimer);
    shellLoadingHideTimer = 0;
  }
  if(shellLoadingForceTimer){
    clearTimeout(shellLoadingForceTimer);
    shellLoadingForceTimer = 0;
  }
  image.src = 'apps/assets/loading-cat.png';
  overlay.classList.add('show');
  shellLoadingForceTimer = setTimeout(function(){
    overlay.classList.remove('show');
    shellLoadingForceTimer = 0;
  }, 1800);
}

function hideShellLoadingOverlay(delay){
  var overlay = document.getElementById('shell-loading-overlay');
  if(!overlay) return;
  if(shellLoadingHideTimer){
    clearTimeout(shellLoadingHideTimer);
    shellLoadingHideTimer = 0;
  }
  if(shellLoadingForceTimer){
    clearTimeout(shellLoadingForceTimer);
    shellLoadingForceTimer = 0;
  }
  shellLoadingHideTimer = setTimeout(function(){
    overlay.classList.remove('show');
    shellLoadingHideTimer = 0;
  }, Math.max(0, Number(delay) || 0));
}

function renderApp(id){
  const a=APP_MAP[id]; if(!a) return;
  currentApp=id;
  pushBackendLogEntry({
    level: 'info',
    app: id,
    source: 'app.open',
    message: '打开 ' + String(a.title || id)
  });
  const outer = document.querySelector('.phone-outer');
  const container = document.getElementById('app-container');
  const frame = document.getElementById('app-iframe');
  const topbar = document.querySelector('.app-topbar');
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
  if(topbar){
    topbar.style.display = '';
  }
  if(frame){
    frame.style.marginTop = '';
    if(frame.dataset){
      frame.dataset.csPrevMarginTop = '';
    }
  }
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
  showShellLoadingOverlay('app');
  document.getElementById('app-iframe').src = buildAppFrameUrl(a.src);
  if(id === 'chat'){
    pendingOpenChatCharId = '';
    pendingOpenChatNonce = '';
  }
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
  try{
    var frame = document.getElementById('app-iframe');
    if(frame && frame.contentWindow){
      frame.contentWindow.postMessage({ type:'PARENT_CHAT_COMPOSER_SHIFT', payload: shift }, '*');
    }
  }catch(err){}
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
    if(currentApp === 'offline_archive'){
      var archiveCopy = '每次约会收进这里。说完再见就存好，没说完就先待续。';
      var heroSub = doc.querySelector('.hero-sub');
      if(heroSub) heroSub.textContent = archiveCopy;
      var archiveTextNodes = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      while(archiveTextNodes.nextNode()){
        var textNode = archiveTextNodes.currentNode;
        var text = String(textNode.nodeValue || '').trim();
        if(!text) continue;
        if(
          text.indexOf('每次约会都会收进这里') !== -1 ||
          text.indexOf('每次约会都收进这里') !== -1 ||
          text.indexOf('每次约会收进这里') !== -1
        ){
          textNode.nodeValue = archiveCopy;
        }
      }
      var emptyTitle = doc.querySelector('.empty h3');
      if(emptyTitle) emptyTitle.textContent = '这里还空空的';
      var emptyDesc = doc.querySelector('.empty p');
      if(emptyDesc) emptyDesc.textContent = '等你们攒下一次线下约会，它就会乖乖躺进来。';
    }
  }catch(err){
    console.warn('safe area override skipped', err);
  }
}

function openApp(id) {
  if(!APP_MAP[id]) return Promise.resolve();
  return runAppTransition(async function(){
    if(id === 'worldbook'){
      var activeForWorldbook = currentApp === 'chat' ? getCurrentForegroundCharacter() : getActiveCharacterData();
      var wbCharId = String((activeForWorldbook && activeForWorldbook.id) || '').trim();
      if(wbCharId){
        try{ localStorage.setItem('wbCharId', wbCharId); }catch(err){}
      }
    }
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
    if(id === 'worldbook'){
      var activeForWorldbook = currentApp === 'chat' ? getCurrentForegroundCharacter() : getActiveCharacterData();
      var wbCharId = String((activeForWorldbook && activeForWorldbook.id) || '').trim();
      if(wbCharId){
        try{ localStorage.setItem('wbCharId', wbCharId); }catch(err){}
      }
    }
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
  var sideAvatar = document.getElementById('wgt-side-avatar');
  if(sideAvatar) sideAvatar.innerHTML='<span class="widget-mini-orb-plus">+</span>';
  var sideOrb = document.getElementById('widget-mini-orb');
  if(sideOrb) sideOrb.classList.remove('has-image');
  document.getElementById('wgt-user-avatar').textContent='你';
  document.getElementById('wgt-name').textContent='No companion yet';
  var sideName = document.getElementById('wgt-side-name');
  if(sideName) sideName.textContent='CHAR';
  document.getElementById('wgt-char-role').textContent='CHAR';
  document.getElementById('wgt-user-role').textContent='USER';
  document.getElementById('wgt-char-last').textContent=getDefaultWidgetCharacterQuote('char');
  document.getElementById('wgt-user-last').textContent=getDefaultWidgetCharacterQuote('user');
  try{ localStorage.removeItem(getWidgetLastChatCharKey()); }catch(e){}
  try{ localStorage.removeItem(WIDGET_LAST_CHAT_CHAR_KEY); }catch(e){}
  applyWidgetCharacterBackground('');
  applyClockWidgetArt('');
  applyWidgetMiniOrbImage('');
  ['top','1','2','3','4'].forEach((id)=>renderHomeSlot(id, null));
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
    const slim = persistShellActiveCharacter(payload) || slimChar(payload);
    setWidgetCharacter(payload);
    cacheAvatar(payload);
    renderBondWidget(payload);
    renderHomeDockBadges();
    if(currentApp === 'chat'){
      postToChat({ type:'SET_ACTIVE_CHARACTER', payload: slim });
    }
  }
  if(type==='BOND_WIDGET_PREVIEW'){
    applyBondWidgetPreview(payload);
  }
  if(type==='CHARACTER_IMPORTED'){
    // When a card is imported, immediately reflect it on the home widget.
    const slim = persistShellActiveCharacter(payload) || slimChar(payload);
    cacheAvatar(payload);
    setWidgetCharacter(payload);
    renderBondWidget(payload);
    renderHomeDockBadges();
  }
  if(type==='OPEN_CHAT_WITH'){
    const slim = persistShellActiveCharacter(payload) || slimChar(payload);
    setWidgetCharacter(payload);
    renderBondWidget(payload);
    try{ localStorage.setItem('pendingChatChar',JSON.stringify(slim)); }catch(e){}
    try{ localStorage.setItem('pendingChatCharId', String((slim && slim.id) || '')); }catch(e){}
    pendingOpenChatCharId = String((slim && slim.id) || '').trim();
    pendingOpenChatNonce = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8);
    replaceApp('chat');
  }
  if(type==='OPEN_CHAT_SETTINGS'){
    var activeSlim = payload ? slimChar(payload) : getActiveCharacterData();
    openApp('chat');
    if(activeSlim && activeSlim.id){
      persistShellActiveCharacter(activeSlim);
      setWidgetCharacter(activeSlim);
      renderBondWidget(activeSlim);
      postToChat({ type:'SET_ACTIVE_CHARACTER', payload: activeSlim });
    }
    [120, 280, 520].forEach(function(delay){
      setTimeout(function(){ postToChat({ type:'OPEN_CHAT_SETTINGS' }); }, delay);
    });
  }
  if(type==='WORLDBOOK_TOPBAR'){
    var container = document.getElementById('app-container');
    if(container && currentApp === 'worldbook'){
      container.classList.toggle('no-topbar', !!e.data.hidden);
    }
  }
  if(type==='OPEN_APP_WITH'){
    var appId=payload.app;
    if(payload.charId) localStorage.setItem('wbCharId', payload.charId);
    if(appId === 'schedule' && payload.charId){
      try{ localStorage.setItem('scheduleCharId', payload.charId); }catch(err){}
    }
    if(appId === 'offline' && payload.charId){
      pendingOpenOfflineCharId = String(payload.charId || '').trim();
      pendingOpenOfflineNonce = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8);
      pendingOpenOfflineLaunchMode = String(payload.launchMode || '').trim();
      pendingOpenOfflineLaunchToken = String(payload.launchToken || '').trim();
      pendingOpenOfflineLaunchRecord = clonePendingOfflineLaunchRecord(payload.offlineLaunchRecord || null);
      try{ localStorage.setItem(scopedKeyForAccount('activeOfflineCharacterId', getActiveAccountId()), pendingOpenOfflineCharId); }catch(err){}
      try{ localStorage.setItem('activeOfflineCharacterId', pendingOpenOfflineCharId); }catch(err){}
      replaceApp(appId);
      return;
    }
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
  if(type==='QQ_BADGE_SYNC'){
    var activeAcctId = getActiveAccountId();
    if(activeAcctId){
      qqUnreadCountCache[activeAcctId] = Math.max(0, Number(payload && payload.chatUnread || 0) || 0);
      qqMomentsUnreadCountCache[activeAcctId] = Math.max(0, Number(payload && payload.momentsUnread || 0) || 0);
    }
    renderHomeDockBadges();
  }
  if(type==='OPEN_APP'){ openApp(payload); }
  if(type==='OPEN_APP_REPLACE'){ replaceApp(payload); }
  if(type==='BACKEND_LOG_PUSH'){
    pushBackendLogEntry(payload || {});
  }
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
  if(type==='SET_HOME_MUSIC_FLOATING'){
    saveHomeMusicFloatingSettings(payload || {});
    syncHomeMusicBubbleLayout();
    showHomeToast(homeMusicState.floatingEnabled === false ? '音乐悬浮球已关闭' : '音乐悬浮球已更新');
  }
  if(type==='SHOW_HOME_TOAST'){ showHomeToast(payload); }
  if(type==='SET_WALLPAPER'){ setWallpaper(payload); }
  if(type==='CLOSE_APP'){ closeApp(); }
  if(type==='FORMAT_EPHONE'){ formatEphone(); }
  if(type==='SETTINGS_SAVED'){
    if(payload && payload.shellNotifySettings){
      shellNotificationSettingsCache = normalizeShellNotificationSettings(payload.shellNotifySettings);
    }
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
      persistWidgetLastChatCharacter(nextChar);
    }
    if(currentApp === 'chat' && nextChar && nextChar.id){
      persistShellActiveCharacter(nextChar);
    }
    var currentActive = getActiveCharacterData();
    var currentActiveId = String((currentActive && currentActive.id) || '').trim();
    var nextCharId = String((nextChar && nextChar.id) || '').trim();
    if(nextChar && nextCharId && (!currentActiveId || currentActiveId === nextCharId)){
      setWidgetCharacter(nextChar);
      renderBondWidget(nextChar);
    }else{
      var ac = getActiveCharacterData();
      if(ac) renderBondWidget(ac);
    }
    renderHomeDockBadges();
  }
});

if(typeof navigator !== 'undefined' && navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === 'function'){
  navigator.serviceWorker.addEventListener('message', function(event){
    var data = event && event.data || {};
    if(String(data.type || '').trim() !== 'OPEN_SHELL_NOTIFICATION') return;
    openShellNotificationPayload(data.payload || {});
  });
}

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
  var safe = String(type || '').trim().toLowerCase();
  if(safe === 'rich_html' || safe === 'richhtml' || safe === 'html_card') return 'richhtml';
  if(safe === 'recall_notice' || safe === 'recallnotice' || safe === 'withdraw_notice') return 'recallnotice';
  if(safe === 'narrator' || safe === 'narrator_message') return 'narrator';
  if(safe === 'schedule_quote' || safe === 'schedulequote') return 'schedulequote';
  if(type === 'voice_message' || type === 'voice') return 'voice';
  if(type === 'image_message' || type === 'image_card' || type === 'image') return 'image';
  if(type === 'meme_message' || type === 'meme' || type === 'sticker') return 'meme';
  if(type === 'family_card' || type === 'familycard') return 'familycard';
  if(type === 'money_packet' || type === 'moneypacket' || type === 'transfer') return 'moneypacket';
  if(type === 'offline_invite' || type === 'offlineinvite') return 'offlineinvite';
  if(type === 'sunny_card' || type === 'sunnycard' || type === 'support_card') return 'sunnycard';
  return 'text';
}

function summarizeOfflineInvitePreview(content){
  var raw = content;
  try{
    if(typeof raw === 'string'){
      raw = JSON.parse(raw);
    }
  }catch(e){}
  var invite = raw && typeof raw === 'object' ? raw : null;
  if(!invite) return '【线下邀约】';
  var text = String(invite.content || invite.summary || '').trim();
  var location = String(invite.location || '').trim();
  if(text && location) return text + ' · ' + location;
  return text || location || '【线下邀约】';
}

function summarizeMemePreview(content){
  var raw = content;
  try{
    if(typeof raw === 'string'){
      raw = JSON.parse(raw);
    }
  }catch(e){}
  var name = '';
  if(raw && typeof raw === 'object'){
    name = String(raw.name || raw.content || raw.text || '').trim();
  }
  if(!name && /^\[(?:表情包|meme)\s*[:：]\s*([^\]]+)\]$/i.test(String(content || '').trim())){
    name = String(String(content || '').trim().match(/^\[(?:表情包|meme)\s*[:：]\s*([^\]]+)\]$/i)[1] || '').trim();
  }
  return name ? ('【表情包】' + name) : '【表情包】';
}

function normalizePreviewMessage(msg){
  var next = msg && typeof msg === 'object' ? msg : { content:'', type:'text' };
  var kind = normalizeChatPreviewType(next.type || 'text');
  if(kind === 'sunnycard'){
    try{
      var sunnyCard = typeof next.content === 'string' ? JSON.parse(next.content) : next.content;
      return { content: String((sunnyCard && (sunnyCard.summary || sunnyCard.text || sunnyCard.title)) || 'Sunny 卡片').trim(), type: 'text' };
    }catch(err){
      return { content:'Sunny 卡片', type:'text' };
    }
  }
  if(kind === 'text' && /^\[(?:表情包|meme)\s*[:：]\s*[^\]]+\]$/i.test(String(next.content || '').trim())){
    return { content: summarizeMemePreview(next.content), type: 'text' };
  }
  if(kind === 'familycard'){
    return { content: '【亲属卡】', type: 'text' };
  }
  if(kind === 'richhtml'){
    return { content: '【SURPRISE】', type: 'text' };
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
  if(kind === 'offlineinvite'){
    return { content: summarizeOfflineInvitePreview(next.content), type: 'text' };
  }
  if(kind === 'meme'){
    return { content: summarizeMemePreview(next.content), type: 'text' };
  }
  if(kind === 'recallnotice'){
    try{
      var recallPayload = typeof next.content === 'string' ? JSON.parse(next.content) : next.content;
      var actorName = '';
      var noticeText = String((recallPayload && recallPayload.notice) || '').trim();
      var nameMatch = noticeText.match(/^句子已经被(.+?)毁尸灭迹啦\^\^/);
      if(nameMatch) actorName = String(nameMatch[1] || '').trim();
      if(!actorName) actorName = String(((recallPayload && recallPayload.actorRole) === 'user') ? '你' : '对方').trim() || '对方';
      return { content: actorName + '撤回了一条消息', type: 'text' };
    }catch(e){
      return { content: '撤回了一条消息', type: 'text' };
    }
  }
  if(kind === 'text' && typeof next.content === 'string' && next.content.trim().startsWith('{')){
    try{
      var parsed = JSON.parse(next.content);
      if(parsed && typeof parsed === 'object'){
        if((parsed.html || parsed.css || parsed.js) && !parsed.type){
          return { content: '【SURPRISE】', type: 'text' };
        }
        if(parsed.content){
          var parsedType = normalizeChatPreviewType(parsed.type || 'text');
          if(parsedType === 'meme') return { content: summarizeMemePreview(parsed.content), type: 'text' };
          if(parsedType === 'richhtml') return { content: '【SURPRISE】', type: 'text' };
          if(parsedType === 'recallnotice'){
            var parsedRecallPayload = typeof parsed.content === 'string' ? JSON.parse(parsed.content) : parsed.content;
            var parsedActorName = '';
            var parsedNoticeText = String((parsedRecallPayload && parsedRecallPayload.notice) || '').trim();
            var parsedNameMatch = parsedNoticeText.match(/^句子已经被(.+?)毁尸灭迹啦\^\^/);
            if(parsedNameMatch) parsedActorName = String(parsedNameMatch[1] || '').trim();
            if(!parsedActorName) parsedActorName = String(((parsedRecallPayload && parsedRecallPayload.actorRole) === 'user') ? '你' : '对方').trim() || '对方';
            return { content: parsedActorName + '撤回了一条消息', type: 'text' };
          }
          return { content: parsed.content, type: parsedType };
        }
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
  if(kind === 'meme'){
    return '【表情包】';
  }
  if(kind === 'richhtml'){
    return '【SURPRISE】';
  }
  return next.content || '';
}

function getLatestPreviewForRole(messages, role){
  var list = Array.isArray(messages) ? messages : [];
  var target = String(role || '').trim().toLowerCase();
  for(var i = list.length - 1; i >= 0; i--){
    var entry = list[i] || {};
    if(entry.hidden) continue;
    var entryRole = String((entry.role || entry.sender || entry.from || '') || '').toLowerCase();
    var matched = target === 'user'
      ? entryRole === 'user'
      : isAssistantPreviewMessage(entry);
    if(!matched) continue;
    return normalizePreviewMessage(entry);
  }
  return { content:'', type:'text' };
}

function formatWidgetConversationLine(text, fallback){
  var src = String(text || '').replace(/\s+/g, ' ').trim();
  if(!src) return String(fallback || '').trim();
  var max = 34;
  return src.length > max ? (src.slice(0, max - 1).trim() + '…') : src;
}

function applyWidgetUserAvatarContent(target, src, fallback){
  if(!target) return;
  var safeSrc = normalizeShellAssetSrc(src || '');
  if(isRenderableShellAvatarSrc(safeSrc)){
    target.innerHTML = '<img src="' + safeSrc + '" alt="">';
    return;
  }
  target.textContent = String(fallback || '你').trim() || '你';
}

function getDefaultWidgetCharacterQuote(role){
  return String(role || '') === 'user'
    ? '在时间的尽头我们终将重逢'
    : '因为爱与希望是永恒存在的';
}

function getEffectiveWidgetCharacterBackgroundSource(src){
  var safe = normalizeShellAssetSrc(src || '');
  return isRenderableShellAvatarSrc(safe) ? safe : 'apps/assets/樱花在水里.jpg';
}

function getWidgetTextOverrideKey(role){
  var base = String(role || '') === 'user' ? WIDGET_TEXT_OVERRIDE_USER_KEY : WIDGET_TEXT_OVERRIDE_CHAR_KEY;
  return scopedKeyForAccount(base, getActiveAccountId());
}

function getWidgetTextOverride(role){
  try{
    var value = localStorage.getItem(getWidgetTextOverrideKey(role));
    return value == null ? '' : String(value || '');
  }catch(e){
    return '';
  }
}

function setWidgetTextOverride(role, value){
  var key = getWidgetTextOverrideKey(role);
  try{
    var next = String(value || '').trim();
    if(next){
      localStorage.setItem(key, next);
    }else{
      localStorage.removeItem(key);
    }
  }catch(e){}
}

function getWidgetLastChatCharKey(){
  return scopedKeyForAccount(WIDGET_LAST_CHAT_CHAR_KEY, getActiveAccountId());
}

function persistWidgetLastChatCharacter(character){
  var slim = slimChar(character);
  if(!slim || !slim.id) return null;
  try{ localStorage.setItem(getWidgetLastChatCharKey(), JSON.stringify(slim)); }catch(e){}
  return slim;
}

function getWidgetLastChatCharacter(){
  var keys = [getWidgetLastChatCharKey(), WIDGET_LAST_CHAT_CHAR_KEY];
  for(var i = 0; i < keys.length; i++){
    try{
      var raw = localStorage.getItem(keys[i]);
      if(!raw) continue;
      var parsed = JSON.parse(raw);
      if(parsed && parsed.id) return parsed;
    }catch(e){}
  }
  return null;
}

function applyWidgetCharacterBackground(src){
  var widgetEl = document.getElementById('widget-character');
  var finalSrc = getEffectiveWidgetCharacterBackgroundSource(src);
  if(widgetEl){
    widgetEl.style.setProperty('--widget-char-art', 'url("' + finalSrc.replace(/"/g, '\\"') + '")');
  }
}

function restoreWidgetCharacterBackground(){
  loadStoredAsset(WIDGET_CHARACTER_BG_KEY).then(function(src){
    applyWidgetCharacterBackground(src);
  });
}

function bindWidgetCharacterBackgroundInput(){
  var input = document.getElementById('widget-character-bg-input');
  if(!input) return;
  input.addEventListener('change', async function(e){
    var file = e && e.target && e.target.files ? e.target.files[0] : null;
    if(!file) return;
    try{
      var rawData = await fileToDataUrl(file);
      var finalData = isGifFile(file) ? rawData : await optimizeImageDataUrl(rawData, { maxSide: 900, quality: 0.82 });
      var ok = await saveStoredAsset(WIDGET_CHARACTER_BG_KEY, finalData);
      if(ok){
        applyWidgetCharacterBackground(finalData);
        showHomeToast('小组件背景已更新');
      }else{
        showHomeToast('图片有点大，换一张试试');
      }
    }catch(err){
      showHomeToast('图片读取失败');
    }
    input.value = '';
  });
}

function applyWidgetMiniOrbImage(src){
  var sideAvEl = document.getElementById('wgt-side-avatar');
  var sideOrbEl = document.getElementById('widget-mini-orb');
  var safeSrc = normalizeShellAssetSrc(src || '');
  if(!sideAvEl || !sideOrbEl) return;
  if(isRenderableShellAvatarSrc(safeSrc)){
    sideAvEl.innerHTML = '<img src="' + safeSrc + '" alt="">';
    sideOrbEl.classList.add('has-image');
  }else{
    sideAvEl.innerHTML = '<span class="widget-mini-orb-plus">+</span>';
    sideOrbEl.classList.remove('has-image');
  }
}

function restoreWidgetMiniOrbImage(){
  loadStoredAsset(HOME_WIDGET_MINI_ORB_KEY).then(function(src){
    applyWidgetMiniOrbImage(src);
  });
}

function openWidgetMiniOrbPicker(e){
  if(e && e.stopPropagation) e.stopPropagation();
  var input = document.getElementById('widget-mini-orb-file');
  if(!input) return;
  input.value = '';
  input.click();
}

function bindWidgetMiniOrbInput(){
  var input = document.getElementById('widget-mini-orb-file');
  if(!input) return;
  input.addEventListener('change', async function(e){
    var file = e && e.target && e.target.files ? e.target.files[0] : null;
    if(!file) return;
    try{
      var rawData = await fileToDataUrl(file);
      var finalData = isGifFile(file) ? rawData : await optimizeImageDataUrl(rawData, { maxSide: 700, quality: 0.82 });
      var ok = await saveStoredAsset(HOME_WIDGET_MINI_ORB_KEY, finalData);
      if(ok){
        applyWidgetMiniOrbImage(finalData);
        showHomeToast('头像已更新');
      }else{
        showHomeToast('图片有点大，换一张试试');
      }
    }catch(err){
      showHomeToast('图片读取失败');
    }
    input.value = '';
  });
}

function applyClockWidgetArt(src){
  var clockEl = document.getElementById('widget-clock');
  if(!clockEl) return;
  clockEl.style.removeProperty('--clock-widget-art');
  clockEl.classList.remove('has-art');
}

function restoreClockWidgetArt(){
  applyClockWidgetArt('');
}

function openClockWidgetArtPicker(e){
  if(e && e.stopPropagation) e.stopPropagation();
}

function bindClockWidgetArtInput(){
  applyClockWidgetArt('');
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
  var widgetEl = document.getElementById('widget-character');
  if(widgetEl){
    widgetEl.dataset.charId = String((c && c.id) || '').trim();
  }
  const displayName = c?.nickname || c?.name || 'No companion yet';
  var hiddenNameEl = document.getElementById('wgt-name');
  if(hiddenNameEl) hiddenNameEl.textContent = displayName;
  function applyWidgetSub(messages){
    var charLine = '';
    var userLine = '';
    try{
      if(Array.isArray(messages) && messages.length){
        var charMsg = getLatestPreviewForRole(messages, 'assistant');
        charLine = getPreviewTextForWidget(charMsg);
        var userMsg = getLatestPreviewForRole(messages, 'user');
        userLine = getPreviewTextForWidget(userMsg);
      }
    }catch(e){}
    var charOverride = getWidgetTextOverride('char');
    var userOverride = getWidgetTextOverride('user');
    if(charOverride) charLine = charOverride;
    if(userOverride) userLine = userOverride;
    var charText = formatWidgetConversationLine(charLine || '', getDefaultWidgetCharacterQuote('char'));
    var userText = formatWidgetConversationLine(userLine, getDefaultWidgetCharacterQuote('user'));
    var charLineEl = document.getElementById('wgt-char-last');
    var userLineEl = document.getElementById('wgt-user-last');
    if(charLineEl) charLineEl.textContent = charText;
    if(userLineEl) userLineEl.textContent = userText;
  }
  applyWidgetSub(c?.id ? getStoredChatMessages(c.id) : []);
  if(c?.id){
    getStoredChatMessagesAsync(c.id).then(function(msgs){
      var liveWidget = document.getElementById('widget-character');
      var boundId = String((liveWidget && liveWidget.dataset && liveWidget.dataset.charId) || '').trim();
      if(boundId !== String(c.id || '').trim()) return;
      applyWidgetSub(msgs);
    });
  }
  const avEl = document.getElementById('wgt-avatar');
  const userAvEl = document.getElementById('wgt-user-avatar');
  const sideNameEl = document.getElementById('wgt-side-name');
  var liveAvatarSrc = normalizeShellAssetSrc(c && c.imageData || '');
  if(c && c.id){
    var userLabel = getBondWidgetUserName(c, getChatUserName(c.id));
    var charRoleEl = document.getElementById('wgt-char-role');
    var userRoleEl = document.getElementById('wgt-user-role');
    if(charRoleEl) charRoleEl.textContent = String((c.nickname || c.name || 'CHAR')).trim() || 'CHAR';
    if(userRoleEl) userRoleEl.textContent = String(userLabel || 'USER').trim() || 'USER';
    if(sideNameEl) sideNameEl.textContent = String((c.nickname || c.name || 'CHAR')).trim() || 'CHAR';
    getChatUserAvatar(c.id).then(function(userSrc){
      applyWidgetUserAvatarContent(userAvEl, userSrc, String(userLabel || '你').slice(0, 2));
    });
  }else{
    var emptyCharRoleEl = document.getElementById('wgt-char-role');
    var emptyUserRoleEl = document.getElementById('wgt-user-role');
    if(emptyCharRoleEl) emptyCharRoleEl.textContent = 'CHAR';
    if(emptyUserRoleEl) emptyUserRoleEl.textContent = 'USER';
    if(sideNameEl) sideNameEl.textContent = 'CHAR';
    applyWidgetUserAvatarContent(userAvEl, '', '你');
  }
  if (isRenderableShellAvatarSrc(liveAvatarSrc)) {
    avEl.innerHTML = '<img src="'+liveAvatarSrc+'" style="width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.03);transform-origin:center">';
  } else {
    avEl.textContent = c?.avatar || '✿';
  }
  if(c?.id){
    loadStoredAsset('char_avatar_' + c.id).then((override)=>{
      var safeOverride = normalizeShellAssetSrc(override || '');
      if(isRenderableShellAvatarSrc(safeOverride)){
        avEl.innerHTML = '<img src="'+safeOverride+'" style="width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.03);transform-origin:center">';
      }
    });
  }
}

function getWidgetBubbleTextElement(role){
  var targetId = String(role || '') === 'user' ? 'wgt-user-last' : 'wgt-char-last';
  return document.getElementById(targetId);
}

function finishWidgetBubbleEdit(role, opts){
  var target = getWidgetBubbleTextElement(role);
  if(!target) return;
  var options = opts || {};
  var rawValue = String(target.textContent || '').replace(/\s+/g, ' ').trim();
  var fallback = String(target.dataset.originalText || '').trim();
  var value = options.cancel ? fallback : rawValue;
  target.contentEditable = 'false';
  target.removeAttribute('data-editing');
  target.classList.remove('editing');
  var line = target.closest('.widget-character-line');
  if(line) line.classList.remove('editing');
  if(options.cancel){
    target.textContent = fallback;
    return;
  }
  setWidgetTextOverride(role, value);
  var active = getActiveCharacterData();
  if(active){
    setWidgetCharacter(active);
  }else{
    setWidgetCharacter({ name:'No companion yet' });
  }
}

function beginWidgetBubbleEdit(e, role){
  if(e && e.stopPropagation) e.stopPropagation();
  if(e && e.preventDefault) e.preventDefault();
  var target = getWidgetBubbleTextElement(role);
  if(!target) return;
  if(target.getAttribute('data-editing') === 'true') return;
  ['char','user'].forEach(function(key){
    if(key !== String(role || '')) finishWidgetBubbleEdit(key, { cancel: false });
  });
  target.dataset.originalText = String(target.textContent || '').trim();
  target.setAttribute('data-editing', 'true');
  target.contentEditable = 'true';
  target.classList.add('editing');
  var line = target.closest('.widget-character-line');
  if(line) line.classList.add('editing');
  try{
    var range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    var sel = window.getSelection();
    if(sel){
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }catch(err){}
  target.focus();
}

function bindWidgetBubbleEditors(){
  ['char','user'].forEach(function(role){
    var target = getWidgetBubbleTextElement(role);
    if(!target || target.dataset.editorBound === 'true') return;
    target.dataset.editorBound = 'true';
    target.addEventListener('keydown', function(evt){
      if(evt.key === 'Enter'){
        evt.preventDefault();
        finishWidgetBubbleEdit(role, { cancel: false });
      }else if(evt.key === 'Escape'){
        evt.preventDefault();
        finishWidgetBubbleEdit(role, { cancel: true });
      }
    });
    target.addEventListener('blur', function(){
      if(target.getAttribute('data-editing') === 'true'){
        finishWidgetBubbleEdit(role, { cancel: false });
      }
    });
    target.addEventListener('paste', function(evt){
      evt.preventDefault();
      var text = '';
      try{
        text = (evt.clipboardData || window.clipboardData).getData('text') || '';
      }catch(err){
        text = '';
      }
      document.execCommand('insertText', false, text.replace(/\s+/g, ' '));
    });
  });
}

function onWidgetCharacterTap(e){
  if(e && e.stopPropagation) e.stopPropagation();
  var input = document.getElementById('widget-character-bg-input');
  if(!input) return;
  input.value = '';
  input.click();
}

function normalizeUnreadBadgeCount(n){
  if(!n || n < 1) return '';
  return n > 9 ? '9+' : String(n);
}

var qqUnreadCountCache = {};
var qqMomentsUnreadCountCache = {};
var qqUnreadRefreshToken = 0;
function summarizeShellUnreadHistory(list){
  var items = Array.isArray(list) ? list : [];
  var unread = 0;
  var lastTs = 0;
  items.forEach(function(item){
    if(!item || typeof item !== 'object') return;
    var ts = Number(item.sentAt || item.readAt || item.updatedAt || 0) || 0;
    if(ts > lastTs) lastTs = ts;
    if(item.role === 'assistant' && !item.readAt) unread += 1;
  });
  return { unread: unread, lastTs: lastTs, count: items.length };
}
function chooseBetterShellUnreadSummary(current, next){
  if(!current) return next;
  if(!next) return current;
  if(Number(next.lastTs || 0) > Number(current.lastTs || 0)) return next;
  if(Number(next.lastTs || 0) === Number(current.lastTs || 0) && Number(next.count || 0) > Number(current.count || 0)) return next;
  return current;
}
function extractChatCharIdFromRecord(record){
  if(record && record.charId) return String(record.charId || '').trim();
  var recordId = String(record && record.id || '').trim();
  var match = recordId.match(/^chat_(.+?)(?:__acct_.+)?$/);
  return match ? String(match[1] || '').trim() : '';
}
function getQqUnreadCountForActive(){
  var activeId = '';
  try{
    if(window.AccountManager){
      var active = window.AccountManager.getActive();
      activeId = (active && active.id) || '';
    }
  }catch(e){}
  var chars = getStoredCharactersSnapshot();
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

function getMomentsUnreadCountForActive(){
  var activeId = getActiveAccountId();
  if(activeId && Object.prototype.hasOwnProperty.call(qqMomentsUnreadCountCache, activeId)){
    return Math.max(0, Number(qqMomentsUnreadCountCache[activeId] || 0) || 0);
  }
  var seenAt = 0;
  try{
    seenAt = parseInt(localStorage.getItem(scopedKeyForAccount(MOMENTS_LAST_SEEN_KEY, activeId)) || '0', 10);
  }catch(e){
    seenAt = 0;
  }
  if(Number.isNaN(seenAt)) seenAt = 0;
  var posts = [];
  try{
    posts = JSON.parse(localStorage.getItem(scopedKeyForAccount(MOMENTS_POSTS_KEY, activeId)) || localStorage.getItem(scopedKeyForAccount(MOMENTS_POSTS_ALT_KEY, activeId)) || '[]');
    if(!Array.isArray(posts)) posts = [];
  }catch(e){
    posts = [];
  }
  var myName = '';
  try{
    if(window.AccountManager){
      var acct = window.AccountManager.getActive();
      myName = String((acct && acct.name) || '').trim();
    }
  }catch(e){}
  var count = 0;
  posts.forEach(function(post){
    if(!post) return;
    var createdAt = Number(post.createdAt || 0) || 0;
    if(createdAt <= seenAt) return;
    var author = String(post.authorName || '').trim();
    if(myName && author && author === myName) return;
    count += 1;
  });
  return count;
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
    var byChar = Object.create(null);
    (Array.isArray(records) ? records : []).forEach(function(record){
      if(!record || typeof record !== 'object') return;
      var recordId = String(record.id || '');
      if(recordId.indexOf('chat_') !== 0 || recordId.indexOf(suffix) === -1) return;
      var list = Array.isArray(record.history) ? record.history : [];
      var charId = extractChatCharIdFromRecord(record);
      if(!charId) return;
      byChar[charId] = chooseBetterShellUnreadSummary(byChar[charId], summarizeShellUnreadHistory(list));
    });
    var total = Object.keys(byChar).reduce(function(sum, charId){
      return sum + Math.max(0, Number(byChar[charId] && byChar[charId].unread || 0) || 0);
    }, 0);
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

function isViewingCharacterChat(charId){
  if(currentApp !== 'chat' || !charId) return false;
  var cacheKey = getShellAccountCacheKey(getActiveAccountId());
  var forcedId = String(shellActiveChatIdCache[cacheKey] || '').trim();
  if(forcedId) return forcedId === String(charId || '');
  var parsed = shellActiveCharacterCache[cacheKey] || null;
  return !!(parsed && String(parsed.id || '') === String(charId || ''));
}

let aiBgTickTimer = null;
let aiBgRunning = false;
let scheduleReminderRunning = false;

function getAiBgIntervalMs(){
  var min = parseInt(localStorage.getItem(AI_BG_INTERVAL_KEY) || '6', 10);
  if(Number.isNaN(min)) min = 6;
  min = Math.max(1, Math.min(120, min));
  return min * 60 * 1000;
}

function getScheduleSharedApi(){
  return window.ScheduleShared && typeof window.ScheduleShared.loadState === 'function' ? window.ScheduleShared : null;
}

function scheduleTimeToMinutes(value){
  var txt = String(value || '').trim();
  var match = txt.match(/^(\d{1,2}):(\d{2})$/);
  if(!match) return -1;
  return (parseInt(match[1], 10) || 0) * 60 + (parseInt(match[2], 10) || 0);
}

async function maybeRunScheduleTodoReminders(){
  if(scheduleReminderRunning) return;
  var shared = getScheduleSharedApi();
  if(!shared) return;
  scheduleReminderRunning = true;
  try{
    var state = await shared.loadState();
    state = shared.normalizeState(state || null);
    var changed = false;
    var chars = getStoredCharactersSnapshot();
    for(const charId of Object.keys(state.chars || {})){
      if(!shared.isTimeAwarenessEnabled(state, charId)) continue;
      var character = chars.find(function(item){ return item && String(item.id || '') === String(charId); }) || null;
      var localClock = buildScheduleLocalNowContextForCharacter(character, Date.now());
      var dateKey = String(localClock && localClock.user && localClock.user.dateKey || shared.toDateKey(new Date()));
      var nowMinutes = scheduleTimeToMinutes(localClock && localClock.user && localClock.user.nowTime);
      if(nowMinutes < 0){
        var fallbackNow = new Date();
        nowMinutes = fallbackNow.getHours() * 60 + fallbackNow.getMinutes();
      }
      var charState = shared.getCharState(state, charId);
      var todos = Array.isArray(charState.todos) ? charState.todos.slice() : [];
      var charChanged = false;
      for(let i = 0; i < todos.length; i++){
        var todo = Object.assign({}, todos[i] || {});
        if(String(todo.date || '') !== dateKey) continue;
        if(!todo.remindEnabled || !String(todo.remindAt || '').trim()) continue;
        if(String(todo.remindedDate || '') === dateKey) continue;
        var dueMinutes = scheduleTimeToMinutes(todo.remindAt);
        if(dueMinutes < 0 || nowMinutes < dueMinutes) continue;
        var text = await generateScheduleInlineComment({
          charId: charId,
          dateKey: dateKey,
          owner: 'user',
          item: {
            title: String(todo.text || '').trim(),
            note: String(todo.note || '').trim(),
            start: String(todo.remindAt || '').trim(),
            end: ''
          },
          comments: Array.isArray(todo.comments) ? todo.comments : [],
          timeStatus: todo.done ? '这条待办原本该在现在提醒，但用户已经提前完成了。请像真人一样知道这点，再顺势聊一句。' : '这条待办现在到了提醒时间。请按人设自然提醒用户。',
          extraContext: [
            '提醒时间和是否超时，必须按用户地理位置的当地时间来判断，不要用设备时间乱算。',
            localClock && localClock.user ? ('用户当地现在：' + String(localClock.user.dateKey || '') + ' ' + String(localClock.user.nowTime || '')) : '',
            localClock && localClock.char ? ('角色当地现在：' + String(localClock.char.dateKey || '') + ' ' + String(localClock.char.nowTime || '')) : '',
            todo.done
              ? '这是日程 app 的提醒待办。用户已经在提醒时间前完成了，所以你不是催促，而是知道他做完了，可以顺势夸一句、问一句，或者自然聊开。'
              : '这是日程 app 的提醒待办。你现在要真的发一条聊天消息提醒用户，不要像系统通知。'
          ].filter(Boolean).join('\n')
        }).catch(function(){ return ''; });
        text = String(text || '').trim();
        if(text){
          await appendScheduleChatMessage({
            charId: charId,
            role: 'assistant',
            text: text
          }).catch(function(){});
        }
        todo.remindedAt = Date.now();
        todo.remindedDate = dateKey;
        todos[i] = todo;
        charChanged = true;
      }
      if(charChanged){
        charState.todos = todos;
        state = shared.setCharState(state, charId, charState);
        changed = true;
      }
    }
    if(changed){
      await shared.saveState(state);
    }
  }catch(err){
    console.error('[schedule-reminder] failed:', err);
  }finally{
    scheduleReminderRunning = false;
  }
}

async function maybeRunAiBgTick(force){
  if(aiBgRunning) return;
  var defaultId = getDefaultAccountId();
  if(!defaultId) return;
  if(!hasAnyAiBgActivityEnabled(defaultId)) return;
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
    maybeRunScheduleTodoReminders();
  }, 20000);
  setTimeout(function(){ maybeRunAiBgTick(false); }, 1200);
  setTimeout(function(){ maybeRunScheduleTodoReminders(); }, 1600);
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
  bindHomeMusicSystem();
  bindWidgetCharacterBackgroundInput();
  bindWidgetMiniOrbInput();
  bindClockWidgetArtInput();
  bindWidgetBubbleEditors();
  bindHomeAppPressState();
  applyLiveDanmakuVisibility(getLiveDanmakuEnabled());
  restoreHomeSlots();
  restoreWidgetCharacterBackground();
  restoreWidgetMiniOrbImage();
  restoreClockWidgetArt();
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
  hydrateShellActiveCharacterState().finally(function(){
    try{
      const c = getActiveCharacterData();
      if(c){ setWidgetCharacter(c); }
      renderBondWidget(c);
    }catch(e){}
  });
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

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=>{
    bootHostedUpdateCheck();
  }, { once:true });
}else{
  bootHostedUpdateCheck();
}

window.addEventListener('load', ()=>{
  hideShellLoadingOverlay(0);
  pushBackendLogEntry({
    level: 'info',
    app: 'shell',
    source: 'shell.load',
    message: '主壳已启动'
  });
  hydrateShellNotificationSettingsCache().catch(function(){});
  clearHostedRefreshParams();
  syncAppHeight();
  renderHomePages(true);
  bootHostedUpdateCheck();
  try{
    var launchUrl = new URL(window.location.href);
    var notifyApp = String(launchUrl.searchParams.get('openApp') || '').trim();
    var notifyCharId = String(launchUrl.searchParams.get('notifyCharId') || '').trim();
    if(notifyApp){
      setTimeout(function(){
        openShellNotificationPayload({
          app: notifyApp,
          charId: notifyCharId
        });
      }, 120);
      launchUrl.searchParams.delete('openApp');
      launchUrl.searchParams.delete('notifyCharId');
      history.replaceState({}, document.title, launchUrl.toString());
    }
  }catch(err){}
  if(hostedUpdateCardPending && pendingRemoteAppFingerprint){
    showHostedUpdateCard();
  }
  var frame = document.getElementById('app-iframe');
  if(frame){
    frame.addEventListener('load', function(){
      applyIframeSafeAreaOverrides();
      installBackendLogBridge(frame.contentWindow, currentApp || 'app');
      pushBackendLogEntry({
        level: 'info',
        app: currentApp || 'app',
        source: 'app.load',
        message: '页面已加载'
      });
      setTimeout(applyIframeSafeAreaOverrides, 120);
      hideShellLoadingOverlay(currentApp ? 260 : 2000);
    });
    frame.addEventListener('error', function(){
      hideShellLoadingOverlay(0);
    });
  }
  var notifyCard = document.getElementById('app-notify-card');
  if(notifyCard){
    notifyCard.addEventListener('click', function(evt){
      if(appNotifyPointerDragging) return;
      evt.preventDefault();
      openAppNotificationTarget();
    });
    notifyCard.addEventListener('pointerdown', function(evt){
      appNotifyPointerStartY = evt.clientY;
      appNotifyPointerDragging = false;
    });
    notifyCard.addEventListener('pointermove', function(evt){
      if(appNotifyPointerStartY && evt.clientY < appNotifyPointerStartY - 26){
        appNotifyPointerDragging = true;
      }
    });
    notifyCard.addEventListener('pointerup', function(evt){
      if(appNotifyPointerDragging && evt.clientY < appNotifyPointerStartY - 26){
        dismissAppNotification();
      }
      appNotifyPointerStartY = 0;
      setTimeout(function(){ appNotifyPointerDragging = false; }, 0);
    });
    notifyCard.addEventListener('pointercancel', function(){
      appNotifyPointerStartY = 0;
      appNotifyPointerDragging = false;
    });
  }
});

window.addEventListener('error', function(evt){
  pushBackendLogEntry({
    level: 'error',
    app: 'shell',
    source: 'window.error',
    message: trimBackendLogText((evt && evt.message) || '主壳错误', 220) || '主壳错误',
    detail: evt && evt.error ? evt.error : ''
  });
});

window.addEventListener('unhandledrejection', function(evt){
  pushBackendLogEntry({
    level: 'error',
    app: 'shell',
    source: 'unhandledrejection',
    message: trimBackendLogText(summarizeBackendLogDetail(evt && evt.reason ? evt.reason : 'Promise rejected'), 220) || 'Promise rejected',
    detail: evt && evt.reason ? evt.reason : ''
  });
});

window.addEventListener('online', function(){
  scheduleHostedUpdateCheck(true);
});

document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible'){
    scheduleHostedUpdateCheck(true);
  }
});

window.addEventListener('pageshow', function(){
  scheduleHostedUpdateCheck(true);
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

window.addEventListener('focus', ()=>{
  hydrateShellActiveCharacterState().finally(function(){
    renderBondWidget();
  });
});
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden){
    renderBondWidget();
    renderHomeMusic();
    renderHomeDockBadges();
    refreshQqUnreadCountCache();
    maybeRunAiBgTick(false);
    maybeRunScheduleTodoReminders();
  }
});
window.addEventListener('resize', ()=>{
  renderHomePages(true);
  renderHomeMusic();
});
window.addEventListener('resize', syncChatKeyboardShift);
setInterval(()=>{
  renderHomeDockBadges();
  refreshQqUnreadCountCache();
}, 2500);
