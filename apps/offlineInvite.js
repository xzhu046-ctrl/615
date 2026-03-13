var OFFLINE_INVITE_SNIPPET = '【线下邀请】';
var OFFLINE_WEATHERS = ['☀︎','☁︎','⛅︎','☂︎','☃︎'];
var OFFLINE_MOODS = ['(///v///)','(,,> <,,)','(๑´ㅂ`๑)','(｡･ω･｡)','(っ˘ڡ˘ς)','( ´ ▽ ` )'];

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

function currentDateLabels(){
  var d = new Date();
  return {
    timeLabel: d.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }),
    dateLabel: d.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' })
  };
}

function buildOfflineInvitePayload(sourceRole, text, overrides){
  var labels = currentDateLabels();
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
  data.weather = String(data.weather || '').trim() || '☀︎';
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
  postToShell({ type:'OPEN_APP', payload:'offline' });
}

function getCurrentUserDisplayName(){
  return getChatUserName(character && character.id) || resolveDisplayUserName() || '你';
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
  if(input){
    input.value = '';
    setTimeout(function(){ input.focus(); }, 40);
  }
}

function appendOfflineInviteNoticeText(role){
  var charName = (character && (character.nickname || character.name)) || 'Char';
  if(role === 'user'){
    return '系统提示：' + getCurrentUserDisplayName() + '向' + charName + '发出了线下邀请';
  }
  return '系统提示：您收到了' + charName + '的线下邀请';
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
  var systemPrompt = [
    '你是角色本人，要决定是否接受用户发来的线下邀请。',
    '只返回 JSON：{"accept":true|false,"text":"...","mood":"...","weather":"...","location":"...","aside":"..."}',
    '如果 accept 为 true，text 写一句自然口语的线下回应，其他字段用于邀约卡片。',
    '如果 accept 为 false，text 写一句自然拒绝或婉拒的话，其他字段可留空。',
    '不要 markdown，不要额外解释。'
  ].join('\n');
  var userPrompt = [
    buildSystemPrompt(),
    '用户刚刚发来线下邀请：' + JSON.stringify(userPayload),
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

async function sendOfflineInviteFromUser(){
  if(!character){
    toast('请先选择角色');
    return;
  }
  var input = document.getElementById('offlineInviteInput');
  var text = String((input && input.value) || '').trim();
  if(!text){
    toast('写一句邀约再发出去吧');
    return;
  }
  closeOfflineInviteComposer();
  var payload = buildOfflineInvitePayload('user', text, {
    aside: '想立刻见你',
    location: ((character && (character.nickname || character.name)) || '对方') + '方便出现的地方'
  });
  await appendOfflineInviteToChat('user', payload, true);
  var decision = await requestCharOfflineInviteDecision(payload);
  if(decision && decision.accept){
    var replyPayload = buildOfflineInvitePayload('assistant', String(decision.text || '我来了').trim(), {
      mood: decision.mood || randomPick(OFFLINE_MOODS, '(///v///)'),
      weather: decision.weather || randomPick(OFFLINE_WEATHERS, '☀︎'),
      location: decision.location || payload.location,
      aside: decision.aside || '这次别拒绝我'
    });
    await appendOfflineInviteToChat('assistant', replyPayload, true);
    return;
  }
  var responseEntry = makeChatEntry('assistant', String((decision && decision.text) || '今天先不出门了。').trim(), 'text');
  chatLog.push(responseEntry);
  addMessage('ai', responseEntry.content, true, 'text', responseEntry.id);
  await saveChat(true);
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
  bubble.innerHTML = '<div class="offline-bubble-shell">'
    + '<div class="offline-bubble-paper back"></div>'
    + '<div class="offline-bubble-paper front"></div>'
    + '<div class="offline-invite-card' + (status !== 'pending' ? ' open' : '') + '" data-msg-id="' + escAttr(msgId || '') + '" data-status="' + escAttr(status) + '">'
    + '<div class="offline-bubble-dots left"><span></span><span></span><span></span></div>'
    + '<div class="offline-bubble-dots right"><span></span><span></span><span></span></div>'
    + '<div class="offline-envelope">'
    + '<div class="offline-envelope-back"></div>'
    + '<div class="offline-letter">'
    + '<div class="offline-letter-top"><div class="offline-letter-when">' + esc(data.timeLabel || '') + '<br>' + esc(data.dateLabel || '') + '</div><div class="offline-letter-deco">♥</div></div>'
    + '<div class="offline-letter-body"><div class="offline-weather">' + esc(data.weather || '☀︎') + '</div><div class="offline-letter-main"><div class="offline-letter-mood">Mood: ' + esc(data.mood || '') + '</div><div class="offline-letter-location"><span class="offline-letter-pin">▣</span><span>' + esc(data.location || '') + '</span></div><div class="offline-letter-aside">' + esc(data.aside || '') + '</div></div></div>'
    + '<div class="offline-letter-actions">'
    + '<button class="offline-action-btn' + (!canRespond || status !== 'pending' ? ' disabled' : '') + '" type="button" data-offline-action="reject">×</button>'
    + '<button class="offline-action-btn' + (!canRespond || status !== 'pending' ? ' disabled' : '') + '" type="button" data-offline-action="accept">✓</button>'
    + '</div>'
    + '</div>'
    + '<div class="offline-envelope-flap"></div>'
    + '<div class="offline-envelope-front"></div>'
    + '<div class="offline-envelope-paws"><span>🐾</span><span>🐾</span></div>'
    + '<div class="offline-envelope-heart">♥</div>'
    + '</div>'
    + '</div>'
    + '</div>';
  var card = bubble.querySelector('.offline-invite-card');
  if(!card) return;
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
    card.classList.toggle('open');
  });
}
