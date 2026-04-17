var OFFLINE_INVITE_SNIPPET = '【约会邀请】';
var OFFLINE_WEATHERS = ['☀︎','☁︎','⛅︎','☂︎','☃︎'];
var OFFLINE_MOODS = ['(///v///)','(,,> <,,)','(๑´ㅂ`๑)','(｡･ω･｡)','(っ˘ڡ˘ς)','( ´ ▽ ` )'];
var OFFLINE_INVITE_STAMP_ASSETS = [
  'assets/邮票1.jpg',
  'assets/邮票2.jpg',
  'assets/邮票3.jpg',
  'assets/邮票4.jpg',
  'assets/邮票5.jpg',
  'assets/邮票6.jpg'
];

function normalizeOfflineWeatherIcon(value){
  var raw = String(value || '').trim();
  if(!raw) return '☀︎';
  if(raw === '☀︎' || raw === '☁︎' || raw === '⛅︎' || raw === '☂︎' || raw === '☃︎') return raw;
  if(/[雪|snow]/i.test(raw)) return '☃︎';
  if(/[雨|rain|storm|shower]/i.test(raw)) return '☂︎';
  if(/[多云|阴|cloud|overcast]/i.test(raw)) return '☁︎';
  if(/[晴间多云|云间晴|partly|mixed|fair]/i.test(raw)) return '⛅︎';
  if(/[晴|sun|clear|bright]/i.test(raw)) return '☀︎';
  return '☀︎';
}

async function resolveOfflineInviteWeather(role, fallbackIcon){
  var safeRole = role === 'user' ? 'user' : 'char';
  var fallback = normalizeOfflineWeatherIcon(fallbackIcon || '☀︎');
  try{
    if(window.refreshInviteWeatherSnapshot){
      var snapshot = await window.refreshInviteWeatherSnapshot(safeRole);
      if(snapshot && snapshot.weatherIcon){
        return {
          icon: normalizeOfflineWeatherIcon(snapshot.weatherIcon),
          label: String(snapshot.weatherLabel || '').trim(),
          temperatureC: snapshot.temperatureC,
          aliasName: String(snapshot.aliasName || '').trim(),
          resolvedName: String(snapshot.resolvedName || snapshot.realName || '').trim()
        };
      }
    }
  }catch(e){}
  return { icon: fallback, label: '', temperatureC: null, aliasName: '', resolvedName: '' };
}

function randomPick(list, fallback){
  return Array.isArray(list) && list.length ? list[Math.floor(Math.random() * list.length)] : fallback;
}

function getOfflineInviteStampAsset(payload){
  var raw = String(payload && payload.stampAsset || '').trim();
  return raw || 'assets/邮票1.jpg';
}

function getOfflineInviteSignatureName(payload, role){
  var direct = String(payload && payload.signatureName || '').trim();
  if(direct) return direct;
  return getOfflineInviteDisplayName(role === 'user' ? 'user' : 'assistant');
}

function buildOfflineInviteDefaultSchedule(){
  var now = new Date();
  var next = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0);
  if(next.getMinutes() === 60){
    next.setHours(next.getHours() + 1, 0, 0, 0);
  }
  var year = next.getFullYear();
  var month = String(next.getMonth() + 1).padStart(2, '0');
  var day = String(next.getDate()).padStart(2, '0');
  var hour = String(next.getHours()).padStart(2, '0');
  var minute = String(next.getMinutes()).padStart(2, '0');
  return {
    date: year + '-' + month + '-' + day,
    time: hour + ':' + minute
  };
}

function formatOfflineInviteDraftDateLabel(value){
  var raw = String(value || '').trim();
  if(!raw) return '日期待定';
  var parts = raw.split('-');
  if(parts.length < 3) return raw;
  var year = Number(parts[0]) || 0;
  var month = Number(parts[1]) || 0;
  var day = Number(parts[2]) || 0;
  var date = new Date(year, Math.max(0, month - 1), day);
  var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return month + '月' + day + '日 ' + weekdays[date.getDay()];
}

function formatOfflineInviteDraftTimeLabel(value){
  var raw = String(value || '').trim();
  if(!raw) return '时间待定';
  return raw;
}

function parseOfflineInvitePayload(content){
  if(!content) return null;
  if(typeof content === 'object') return content;
  try{
    var parsed = JSON.parse(String(content || ''));
    if(parsed && typeof parsed === 'object') return parsed;
  }catch(e){}
  return null;
}

function currentDateLabels(role){
  try{
    if(window.getInviteWeatherSnapshot){
      var snapshot = window.getInviteWeatherSnapshot(role === 'user' ? 'user' : 'char');
      if(snapshot && snapshot.timeLabel && snapshot.dateLabel){
        return {
          timeLabel: snapshot.timeLabel,
          dateLabel: snapshot.dateLabel
        };
      }
    }
  }catch(e){}
  var d = new Date();
  return {
    timeLabel: d.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }),
    dateLabel: d.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' })
  };
}

function getOfflineInviteThreadCharId(){
  var routeCharId = '';
  try{
    var routeUrl = new URL(window.location.href);
    routeCharId = String(routeUrl.searchParams.get('char') || '').trim();
  }catch(e){}
  var desiredId = '';
  try{ desiredId = String(typeof desiredChatCharId !== 'undefined' ? desiredChatCharId : '').trim(); }catch(e){}
  var pendingId = '';
  try{ pendingId = String(localStorage.getItem('pendingChatCharId') || '').trim(); }catch(e){}
  var currentCharacterId = '';
  try{
    currentCharacterId = String((character && character.id) || '').trim();
  }catch(e){}
  var scopedActiveId = '';
  try{
    if(typeof accountScopedKey === 'function'){
      scopedActiveId = String(localStorage.getItem(accountScopedKey('activeChatCharacterId')) || '').trim();
    }
  }catch(e){}
  return String(
    routeCharId ||
    desiredId ||
    pendingId ||
    currentCharacterId ||
    scopedActiveId ||
    localStorage.getItem('activeChatCharacterId') ||
    ''
  ).trim();
}

function getOfflineInviteThreadCharacter(){
  var targetId = getOfflineInviteThreadCharId();
  if(!targetId) return character || null;
  try{
    if(typeof findCharacterById === 'function'){
      var found = findCharacterById(targetId);
      if(found) return found;
    }
  }catch(e){}
  if(character && String(character.id || '').trim() === targetId) return character;
  return character || null;
}

function coerceOfflineInvitePayloadToThread(payload, sourceRole){
  var next = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
  var safeRole = sourceRole === 'user' ? 'user' : 'assistant';
  if(safeRole === 'user') return next;
  var threadCharId = getOfflineInviteThreadCharId();
  var threadCharacter = getOfflineInviteThreadCharacter();
  if(threadCharId){
    next.charId = String(threadCharId || '').trim();
  }
  if(threadCharacter){
    next.charName = String((threadCharacter.nickname || threadCharacter.name) || next.charName || '').trim();
  }
  return next;
}

function buildOfflineInvitePayload(sourceRole, text, overrides){
  var labels = currentDateLabels(sourceRole === 'user' ? 'user' : 'char');
  var threadCharacter = getOfflineInviteThreadCharacter();
  var safeOverrides = coerceOfflineInvitePayloadToThread(overrides || {}, sourceRole);
  var snapshotSource = threadCharacter || (safeOverrides && safeOverrides.charSnapshot) || character || {};
  var data = Object.assign({
    type: 'offline_invite',
    sourceRole: sourceRole === 'user' ? 'user' : 'assistant',
    charId: String((threadCharacter && threadCharacter.id) || '').trim(),
    charName: String((threadCharacter && (threadCharacter.nickname || threadCharacter.name)) || '').trim(),
    content: String(text || '').trim() || (sourceRole === 'user' ? '要不要出来见我？' : '宝宝，我来找你了。'),
    mood: randomPick(OFFLINE_MOODS, '(｡･ω･｡)'),
    weather: randomPick(OFFLINE_WEATHERS, '☀︎'),
    location: ((threadCharacter && (threadCharacter.nickname || threadCharacter.name)) || '对方') + '想和你见面的地方',
    aside: sourceRole === 'user' ? '' : '好想见你',
    timeLabel: labels.timeLabel,
    dateLabel: labels.dateLabel,
    createdAt: Date.now(),
    status: 'pending',
    charSnapshot: buildOfflineLaunchCharSnapshot(snapshotSource)
  }, safeOverrides);
  data.type = 'offline_invite';
  data.sourceRole = data.sourceRole === 'user' ? 'user' : 'assistant';
  data.charId = String(data.charId || (threadCharacter && threadCharacter.id) || '').trim();
  data.charName = String(data.charName || (threadCharacter && (threadCharacter.nickname || threadCharacter.name)) || '').trim();
  data.content = String(data.content || '').trim() || '想见你。';
  data.mood = String(data.mood || '').trim() || '(｡･ω･｡)';
  data.weather = normalizeOfflineWeatherIcon(data.weather);
  data.location = String(data.location || '').trim() || '老地方';
  data.aside = String(data.aside || '').trim();
  if(data.sourceRole !== 'user' && !data.aside) data.aside = '好想见你';
  if(data.sourceRole === 'user') data.aside = '';
  data.timeLabel = String(data.timeLabel || labels.timeLabel);
  data.dateLabel = String(data.dateLabel || labels.dateLabel);
  data.status = String(data.status || 'pending');
  if(!data.charSnapshot || typeof data.charSnapshot !== 'object'){
    data.charSnapshot = buildOfflineLaunchCharSnapshot(snapshotSource);
  }
  return data;
}

function sanitizeOfflineInvitePayloadForModel(payload){
  var src = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
  delete src.aside;
  delete src.status;
  delete src.type;
  delete src.sourceRole;
  delete src.createdAt;
  delete src.timeLabel;
  delete src.dateLabel;
  if(src.content != null) src.content = String(src.content || '').trim();
  if(src.location != null) src.location = String(src.location || '').trim();
  return src;
}

function offlineInviteSummaryText(content){
  var data = parseOfflineInvitePayload(content) || buildOfflineInvitePayload('assistant', '');
  return OFFLINE_INVITE_SNIPPET + (data.location ? (' ' + data.location) : '');
}

function normalizeOfflineInviteDecisionText(text, fallback){
  var clean = String(text || '').replace(/\s+/g, ' ').trim() || String(fallback || '').trim();
  if(!clean) return '';
  if(clean.length > 48) return clean.slice(0, 48);
  return clean;
}

function normalizeOfflineInviteRejectText(text, fallback){
  var clean = String(text || '').replace(/\s+/g, ' ').trim() || String(fallback || '').trim();
  if(!clean) return '';
  if(/<msg>/i.test(clean)) return clean;
  if(clean.length <= 34) return clean;
  var minCount = Math.max(1, Number(character && character.msgMin) || 1);
  var maxCount = Math.max(minCount, Number(character && character.msgMax) || 3);
  var parts = clean.match(/[^，,。！？!?；;]+[，,。！？!?；;]?/g) || [clean];
  parts = parts.map(function(part){ return String(part || '').trim(); }).filter(Boolean);
  if(parts.length <= 1){
    if(clean.length <= 54 || maxCount <= 1) return clean;
    var mid = Math.ceil(clean.length / 2);
    var splitAt = clean.indexOf('，', Math.max(6, mid - 6));
    if(splitAt < 0) splitAt = clean.indexOf(',', Math.max(6, mid - 6));
    if(splitAt < 0) splitAt = mid;
    parts = [clean.slice(0, splitAt + (splitAt === mid ? 0 : 1)).trim(), clean.slice(splitAt + (splitAt === mid ? 0 : 1)).trim()].filter(Boolean);
  }
  if(parts.length <= 1 || parts.length > maxCount + 2) return clean;
  var targetCount = Math.min(maxCount, Math.max(Math.min(parts.length, maxCount), Math.min(minCount, parts.length)));
  if(targetCount <= 1) return clean;
  var groups = [];
  var idx = 0;
  for(var i = 0; i < targetCount; i++){
    var remainingParts = parts.length - idx;
    var remainingSlots = targetCount - i;
    var take = Math.ceil(remainingParts / remainingSlots);
    var slice = parts.slice(idx, idx + take).join('').trim();
    if(slice) groups.push(slice);
    idx += take;
  }
  groups = groups.filter(Boolean);
  return groups.length > 1 ? groups.join('<msg>') : clean;
}

function makeSystemNoticeEntry(text){
  return makeChatEntry('system', String(text || '').trim(), 'text');
}

function addSystemNotice(text, doScroll, entryId){
  addMessage('system', String(text || '').trim(), doScroll !== false, 'text', entryId || '');
}

function writeOfflineInviteDebug(partial){
  try{
    var key = accountScopedKey('offline_invite_debug_latest');
    var current = {};
    try{
      current = JSON.parse(localStorage.getItem(key) || '{}') || {};
    }catch(e){}
    var next = Object.assign({}, current, partial || {}, {
      updatedAt: Date.now()
    });
    localStorage.setItem(key, JSON.stringify(next));
  }catch(e){}
}

function persistOfflineSession(session, charIdOverride){
  var targetCharId = String(charIdOverride || (character && character.id) || '').trim();
  if(!targetCharId) return;
  try{
    localStorage.setItem(offlineSessionStorageKey(targetCharId), JSON.stringify(session || {}));
  }catch(e){}
  try{
    localStorage.setItem('offline_meet_session_' + targetCharId, JSON.stringify(session || {}));
  }catch(e){}
}
function primeOfflineLaunchCharacterSnapshot(charSnapshot){
  if(!charSnapshot || !String(charSnapshot.id || '').trim()) return;
  var serialized = '';
  try{ serialized = JSON.stringify(charSnapshot); }catch(e){ serialized = ''; }
  if(!serialized) return;
  try{ localStorage.setItem('pendingChatChar', serialized); }catch(e){}
  try{ localStorage.setItem('pendingChatCharId', String(charSnapshot.id || '').trim()); }catch(e){}
  try{
    if(typeof accountScopedKey === 'function'){
      localStorage.setItem(accountScopedKey('activeCharacter'), serialized);
    }
  }catch(e){}
  try{ localStorage.setItem('activeCharacter', serialized); }catch(e){}
}
function persistOfflineLaunchTokenRecord(token, record){
  var safeToken = String(token || '').trim();
  if(!safeToken) return;
  var serialized = '';
  try{ serialized = JSON.stringify(record || {}); }catch(e){ serialized = ''; }
  if(!serialized) return;
  try{ localStorage.setItem(offlineLaunchTokenStorageKey(safeToken), serialized); }catch(e){}
  try{ localStorage.setItem('offline_launch_token_' + safeToken, serialized); }catch(e){}
}

function pendingOfflineBootstrapStorageKey(charId){
  return accountScopedKey('offline_bootstrap_' + String(charId || '').trim());
}

function pendingOfflineLaunchStorageKey(charId){
  return accountScopedKey('offline_launch_' + String(charId || '').trim());
}

function latestOfflineLaunchStorageKey(){
  return accountScopedKey('offline_launch_latest');
}
function offlineLaunchTokenStorageKey(token){
  return accountScopedKey('offline_launch_token_' + String(token || '').trim());
}

function readOfflineSession(charId){
  if(!charId) return null;
  try{
    var raw = localStorage.getItem(offlineSessionStorageKey(charId));
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){
    return null;
  }
}

function buildOfflineLaunchCharSnapshot(source){
  if(!source || typeof source !== 'object') return null;
  var imageData = String(source.imageData || '').trim();
  if(/^data:/i.test(imageData)) imageData = '';
  return {
    id: String(source.id || '').trim(),
    name: String(source.name || '').trim(),
    nickname: String(source.nickname || '').trim(),
    avatar: String(source.avatar || '').trim(),
    imageData: imageData,
    description: String(source.description || '').trim(),
    personality: String(source.personality || '').trim(),
    scenario: String(source.scenario || '').trim(),
    system_prompt: String(source.system_prompt || '').trim(),
    first_mes: String(source.first_mes || '').trim(),
    offlineInviteMin: Number(source.offlineInviteMin || 300),
    offlineInviteMax: Number(source.offlineInviteMax || 360),
    offlineInvitePerspective: String(source.offlineInvitePerspective || 'first'),
    offlineInviteStyle: String(source.offlineInviteStyle || '').trim(),
    offlineSummaryEvery: Number(source.offlineSummaryEvery || 5),
    offlineSummaryAuto: source.offlineSummaryAuto != null ? !!source.offlineSummaryAuto : true,
    offlineMemoryReadCount: Number(source.offlineMemoryReadCount || 4),
    offlineSideStoryType: String(source.offlineSideStoryType || 'future'),
    translationEnabled: !!source.translationEnabled,
    replyLanguage: String(source.replyLanguage || source.language || 'zh').trim() || 'zh',
    translationMode: String(source.translationMode || 'ondemand').trim() || 'ondemand',
    userNameProfile: String(source.userNameProfile || '').trim(),
    userPersonaProfile: String(source.userPersonaProfile || '').trim()
  };
}

function snapshotMatchesOfflineTarget(snapshot, targetCharId){
  var safeTargetId = String(targetCharId || '').trim();
  if(!snapshot || typeof snapshot !== 'object') return false;
  if(!safeTargetId) return true;
  var snapshotId = String(snapshot.id || '').trim();
  return !snapshotId || snapshotId === safeTargetId;
}

function sanitizeOfflineLaunchSnapshotForTarget(source, targetCharId){
  if(!snapshotMatchesOfflineTarget(source, targetCharId)) return null;
  var snapshot = buildOfflineLaunchCharSnapshot(source);
  if(!snapshot) return null;
  if(targetCharId) snapshot.id = String(targetCharId || '').trim();
  return snapshot;
}

function mergeOfflineLaunchCharSnapshots(){
  var merged = {};
  for(var i = 0; i < arguments.length; i += 1){
    var source = arguments[i];
    if(!source || typeof source !== 'object') continue;
    Object.keys(source).forEach(function(key){
      var value = source[key];
      if(value == null) return;
      if(typeof value === 'string'){
        if(!value.trim()) return;
      }
      merged[key] = value;
    });
  }
  return Object.keys(merged).length ? merged : null;
}

function buildOfflineThreadLaunchSnapshot(targetCharId, payload){
  var safeTargetCharId = String(targetCharId || '').trim();
  var payloadSnapshot = payload && payload.charSnapshot && typeof payload.charSnapshot === 'object' ? payload.charSnapshot : null;
  var activeRaw = '';
  try{ activeRaw = localStorage.getItem('activeCharacter') || ''; }catch(e){}
  var activeSnapshot = null;
  if(activeRaw){
    try{ activeSnapshot = JSON.parse(activeRaw) || null; }catch(e){}
  }
  var pendingRaw = '';
  try{ pendingRaw = localStorage.getItem('pendingChatChar') || ''; }catch(e){}
  var pendingSnapshot = null;
  if(pendingRaw){
    try{ pendingSnapshot = JSON.parse(pendingRaw) || null; }catch(e){}
  }
  var threadCharacter = getOfflineInviteThreadCharacter();
  var targetCharacter = null;
  try{
    if(typeof findCharacterById === 'function') targetCharacter = findCharacterById(targetCharId);
  }catch(e){}
  if(!targetCharacter && threadCharacter && String(threadCharacter.id || '').trim() === String(targetCharId || '').trim()){
    targetCharacter = threadCharacter;
  }
  if(!targetCharacter && character && String(character.id || '').trim() === String(targetCharId || '').trim()){
    targetCharacter = character;
  }
  var merged = mergeOfflineLaunchCharSnapshots(
    sanitizeOfflineLaunchSnapshotForTarget(targetCharacter || {}, safeTargetCharId),
    sanitizeOfflineLaunchSnapshotForTarget(threadCharacter || {}, safeTargetCharId),
    sanitizeOfflineLaunchSnapshotForTarget(character || {}, safeTargetCharId),
    sanitizeOfflineLaunchSnapshotForTarget(activeSnapshot || {}, safeTargetCharId),
    sanitizeOfflineLaunchSnapshotForTarget(pendingSnapshot || {}, safeTargetCharId),
    sanitizeOfflineLaunchSnapshotForTarget(payloadSnapshot || {}, safeTargetCharId),
    {
      id: safeTargetCharId,
      name: String(
        (targetCharacter && targetCharacter.name) ||
        (threadCharacter && threadCharacter.name) ||
        (character && character.name) ||
        (payload && payload.charName) ||
        ''
      ).trim(),
      nickname: String(
        (targetCharacter && targetCharacter.nickname) ||
        (threadCharacter && threadCharacter.nickname) ||
        (character && character.nickname) ||
        (payload && payload.charName) ||
        ''
      ).trim()
    }
  ) || { id: safeTargetCharId };
  if(!String(merged.id || '').trim()) merged.id = safeTargetCharId;
  if(!String(merged.name || '').trim()){
    merged.name = String(merged.nickname || (payload && payload.charName) || 'CHAR').trim() || 'CHAR';
  }
  if(!String(merged.nickname || '').trim() && payload && payload.charName){
    merged.nickname = String(payload.charName || '').trim();
  }
  return merged;
}

async function openOfflineSession(payload){
  var liveCharId = getOfflineInviteThreadCharId();
  var targetCharId = String(liveCharId || (payload && payload.charId) || '').trim();
  if(!targetCharId) return;
  if(payload && typeof payload === 'object'){
    payload.charId = targetCharId;
    if(!String(payload.charName || '').trim()){
      var threadCharacter = getOfflineInviteThreadCharacter();
      payload.charName = String((threadCharacter && (threadCharacter.nickname || threadCharacter.name)) || '').trim();
    }
  }
  writeOfflineInviteDebug({
    chatThreadCharId: liveCharId,
    invitePayloadCharId: String(payload && payload.charId || '').trim(),
    invitePayloadCharName: String(payload && payload.charName || '').trim(),
    targetOpenCharId: targetCharId
  });
  var threadCharacter = getOfflineInviteThreadCharacter();
  var targetCharacter = null;
  try{
    if(typeof findCharacterById === 'function') targetCharacter = findCharacterById(targetCharId);
  }catch(e){}
  if(!targetCharacter && threadCharacter && String(threadCharacter.id || '').trim() === targetCharId){
    targetCharacter = threadCharacter;
  }
  if(!targetCharacter && character && String(character.id || '').trim() === targetCharId){
    targetCharacter = character;
  }
  if(targetCharacter) character = targetCharacter;
  var charSnapshot = buildOfflineThreadLaunchSnapshot(targetCharId, payload);
  if(payload){
    payload.charId = targetCharId;
    payload.charSnapshot = Object.assign({}, charSnapshot || {});
    payload.charName = String((charSnapshot && (charSnapshot.nickname || charSnapshot.name)) || payload.charName || '').trim();
  }
  primeOfflineLaunchCharacterSnapshot(charSnapshot);
  var history = formatChatForModel(chatLog.slice(-10));
  var launchToken = 'ol_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  var latestLaunchRecord = {
    mode: 'invite',
    launchToken: launchToken,
    charId: targetCharId,
    charSnapshot: charSnapshot,
    threadCharSnapshot: charSnapshot,
    payload: payload,
    chatHistory: history,
    createdAt: Date.now()
  };
  try{ localStorage.removeItem(pendingOfflineBootstrapStorageKey(targetCharId)); }catch(e){}
  try{ localStorage.removeItem('offline_bootstrap_' + targetCharId); }catch(e){}
  try{ localStorage.removeItem(pendingOfflineLaunchStorageKey(targetCharId)); }catch(e){}
  try{ localStorage.removeItem('offline_launch_' + targetCharId); }catch(e){}
  try{ localStorage.removeItem(accountScopedKey('offline_resume_' + targetCharId)); }catch(e){}
  try{ localStorage.removeItem('offline_resume_' + targetCharId); }catch(e){}
  var nextSession = {
    charId: targetCharId,
    charSnapshot: charSnapshot,
    active: true,
    invite: payload,
    entries: [],
    pendingAnimation: true,
    pendingOpening: true,
    chatHistory: history,
    updatedAt: Date.now()
  };
  persistOfflineSession(nextSession, targetCharId);
  try{
    localStorage.setItem(pendingOfflineBootstrapStorageKey(targetCharId), JSON.stringify({
      charId: targetCharId,
      charSnapshot: charSnapshot,
      session: nextSession
    }));
  }catch(e){}
  try{
    localStorage.setItem('offline_bootstrap_' + targetCharId, JSON.stringify({
      charId: targetCharId,
      charSnapshot: charSnapshot,
      session: nextSession
    }));
  }catch(e){}
  try{
    localStorage.setItem(pendingOfflineLaunchStorageKey(targetCharId), JSON.stringify({
      charId: targetCharId,
      charSnapshot: charSnapshot,
      payload: payload,
      chatHistory: history,
      createdAt: Date.now()
    }));
  }catch(e){}
  try{
    localStorage.setItem('offline_launch_' + targetCharId, JSON.stringify({
      charId: targetCharId,
      charSnapshot: charSnapshot,
      payload: payload,
      chatHistory: history,
      createdAt: Date.now()
    }));
  }catch(e){}
  try{
    localStorage.setItem(latestOfflineLaunchStorageKey(), JSON.stringify({
      launchToken: launchToken,
      charId: targetCharId,
      charSnapshot: charSnapshot,
      payload: payload,
      chatHistory: history,
      createdAt: Date.now()
    }));
  }catch(e){}
  try{
    localStorage.setItem('offline_launch_latest', JSON.stringify({
      launchToken: launchToken,
      charId: targetCharId,
      charSnapshot: charSnapshot,
      payload: payload,
      chatHistory: history,
      createdAt: Date.now()
    }));
  }catch(e){}
  latestLaunchRecord.session = nextSession;
  persistOfflineLaunchTokenRecord(launchToken, latestLaunchRecord);
  postToShell({
    type:'OPEN_APP_WITH',
    payload:{
      app:'offline',
      charId: targetCharId,
      launchMode:'invite',
      launchToken: launchToken,
      offlineLaunchRecord: latestLaunchRecord
    }
  });
}

function getCurrentUserDisplayName(){
  return getChatUserName(character && character.id) || resolveDisplayUserName() || '你';
}

function getOfflineInviteAvatarFallback(role){
  if(role === 'user'){
    return String(getCurrentUserDisplayName() || '你').trim().charAt(0) || '你';
  }
  var name = String((character && (character.nickname || character.name)) || 'C').trim();
  return name.charAt(0) || 'C';
}

function getOfflineInviteDisplayName(role){
  if(role === 'user'){
    return String(getCurrentUserDisplayName() || 'User').trim() || 'User';
  }
  return String((character && (character.nickname || character.name)) || 'Char').trim() || 'Char';
}

function closeOfflineInviteComposer(){
  var modal = document.getElementById('offlineInviteModal');
  if(modal) modal.classList.remove('open');
}

function handleOfflineInviteComposerMask(evt){
  var card = evt && evt.target && evt.target.closest ? evt.target.closest('.invite-compose-card') : null;
  if(card) return;
  closeOfflineInviteComposer();
}

function hydrateOfflineInviteComposerAvatar(){
  var photo = document.getElementById('offlineInviteUserPhoto');
  var label = document.getElementById('offlineInviteUserLabel');
  var signature = document.getElementById('offlineInviteSignatureName');
  var displayName = getCurrentUserDisplayName() || 'USER';
  if(label) label.textContent = displayName;
  if(signature) signature.textContent = displayName;
  if(!photo) return;
  photo.innerHTML = '<span class="invite-compose-polaroid-fallback">' + esc(displayName.charAt(0) || 'U') + '</span>';
  resolveChatUserAvatarAsync(character && character.id).then(function(src){
    var safe = String(src || '').trim();
    if(!safe) return;
    photo.innerHTML = '<img src="' + escAttr(safe) + '" alt="">';
  }).catch(function(){});
}

function runOfflineInviteAction(action, msgId){
  var safeAction = String(action || '').trim();
  var safeMsgId = String(msgId || '').trim();
  if(!safeAction || !safeMsgId) return;
  var runner = safeAction === 'accept' ? acceptOfflineInvite : (safeAction === 'reject' ? rejectOfflineInvite : null);
  if(typeof runner !== 'function') return;
  Promise.resolve()
    .then(function(){ return runner(safeMsgId); })
    .catch(function(err){
      console.error('offline invite action failed:', safeAction, safeMsgId, err);
      if(typeof toast === 'function'){
        toast('线下邀约启动失败：' + String(err && (err.message || err) || '未知错误'));
      }
    });
}

function openOfflineInviteComposer(){
  if(!character){
    if(typeof toast === 'function') toast('请先选择角色');
    return;
  }
  closeAddonPanel();
  var modal = document.getElementById('offlineInviteModal');
  var locationField = document.getElementById('offlineInviteLocationField');
  var dateField = document.getElementById('offlineInviteDateField');
  var timeField = document.getElementById('offlineInviteTimeField');
  var messageField = document.getElementById('offlineInviteMessageField');
  var sub = document.getElementById('offlineInviteModalSub');
  var schedule = buildOfflineInviteDefaultSchedule();
  if(sub) sub.textContent = '发给 ' + getOfflineInviteDisplayName('assistant') + ' 的线下邀请。';
  if(locationField) locationField.value = '';
  if(dateField) dateField.value = schedule.date;
  if(timeField) timeField.value = schedule.time;
  if(messageField) messageField.value = '';
  hydrateOfflineInviteComposerAvatar();
  if(modal) modal.classList.add('open');
  if(locationField){
    setTimeout(function(){ locationField.focus(); }, 40);
  }
}

function appendOfflineInviteNoticeText(role){
  var charName = (character && (character.nickname || character.name)) || 'Char';
  if(role === 'user'){
    return '系统提示：' + getCurrentUserDisplayName() + '向' + charName + '发出了约会邀请';
  }
  return '系统提示：您收到了' + charName + '的约会邀请';
}

function appendOfflineInviteRejectNoticeText(){
  var charName = (character && (character.nickname || character.name)) || 'Char';
  return '系统提示：' + charName + '暂时拒绝了这次约会邀请';
}

async function appendOfflineInviteToChat(role, payload, doScroll){
  var notice = makeSystemNoticeEntry(appendOfflineInviteNoticeText(role));
  chatLog.push(notice);
  addSystemNotice(notice.content, doScroll !== false, notice.id);
  var safePayload = coerceOfflineInvitePayloadToThread(payload || {}, role === 'user' ? 'user' : 'assistant');
  var finalPayload = buildOfflineInvitePayload(role === 'user' ? 'user' : 'assistant', safePayload && safePayload.content, safePayload || {});
  if(role === 'user') finalPayload.aside = '';
  var entry = makeChatEntry(role === 'user' ? 'user' : 'assistant', JSON.stringify(finalPayload), 'offline_invite');
  chatLog.push(entry);
  addMessage(role === 'user' ? 'user' : 'ai', entry.content, doScroll !== false, 'offline_invite', entry.id);
  await saveChat(true);
  return entry;
}

async function rejectOfflineInvite(messageId){
  var entry = getMessageById(messageId);
  var payload = parseOfflineInvitePayload(entry && entry.content) || null;
  if(!entry || !payload || !character) return;
  payload.status = 'rejected';
  entry.content = JSON.stringify(payload);
  var userName = getCurrentUserDisplayName();
  var note = makeSystemNoticeEntry(userName + '现在不想出门');
  chatLog.push(note);
  addSystemNotice(note.content, true, note.id);
  await saveChat(true);
  rerenderChat();
}

async function acceptOfflineInvite(messageId){
  var entry = getMessageById(messageId);
  var payload = parseOfflineInvitePayload(entry && entry.content) || null;
  if(!entry || !payload) return;
  payload = coerceOfflineInvitePayloadToThread(payload, 'assistant');
  writeOfflineInviteDebug({
    chatThreadCharId: String((character && character.id) || '').trim(),
    invitePayloadCharId: String(payload && payload.charId || '').trim(),
    invitePayloadCharName: String(payload && payload.charName || '').trim(),
    clickedInviteMessageId: String(messageId || '').trim()
  });
  if(!payload.charId || !String(payload.charId).trim()){
    var threadCharId = getOfflineInviteThreadCharId();
    var threadCharacter = getOfflineInviteThreadCharacter();
    if(threadCharId){
      payload.charId = String(threadCharId || '').trim();
      payload.charName = String((threadCharacter && (threadCharacter.nickname || threadCharacter.name)) || '').trim();
    }
  }
  payload.status = 'accepted';
  entry.content = JSON.stringify(payload);
  rerenderChat();
  try{
    var threadCharacter = getOfflineInviteThreadCharacter();
    var shellCharacter = null;
    if(threadCharacter && typeof compactChar === 'function'){
      shellCharacter = compactChar(threadCharacter);
    }else if(character && typeof compactChar === 'function'){
      shellCharacter = compactChar(character);
    }
    if(shellCharacter) postToShell({ type:'SET_ACTIVE_CHARACTER', payload: shellCharacter });
  }catch(e){}
  try{
    if(typeof saveChat === 'function'){
      Promise.resolve(saveChat(true)).catch(function(err){
        console.error('save accepted offline invite failed:', err);
      });
    }
  }catch(e){}
  await openOfflineSession(payload);
}

async function requestCharOfflineInviteDecision(userPayload){
  var safePayload = sanitizeOfflineInvitePayloadForModel(userPayload);
  var inviteText = String(safePayload.content || '').trim();
  var inviteLocation = String(safePayload.location || '').trim();
  var msgMin = Math.max(1, Number(character && character.msgMin) || 1);
  var msgMax = Math.max(msgMin, Number(character && character.msgMax) || 3);
  var systemPrompt = [
    '你是角色本人，要决定是否接受用户发来的线下邀请。',
    '必须认真读取角色当前人设、世界书设定、最近聊天气氛、用户此刻的伤心或情绪状态，以及用户这次邀约里写的具体话和地点。',
    '一定要把用户邀约里写的那句话和地点真正读进去，再决定接受还是拒绝，不能忽略地点，也不能把卡片装饰文案当成用户原话。',
    '如果 accept 为 true，text 不是模板句，而是角色本人认真写给用户的一句约会邀请或回应，语气要符合角色，不要套话，不要默认文案。',
    'text 控制在大约 45 个字，允许上下浮动一点，但不要太短，也不要太长。',
    '只返回 JSON：{"accept":true|false,"text":"...","mood":"...","weather":"...","location":"...","aside":"..."}',
    '如果 accept 为 true，text 写一句自然口语的线下回应，其他字段用于邀约卡片。',
    '如果 accept 为 false，text 要写成普通聊天里的自然解释，不要模板腔，不要写成邀约卡片文案。',
    '如果 accept 为 false，请像真人聊天一样回复：可以先来一句当下反应，再补一句解释或安抚，语气要有停顿感和生活感。',
    '优先由你自己决定是否分成多条短消息；如果分多条，请用 <msg> 隔开，并严格参考当前聊天设置的范围：最少 ' + msgMin + ' 条，最多 ' + msgMax + ' 条。',
    '不要为了分条而硬切，只有真的像聊天那样自然停顿时才分开。',
    '不要 markdown，不要额外解释。'
  ].join('\n');
  var userPrompt = [
    buildSystemPrompt(),
    '用户这次真正写下的邀约话语：' + (inviteText || '（空）'),
    '用户想约你的地点：' + (inviteLocation || '（未填写）'),
    '用户刚刚发来线下邀请（只保留真实邀约信息）：' + JSON.stringify(safePayload),
    (window.getInviteWeatherPromptText ? window.getInviteWeatherPromptText('char') : ''),
    (window.getInviteWeatherPromptText ? window.getInviteWeatherPromptText('user') : ''),
    '最近聊天：\n' + formatChatForModel(chatLog.slice(-12))
  ].join('\n\n');
  var raw = await callAIWithCustomPrompts(systemPrompt, userPrompt);
  var clean = String(raw || '').replace(/^```[a-zA-Z]*\s*/,'').replace(/```$/,'').trim();
  try{
    return JSON.parse(clean);
  }catch(e){
    throw new Error('邀约回复解析失败');
  }
}

function getPendingUserOfflineInviteEntry(){
  if(!Array.isArray(chatLog) || !chatLog.length) return null;
  for(var i = chatLog.length - 1; i >= 0; i--){
    var entry = chatLog[i];
    if(!entry) continue;
    if(String(entry.role || '') === 'system') continue;
    if(normalizeMessageType(entry.type || 'text') === 'offlineinvite' && String(entry.role || '') === 'user'){
      var payload = parseOfflineInvitePayload(entry.content) || null;
      if(payload && String(payload.status || 'pending') === 'pending') return { entry: entry, payload: payload };
    }
    break;
  }
  return null;
}

function getLatestPendingUserOfflineInviteThread(){
  if(!Array.isArray(chatLog) || !chatLog.length) return null;
  for(var i = chatLog.length - 1; i >= 0; i--){
    var entry = chatLog[i];
    if(!entry) continue;
    if(String(entry.role || '') === 'system') continue;
    if(String(entry.role || '') === 'user'){
      if(normalizeMessageType(entry.type || 'text') !== 'offlineinvite') return null;
      var payload = parseOfflineInvitePayload(entry.content) || null;
      if(payload && String(payload.status || 'pending') === 'pending'){
        return { index: i, entry: entry, payload: payload };
      }
      return null;
    }
  }
  return null;
}

async function rerollPendingOfflineInviteReply(){
  var pending = getLatestPendingUserOfflineInviteThread();
  if(!pending) return false;
  var removedAssistant = false;
  for(var i = chatLog.length - 1; i > pending.index; i--){
    var entry = chatLog[i];
    if(!entry) continue;
    if(String(entry.role || '') === 'user') return false;
    if(String(entry.role || '') === 'assistant'){
      removedAssistant = true;
    }
    chatLog.splice(i, 1);
  }
  if(!removedAssistant) return false;
  if(typeof rollbackInnerVoiceOnReroll === 'function') rollbackInnerVoiceOnReroll();
  await saveChat(true);
  renderChatLog(false);
  var provider = localStorage.getItem('provider') || 'openai';
  var key = localStorage.getItem('key_' + provider);
  if(!key){
    showError('未找到 ' + provider + ' 的 API key，请先去设置');
    return true;
  }
  hideError();
  pendingMomentsChatCue = '';
  pendingFamilyFollowupCue = '';
  pendingModelUserCue = '';
  await handlePendingOfflineInviteReply();
  return true;
}

async function handlePendingOfflineInviteReply(){
  var pending = getPendingUserOfflineInviteEntry();
  if(!pending) return false;
  isTyping = true;
  var genBtn = document.getElementById('genBtn');
  var sendBtn = document.getElementById('sendBtn');
  if(genBtn) genBtn.disabled = true;
  if(sendBtn) sendBtn.disabled = true;
  showTyping();
  try{
    var decision = await requestCharOfflineInviteDecision(pending.payload);
    hideTyping();
    if(decision && decision.accept){
      var charWeather = await resolveOfflineInviteWeather('char', decision.weather || randomPick(OFFLINE_WEATHERS, '☀︎'));
      var replyPayload = buildOfflineInvitePayload('assistant', normalizeOfflineInviteDecisionText(decision.text, '我想认真见你一面'), {
        charId: String((character && character.id) || '').trim(),
        charName: String((character && (character.nickname || character.name)) || '').trim(),
        mood: decision.mood || randomPick(OFFLINE_MOODS, '(///v///)'),
        weather: charWeather.icon,
        location: decision.location || pending.payload.location,
        aside: decision.aside || '这次别拒绝我'
      });
      await appendOfflineInviteToChat('assistant', replyPayload, true);
      return true;
    }
    var rejectNotice = makeSystemNoticeEntry(appendOfflineInviteRejectNoticeText());
    chatLog.push(rejectNotice);
    addSystemNotice(rejectNotice.content, true, rejectNotice.id);
    await deliverAiReply(normalizeOfflineInviteRejectText((decision && decision.text) || '', '今天先不出门了，不过我有点心动。'), Math.max(1, character && character.msgMax ? character.msgMax : 3));
    await saveChat(true);
    return true;
  }catch(err){
    hideTyping();
    showError('邀约回复失败: ' + humanizeAiError(err));
    console.error('offline invite reply error:', err);
    return true;
  } finally {
    hideTyping();
    isTyping = false;
    if(genBtn) genBtn.disabled = false;
    if(sendBtn) sendBtn.disabled = false;
  }
}

async function sendOfflineInviteFromUser(){
  if(!character){
    if(typeof toast === 'function') toast('请先选择角色');
    return;
  }
  var locationField = document.getElementById('offlineInviteLocationField');
  var dateField = document.getElementById('offlineInviteDateField');
  var timeField = document.getElementById('offlineInviteTimeField');
  var messageField = document.getElementById('offlineInviteMessageField');
  var location = String(locationField && locationField.value || '').trim();
  var dateValue = String(dateField && dateField.value || '').trim();
  var timeValue = String(timeField && timeField.value || '').trim();
  var text = String(messageField && messageField.value || '').trim();
  if(!location){
    if(typeof toast === 'function') toast('地点也要写上呀');
    return;
  }
  if(!dateValue || !timeValue){
    if(typeof toast === 'function') toast('把时间定下来再发吧');
    return;
  }
  if(!text){
    if(typeof toast === 'function') toast('写一句邀约再发出去吧');
    return;
  }
  closeOfflineInviteComposer();
  var userWeather = await resolveOfflineInviteWeather('user', '☀︎');
  var payload = buildOfflineInvitePayload('user', text, {
    charId: String((character && character.id) || '').trim(),
    charName: String((character && (character.nickname || character.name)) || '').trim(),
    weather: userWeather.icon,
    location: location,
    dateLabel: formatOfflineInviteDraftDateLabel(dateValue),
    timeLabel: formatOfflineInviteDraftTimeLabel(timeValue),
    signatureName: getCurrentUserDisplayName(),
    stampAsset: randomPick(OFFLINE_INVITE_STAMP_ASSETS, 'assets/邮票1.jpg'),
    scheduledDate: dateValue,
    scheduledTime: timeValue
  });
  payload.aside = '';
  payload.mood = '';
  await appendOfflineInviteToChat('user', payload, true);
}

function importPendingOfflineArtifacts(){
  if(!character || !character.id) return;
  var changed = false;
  var memoryChanged = false;
  try{
    var noticeRaw = localStorage.getItem(pendingOfflineNoticeStorageKey(character.id));
    if(noticeRaw){
      var notice = JSON.parse(noticeRaw);
      if(notice && notice.text){
        var entry = makeSystemNoticeEntry(notice.text);
        chatLog.push(entry);
        addSystemNotice(entry.content, false, entry.id);
        localStorage.removeItem(pendingOfflineNoticeStorageKey(character.id));
        changed = true;
      }
    }
  }catch(e){}
  try{
    var memoryRaw = localStorage.getItem(pendingOfflineMemoryStorageKey(character.id));
    if(memoryRaw){
      var memory = JSON.parse(memoryRaw);
      if(memory && memory.text){
        var store = loadMemorySummaryStore();
        store.items.push({
          id: 'ms_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
          from: chatLog.length,
          to: chatLog.length,
          text: String(memory.text || ''),
          tokens: approxTokenCount(memory.text || ''),
          createdAt: Number(memory.createdAt || Date.now()) || Date.now()
        });
        saveMemorySummaryStore(store);
        localStorage.removeItem(pendingOfflineMemoryStorageKey(character.id));
        changed = true;
        memoryChanged = true;
      }
    }
  }catch(e){}
  if(memoryChanged) refreshMemoryUi();
  if(changed) saveChat(true);
}

function renderOfflineInviteBubble(bubble, raw, viewRole, msgId){
  var data = buildOfflineInvitePayload(viewRole === 'user' ? 'user' : 'assistant', '', coerceOfflineInvitePayloadToThread(parseOfflineInvitePayload(raw) || {}, viewRole === 'user' ? 'user' : 'assistant'));
  var canRespond = viewRole !== 'user';
  var status = String(data.status || 'pending');
  var title = viewRole === 'user' ? 'Sent Invite' : 'Incoming Invite';
  var statusLabel = status === 'accepted' ? 'Accepted' : (status === 'rejected' ? 'Rejected' : 'Pending');
  var disabled = status !== 'pending';
  bubble.innerHTML = '<div class="offline-invite-plain">'
    + '<div class="offline-invite-plain-head">'
    + '<div class="offline-invite-plain-title">' + esc(title) + '</div>'
    + '<div class="offline-invite-plain-status' + (disabled ? ' is-done' : '') + '">' + esc(statusLabel) + '</div>'
    + '</div>'
    + '<div class="offline-invite-plain-body">' + esc(String(data.content || '').trim() || '约会邀请') + '</div>'
    + '<div class="offline-invite-plain-meta">'
    + '<div class="offline-invite-plain-row"><strong>Time</strong>' + esc([String(data.dateLabel || '').trim(), String(data.timeLabel || '').trim()].filter(Boolean).join(' ' ) || '待定') + '</div>'
    + '<div class="offline-invite-plain-row"><strong>At</strong>' + esc(String(data.location || '').trim() || '待定地点') + '</div>'
    + '</div>'
    + (canRespond ? '<div class="offline-invite-plain-actions">'
      + '<button class="offline-invite-plain-btn" type="button" data-offline-action="reject"' + (disabled ? ' disabled' : '') + '>Pass</button>'
      + '<button class="offline-invite-plain-btn primary" type="button" data-offline-action="accept"' + (disabled ? ' disabled' : '') + '>Go</button>'
      + '</div>' : '')
    + '</div>';
  if(!canRespond) return;
  bubble.addEventListener('click', function(evt){
    var actionBtn = evt.target && evt.target.closest ? evt.target.closest('[data-offline-action]') : null;
    if(!actionBtn || !msgId || actionBtn.disabled) return;
    evt.stopPropagation();
    runOfflineInviteAction(actionBtn.getAttribute('data-offline-action'), msgId);
  });
}
