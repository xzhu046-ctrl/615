// EPHONE Main OS Logic
const APP_MAP = {
  qq:         { title: 'QQ',             src: 'apps/qq.html' },
  chat:       { title: 'Chat',           src: 'apps/chat.html' },
  characters: { title: 'Contacts',       src: 'apps/characters.html' },
  settings:   { title: '设置',           src: 'apps/settings.html' },
  customize:  { title: '外观',           src: 'apps/customize.html' },
  worldbook:  { title: '世界书',         src: 'apps/worldbook.html' },
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

function hasSavedPhoneFramePreference(){
  const saved = localStorage.getItem(PHONE_FRAME_STORAGE_KEY);
  return saved === '0' || saved === '1';
}

function getDefaultPhoneFrameVisibility(){
  try{
    return !window.matchMedia('(max-width: 768px)').matches;
  }catch(e){
    return true;
  }
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

function syncAppHeight(){
  const vv = window.visualViewport;
  const isStandalone = isStandaloneMode();
  const viewportWidth = Math.round(isStandalone ? window.innerWidth : (vv ? vv.width : window.innerWidth));
  const vvTopOffset = Math.round(vv ? Math.max(0, vv.offsetTop || 0) : 0);
  const rawBottomOffset = Math.round(vv ? Math.max(0, window.innerHeight - (vv.height + (vv.offsetTop || 0))) : 0);
  const keyboardLikelyOpen = rawBottomOffset > 120;
  const vvBottomOffset = keyboardLikelyOpen ? 0 : rawBottomOffset;
  const viewportHeight = Math.round(window.innerHeight);
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

function readBackgroundChatHistory(charId, accountId){
  var scoped = scopedKeyForAccount('chat_' + charId, accountId);
  var raw = '';
  try{ raw = localStorage.getItem(scoped) || localStorage.getItem('chat_' + charId) || ''; }catch(e){}
  if(!raw) return [];
  try{
    var parsed = JSON.parse(raw);
    var list = (parsed && (parsed.history || parsed.messages)) || [];
    return Array.isArray(list) ? list : [];
  }catch(e){
    return [];
  }
}

function writeBackgroundChatHistory(charId, accountId, messages){
  var payload = JSON.stringify({ history: messages, messages: messages });
  var scoped = scopedKeyForAccount('chat_' + charId, accountId);
  try{ localStorage.setItem(scoped, payload); }catch(e){}
  try{ localStorage.setItem('chat_' + charId, payload); }catch(e){}
}

function readBackgroundMoments(accountId){
  var key = scopedKeyForAccount(MOMENTS_POSTS_KEY, accountId);
  try{
    var parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  }catch(e){
    return [];
  }
}

function writeBackgroundMoments(accountId, posts){
  var key = scopedKeyForAccount(MOMENTS_POSTS_KEY, accountId);
  try{ localStorage.setItem(key, JSON.stringify(Array.isArray(posts) ? posts : [])); }catch(e){}
}

function readBackgroundBlockState(charId, accountId){
  var key = scopedKeyForAccount('chat_block_state_' + charId, accountId);
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

function writeBackgroundBlockState(charId, accountId, state){
  var key = scopedKeyForAccount('chat_block_state_' + charId, accountId);
  var next = Object.assign({ userBlocked:false, charBlocked:false, appealCount:0, abuseCount:0, charBlockedAt:0, lastUserReAddAt:0 }, state || {});
  try{ localStorage.setItem(key, JSON.stringify(next)); }catch(e){}
  try{ localStorage.setItem('chat_block_state_' + charId, JSON.stringify(next)); }catch(e){}
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

function appendBackgroundAiMessage(character, accountId, content){
  var history = readBackgroundChatHistory(character.id, accountId);
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
  writeBackgroundChatHistory(character.id, accountId, history);
  try{
    var f = document.getElementById('app-iframe');
    if(f && f.contentWindow){
      f.contentWindow.postMessage({ type:'BACKGROUND_AI_MESSAGE', payload:{ charId: character.id, entry: entry } }, '*');
    }
  }catch(e){}
}

function appendBackgroundMoment(character, accountId, action, content, imageText){
  var posts = readBackgroundMoments(accountId);
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
  writeBackgroundMoments(accountId, posts);
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
  var state = readBackgroundBlockState(character.id, accountId);
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
  writeBackgroundBlockState(character.id, accountId, state);
  appendBackgroundAiMessage(character, accountId, decision.text || '我把你从黑名单里放出来了。');
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

  var history = readBackgroundChatHistory(character.id, defaultId).slice(-8);
  var shortHistory = history.map(function(m){
    var role = m && m.role === 'user' ? 'User' : 'Char';
    var content = String((m && m.content) || '').replace(/\s+/g, ' ').trim();
    return role + ': ' + content;
  }).join('\n');
  var posts = readBackgroundMoments(defaultId).slice(-3).map(function(p){
    var kind = p && p.type === 'dynamic' ? '动态' : '说说';
    return kind + '：' + String((p && (p.text || p.imageText)) || '').replace(/\s+/g, ' ').trim();
  }).join('\n');

  var state = readBackgroundBlockState(character.id, defaultId);
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
    appendBackgroundAiMessage(character, defaultId, parsed.content);
  }else{
    appendBackgroundMoment(character, defaultId, parsed.action, parsed.content, parsed.imageText);
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
    var globalActive = JSON.parse(localStorage.getItem('activeCharacter') || 'null');
    if(globalActive && globalActive.id) return globalActive;
  }catch(e){
  }
  try{
    var scoped = scopedKeyForAccount('activeCharacter', getActiveAccountId());
    return JSON.parse(localStorage.getItem(scoped) || 'null');
  }catch(e){
    return null;
  }
}

function getChatUserName(charId){
  if(!charId) return 'USER';
  var activeId = getActiveAccountId();
  var scoped = scopedKeyForAccount('user_name_' + charId, activeId);
  return (localStorage.getItem(scoped) || localStorage.getItem('user_name_' + charId) || '').trim() || 'USER';
}

function getChatUserAvatar(charId){
  if(!charId) return Promise.resolve('');
  var activeId = getActiveAccountId();
  var scoped = scopedKeyForAccount('user_avatar_' + charId, activeId);
  return loadStoredAsset(scoped).then(function(src){
    if(src && src.startsWith('data:')) return src;
    return loadStoredAsset('user_avatar_' + charId);
  });
}

function getStoredChatMessages(charId){
  if(!charId) return [];
  try{
    var scoped = scopedKeyForAccount('chat_' + charId, getActiveAccountId());
    var raw = localStorage.getItem(scoped) || localStorage.getItem('chat_' + charId) || '';
    if(!raw) return [];
    var parsed = JSON.parse(raw);
    var list = (parsed && (parsed.history || parsed.messages)) || [];
    return Array.isArray(list) ? list : [];
  }catch(e){
    return [];
  }
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

function renderApp(id){
  const a=APP_MAP[id]; if(!a) return;
  currentApp=id;
  const outer = document.querySelector('.phone-outer');
  if(outer) outer.classList.add('app-open');
  document.documentElement.classList.add('app-open-mode');
  document.body.classList.add('app-open-mode');
  document.getElementById('app-title-label').textContent=a.title;
  document.getElementById('app-iframe').src=a.src;
  document.getElementById('app-container').classList.add('open');
  document.getElementById('home-screen').classList.add('hidden');
}

function openApp(id) {
  if(!APP_MAP[id]) return;
  if(appStack[appStack.length-1]!==id) appStack.push(id);
  renderApp(id);
}

function closeApp() {
  appStack.length = 0;
  currentApp = null;
  const outer = document.querySelector('.phone-outer');
  if(outer) outer.classList.remove('app-open');
  document.documentElement.classList.remove('app-open-mode');
  document.body.classList.remove('app-open-mode');
  document.getElementById('app-container').classList.remove('open');
  document.getElementById('home-screen').classList.remove('hidden');
  try{
    const c = JSON.parse(localStorage.getItem('activeCharacter') || 'null');
    if(c) setWidgetCharacter(c);
    renderBondWidget(c);
  }catch(e){
    renderBondWidget(null);
  }
  setTimeout(()=>{ document.getElementById('app-iframe').src=''; },400);
}

function handleBack(){
  if(appStack.length>1){
    appStack.pop();
    renderApp(appStack[appStack.length-1]);
    return;
  }
  closeApp();
}

function goHome(){ closeApp(); }

function formatEphone(){
  try{ localStorage.clear(); sessionStorage.clear(); }catch(e){}
  try{ if(window.assetStore && typeof window.assetStore.clearAll === 'function') window.assetStore.clearAll(); }catch(e){}
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
    try{ localStorage.setItem('activeCharacter',JSON.stringify(slim)); }catch(e){}
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
    try{ localStorage.setItem('activeCharacter',JSON.stringify(slim)); }catch(e){}
    try{ localStorage.setItem(scopedKeyForAccount('activeCharacter', getActiveAccountId()), JSON.stringify(slim)); }catch(e){}
    renderBondWidget(payload);
    renderHomeDockBadges();
  }
  if(type==='OPEN_CHAT_WITH'){
    openApp('chat');
    const slim = slimChar(payload);
    try{ localStorage.setItem('activeCharacter',JSON.stringify(slim)); }catch(e){}
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
  if(type==='OPEN_APP'){ openApp(payload); }
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
    var nextChar = payload && payload.data ? payload.data : null;
    if(nextChar && nextChar.id){
      try{ localStorage.setItem('activeCharacter', JSON.stringify(nextChar)); }catch(e){}
      try{ localStorage.setItem(scopedKeyForAccount('activeCharacter', getActiveAccountId()), JSON.stringify(nextChar)); }catch(e){}
      setWidgetCharacter(nextChar);
      renderBondWidget(nextChar);
    }else{
      var ac = getActiveCharacterData();
      if(ac) renderBondWidget(ac);
    }
    var subText = payload.last || '';
    var lastType = normalizeChatPreviewType(payload.lastType || 'text');
    if(lastType === 'voice'){
      var dur = Math.max(1, Math.min(60, Math.ceil((payload.last||'').length/6)));
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
  return 'text';
}

function normalizePreviewMessage(msg){
  var next = msg && typeof msg === 'object' ? msg : { content:'', type:'text' };
  var kind = normalizeChatPreviewType(next.type || 'text');
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

// Clamp long character descriptions to keep the widget tidy while showing the tail.
function formatCharSub(text){
  const limit = 36; // clamp to last 36 chars for compact widget
  if(!text) return '';
  return text.length > limit ? '…' + text.slice(-limit) : text;
}

function setWidgetCharacter(c){
  const displayName = c?.nickname || c?.name || '';
  document.getElementById('wgt-name').textContent = displayName;
  // Prefer last chat line; fall back to description
  var lastLine = '';
  try {
    if (c?.id) {
      var msgs = getStoredChatMessages(c.id);
      if (msgs.length) {
        var lastMsg = normalizePreviewMessage(msgs[msgs.length - 1]);
        var lastType = lastMsg.type;
        if (lastType === 'voice') {
          var duration = Math.max(1, Math.min(60, Math.ceil((lastMsg.content || '').length/6)));
          lastLine = '语音消息 ' + duration + "''";
        } else if (lastType === 'image') {
          lastLine = '【图片】';
        } else {
          lastLine = lastMsg.content || '';
        }
      }
    }
  } catch(e){}
  var sub = lastLine || c?.description || '';
  document.getElementById('wgt-sub').textContent = formatCharSub(sub);
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
  try{ const c=JSON.parse(localStorage.getItem('activeCharacter')||'null');
    if(c){ setWidgetCharacter(c); }
    renderBondWidget(c);
  }catch(e){}
  renderHomeDockBadges();
  try{
    homePageIndex = Math.max(0, Math.min(1, Number(localStorage.getItem('home_page_index') || '0') || 0));
  }catch(e){
    homePageIndex = 0;
  }
  renderHomePages(true);
  setupAiBgScheduler();
}

window.addEventListener('resize', ()=>{
  syncAppHeight();
  if(!hasSavedPhoneFramePreference()){
    applyPhoneFrameVisibility(getDefaultPhoneFrameVisibility(), false);
  }
});

if(window.visualViewport){
  window.visualViewport.addEventListener('resize', ()=>{
    if(isStandaloneMode()) return;
    syncAppHeight();
  });
}

restoreState();

window.addEventListener('focus', ()=>renderBondWidget());
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden){
    renderBondWidget();
    renderHomeDockBadges();
    maybeRunAiBgTick(false);
  }
});
window.addEventListener('resize', ()=>renderHomePages(true));
setInterval(renderHomeDockBadges, 2500);
