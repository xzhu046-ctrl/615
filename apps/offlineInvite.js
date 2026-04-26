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

function parseOfflineInviteTagPayload(raw){
  var text = String(raw || '').trim();
  if(!text) return null;
  var match = text.match(/\[\s*offline_invite\b([\s\S]*?)\]/i) || text.match(/\boffline_invite\b([\s\S]*)/i);
  if(!match) return null;
  var body = String(match[1] || '').trim();
  if(!body) return { type:'offline_invite' };
  var out = { type:'offline_invite' };
  body.replace(/([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|“([^”]*)”|‘([^’]*)’|([^\s\]]+))/g, function(_, key, v1, v2, v3, v4, v5){
    var safeKey = String(key || '').trim();
    if(!safeKey) return '';
    out[safeKey] = String(v1 != null ? v1 : (v2 != null ? v2 : (v3 != null ? v3 : (v4 != null ? v4 : (v5 || ''))))).trim();
    return '';
  });
  return out;
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
  var tagged = parseOfflineInviteTagPayload(raw);
  if(tagged){
    delete tagged.content;
    return tagged;
  }
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
  var normalizedSourceRole = sourceRole === 'user' ? 'user' : 'assistant';
  var labels = currentDateLabels(sourceRole === 'user' ? 'user' : 'char');
  var threadCharacter = getOfflineInviteThreadCharacter();
  var safeOverrides = coerceOfflineInvitePayloadToThread(overrides || {}, sourceRole);
  var snapshotSource = threadCharacter || (safeOverrides && safeOverrides.charSnapshot) || character || {};
  var data = Object.assign({
    type: 'offline_invite',
    sourceRole: normalizedSourceRole,
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
  data.sourceRole = normalizedSourceRole;
  data.charId = String(data.charId || (threadCharacter && threadCharacter.id) || '').trim();
  data.charName = String(data.charName || (threadCharacter && (threadCharacter.nickname || threadCharacter.name)) || '').trim();
  data.mood = String(data.mood || '').trim() || '(｡･ω･｡)';
  data.weather = normalizeOfflineWeatherIcon(data.weather);
  data.location = String(data.location || '').trim() || '老地方';
  data.timeLabel = String(data.timeLabel || labels.timeLabel);
  data.dateLabel = String(data.dateLabel || labels.dateLabel);
  data.status = String(data.status || 'pending');
  data.immediate = !!data.immediate || (data.sourceRole === 'assistant' && data.status === 'pending');
  if(data.immediate){
    data.scheduledDate = '';
    data.scheduledTime = '';
    data.dateLabel = '';
    data.timeLabel = '现在';
  }
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
  var src = userPayload && typeof userPayload === 'object' ? userPayload : {};
  var requestedDate = String(src.requestedDate || src.scheduledDate || '').trim();
  var requestedTime = String(src.requestedTime || src.scheduledTime || '').trim();
  var isImmediate = !!src.immediate || (!requestedDate && !requestedTime && String(src.timeLabel || '').trim() === '现在');
  if(isImmediate){
    return {
      scheduledDate: '',
      scheduledTime: '',
      dateLabel: '',
      timeLabel: '现在'
    };
  }
  var finalDate = isOfflineInviteValidDateKey(requestedDate) ? requestedDate : '';
  var finalTime = isOfflineInviteValidTimeValue(requestedTime) ? requestedTime : '';
  return {
    scheduledDate: finalDate,
    scheduledTime: finalTime,
    dateLabel: String(src.requestedDateLabel || src.dateLabel || '').trim() || (finalDate ? formatOfflineInviteDraftDateLabel(finalDate) : ''),
    timeLabel: String(src.requestedTimeLabel || src.timeLabel || '').trim() || (finalTime ? formatOfflineInviteDraftTimeLabel(finalTime) : '待定')
  };
}

function buildOfflineInviteAcceptedTimingPrompt(schedule){
  var safeSchedule = schedule && typeof schedule === 'object' ? schedule : {};
  var safeDate = String(safeSchedule.scheduledDate || '').trim();
  var safeTime = String(safeSchedule.scheduledTime || '').trim();
  var lines = [];
  if(isOfflineInviteValidDateKey(safeDate) && isOfflineInviteValidTimeValue(safeTime)){
    lines.push('最终定下来的赴约时间：' + safeDate + ' ' + safeTime);
    var localNow = getOfflineInviteLocalClockNow();
    var todayKey = String(localNow.dateKey || '').trim();
    var nowMinutes = offlineInviteTimeToMinutes(localNow.nowTime);
    var meetMinutes = offlineInviteTimeToMinutes(safeTime);
    if(todayKey && isOfflineInviteValidDateKey(todayKey) && nowMinutes >= 0 && meetMinutes >= 0){
      if(compareOfflineInviteDateKeys(safeDate, todayKey) > 0){
        lines.push('这次见面不是现在，是之后的安排。不要写成你已经到了、已经在楼下、已经在门口、马上敲门。');
      }else if(compareOfflineInviteDateKeys(safeDate, todayKey) === 0){
        var delta = meetMinutes - nowMinutes;
        if(delta > 90){
          lines.push('这次见面离现在还早。只能像正常约好时间那样继续聊，不要写成你已经出现在用户门口、楼下或已经到了。');
        }else if(delta > 30){
          lines.push('这次见面还要一阵子。可以说晚点见、到时候见、你先忙，但不要写成你已经到了用户门口或已经在楼下。');
        }else if(delta > 10){
          lines.push('这次见面已经比较近了，可以自然说准备出门、等会儿见，但仍然不要直接写成自己已经在用户门口，除非真的已经到点。');
        }else{
          lines.push('这次见面已经很近了，可以自然一点，但也要和时间对上，别一边说两小时后见一边下一句就说自己在门口。');
        }
      }
    }
  }
  return lines.join('\n').trim();
}

async function requestCharOfflineInviteAcceptedFollowups(userPayload, acceptedPayload){
  var safeUserPayload = sanitizeOfflineInvitePayloadForModel(userPayload);
  var safeAcceptedPayload = sanitizeOfflineInvitePayloadForModel(acceptedPayload);
  var msgMax = Math.max(1, Math.min(2, Number(character && character.msgMax) || 2));
  var systemPrompt = [
    '你是角色本人。',
    '你已经答应了这次见面，接受状态和时间地点会由单独的小卡片展示。',
    '现在你只需要补 1 到 ' + msgMax + ' 条普通聊天消息，像真人答应见面后顺手又说了几句。',
    '这些消息必须和最终定下来的赴约时间完全一致。',
    '如果见面是更晚一点、几个小时后或改天，就不要写成你已经到了、已经在楼下、已经在门口、马上敲门、现在就在 user 家门口。',
    '只有时间真的非常近，才可以自然提准备过去、快见到了；就算这样也别突兀。',
    '不要复述卡片，不要再机械重报时间地点，不要提卡片、按钮或系统提示。',
    '只返回 JSON 数组，每项格式：{"type":"text","content":"..."}。'
  ].join('\n');
  var userPrompt = [
    buildSystemPrompt(),
    buildOfflineInviteAcceptedTimingPrompt(safeAcceptedPayload),
    '用户这次约你的地点：' + (String(safeUserPayload.location || '').trim() || '（未填写）'),
    '最终定下来的赴约安排：' + JSON.stringify(safeAcceptedPayload),
    '最近聊天：\n' + formatChatForModel(chatLog.slice(-12))
  ].filter(Boolean).join('\n\n');
  var raw = await callAIWithCustomPrompts(systemPrompt, userPrompt);
  var clean = String(raw || '').replace(/^```[a-zA-Z]*\s*/,'').replace(/```$/,'').trim();
  if(!clean) return [];
  try{
    var parsed = JSON.parse(clean);
    if(Array.isArray(parsed)) return parsed;
    if(parsed && Array.isArray(parsed.replies)) return parsed.replies;
    if(parsed && typeof parsed === 'object' && parsed.type === 'text') return [parsed];
    if(typeof parsed === 'string') return [{ type:'text', content: parsed }];
  }catch(err){}
  return [{ type:'text', content: clean }];
}

async function requestCharOfflineInviteScheduleNote(userPayload, acceptedPayload){
  var safeUserPayload = sanitizeOfflineInvitePayloadForModel(userPayload);
  var safeAcceptedPayload = sanitizeOfflineInvitePayloadForModel(acceptedPayload);
  var systemPrompt = [
    '你是角色本人。',
    '现在你要给自己日程里的这次见面写一句到两句备注。',
    '这不是发给用户的聊天，也不是系统文案，而是你自己记在日程里的小 note。',
    '语气要像这个角色真的会写下来的东西，可以带一点情绪、期待、提醒或当下心思，但要自然。',
    '一定要和已经定下来的时间地点对齐。',
    '不要提卡片、按钮、邀请、accept 之类系统词。',
    '只返回纯文本，不要 markdown，不要引号。'
  ].join('\n');
  var userPrompt = [
    buildSystemPrompt(),
    '用户：' + (getCurrentUserDisplayName() || '用户'),
    '这次见面的地点：' + (String(safeAcceptedPayload.location || safeUserPayload.location || '').trim() || '（未填写）'),
    '这次见面的时间：' + [
      String(safeAcceptedPayload.scheduledDate || '').trim(),
      String(safeAcceptedPayload.scheduledTime || '').trim()
    ].filter(Boolean).join(' '),
    '写 note 时参考这次已经定下来的安排：' + JSON.stringify(safeAcceptedPayload),
    '最近聊天：\n' + formatChatForModel(chatLog.slice(-12))
  ].join('\n\n');
  var raw = await callAIWithCustomPrompts(systemPrompt, userPrompt);
  var clean = String(raw || '').replace(/^```[a-zA-Z]*\s*/,'').replace(/```$/,'').trim();
  return clean.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
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
    meetState: String(payload.meetState || '').trim(),
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
  var safeDateLabel = String((acceptedPayload && acceptedPayload.dateLabel) || (payload && payload.dateLabel) || '').trim();
  var safeTimeLabel = String((acceptedPayload && acceptedPayload.timeLabel) || (payload && payload.timeLabel) || '').trim();
  var safeLocation = String((acceptedPayload && acceptedPayload.location) || (payload && payload.location) || '').trim();
  var scheduleNote = String((acceptedPayload && acceptedPayload.scheduleNote) || (payload && payload.scheduleNote) || '').trim();
  if(!scheduleNote){
    scheduleNote = [
      safeDateLabel,
      safeTimeLabel,
      safeLocation ? ('在' + safeLocation) : ''
    ].filter(Boolean).join(' · ') || ('和' + userName + '见面');
  }
  day.timeline = Array.isArray(day.timeline) ? day.timeline.slice() : [];
  day.timeline = day.timeline.filter(function(item){
    return String(item && item.id || '') !== scheduleEntryId;
  });
  day.timeline.push({
    id: scheduleEntryId,
    start: String(acceptedPayload && acceptedPayload.scheduledTime || '').trim(),
    end: '',
    title: '和' + userName + '赴约',
    note: scheduleNote,
    location: safeLocation,
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
    if(String(payload.status || '').trim() === 'accepted'){
      payload.sourceRole = String(payload.sourceRole || 'assistant').trim() || 'assistant';
      payload.previewText = String(payload.previewText || payload.location || '赴约已定下').trim();
      try{
        await syncOfflineInviteRecord(payload, {
          id: ensureOfflineInviteRecordId(payload),
          charId: String(payload.charId || '').trim(),
          charName: String(payload.charName || '').trim(),
          location: String(payload.location || '').trim(),
          scheduledDate: String(payload.scheduledDate || '').trim(),
          scheduledTime: String(payload.scheduledTime || '').trim(),
          dateLabel: String(payload.dateLabel || '').trim(),
          timeLabel: String(payload.timeLabel || '').trim(),
          sourceRole: String(payload.sourceRole || 'assistant').trim() || 'assistant',
          status: 'accepted',
          meetState: 'scheduled',
          previewText: String(payload.previewText || payload.location || '赴约已定下').trim(),
          inviteMessageId: String(payload.inviteMessageId || '').trim(),
          openedAt: Date.now()
        });
      }catch(err){}
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

function isOfflineInviteImmediateMode(){
  var dateField = document.getElementById('offlineInviteDateField');
  if(dateField && dateField.dataset){
    return String(dateField.dataset.immediate || '') === '1';
  }
  var toggle = document.getElementById('offlineInviteImmediateToggle');
  return !!(toggle && toggle.checked);
}

function setOfflineInviteImmediateMode(enabled){
  var next = !!enabled;
  var dateField = document.getElementById('offlineInviteDateField');
  var toggle = document.getElementById('offlineInviteImmediateToggle');
  if(dateField && dateField.dataset){
    dateField.dataset.immediate = next ? '1' : '0';
  }
  if(toggle) toggle.checked = next;
  if(next) closeOfflineInviteDatePicker();
  syncOfflineInviteComposerVisuals();
}

function toggleOfflineInviteImmediateMode(evt){
  if(evt && evt.stopPropagation) evt.stopPropagation();
  setOfflineInviteImmediateMode(!isOfflineInviteImmediateMode());
}

function syncOfflineInviteComposerVisuals(){
  var locationField = document.getElementById('offlineInviteLocationField');
  var dateField = document.getElementById('offlineInviteDateField');
  var dateDisplay = document.getElementById('offlineInviteDateDisplay');
  var hourWheel = document.getElementById('offlineInviteHourWheel');
  var minuteWheel = document.getElementById('offlineInviteMinuteWheel');
  var timeField = document.getElementById('offlineInviteTimeField');
  var dateFieldWrap = document.getElementById('offlineInviteDateFieldWrap');
  var immediateToggle = document.getElementById('offlineInviteImmediateToggle');
  var immediate = isOfflineInviteImmediateMode();
  var timeValue = String(dateField && dateField.dataset.time || '').trim();
  var parts = timeValue ? timeValue.split(':') : [];
  var hourValue = String(parts[0] || '19').padStart(2, '0');
  var minuteValue = String(parts[1] || '30').padStart(2, '0');
  if(dateDisplay){
    dateDisplay.textContent = immediate ? '现在' : formatOfflineInviteComposerDate(dateField && dateField.value || '');
    dateDisplay.disabled = immediate;
  }
  if(immediateToggle) immediateToggle.checked = immediate;
  if(timeField) timeField.classList.toggle('is-disabled', immediate);
  if(dateFieldWrap) dateFieldWrap.classList.toggle('is-disabled', immediate);
  syncOfflineInviteInlineWidth(locationField, 9);
  syncOfflineInviteInlineWidth(dateDisplay, 11);
  if(hourWheel && minuteWheel) renderOfflineInviteTimeWheels(hourValue, minuteValue);
  if(immediate){
    closeOfflineInviteDatePicker();
  }else{
    renderOfflineInviteDatePicker();
  }
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
  if(isOfflineInviteImmediateMode()) return;
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
  if(isOfflineInviteImmediateMode()) return;
  var dateField = document.getElementById('offlineInviteDateField');
  if(!dateField) return;
  dateField.value = String(value || '').trim();
  setOfflineInviteDatePageStart(String(value || '').trim());
  syncOfflineInviteComposerVisuals();
}

function selectOfflineInviteTimePart(type, value){
  if(isOfflineInviteImmediateMode()) return;
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

var pendingOfflineInviteDecisionAction = '';
var pendingOfflineInviteDecisionMessageId = '';

function closeOfflineInviteDecisionPrompt(){
  pendingOfflineInviteDecisionAction = '';
  pendingOfflineInviteDecisionMessageId = '';
  var overlay = document.getElementById('offlineInviteDecisionOverlay');
  if(overlay) overlay.classList.remove('open');
}

function openOfflineInviteDecisionPrompt(msgId, preferredAction){
  var safeMsgId = String(msgId || '').trim();
  if(!safeMsgId) return;
  var entry = getMessageById(safeMsgId);
  var payload = parseOfflineInvitePayload(entry && entry.content) || null;
  if(!entry || !payload) return;
  if(String(payload.status || 'pending') !== 'pending') return;
  pendingOfflineInviteDecisionMessageId = safeMsgId;
  pendingOfflineInviteDecisionAction = String(preferredAction || '').trim() === 'reject' ? 'reject' : 'accept';
  var overlay = document.getElementById('offlineInviteDecisionOverlay');
  var copy = document.getElementById('offlineInviteDecisionText');
  if(copy){
    var bits = [];
    var dateText = stripOfflineInviteWeekdayLabel(payload.dateLabel || '');
    var timeText = String(payload.timeLabel || '').trim();
    var placeText = String(payload.location || '').trim();
    if(dateText || timeText) bits.push([dateText, timeText].filter(Boolean).join(' · '));
    if(placeText) bits.push(placeText);
    copy.textContent = bits.length ? bits.join('\n') : '这次见面你要怎么回？';
  }
  if(overlay) overlay.classList.add('open');
}

function confirmOfflineInviteDecision(accepted){
  var msgId = String(pendingOfflineInviteDecisionMessageId || '').trim();
  var chosen = typeof accepted === 'boolean'
    ? (accepted ? 'accept' : 'reject')
    : (pendingOfflineInviteDecisionAction === 'reject' ? 'reject' : 'accept');
  closeOfflineInviteDecisionPrompt();
  if(!msgId) return;
  runOfflineInviteAction(chosen, msgId);
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
  if(dateField) dateField.dataset.immediate = '0';
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
  return '系统提示：' + charName + '想约你见面';
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
  var safeRole = role === 'user' ? 'user' : 'assistant';
  if(safeOptions.skipNotice !== true){
    noticeText = String(safeOptions.noticeText || appendOfflineInviteNoticeText(safeRole)).trim();
  }
  if(noticeText){
    var notice = makeSystemNoticeEntry(noticeText);
    chatLog.push(notice);
    addSystemNotice(notice.content, doScroll !== false, notice.id);
  }
  var safePayload = coerceOfflineInvitePayloadToThread(payload || {}, safeRole);
  var finalPayload = buildOfflineInvitePayload(safeRole, safePayload || {});
  var entry = makeChatEntry(safeRole === 'user' ? 'user' : 'assistant', JSON.stringify(finalPayload), 'offline_invite');
  chatLog.push(entry);
  addMessage(safeRole === 'user' ? 'user' : 'ai', entry.content, doScroll !== false, 'offline_invite', entry.id);
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
    meetState: '',
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
  payload.sourceRole = 'assistant';
  payload.inviteMessageId = String(entry && entry.id || '').trim();
  payload.previewText = String(payload.previewText || payload.location || '赴约已定下').trim();
  entry.content = JSON.stringify(payload);
  rerenderChat();
  await syncOfflineInviteRecord(payload, {
    id: ensureOfflineInviteRecordId(payload),
    inviteMessageId: String(entry && entry.id || '').trim(),
    charId: String(payload.charId || '').trim(),
    charName: String(payload.charName || '').trim(),
    location: String(payload.location || '').trim(),
    scheduledDate: String(payload.scheduledDate || '').trim(),
    scheduledTime: String(payload.scheduledTime || '').trim(),
    dateLabel: String(payload.dateLabel || '').trim(),
    timeLabel: String(payload.timeLabel || '').trim(),
    sourceRole: 'assistant',
    status: 'accepted',
    meetState: 'scheduled',
    previewText: String(payload.previewText || payload.location || '赴约已定下').trim(),
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

function openAcceptedOfflineInvitePayload(rawPayload, msgId){
  var source = rawPayload && typeof rawPayload === 'object' ? Object.assign({}, rawPayload) : {};
  source.status = 'accepted';
  source.sourceRole = 'assistant';
  source.inviteMessageId = String(source.inviteMessageId || msgId || '').trim();
  source.replyMessageId = String(source.replyMessageId || msgId || '').trim();
  if(!String(source.previewText || '').trim()){
    source.previewText = String(source.location || '赴约已定下').trim();
  }
  Promise.resolve()
    .then(function(){ return openOfflineSession(source); })
    .catch(function(err){
      console.error('open accepted offline invite failed:', err);
      if(typeof toast === 'function'){
        toast('线下邀约启动失败：' + String(err && (err.message || err) || '未知错误'));
      }
    });
}

function launchAcceptedOfflineInviteFromCard(rawPayload, msgId){
  var source = rawPayload && typeof rawPayload === 'object' ? Object.assign({}, rawPayload) : {};
  var safeMsgId = String(msgId || '').trim();
  if(safeMsgId){
    try{
      var entry = getMessageById(safeMsgId);
      var savedPayload = parseOfflineInvitePayload(entry && entry.content) || null;
      if(entry && savedPayload){
        source = Object.assign({}, savedPayload, source, {
          status: 'accepted',
          sourceRole: 'assistant',
          inviteMessageId: String(savedPayload.inviteMessageId || entry.id || safeMsgId).trim(),
          replyMessageId: String(savedPayload.replyMessageId || entry.id || safeMsgId).trim()
        });
        entry.content = JSON.stringify(source);
        if(typeof saveChat === 'function'){
          Promise.resolve(saveChat(true)).catch(function(err){
            console.error('save accepted offline invite before launch failed:', err);
          });
        }
      }
    }catch(err){
      console.warn('accepted offline invite card launch save skipped:', err);
    }
  }
  openAcceptedOfflineInvitePayload(source, safeMsgId);
}

async function requestCharOfflineInviteDecision(userPayload){
  var safePayload = sanitizeOfflineInvitePayloadForModel(userPayload);
  var inviteLocation = String(safePayload.location || '').trim();
  var systemPrompt = [
    '你是角色本人，只负责判断是否接受用户刚刚发来的见面请求。',
    '必须认真读取角色当前人设、世界书设定、最近聊天气氛、用户此刻的伤心或情绪状态，以及这次见面的地点和时间。',
    '决定必须贴住最近聊天的因果：上一秒如果正在急着见面、撒娇、吵架后求和、担心对方、已经说要过去，就不要突然冷冰冰改成很久以后的安排。',
    '上一秒如果关系紧张、角色明显不方便、跨城/时间/天气不合理，才可以拒绝或缓一缓；不要为了有动作而硬答应。',
    '把“地点”当成用户真实想见面的方式来理解：卧室、楼下、公园、公司、学校、车站等都要结合关系和当下语境判断，不能只当表格字段。',
    '一定要把地点和时间真正读进去，再决定接受还是拒绝，不能忽略地点，也不能把系统展示用的信息当成聊天正文。',
    '对你来说这就是一次正常的见面、出门、赴约沟通。不要提卡片、按钮、接受拒绝按钮或系统提示。',
    '不要生成聊天正文，不要生成 followups，不要写台词；真正聊天回复会走普通聊天链。',
    '用户如果选了“现在”，就把这次理解成现在/马上/当下，不要改成早上十点、明天或几小时后。',
    '用户如果已经给了 scheduledDate / scheduledTime，你不能另约随机时间，只按用户给出的时间理解。',
    '只返回 JSON：{"accept":true|false,"mood":"...","weather":"...","scheduleNote":"..."}',
    'scheduleNote 是角色自己写进日程里的 1 到 2 句小备注。accept=false 时可以留空。',
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

function buildOfflineInviteNormalReplyCue(accepted, userPayload, acceptedPayload){
  var userInfo = sanitizeOfflineInvitePayloadForModel(userPayload || {});
  var acceptedInfo = sanitizeOfflineInvitePayloadForModel(acceptedPayload || {});
  var timingBits = [];
  var locationText = String((acceptedPayload && acceptedPayload.location) || (userPayload && userPayload.location) || '').trim();
  var immediate = !!(userPayload && userPayload.immediate) || String((acceptedPayload && acceptedPayload.timeLabel) || (userPayload && userPayload.timeLabel) || '').trim() === '现在';
  if(immediate) timingBits.push('用户约的是现在/马上/当下');
  var dateText = String((acceptedPayload && acceptedPayload.scheduledDate) || (userPayload && userPayload.scheduledDate) || '').trim();
  var timeText = String((acceptedPayload && acceptedPayload.scheduledTime) || (userPayload && userPayload.scheduledTime) || '').trim();
  if(dateText || timeText) timingBits.push('用户定的时间：' + [dateText, timeText].filter(Boolean).join(' '));
  if(locationText) timingBits.push('地点：' + locationText);
  if(accepted){
    if(dateText || timeText){
      timingBits.push('不要把时间改成别的，也不要突然说自己已经到门口，除非上下文真的已经到点');
    }else if(immediate){
      timingBits.push('不要另约早上十点/明天/几小时后，顺着“现在见面”的语境说');
    }
  }
  return [
    accepted
      ? '系统事件：用户刚刚约你线下见面，你已经决定答应。小卡片状态已经单独展示好了。'
      : '系统事件：用户刚刚约你线下见面，你已经决定这次先不去/不方便答应。卡片状态已经单独处理好了。',
    '现在请像普通聊天一样回复用户刚才这个邀约，语气、人设、短句节奏、分条方式都完全沿用平时聊天。',
    '先接住上一轮聊天里的真实情绪和关系推进，再顺着说见面这件事；不要像突然插进来的审批回复。',
    '不要写成系统通知，不要解释“我接受/拒绝了邀请卡片”，不要提卡片、按钮、系统、offline_invite，也不要再发 offline_invite。',
    '不要为了总结而机械复述时间地点；只在自然需要时顺口提。',
    timingBits.join('；'),
    '用户邀约原始信息：' + JSON.stringify(userInfo),
    accepted ? ('已定下来的卡片信息：' + JSON.stringify(acceptedInfo)) : ''
  ].filter(Boolean).join('\n');
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
    meetState: '',
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
  var handled = await handlePendingOfflineInviteReply();
  if(!handled){
    await requestAndDeliverAiReply(provider, key);
  }
  return true;
}

async function handlePendingOfflineInviteReply(){
  var pending = getPendingUserOfflineInviteEntry();
  if(!pending) return false;
  var genBtn = document.getElementById('genBtn');
  var sendBtn = document.getElementById('sendBtn');
  if(genBtn) genBtn.disabled = true;
  if(sendBtn) sendBtn.disabled = true;
  clearPendingOfflineInviteReplyTimer();
  try{
    var decision = await requestCharOfflineInviteDecision(pending.payload);
    if(decision && decision.accept){
      var schedule = deriveOfflineInviteAcceptedSchedule(pending.payload, decision);
      var charWeather = await resolveOfflineInviteWeather('char', decision.weather || randomPick(OFFLINE_WEATHERS, '☀︎'));
      var replyPayload = buildOfflineInvitePayload('assistant', {
        charId: String((character && character.id) || '').trim(),
        charName: String((character && (character.nickname || character.name)) || '').trim(),
        mood: decision.mood || randomPick(OFFLINE_MOODS, '(///v///)'),
        weather: charWeather.icon,
        location: pending.payload.location,
        status: 'pending',
        displayStatus: 'accepted',
        acceptedByChar: true,
        scheduledDate: schedule.scheduledDate,
        scheduledTime: schedule.scheduledTime,
        dateLabel: schedule.dateLabel,
        timeLabel: schedule.timeLabel,
        immediate: !!pending.payload.immediate && !schedule.scheduledDate && !schedule.scheduledTime,
        scheduleNote: String(decision.scheduleNote || '').trim(),
        recordId: ensureOfflineInviteRecordId(pending.payload)
      });
      pending.payload.status = 'accepted';
      pending.entry.content = JSON.stringify(pending.payload);
      var replyEntry = await appendOfflineInviteToChat('assistant', replyPayload, true, {
        noticeText: appendOfflineInviteAcceptedNoticeText(replyPayload)
      });
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
        meetState: 'scheduled',
        previewText: 'ACCEPTED',
        reminderState: 'pending',
        arrivalState: 'pending',
        arrivedAt: 0,
        snoozeUntil: 0,
        remindedAt: 0,
        openedAt: 0
      });
      await saveChat(true);
      rerenderChat();
      pendingModelUserCue = [pendingModelUserCue, buildOfflineInviteNormalReplyCue(true, pending.payload, replyPayload)].filter(Boolean).join('\n');
      notifyShellAboutOfflineInvite('我答应见面了');
      return false;
    }
    pending.payload.status = 'rejected';
    pending.entry.content = JSON.stringify(pending.payload);
    var rejectNotice = makeSystemNoticeEntry(appendOfflineInviteRejectNoticeText());
    chatLog.push(rejectNotice);
    addSystemNotice(rejectNotice.content, true, rejectNotice.id);
    await syncOfflineInviteRecord(pending.payload, {
      id: ensureOfflineInviteRecordId(pending.payload),
      inviteMessageId: String(pending.entry && pending.entry.id || '').trim(),
      status: 'rejected',
      meetState: '',
      sourceRole: 'user',
      previewText: 'REJECTED',
      remindedAt: 0,
      reminderState: 'pending',
      arrivalState: 'pending',
      arrivedAt: 0
    });
    await saveChat(true);
    rerenderChat();
    pendingModelUserCue = [pendingModelUserCue, buildOfflineInviteNormalReplyCue(false, pending.payload, null)].filter(Boolean).join('\n');
    return false;
  }catch(err){
    showError('邀约回复失败: ' + humanizeAiError(err));
    console.error('offline invite reply error:', err);
    return true;
  } finally {
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
  var immediate = isOfflineInviteImmediateMode();
  if(!location){
    if(typeof toast === 'function') toast('地点也要写上呀');
    return;
  }
  if(!immediate && (!dateValue || !timeValue)){
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
    dateLabel: immediate ? '' : formatOfflineInviteDraftDateLabel(dateValue),
    timeLabel: immediate ? '现在' : formatOfflineInviteDraftTimeLabel(timeValue),
    signatureName: getCurrentUserDisplayName(),
    stampAsset: String(stamp && stamp.getAttribute('src') || '').trim() || randomPick(OFFLINE_INVITE_STAMP_ASSETS, 'assets/邮票1.jpg'),
    scheduledDate: immediate ? '' : dateValue,
    scheduledTime: immediate ? '' : timeValue,
    immediate: immediate
  });
  payload.requestedDate = immediate ? '' : dateValue;
  payload.requestedTime = immediate ? '' : timeValue;
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
    meetState: '',
    reminderState: 'pending'
  });
  clearPendingOfflineInviteReplyTimer();
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
  var displayAccepted = String(data.displayStatus || '').trim() === 'accepted' || data.acceptedByChar === true;
  var statusLabel = (status === 'accepted' || displayAccepted) ? 'Accepted' : (status === 'rejected' ? 'Rejected' : 'Pending');
  var disabled = status !== 'pending';
  var statusTone = (status === 'accepted' || displayAccepted) ? ' is-accepted' : (status === 'rejected' ? ' is-rejected' : ' is-pending');
  var cleanDateLabel = stripOfflineInviteWeekdayLabel(data.dateLabel || '');
  var timeText = data.immediate
    ? '现在'
    : esc([cleanDateLabel, String(data.timeLabel || '').trim()].filter(Boolean).join(' · ') || '待定时间');
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
      + '<div class="offline-invite-plain-actions">'
      + '<button class="offline-invite-plain-btn" type="button" data-offline-action="reject">Pass</button>'
      + '<button class="offline-invite-plain-btn primary" type="button" data-offline-action="accept">Go</button>'
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
    bubble.addEventListener('click', function(evt){
      var actionBtn = evt.target && evt.target.closest ? evt.target.closest('[data-offline-action]') : null;
      if(!actionBtn) return;
      evt.stopPropagation();
      evt.preventDefault();
      if(actionBtn.getAttribute('data-offline-action') === 'accept'){
        if(msgId){
          runOfflineInviteAction('accept', msgId);
          return;
        }
        launchAcceptedOfflineInviteFromCard(data, msgId);
        return;
      }
      if(msgId) runOfflineInviteAction(actionBtn.getAttribute('data-offline-action'), msgId);
    });
    return;
  }
  bubble.innerHTML = '<div class="offline-invite-plain' + (displayAccepted ? ' reply' : '') + '">'
    + (displayAccepted ? '<div class="offline-invite-plain-head">'
      + '<div class="offline-invite-plain-title is-sent">ACCEPTED</div>'
      + '<div class="offline-invite-plain-status is-dot is-accepted" title="' + escAttr(statusLabel) + '" aria-label="' + escAttr(statusLabel) + '"></div>'
      + '</div>' : '')
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
    if(actionBtn){
      if(!msgId || actionBtn.disabled) return;
      evt.stopPropagation();
      evt.preventDefault();
      runOfflineInviteAction(actionBtn.getAttribute('data-offline-action'), msgId);
      return;
    }
    if(!msgId || disabled) return;
    evt.stopPropagation();
    evt.preventDefault();
    runOfflineInviteAction('accept', msgId);
  });
}
