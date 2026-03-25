var OFFLINE_INVITE_SNIPPET = '【约会邀请】';
var OFFLINE_WEATHERS = ['☀︎','☁︎','⛅︎','☂︎','☃︎'];
var OFFLINE_MOODS = ['(///v///)','(,,> <,,)','(๑´ㅂ`๑)','(｡･ω･｡)','(っ˘ڡ˘ς)','( ´ ▽ ` )'];

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

function buildOfflineInvitePayload(sourceRole, text, overrides){
  var labels = currentDateLabels(sourceRole === 'user' ? 'user' : 'char');
  var data = Object.assign({
    type: 'offline_invite',
    sourceRole: sourceRole === 'user' ? 'user' : 'assistant',
    content: String(text || '').trim() || (sourceRole === 'user' ? '要不要出来见我？' : '宝宝，我来找你了。'),
    mood: randomPick(OFFLINE_MOODS, '(｡･ω･｡)'),
    weather: randomPick(OFFLINE_WEATHERS, '☀︎'),
    location: ((character && (character.nickname || character.name)) || '对方') + '想和你见面的地方',
    aside: sourceRole === 'user' ? '快答应我' : '好想见你',
    timeLabel: labels.timeLabel,
    dateLabel: labels.dateLabel,
    createdAt: Date.now(),
    status: 'pending'
  }, overrides || {});
  data.type = 'offline_invite';
  data.sourceRole = data.sourceRole === 'user' ? 'user' : 'assistant';
  data.content = String(data.content || '').trim() || '想见你。';
  data.mood = String(data.mood || '').trim() || '(｡･ω･｡)';
  data.weather = normalizeOfflineWeatherIcon(data.weather);
  data.location = String(data.location || '').trim() || '老地方';
  data.aside = String(data.aside || '').trim() || '快答应我';
  data.timeLabel = String(data.timeLabel || labels.timeLabel);
  data.dateLabel = String(data.dateLabel || labels.dateLabel);
  data.status = String(data.status || 'pending');
  return data;
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

function persistOfflineSession(session){
  if(!character || !character.id) return;
  try{
    localStorage.setItem(offlineSessionStorageKey(character.id), JSON.stringify(session || {}));
  }catch(e){}
  try{
    localStorage.setItem('offline_meet_session_' + String(character.id || '').trim(), JSON.stringify(session || {}));
  }catch(e){}
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

async function openOfflineSession(payload){
  if(!character || !character.id) return;
  var history = formatChatForModel(chatLog.slice(-10));
  persistOfflineSession({
    active: true,
    invite: payload,
    entries: [],
    pendingAnimation: true,
    pendingOpening: true,
    chatHistory: history,
    updatedAt: Date.now()
  });
  postToShell({ type:'OPEN_APP_WITH', payload:{ app:'offline', charId: String(character.id || '') } });
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

function ensureOfflineInviteModal(){
  var existing = document.getElementById('offlineInviteModal');
  if(existing) return existing;
  var host = document.createElement('div');
  host.id = 'offlineInviteModal';
  host.className = 'offline-invite-modal';
  host.innerHTML = ''
    + '<div class="offline-invite-modal-backdrop" data-offline-modal-close="1"></div>'
    + '<div class="offline-invite-modal-card">'
    + '<div class="offline-invite-modal-papers">'
    + '<div class="offline-invite-modal-paper back"></div>'
    + '<div class="offline-invite-modal-paper front"></div>'
    + '</div>'
    + '<div class="offline-invite-modal-letter"></div>'
    + '</div>';
  host.addEventListener('click', function(evt){
    var closeBtn = evt.target && evt.target.closest ? evt.target.closest('[data-offline-modal-close]') : null;
    if(closeBtn) closeOfflineInviteModal();
  });
  document.body.appendChild(host);
  return host;
}

function closeOfflineInviteModal(){
  var modal = document.getElementById('offlineInviteModal');
  if(!modal) return;
  modal.classList.remove('open');
  modal.removeAttribute('data-msg-id');
}

function showOfflineInviteAsidePopup(letter, text, evt){
  if(!letter || !text) return;
  var pop = letter.querySelector('.offline-invite-modal-aside-pop');
  if(!pop) return;
  var rect = letter.getBoundingClientRect();
  var offsetX = evt && typeof evt.clientX === 'number' ? evt.clientX - rect.left : rect.width * 0.58;
  var offsetY = evt && typeof evt.clientY === 'number' ? evt.clientY - rect.top : rect.height * 0.46;
  var maxLeft = Math.max(16, rect.width - 122);
  var maxTop = Math.max(18, rect.height - 72);
  var left = Math.min(maxLeft, Math.max(14, offsetX - 24));
  var top = Math.min(maxTop, Math.max(18, offsetY - 34));
  pop.textContent = text;
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  pop.classList.remove('open');
  if(pop._hideTimer) clearTimeout(pop._hideTimer);
  void pop.offsetWidth;
  pop.classList.add('open');
  pop._hideTimer = setTimeout(function(){
    pop.classList.remove('open');
  }, 950);
}

function buildOfflineInviteEnvelopeSvg(clipId){
  return ''
    + '<svg viewBox="0 0 212 128" aria-hidden="true" shape-rendering="geometricPrecision">'
    + '<defs>'
    + '<clipPath id="' + escAttr(clipId) + '"><rect x="13.5" y="23.5" width="176" height="88" rx="10" ry="10"></rect></clipPath>'
    + '<filter id="' + escAttr(clipId + 'Shadow') + '" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#000" flood-opacity=".12"/></filter>'
    + '</defs>'
    + '<rect x="17" y="28" width="174" height="86" rx="10" ry="10" fill="#111" opacity=".92"/>'
    + '<rect x="13.5" y="23.5" width="176" height="88" rx="10" ry="10" fill="#fbfbfb" stroke="#4f4f4f" stroke-width="1.15" filter="url(#' + escAttr(clipId + 'Shadow') + ')"/>'
    + '<g clip-path="url(#' + escAttr(clipId) + ')">'
    + '<path d="M22 25.5 Q27 19.5 34 19.5 L170 19.5 Q177 19.5 182 25.5 L106 75.5 Z" fill="#141414" opacity=".92"/>'
    + '<path d="M20.5 24.5 Q26.5 19 33.5 19 L169.5 19 Q176.5 19 182.5 24.5 L102 74 Z" fill="#dcdcdc" stroke="#575757" stroke-width="1.15" stroke-linejoin="round"/>'
    + '<path d="M21.5 25 L102 74 L181.5 25" fill="none" stroke="#111" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>'
    + '</g>'
    + '<path d="M13.5 34.5 L13.5 103.5" stroke="#595959" stroke-width="1.05" stroke-linecap="round"/>'
    + '<path d="M189.5 34.5 L189.5 103.5" stroke="#595959" stroke-width="1.05" stroke-linecap="round"/>'
    + '</svg>';
}

function openOfflineInviteModal(msgId, payload, viewRole, canRespond){
  var modal = ensureOfflineInviteModal();
  var letter = modal.querySelector('.offline-invite-modal-letter');
  if(!letter) return;
  var status = String((payload && payload.status) || 'pending');
  var aside = String((payload && payload.aside) || '').trim() || '想见你';
  var displayName = getOfflineInviteDisplayName(viewRole === 'user' ? 'user' : 'assistant');
  var mood = String((payload && payload.mood) || '').trim() || '想你';
  var location = String((payload && payload.location) || '').trim() || '待定地点';
  var showActions = canRespond && viewRole !== 'user';
  var showMood = viewRole === 'user';
  var openingText = viewRole === 'user'
    ? '给你偷偷塞来一张小小邀约单，如果你也想见我，就和我一起去赴约吧，想和你一起过一个开心的下午'
    : String((payload && payload.content) || '').trim() || '想和你认真见一面';
  var popupText = viewRole === 'user'
    ? String((payload && payload.content) || '').trim()
    : aside;
  letter.innerHTML = ''
    + '<div class="offline-invite-modal-weather">' + esc(payload && payload.weather || '☀︎') + '</div>'
    + '<button class="offline-invite-modal-heart" type="button" data-offline-modal-close="1" aria-label="关闭邀请"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg></button>'
    + '<div class="offline-invite-modal-notehead">Invitation</div>'
    + '<div class="offline-invite-modal-time">' + esc(payload && payload.timeLabel || '') + '</div>'
    + '<div class="offline-invite-modal-date">' + esc(payload && payload.dateLabel || '') + '</div>'
    + '<div class="offline-invite-modal-opening">' + esc(openingText) + '</div>'
    + (showMood ? '<div class="offline-invite-modal-mood">' + esc(mood) + '</div>' : '')
    + '<div class="offline-invite-modal-location"><span class="offline-invite-modal-pin">📍</span><span class="offline-invite-modal-location-text">' + esc(location) + '</span></div>'
    + (popupText ? '<div class="offline-invite-modal-aside-pop"></div>' : '')
    + '<div class="offline-invite-modal-signoff">With love,</div>'
    + '<div class="offline-invite-modal-signature">' + esc(displayName) + '</div>'
    + '<div class="offline-invite-modal-letter-flower"><img src="assets/floral-border-2.png" alt=""></div>'
    + (showActions ? '<div class="offline-invite-modal-actions">'
    + '<button class="offline-action-btn' + (status !== 'pending' ? ' disabled' : '') + '" type="button" data-offline-action="reject">×</button>'
    + '<button class="offline-action-btn' + (status !== 'pending' ? ' disabled' : '') + '" type="button" data-offline-action="accept">✓</button>'
    + '</div>' : '');
  modal.setAttribute('data-msg-id', String(msgId || ''));
  modal.classList.add('open');
  letter.onclick = function(evt){
    var actionBtn = evt.target && evt.target.closest ? evt.target.closest('[data-offline-action]') : null;
    if(actionBtn){
      evt.stopPropagation();
      if(actionBtn.classList.contains('disabled') || !msgId) return;
      var action = actionBtn.getAttribute('data-offline-action');
      closeOfflineInviteModal();
      if(action === 'accept') acceptOfflineInvite(msgId);
      if(action === 'reject') rejectOfflineInvite(msgId);
      return;
    }
    var closeBtn = evt.target && evt.target.closest ? evt.target.closest('[data-offline-modal-close]') : null;
    if(closeBtn) return;
    if(popupText){
      evt.stopPropagation();
      showOfflineInviteAsidePopup(letter, popupText, evt);
    }
  };
}

function hydrateOfflineInviteAvatar(card, role){
  if(!card) return;
  var badge = card.querySelector('.offline-envelope-avatar');
  if(!badge) return;
  if(role === 'user'){
    resolveChatUserAvatarAsync(character && character.id).then(function(uav){
      if(uav && uav.startsWith('data:')){
        badge.innerHTML = '<img src="' + escAttr(uav) + '" alt="">';
      }
    }).catch(function(){});
    return;
  }
  badge.innerHTML = getCharAvatarHTML();
}

function closeOfflineInviteComposer(){
  var overlay = document.getElementById('offlineInviteOverlay');
  if(overlay) overlay.classList.remove('open');
}

function openOfflineInviteComposer(){
  if(!character){
    toast('请先选择角色');
    return;
  }
  closeAddonPanel();
  var overlay = document.getElementById('offlineInviteOverlay');
  if(overlay) overlay.classList.add('open');
  var input = document.getElementById('offlineInviteInput');
  var locInput = document.getElementById('offlineInviteLocationInput');
  if(input){
    input.value = '';
    setTimeout(function(){ input.focus(); }, 40);
  }
  if(locInput) locInput.value = '';
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
  var entry = makeChatEntry(role === 'user' ? 'user' : 'assistant', JSON.stringify(payload), 'offline_invite');
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
  payload.status = 'accepted';
  entry.content = JSON.stringify(payload);
  await saveChat(true);
  rerenderChat();
  await openOfflineSession(payload);
}

async function requestCharOfflineInviteDecision(userPayload){
  var msgMin = Math.max(1, Number(character && character.msgMin) || 1);
  var msgMax = Math.max(msgMin, Number(character && character.msgMax) || 3);
  var systemPrompt = [
    '你是角色本人，要决定是否接受用户发来的线下邀请。',
    '必须认真读取角色当前人设、世界书设定、最近聊天气氛、用户此刻的伤心或情绪状态，以及用户这次邀约里写的具体话和地点。',
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
    '用户刚刚发来线下邀请：' + JSON.stringify(userPayload),
    (window.getInviteWeatherPromptText ? window.getInviteWeatherPromptText('char') : ''),
    (window.getInviteWeatherPromptText ? window.getInviteWeatherPromptText('user') : ''),
    '最近聊天：\n' + formatChatForModel(chatLog.slice(-12))
  ].join('\n\n');
  try{
    var raw = await callAIWithCustomPrompts(systemPrompt, userPrompt);
    var clean = String(raw || '').replace(/^```[a-zA-Z]*\s*/,'').replace(/```$/,'').trim();
    return JSON.parse(clean);
  }catch(e){
    return { accept: false, text: '今天先不出门了，不过我有点心动。' };
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
  } finally {
    hideTyping();
    isTyping = false;
    if(genBtn) genBtn.disabled = false;
    if(sendBtn) sendBtn.disabled = false;
  }
}

async function sendOfflineInviteFromUser(){
  if(!character){
    toast('请先选择角色');
    return;
  }
  var input = document.getElementById('offlineInviteInput');
  var locInput = document.getElementById('offlineInviteLocationInput');
  var text = String((input && input.value) || '').trim();
  var location = String((locInput && locInput.value) || '').trim();
  if(!text){
    toast('写一句邀约再发出去吧');
    return;
  }
  closeOfflineInviteComposer();
  var userWeather = await resolveOfflineInviteWeather('user', '☀︎');
  var payload = buildOfflineInvitePayload('user', text, {
    aside: '想立刻见你',
    weather: userWeather.icon,
    location: location || (((character && (character.nickname || character.name)) || '对方') + '方便出现的地方')
  });
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
  var data = buildOfflineInvitePayload(viewRole === 'user' ? 'user' : 'assistant', '', parseOfflineInvitePayload(raw) || {});
  var canRespond = viewRole !== 'user';
  var status = String(data.status || 'pending');
  var sideClass = viewRole === 'user' ? ' from-user' : ' from-ai';
  var badgeClass = viewRole === 'user' ? ' right' : ' left';
  var clipId = 'offlineEnvelopeClip' + String(msgId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  var displayName = getOfflineInviteDisplayName(viewRole === 'user' ? 'user' : 'assistant');
  bubble.innerHTML = '<div class="offline-bubble-shell' + sideClass + '">'
    + '<div class="offline-bubble-flower"><img src="assets/floral-border-1.png" alt=""></div>'
    + '<div class="offline-bubble-paper back"></div>'
    + '<div class="offline-bubble-paper front"></div>'
    + '<div class="offline-invite-card' + sideClass + '" data-msg-id="' + escAttr(msgId || '') + '" data-status="' + escAttr(status) + '">'
    + '<div class="offline-envelope">'
    + buildOfflineInviteEnvelopeSvg(clipId)
    + '<div class="offline-envelope-name">' + esc(displayName) + '</div>'
    + '<div class="offline-envelope-avatar' + badgeClass + '">' + esc(getOfflineInviteAvatarFallback(viewRole === 'user' ? 'user' : 'assistant')) + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
  var card = bubble.querySelector('.offline-invite-card');
  if(!card) return;
  hydrateOfflineInviteAvatar(card, viewRole === 'user' ? 'user' : 'assistant');
  card.addEventListener('click', function(evt){
    var actionBtn = evt.target && evt.target.closest ? evt.target.closest('[data-offline-action]') : null;
    if(actionBtn){
      evt.stopPropagation();
      if(actionBtn.classList.contains('disabled') || !msgId) return;
      var action = actionBtn.getAttribute('data-offline-action');
      if(action === 'accept') acceptOfflineInvite(msgId);
      if(action === 'reject') rejectOfflineInvite(msgId);
      return;
    }
    openOfflineInviteModal(msgId, data, viewRole, canRespond);
  });
}
