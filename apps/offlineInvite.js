var OFFLINE_INVITE_SNIPPET = '【见面安排】';
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
  var month = Number(parts[1]) || 0;
  var day = Number(parts[2]) || 0;
  return month + '月' + day + '日';
}

function formatOfflineInviteDraftTimeLabel(value){
  var raw = String(value || '').trim();
  if(!raw) return '时间待定';
  return raw;
}

function parseOfflineInvitePayload(raw){
  if(!raw) return null;
  if(typeof raw === 'object'){
    var cloned = Object.assign({}, raw);
    delete cloned.content;
    return cloned;
  }
  try{
    var parsed = JSON.parse(String(raw || ''));
    if(parsed && typeof parsed === 'object'){
      delete parsed.content;
      return parsed;
    }
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
    dateLabel: d.toLocaleDateString([], { month:'short', day:'numeric' })
  };
}

function stripOfflineInviteWeekdayLabel(value){
  var raw = String(value || '').trim();
  if(!raw) return '';
  return raw
    .replace(/\s*周[日一二三四五六天]\s*/g, ' ')
    .replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b\.?,?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function buildOfflineInvitePayload(sourceRole, overrides){
  var labels = currentDateLabels(sourceRole === 'user' ? 'user' : 'char');
  var threadCharacter = getOfflineInviteThreadCharacter();
  var safeOverrides = coerceOfflineInvitePayloadToThread(overrides || {}, sourceRole);
  var snapshotSource = threadCharacter || (safeOverrides && safeOverrides.charSnapshot) || character || {};
  var data = Object.assign({
    type: 'offline_invite',
    sourceRole: sourceRole === 'user' ? 'user' : 'assistant',
    charId: String((threadCharacter && threadCharacter.id) || '').trim(),
    charName: String((threadCharacter && (threadCharacter.nickname || threadCharacter.name)) || '').trim(),
    mood: randomPick(OFFLINE_MOODS, '(｡･ω･｡)'),
    weather: randomPick(OFFLINE_WEATHERS, '☀︎'),
    location: ((threadCharacter && (threadCharacter.nickname || threadCharacter.name)) || '对方') + '想和你见面的地方',
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
  data.mood = String(data.mood || '').trim() || '(｡･ω･｡)';
  data.weather = normalizeOfflineWeatherIcon(data.weather);
  data.location = String(data.location || '').trim() || '老地方';
  data.timeLabel = String(data.timeLabel || labels.timeLabel);
  data.dateLabel = String(data.dateLabel || labels.dateLabel);
  data.status = String(data.status || 'pending');
  delete data.content;
  if(!data.charSnapshot || typeof data.charSnapshot !== 'object'){
    data.charSnapshot = buildOfflineLaunchCharSnapshot(snapshotSource);
  }
  return data;
}

function getOfflineInviteStoreApi(){
  return window.OfflineInviteStore && typeof window.OfflineInviteStore.upsertRecord === 'function'
    ? window.OfflineInviteStore
    : null;
}

function getOfflineInviteScheduleApi(){
  return window.ScheduleShared && typeof window.ScheduleShared.loadState === 'function'
    ? window.ScheduleShared
    : null;
}

function getOfflineInviteRecordId(payload){
  return String(payload && (payload.recordId || payload.inviteRecordId) || '').trim();
}

function ensureOfflineInviteRecordId(payload){
  if(!(payload && typeof payload === 'object')) return '';
  var existing = getOfflineInviteRecordId(payload);
  if(existing) return existing;
  var created = getOfflineInviteStoreApi() && typeof getOfflineInviteStoreApi().createId === 'function'
    ? getOfflineInviteStoreApi().createId('invite')
    : ('invite_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));
  payload.recordId = created;
  return created;
}

function isOfflineInviteValidDateKey(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function isOfflineInviteValidTimeValue(value){
  return /^\d{2}:\d{2}$/.test(String(value || '').trim());
}

function offlineInviteDateKeyToParts(value){
  var raw = String(value || '').trim();
  if(!isOfflineInviteValidDateKey(raw)) return null;
  var parts = raw.split('-');
  return {
    year: Number(parts[0]) || 0,
    month: Number(parts[1]) || 0,
    day: Number(parts[2]) || 0
  };
}

function compareOfflineInviteDateKeys(a, b){
  var aa = String(a || '').trim();
  var bb = String(b || '').trim();
  if(aa === bb) return 0;
  return aa < bb ? -1 : 1;
}

function shiftOfflineInviteDateKeyByDays(value, days){
  var parts = offlineInviteDateKeyToParts(value);
  if(!parts) return String(value || '').trim();
  var date = new Date(parts.year, Math.max(0, parts.month - 1), parts.day);
  date.setDate(date.getDate() + Number(days || 0));
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function offlineInviteTimeToMinutes(value){
  var raw = String(value || '').trim();
  if(!isOfflineInviteValidTimeValue(raw)) return -1;
  var parts = raw.split(':');
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
}

function offlineInviteMinutesToTime(value){
  var safe = Math.max(0, Number(value) || 0);
  var hours = Math.floor(safe / 60);
  var mins = safe % 60;
  return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

function roundOfflineInviteMinutesToQuarter(value){
  var safe = Math.max(0, Number(value) || 0);
  return Math.ceil(safe / 15) * 15;
}

function getOfflineInviteLocalClockNow(){
  try{
    if(typeof buildScheduleLocalNowContextForCharacter === 'function'){
      var clock = buildScheduleLocalNowContextForCharacter(character, Date.now());
      if(clock && clock.user){
        return {
          dateKey: String(clock.user.dateKey || '').trim(),
          nowTime: String(clock.user.nowTime || '').trim()
        };
      }
    }
  }catch(err){}
  var now = new Date();
  return {
    dateKey: [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-'),
    nowTime: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  };
}

function deriveOfflineInviteAcceptedSchedule(userPayload, decision){
  var chosenDate = '';
  var chosenTime = '';
  var safeDecision = decision && typeof decision === 'object' ? decision : {};
  var decisionDate = String(safeDecision.scheduledDate || safeDecision.date || '').trim();
  var decisionTime = String(safeDecision.scheduledTime || safeDecision.time || safeDecision.availableTime || '').trim();
  if(isOfflineInviteValidDateKey(decisionDate)) chosenDate = decisionDate;
  if(isOfflineInviteValidTimeValue(decisionTime)) chosenTime = decisionTime;
  if(!chosenDate && isOfflineInviteValidDateKey(userPayload && userPayload.scheduledDate)) chosenDate = String(userPayload.scheduledDate).trim();
  if(!chosenTime && isOfflineInviteValidTimeValue(userPayload && userPayload.scheduledTime)) chosenTime = String(userPayload.scheduledTime).trim();
  var localNow = getOfflineInviteLocalClockNow();
  var todayKey = String(localNow.dateKey || buildOfflineInviteDefaultSchedule().date || '').trim();
  var nowMinutes = offlineInviteTimeToMinutes(localNow.nowTime);
  if(nowMinutes < 0) nowMinutes = offlineInviteTimeToMinutes(buildOfflineInviteDefaultSchedule().time);
  if(!chosenDate) chosenDate = todayKey;
  if(!chosenTime) chosenTime = buildOfflineInviteDefaultSchedule().time;
  var minutes = offlineInviteTimeToMinutes(chosenTime);
  if(minutes < 0) minutes = offlineInviteTimeToMinutes(buildOfflineInviteDefaultSchedule().time);
  var earliest = roundOfflineInviteMinutesToQuarter(nowMinutes + 60);
  if(compareOfflineInviteDateKeys(chosenDate, todayKey) < 0){
    chosenDate = todayKey;
    minutes = Math.max(earliest, 10 * 60);
  }else if(compareOfflineInviteDateKeys(chosenDate, todayKey) === 0 && minutes < earliest){
    minutes = earliest;
  }
  if(minutes < 9 * 60 + 30) minutes = 10 * 60;
  if(minutes > 22 * 60 + 30){
    chosenDate = shiftOfflineInviteDateKeyByDays(chosenDate, 1);
    minutes = 10 * 60 + 30;
  }
  var finalTime = offlineInviteMinutesToTime(minutes);
  return {
    scheduledDate: chosenDate,
    scheduledTime: finalTime,
    dateLabel: formatOfflineInviteDraftDateLabel(chosenDate),
    timeLabel: formatOfflineInviteDraftTimeLabel(finalTime)
  };
}

async function syncOfflineInviteRecord(payload, patch){
  var store = getOfflineInviteStoreApi();
  if(!store || !(payload && typeof payload === 'object')) return '';
  var recordId = ensureOfflineInviteRecordId(payload);
  if(!recordId) return '';
  var next = Object.assign({
    id: recordId,
    threadId: String(payload.threadId || recordId).trim() || recordId,
    charId: String(payload.charId || '').trim(),
    charName: String(payload.charName || '').trim(),
    sourceRole: String(payload.sourceRole || 'user').trim() || 'user',
    previewText: String(payload.previewText || '').trim(),
    location: String(payload.location || '').trim(),
    scheduledDate: isOfflineInviteValidDateKey(payload.scheduledDate) ? String(payload.scheduledDate).trim() : '',
    scheduledTime: isOfflineInviteValidTimeValue(payload.scheduledTime) ? String(payload.scheduledTime).trim() : '',
    dateLabel: String(payload.dateLabel || '').trim(),
    timeLabel: String(payload.timeLabel || '').trim(),
    status: String(payload.status || 'pending').trim() || 'pending',
    reminderState: String(payload.reminderState || 'pending').trim() || 'pending',
    arrivalState: String(payload.arrivalState || 'pending').trim() || 'pending',
    arrivedAt: Number(payload.arrivedAt || 0) || 0,
    inviteMessageId: String(payload.inviteMessageId || '').trim(),
    replyMessageId: String(payload.replyMessageId || '').trim(),
    scheduleEntryId: String(payload.scheduleEntryId || '').trim(),
    updatedAt: Date.now()
  }, patch || {});
  await Promise.resolve(store.upsertRecord(next));
  return recordId;
}

async function removeOfflineInviteScheduleEntry(charId, dateKey, entryId){
  var shared = getOfflineInviteScheduleApi();
  var safeCharId = String(charId || '').trim();
  var safeDateKey = String(dateKey || '').trim();
  var safeEntryId = String(entryId || '').trim();
  if(!shared || !safeCharId || !safeDateKey || !safeEntryId) return false;
  var state = shared.normalizeState(await shared.loadState());
  var charState = shared.getCharState(state, safeCharId);
  charState.charDays = charState.charDays || {};
  var day = shared.normalizeCharDay(charState.charDays[safeDateKey] || { date: safeDateKey }, safeDateKey);
  var before = Array.isArray(day.timeline) ? day.timeline.length : 0;
  day.timeline = (Array.isArray(day.timeline) ? day.timeline : []).filter(function(item){
    return String(item && item.id || '') !== safeEntryId;
  });
  if(day.timeline.length === before) return false;
  charState.charDays[safeDateKey] = shared.normalizeCharDay(day, safeDateKey);
  state = shared.setCharState(state, safeCharId, charState);
  await shared.saveState(state);
  return true;
}

async function syncAcceptedOfflineInviteToSchedule(payload, acceptedPayload){
  var shared = getOfflineInviteScheduleApi();
  var safeCharId = String((acceptedPayload && acceptedPayload.charId) || (payload && payload.charId) || (character && character.id) || '').trim();
  var safeDateKey = String((acceptedPayload && acceptedPayload.scheduledDate) || (payload && payload.scheduledDate) || '').trim();
  if(!shared || !safeCharId || !safeDateKey) return '';
  var state = shared.normalizeState(await shared.loadState());
  var charState = shared.getCharState(state, safeCharId);
  charState.charDays = charState.charDays || {};
  var day = shared.normalizeCharDay(charState.charDays[safeDateKey] || { date: safeDateKey }, safeDateKey);
  var recordId = getOfflineInviteRecordId(acceptedPayload || payload);
  var scheduleEntryId = String(acceptedPayload && acceptedPayload.scheduleEntryId || '').trim()
    || (recordId ? ('timeline_invite_' + recordId) : shared.createId('timeline'));
  var userName = getCurrentUserDisplayName();
  day.timeline = Array.isArray(day.timeline) ? day.timeline.slice() : [];
  day.timeline = day.timeline.filter(function(item){
    return String(item && item.id || '') !== scheduleEntryId;
  });
  day.timeline.push({
    id: scheduleEntryId,
    start: String(acceptedPayload && acceptedPayload.scheduledTime || '').trim(),
    end: '',
    title: '和' + userName + '赴约',
    note: '记得去赴约。',
    location: String((acceptedPayload && acceptedPayload.location) || (payload && payload.location) || '').trim(),
    done: false,
    kind: 'char',
    secret: false,
    secretPassword: '',
    secretHint: '',
    publicMask: '',
    comments: []
  });
  charState.charDays[safeDateKey] = shared.normalizeCharDay(day, safeDateKey);
  state = shared.setCharState(state, safeCharId, charState);
  await shared.saveState(state);
  return scheduleEntryId;
}

function sanitizeOfflineInvitePayloadForModel(payload){
  var src = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
  delete src.status;
  delete src.type;
  delete src.sourceRole;
  delete src.createdAt;
  delete src.timeLabel;
  delete src.dateLabel;
  delete src.content;
  if(src.location != null) src.location = String(src.location || '').trim();
  return src;
}

function offlineInviteSummaryText(raw){
  return OFFLINE_INVITE_SNIPPET;
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
  return clean;
}

function splitOfflineInviteFollowupText(raw){
  var clean = String(raw || '')
    .replace(/<\s*\/?\s*msg\s*>/ig, '<msg>')
    .replace(/\r\n?/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();
  if(!clean) return [];
  var explicit = clean.split(/<msg>/i).map(function(part){
    return String(part || '').trim();
  }).filter(Boolean);
  if(explicit.length) return explicit;
  var lines = clean.split(/\n+/).map(function(part){
    return String(part || '').trim();
  }).filter(Boolean);
  return lines.length ? lines : [clean];
}

function normalizeOfflineInviteFollowups(value, fallbackText, options){
  var opts = options && typeof options === 'object' ? options : {};
  var limit = Math.max(1, Number(opts.limit) || Math.max(1, Number(character && character.msgMax) || 3));
  var parts = [];
  var seen = Object.create(null);

  function pushPart(text){
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if(!clean) return;
    var key = clean.replace(/[。！？!?]+$/g, '');
    if(seen[key]) return;
    seen[key] = true;
    parts.push(clean);
  }

  if(Array.isArray(value)){
    value.forEach(function(item){
      splitOfflineInviteFollowupText(item).forEach(pushPart);
    });
  }else{
    splitOfflineInviteFollowupText(value).forEach(pushPart);
  }
  if(!parts.length && fallbackText){
    splitOfflineInviteFollowupText(fallbackText).forEach(pushPart);
  }
  return parts.slice(0, limit).join('<msg>');
}

function firstOfflineInviteFollowupText(bundle){
  var parts = splitOfflineInviteFollowupText(bundle);
  return parts.length ? parts[0] : '';
}

function sanitizeOfflineInviteFollowupItems(items, fallbackText, options){
  var opts = options && typeof options === 'object' ? options : {};
  var limit = Math.max(1, Number(opts.limit) || Math.max(1, Number(character && character.msgMax) || 3));
  var out = [];
  var seen = new Set();

  function pushText(text){
    splitOfflineInviteFollowupText(text).forEach(function(part){
      var safeText = sanitizeAssistantTextForChat(String(part || '').trim());
      if(!safeText) return;
      var dedupeKey = safeText.replace(/\s+/g, ' ');
      if(seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      out.push({ type:'text', content: safeText });
    });
  }

  if(Array.isArray(items)){
    items.forEach(function(item){
      if(item && typeof item === 'object'){
        var type = normalizeMessageType(item.type || 'text');
        if(type !== 'text') return;
        pushText(item.content || item.text || item.reply_content || item.description || '');
        return;
      }
      pushText(item);
    });
  }else{
    pushText(items);
  }

  if(!out.length && fallbackText){
    pushText(fallbackText);
  }

  return out.slice(0, limit);
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
      app:'offline_mode',
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

function formatOfflineInviteComposerDate(value){
  var raw = String(value || '').trim();
  if(!raw) return 'Pick a date';
  var parts = raw.split('-');
  if(parts.length < 3) return raw;
  var year = Number(parts[0]) || 0;
  var month = Number(parts[1]) || 1;
  var day = Number(parts[2]) || 1;
  var names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[Math.max(0, Math.min(11, month - 1))] + ' ' + day + ', ' + year;
}

function formatOfflineInviteDatePickerMonth(value){
  var raw = String(value || '').trim();
  if(!raw) return '';
  var parts = raw.split('-');
  if(parts.length < 2) return raw;
  var month = Number(parts[1]) || 1;
  var year = Number(parts[0]) || 0;
  var names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return names[Math.max(0, Math.min(11, month - 1))] + ' ' + year;
}

function getOfflineInviteDatePageStart(){
  var dateField = document.getElementById('offlineInviteDateField');
  var raw = String(dateField && dateField.dataset.pageStart || '').trim();
  if(raw) return raw;
  return String(dateField && dateField.value || '').trim();
}

function setOfflineInviteDatePageStart(value){
  var dateField = document.getElementById('offlineInviteDateField');
  if(dateField) dateField.dataset.pageStart = String(value || '').trim();
}

function shiftOfflineInviteDateByDays(value, days){
  var raw = String(value || '').trim();
  if(!raw) return raw;
  var parts = raw.split('-');
  if(parts.length < 3) return raw;
  var date = new Date(Number(parts[0]) || 0, Math.max(0, (Number(parts[1]) || 1) - 1), Number(parts[2]) || 1);
  date.setDate(date.getDate() + Number(days || 0));
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function syncOfflineInviteInlineWidth(node, fallback){
  if(!node) return;
  var text = String(node.value != null ? node.value : node.textContent || '').trim();
  var size = Math.max(fallback || 8, Math.min(24, text.length || fallback || 8));
  node.style.width = size + 'ch';
}

function buildOfflineInviteTimeWheelHtml(type, activeValue){
  var values = [];
  var i = 0;
  if(type === 'hour'){
    for(i = 0; i < 24; i++) values.push(String(i).padStart(2, '0'));
  }else{
    for(i = 0; i < 60; i += 5) values.push(String(i).padStart(2, '0'));
  }
  return values.map(function(value){
    var active = String(activeValue || '') === value ? ' active' : '';
    return '<button class="invite-compose-time-option' + active + '" type="button" onclick="event.stopPropagation();selectOfflineInviteTimePart(\'' + type + '\',\'' + value + '\');return false;">' + esc(value) + '</button>';
  }).join('');
}

function renderOfflineInviteTimeWheels(hourValue, minuteValue){
  var hourWheel = document.getElementById('offlineInviteHourWheel');
  var minuteWheel = document.getElementById('offlineInviteMinuteWheel');
  if(hourWheel) hourWheel.innerHTML = buildOfflineInviteTimeWheelHtml('hour', hourValue);
  if(minuteWheel) minuteWheel.innerHTML = buildOfflineInviteTimeWheelHtml('minute', minuteValue);
  setTimeout(function(){
    [hourWheel, minuteWheel].forEach(function(wheel){
      if(!wheel) return;
      var active = wheel.querySelector('.invite-compose-time-option.active');
      if(active && typeof active.scrollIntoView === 'function'){
        try{
          active.scrollIntoView({ block:'center', inline:'nearest' });
        }catch(err){}
      }
    });
  }, 0);
}

function syncOfflineInviteComposerVisuals(){
  var locationField = document.getElementById('offlineInviteLocationField');
  var dateField = document.getElementById('offlineInviteDateField');
  var dateDisplay = document.getElementById('offlineInviteDateDisplay');
  var hourWheel = document.getElementById('offlineInviteHourWheel');
  var minuteWheel = document.getElementById('offlineInviteMinuteWheel');
  var timeValue = String(dateField && dateField.dataset.time || '').trim();
  var parts = timeValue ? timeValue.split(':') : [];
  var hourValue = String(parts[0] || '19').padStart(2, '0');
  var minuteValue = String(parts[1] || '30').padStart(2, '0');
  if(dateDisplay) dateDisplay.textContent = formatOfflineInviteComposerDate(dateField && dateField.value || '');
  syncOfflineInviteInlineWidth(locationField, 9);
  syncOfflineInviteInlineWidth(dateDisplay, 11);
  if(hourWheel && minuteWheel) renderOfflineInviteTimeWheels(hourValue, minuteValue);
  renderOfflineInviteDatePicker();
}

function renderOfflineInviteDatePicker(){
  var dateField = document.getElementById('offlineInviteDateField');
  var list = document.getElementById('offlineInviteDateList');
  var month = document.getElementById('offlineInviteDateMonth');
  if(!dateField || !list) return;
  var base = getOfflineInviteDatePageStart() || String(dateField.value || '').trim();
  if(!base) return;
  if(month) month.textContent = formatOfflineInviteDatePickerMonth(base);
  var html = [];
  var i = 0;
  for(i = 0; i < 7; i++){
    var value = shiftOfflineInviteDateByDays(base, i);
    var dateLabel = formatOfflineInviteComposerDate(value);
    var active = String(dateField.value || '').trim() === value ? ' active' : '';
    html.push('<button class="invite-compose-date-chip' + active + '" type="button" onclick="selectOfflineInviteDate(event,\'' + esc(value) + '\')">' + esc(dateLabel) + '</button>');
  }
  list.innerHTML = html.join('');
}

function toggleOfflineInviteDatePicker(evt){
  if(evt && evt.stopPropagation) evt.stopPropagation();
  var pop = document.getElementById('offlineInviteDatePop');
  if(!pop) return;
  pop.classList.toggle('open');
}

function closeOfflineInviteDatePicker(){
  var pop = document.getElementById('offlineInviteDatePop');
  if(pop) pop.classList.remove('open');
}

function shiftOfflineInviteDatePage(evt, days){
  if(evt && evt.stopPropagation) evt.stopPropagation();
  var base = getOfflineInviteDatePageStart();
  if(!base) return;
  setOfflineInviteDatePageStart(shiftOfflineInviteDateByDays(base, days));
  renderOfflineInviteDatePicker();
}

function selectOfflineInviteDate(evt, value){
  if(evt && evt.stopPropagation) evt.stopPropagation();
  var dateField = document.getElementById('offlineInviteDateField');
  if(!dateField) return;
  dateField.value = String(value || '').trim();
  setOfflineInviteDatePageStart(String(value || '').trim());
  syncOfflineInviteComposerVisuals();
}

function selectOfflineInviteTimePart(type, value){
  var dateField = document.getElementById('offlineInviteDateField');
  if(!dateField) return;
  var current = String(dateField.dataset.time || '').trim() || '19:30';
  var parts = current.split(':');
  var hourValue = String(parts[0] || '19').padStart(2, '0');
  var minuteValue = String(parts[1] || '30').padStart(2, '0');
  if(type === 'hour') hourValue = String(value || '19').padStart(2, '0');
  else minuteValue = String(value || '30').padStart(2, '0');
  dateField.dataset.time = hourValue + ':' + minuteValue;
  syncOfflineInviteComposerVisuals();
}

function handleOfflineInviteComposerMask(evt){
  var card = evt && evt.target && evt.target.closest ? evt.target.closest('.invite-compose-card') : null;
  if(card) return;
  closeOfflineInviteDatePicker();
  closeOfflineInviteComposer();
}

function hydrateOfflineInviteComposerAvatar(){
  var photo = document.getElementById('offlineInviteUserPhoto');
  var label = document.getElementById('offlineInviteUserLabel');
  var displayName = getCurrentUserDisplayName() || 'USER';
  if(label) label.textContent = displayName;
  if(!photo) return;
  photo.style.backgroundImage = '';
  photo.innerHTML = '<span class="invite-compose-polaroid-fallback">' + esc(displayName.charAt(0) || 'U') + '</span>';
  resolveChatUserAvatarAsync(character && character.id).then(function(src){
    var safe = String(src || '').trim();
    if(!safe) return;
    photo.innerHTML = '<img class="invite-compose-polaroid-bg" src="' + escAttr(safe) + '" alt=""><img class="invite-compose-polaroid-fg" src="' + escAttr(safe) + '" alt="">';
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
  var stamp = document.getElementById('offlineInviteStampImage');
  var schedule = buildOfflineInviteDefaultSchedule();
  if(locationField) locationField.value = '';
  if(dateField) dateField.value = schedule.date;
  if(dateField) dateField.dataset.time = schedule.time;
  setOfflineInviteDatePageStart(schedule.date);
  if(stamp) stamp.src = randomPick(OFFLINE_INVITE_STAMP_ASSETS, 'assets/邮票1.jpg');
  hydrateOfflineInviteComposerAvatar();
  syncOfflineInviteComposerVisuals();
  closeOfflineInviteDatePicker();
  if(modal) modal.classList.add('open');
  if(locationField){
    setTimeout(function(){ locationField.focus(); }, 40);
  }
}

function appendOfflineInviteNoticeText(role){
  var charName = (character && (character.nickname || character.name)) || 'Char';
  if(role === 'user'){
    return '系统提示：' + getCurrentUserDisplayName() + '想约' + charName + '见面';
  }
  return '系统提示：' + charName + '想约您见面';
}

function appendOfflineInviteRejectNoticeText(){
  var charName = (character && (character.nickname || character.name)) || 'Char';
  return '系统提示：' + charName + '这次先不出门';
}

function appendOfflineInviteAcceptedNoticeText(payload){
  var charName = String((payload && payload.charName) || (character && (character.nickname || character.name)) || 'Char').trim() || 'Char';
  return '系统提示：' + charName + '答应见面了';
}

function notifyShellAboutOfflineInvite(text){
  var safeText = String(text || '').trim();
  if(!safeText) return;
  try{
    postToShell({
      type: 'CHAT_ACTIVITY_NOTIFY',
      payload: {
        kind: 'chat',
        charId: String((character && character.id) || '').trim(),
        name: String((character && (character.nickname || character.name)) || '角色').trim() || '角色',
        text: safeText
      }
    });
  }catch(err){}
}

async function appendOfflineInviteToChat(role, payload, doScroll, options){
  var safeOptions = options && typeof options === 'object' ? options : {};
  var noticeText = '';
  if(safeOptions.skipNotice !== true){
    noticeText = String(safeOptions.noticeText || appendOfflineInviteNoticeText(role)).trim();
  }
  if(noticeText){
    var notice = makeSystemNoticeEntry(noticeText);
    chatLog.push(notice);
    addSystemNotice(notice.content, doScroll !== false, notice.id);
  }
  var safePayload = coerceOfflineInvitePayloadToThread(payload || {}, role === 'user' ? 'user' : 'assistant');
  var finalPayload = buildOfflineInvitePayload(role === 'user' ? 'user' : 'assistant', safePayload || {});
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
  await syncOfflineInviteRecord(payload, {
    id: ensureOfflineInviteRecordId(payload),
    inviteMessageId: String(entry && entry.id || '').trim(),
    sourceRole: 'assistant',
    status: 'rejected',
    previewText: userName + '现在不想出门',
    reminderState: 'pending',
    arrivalState: 'pending',
    arrivedAt: 0
  });
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
  await syncOfflineInviteRecord(payload, {
    id: ensureOfflineInviteRecordId(payload),
    inviteMessageId: String(entry && entry.id || '').trim(),
    sourceRole: 'assistant',
    status: 'accepted',
    previewText: '',
    reminderState: 'pending',
    arrivalState: 'pending',
    arrivedAt: 0
  });
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
  var inviteLocation = String(safePayload.location || '').trim();
  var msgMin = Math.max(1, Number(character && character.msgMin) || 1);
  var msgMax = Math.max(msgMin, Number(character && character.msgMax) || 3);
  var systemPrompt = [
    '你是角色本人，要决定是否接受用户刚刚发来的见面请求。',
    '必须认真读取角色当前人设、世界书设定、最近聊天气氛、用户此刻的伤心或情绪状态，以及这次见面的地点和时间。',
    '一定要把地点和时间真正读进去，再决定接受还是拒绝，不能忽略地点，也不能把系统展示用的信息当成聊天正文。',
    '对你来说这就是一次正常的见面、出门、赴约沟通。不要提卡片、按钮、接受拒绝按钮或系统提示。',
    '如果 accept 为 true，不要再单独写一条邀约语。正常聊天内容都放进 followups。',
    '只返回 JSON：{"accept":true|false,"text":"...","followups":["..."],"mood":"...","weather":"...","location":"...","scheduledDate":"YYYY-MM-DD","scheduledTime":"HH:MM"}',
    '如果 accept 为 true，scheduledDate / scheduledTime / location 只是你这次见面安排的时间地点，不要把它们写进解释腔里。',
    '如果 accept 为 true，followups 里继续补 1 到 2 条正常聊天消息，像答应见面之后顺手又说了几句。每个数组元素就是单独一条消息，不要把几句塞进同一个字符串里。',
    '如果 accept 为 true，请顺手给出你真的能赴约的时间 scheduledDate / scheduledTime。这个时间必须现实、合理，不能比现在更早，也不要写凌晨四点这种不合常理的时间。',
    '如果 accept 为 false，text 要写成普通聊天里的自然解释，不要模板腔，不要写成通知文案。尽量短一点，别写成长句。',
    '如果 accept 为 false，请像真人聊天一样回复：可以先来一句当下反应，再补一句解释或安抚，语气要有停顿感和生活感。',
    '如果 accept 为 false，followups 里再补 0 到 2 条自然的后续消息，可以是解释、安抚、改约的意思，但要像聊天，不要像通知。每个数组元素就是单独一条消息。',
    'followups 里的总条数请严格参考当前聊天设置：最少 ' + msgMin + ' 条，最多 ' + msgMax + ' 条；每一条都应该是独立消息。',
    '不要为了分条而硬切，只有真的像聊天那样自然停顿时才分开。',
    '不要 markdown，不要额外解释。'
  ].join('\n');
  var userPrompt = [
    buildSystemPrompt(),
    '用户想约你的地点：' + (inviteLocation || '（未填写）'),
    '用户刚刚发来一条想约你见面的消息（只保留真实信息）：' + JSON.stringify(safePayload),
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

function getLatestUserOfflineInviteThread(options){
  var safeOptions = options && typeof options === 'object' ? options : {};
  var requirePending = safeOptions.requirePending === true;
  if(!Array.isArray(chatLog) || !chatLog.length) return null;
  for(var i = chatLog.length - 1; i >= 0; i--){
    var entry = chatLog[i];
    if(!entry) continue;
    if(String(entry.role || '') === 'system') continue;
    if(String(entry.role || '') === 'user'){
      if(normalizeMessageType(entry.type || 'text') !== 'offlineinvite') return null;
      var payload = parseOfflineInvitePayload(entry.content) || null;
      if(payload && (!requirePending || String(payload.status || 'pending') === 'pending')){
        return { index: i, entry: entry, payload: payload };
      }
      return null;
    }
  }
  return null;
}

function getLatestPendingUserOfflineInviteThread(){
  return getLatestUserOfflineInviteThread({ requirePending: true });
}

var pendingOfflineInviteReplyTimer = 0;

function clearPendingOfflineInviteReplyTimer(){
  if(!pendingOfflineInviteReplyTimer) return;
  try{ clearTimeout(pendingOfflineInviteReplyTimer); }catch(err){}
  pendingOfflineInviteReplyTimer = 0;
}

function schedulePendingOfflineInviteReply(delayMs){
  clearPendingOfflineInviteReplyTimer();
  var delay = Math.max(300, Number(delayMs || 1500) || 1500);
  pendingOfflineInviteReplyTimer = setTimeout(function(){
    pendingOfflineInviteReplyTimer = 0;
    if(isTyping){
      schedulePendingOfflineInviteReply(900);
      return;
    }
    Promise.resolve(handlePendingOfflineInviteReply()).catch(function(err){
      console.error('scheduled offline invite reply error:', err);
    });
  }, delay);
}

async function resetOfflineInviteThreadToPending(thread){
  var target = thread && thread.entry && thread.payload ? thread : getLatestUserOfflineInviteThread();
  if(!target) return false;
  clearPendingOfflineInviteReplyTimer();
  var payload = target.payload || {};
  var recordId = ensureOfflineInviteRecordId(payload);
  var record = null;
  try{
    var store = getOfflineInviteStoreApi();
    if(store && typeof store.getRecord === 'function') record = store.getRecord(recordId);
  }catch(err){}
  var scheduleEntryId = String((record && record.scheduleEntryId) || payload.scheduleEntryId || '').trim();
  var scheduleDate = String((record && record.scheduledDate) || '').trim();
  var scheduleCharId = String((record && record.charId) || payload.charId || '').trim();
  if(scheduleEntryId && scheduleDate && scheduleCharId){
    try{ await removeOfflineInviteScheduleEntry(scheduleCharId, scheduleDate, scheduleEntryId); }catch(err){}
  }
  payload.status = 'pending';
  payload.scheduleEntryId = '';
  payload.replyMessageId = '';
  if(payload.requestedDate && payload.requestedTime){
    payload.scheduledDate = String(payload.requestedDate || '').trim();
    payload.scheduledTime = String(payload.requestedTime || '').trim();
  }
  if(payload.requestedDateLabel || payload.requestedTimeLabel){
    payload.dateLabel = String(payload.requestedDateLabel || payload.dateLabel || '').trim();
    payload.timeLabel = String(payload.requestedTimeLabel || payload.timeLabel || '').trim();
  }
  target.entry.content = JSON.stringify(payload);
  await syncOfflineInviteRecord(payload, {
    id: recordId,
    sourceRole: 'user',
    status: 'pending',
    replyMessageId: '',
    scheduleEntryId: '',
    previewText: '',
    location: String(payload.location || '').trim(),
    scheduledDate: String(payload.scheduledDate || '').trim(),
    scheduledTime: String(payload.scheduledTime || '').trim(),
    dateLabel: String(payload.dateLabel || '').trim(),
    timeLabel: String(payload.timeLabel || '').trim(),
    reminderState: 'pending',
    snoozeUntil: 0,
    remindedAt: 0,
    openedAt: 0,
    arrivalState: 'pending',
    arrivedAt: 0
  });
  return true;
}

async function rerollPendingOfflineInviteReply(){
  var pending = getLatestUserOfflineInviteThread();
  if(!pending) return false;
  await resetOfflineInviteThreadToPending(pending);
  var removedAssistant = false;
  var removedSystem = false;
  for(var i = chatLog.length - 1; i > pending.index; i--){
    var entry = chatLog[i];
    if(!entry) continue;
    if(String(entry.role || '') === 'user') return false;
    if(String(entry.role || '') === 'assistant'){
      removedAssistant = true;
    }else if(String(entry.role || '') === 'system'){
      removedSystem = true;
    }
    chatLog.splice(i, 1);
  }
  if(!removedAssistant && !removedSystem) return false;
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
  clearPendingOfflineInviteReplyTimer();
  showTyping();
  try{
    var decision = await requestCharOfflineInviteDecision(pending.payload);
    hideTyping();
    if(decision && decision.accept){
      var schedule = deriveOfflineInviteAcceptedSchedule(pending.payload, decision);
      var acceptedFollowups = sanitizeOfflineInviteFollowupItems(decision && decision.followups, '', {
        limit: Math.max(1, Number(character && character.msgMax) || 3)
      });
      var acceptedPreviewText = acceptedFollowups.length ? String(acceptedFollowups[0].content || '').trim() : 'ACCEPTED';
      pending.payload.status = 'accepted';
      pending.entry.content = JSON.stringify(pending.payload);
      var charWeather = await resolveOfflineInviteWeather('char', decision.weather || randomPick(OFFLINE_WEATHERS, '☀︎'));
      var replyPayload = buildOfflineInvitePayload('assistant', {
        charId: String((character && character.id) || '').trim(),
        charName: String((character && (character.nickname || character.name)) || '').trim(),
        mood: decision.mood || randomPick(OFFLINE_MOODS, '(///v///)'),
        weather: charWeather.icon,
        location: decision.location || pending.payload.location,
        status: 'accepted',
        scheduledDate: schedule.scheduledDate,
        scheduledTime: schedule.scheduledTime,
        dateLabel: schedule.dateLabel,
        timeLabel: schedule.timeLabel,
        recordId: ensureOfflineInviteRecordId(pending.payload)
      });
      var replyEntry = await appendOfflineInviteToChat('assistant', replyPayload, true, {
        noticeText: appendOfflineInviteAcceptedNoticeText(replyPayload)
      });
      if(acceptedFollowups.length){
        await deliverAiReply(acceptedFollowups, Math.max(1, Number(character && character.msgMax) || 3));
      }
      replyPayload.replyMessageId = replyEntry && replyEntry.id ? String(replyEntry.id) : '';
      var scheduleEntryId = await syncAcceptedOfflineInviteToSchedule(pending.payload, replyPayload);
      if(scheduleEntryId){
        replyPayload.scheduleEntryId = scheduleEntryId;
        pending.payload.scheduleEntryId = scheduleEntryId;
        pending.entry.content = JSON.stringify(pending.payload);
      }
      if(replyEntry){
        replyEntry.content = JSON.stringify(Object.assign({}, replyPayload));
      }
      await syncOfflineInviteRecord(pending.payload, {
        id: ensureOfflineInviteRecordId(pending.payload),
        inviteMessageId: String(pending.entry && pending.entry.id || '').trim(),
        replyMessageId: String(replyEntry && replyEntry.id || '').trim(),
        scheduleEntryId: String(scheduleEntryId || '').trim(),
        charId: String(replyPayload.charId || pending.payload.charId || '').trim(),
        charName: String(replyPayload.charName || pending.payload.charName || '').trim(),
        location: String(replyPayload.location || pending.payload.location || '').trim(),
        scheduledDate: String(replyPayload.scheduledDate || '').trim(),
        scheduledTime: String(replyPayload.scheduledTime || '').trim(),
        dateLabel: String(replyPayload.dateLabel || '').trim(),
        timeLabel: String(replyPayload.timeLabel || '').trim(),
        sourceRole: 'assistant',
        status: 'accepted',
        previewText: acceptedPreviewText,
        reminderState: 'pending',
        arrivalState: 'pending',
        arrivedAt: 0,
        snoozeUntil: 0,
        remindedAt: 0,
        openedAt: 0
      });
      notifyShellAboutOfflineInvite(String(acceptedPreviewText || '我答应见面了').trim() || '我答应见面了');
      await saveChat(true);
      rerenderChat();
      return true;
    }
    pending.payload.status = 'rejected';
    pending.entry.content = JSON.stringify(pending.payload);
    var rejectNotice = makeSystemNoticeEntry(appendOfflineInviteRejectNoticeText());
    chatLog.push(rejectNotice);
    addSystemNotice(rejectNotice.content, true, rejectNotice.id);
    var rejectedFollowups = sanitizeOfflineInviteFollowupItems(decision && decision.followups, String((decision && decision.text) || '').trim(), {
      limit: Math.max(1, Number(character && character.msgMax) || 3)
    });
    await syncOfflineInviteRecord(pending.payload, {
      id: ensureOfflineInviteRecordId(pending.payload),
      inviteMessageId: String(pending.entry && pending.entry.id || '').trim(),
      status: 'rejected',
      sourceRole: 'user',
      previewText: rejectedFollowups.length ? String(rejectedFollowups[0].content || '').trim() : normalizeOfflineInviteDecisionText((decision && decision.text) || '', ''),
      remindedAt: 0,
      reminderState: 'pending',
      arrivalState: 'pending',
      arrivedAt: 0
    });
    if(rejectedFollowups.length){
      await deliverAiReply(rejectedFollowups, Math.max(1, character && character.msgMax ? character.msgMax : 3));
    }
    await saveChat(true);
    rerenderChat();
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
  var stamp = document.getElementById('offlineInviteStampImage');
  var location = String(locationField && locationField.value || '').trim();
  var dateValue = String(dateField && dateField.value || '').trim();
  var timeValue = String(dateField && dateField.dataset.time || '').trim();
  if(!location){
    if(typeof toast === 'function') toast('地点也要写上呀');
    return;
  }
  if(!dateValue || !timeValue){
    if(typeof toast === 'function') toast('把时间定下来再发吧');
    return;
  }
  closeOfflineInviteComposer();
  var userWeather = await resolveOfflineInviteWeather('user', '☀︎');
  var payload = buildOfflineInvitePayload('user', {
    charId: String((character && character.id) || '').trim(),
    charName: String((character && (character.nickname || character.name)) || '').trim(),
    weather: userWeather.icon,
    location: location,
    dateLabel: formatOfflineInviteDraftDateLabel(dateValue),
    timeLabel: formatOfflineInviteDraftTimeLabel(timeValue),
    signatureName: getCurrentUserDisplayName(),
    stampAsset: String(stamp && stamp.getAttribute('src') || '').trim() || randomPick(OFFLINE_INVITE_STAMP_ASSETS, 'assets/邮票1.jpg'),
    scheduledDate: dateValue,
    scheduledTime: timeValue
  });
  payload.requestedDate = dateValue;
  payload.requestedTime = timeValue;
  payload.requestedDateLabel = String(payload.dateLabel || '').trim();
  payload.requestedTimeLabel = String(payload.timeLabel || '').trim();
  ensureOfflineInviteRecordId(payload);
  payload.mood = '';
  var entry = await appendOfflineInviteToChat('user', payload, true);
  payload.inviteMessageId = entry && entry.id ? String(entry.id) : '';
  await syncOfflineInviteRecord(payload, {
    id: ensureOfflineInviteRecordId(payload),
    inviteMessageId: String(entry && entry.id || '').trim(),
    sourceRole: 'user',
    status: 'pending',
    reminderState: 'pending'
  });
  schedulePendingOfflineInviteReply(1500);
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
  var data = buildOfflineInvitePayload(viewRole === 'user' ? 'user' : 'assistant', coerceOfflineInvitePayloadToThread(parseOfflineInvitePayload(raw) || {}, viewRole === 'user' ? 'user' : 'assistant'));
  var canRespond = viewRole !== 'user';
  var status = String(data.status || 'pending');
  var statusLabel = status === 'accepted' ? 'Accepted' : (status === 'rejected' ? 'Rejected' : 'Pending');
  var disabled = status !== 'pending';
  var statusTone = status === 'accepted' ? ' is-accepted' : (status === 'rejected' ? ' is-rejected' : ' is-pending');
  var cleanDateLabel = stripOfflineInviteWeekdayLabel(data.dateLabel || '');
  var timeText = esc([cleanDateLabel, String(data.timeLabel || '').trim()].filter(Boolean).join(' · ') || '待定时间');
  var locationText = esc(String(data.location || '').trim() || '待定地点');
  if(viewRole === 'user'){
    bubble.innerHTML = '<div class="offline-invite-plain sent">'
      + '<div class="offline-invite-plain-head">'
      + '<div class="offline-invite-plain-title is-sent">MEET UP</div>'
      + '<div class="offline-invite-plain-status is-dot' + statusTone + '" title="' + escAttr(statusLabel) + '" aria-label="' + escAttr(statusLabel) + '"></div>'
      + '</div>'
      + '<div class="offline-invite-plain-meta">'
      + '<div class="offline-invite-plain-row is-plain">' + timeText + '</div>'
      + '<div class="offline-invite-plain-row is-plain">' + locationText + '</div>'
      + '</div>'
      + '<div class="offline-invite-plain-avatar"><span class="offline-invite-plain-avatar-fallback">' + esc((getCurrentUserDisplayName() || 'U').charAt(0) || 'U') + '</span><div class="offline-invite-plain-avatar-label">' + esc(getCurrentUserDisplayName() || 'USER') + '</div></div>'
      + '</div>';
    var avatar = bubble.querySelector('.offline-invite-plain-avatar');
    if(avatar){
      resolveChatUserAvatarAsync(character && character.id).then(function(src){
        var safe = String(src || '').trim();
        if(!safe) return;
        avatar.innerHTML = '<img src="' + escAttr(safe) + '" alt=""><div class="offline-invite-plain-avatar-label">' + esc(getCurrentUserDisplayName() || 'USER') + '</div>';
      }).catch(function(){});
    }
    return;
  }
  if(status === 'accepted'){
    bubble.innerHTML = '<div class="offline-invite-plain reply">'
      + '<div class="offline-invite-plain-head">'
      + '<div class="offline-invite-plain-title is-sent">ACCEPTED</div>'
      + '<div class="offline-invite-plain-status is-dot is-accepted" title="' + escAttr(statusLabel) + '" aria-label="' + escAttr(statusLabel) + '"></div>'
      + '</div>'
      + '<div class="offline-invite-plain-meta">'
      + '<div class="offline-invite-plain-row is-plain">' + timeText + '</div>'
      + '<div class="offline-invite-plain-row is-plain">' + locationText + '</div>'
      + '</div>'
      + '<div class="offline-invite-plain-avatar is-right"><span class="offline-invite-plain-avatar-fallback">' + esc(getOfflineInviteAvatarFallback('assistant')) + '</span><div class="offline-invite-plain-avatar-label">' + esc(getOfflineInviteDisplayName('assistant')) + '</div></div>'
      + '</div>';
    var assistantAvatar = bubble.querySelector('.offline-invite-plain-avatar');
    if(assistantAvatar){
      Promise.resolve(loadStoredAsset && character && character.id ? loadStoredAsset('char_avatar_' + character.id) : '')
        .then(function(src){
          var safe = String(src || (character && character.imageData) || '').trim();
          if(!safe) return;
          assistantAvatar.innerHTML = '<img src="' + escAttr(safe) + '" alt=""><div class="offline-invite-plain-avatar-label">' + esc(getOfflineInviteDisplayName('assistant')) + '</div>';
        }).catch(function(){});
    }
    return;
  }
  bubble.innerHTML = '<div class="offline-invite-plain">'
    + '<div class="offline-invite-plain-meta">'
    + '<div class="offline-invite-plain-row is-plain">' + timeText + '</div>'
    + '<div class="offline-invite-plain-row is-plain">' + locationText + '</div>'
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
