(function(global){
  'use strict';

  var STORE_KEY = 'offline_invite_records_v1';
  var cache = null;

  function cloneJson(value){
    try{ return JSON.parse(JSON.stringify(value)); }catch(err){ return value; }
  }

  function getAccountManager(){
    try{
      if(global.AccountManager) return global.AccountManager;
      if(global.parent && global.parent !== global && global.parent.AccountManager) return global.parent.AccountManager;
    }catch(err){}
    return null;
  }

  function getScopedStoreKey(){
    var base = STORE_KEY;
    try{
      var am = getAccountManager();
      if(am && typeof am.ensure === 'function') am.ensure();
      var active = am && typeof am.getActive === 'function' ? am.getActive() : null;
      var accountId = String((active && active.id) || '').trim();
      if(accountId){
        if(am && typeof am.scopedKey === 'function') return am.scopedKey(base);
        return base + '__acct_' + accountId;
      }
    }catch(err){}
    return base;
  }

  function createId(prefix){
    return String(prefix || 'invite') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeRecord(item){
    item = item && typeof item === 'object' ? item : {};
    return {
      id: String(item.id || createId('invite')).trim(),
      threadId: String(item.threadId || item.id || '').trim(),
      charId: String(item.charId || '').trim(),
      charName: String(item.charName || '').trim(),
      sourceRole: String(item.sourceRole || 'user').trim() || 'user',
      previewText: String(item.previewText || '').trim(),
      location: String(item.location || '').trim(),
      scheduledDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.scheduledDate || '')) ? String(item.scheduledDate) : '',
      scheduledTime: /^\d{2}:\d{2}$/.test(String(item.scheduledTime || '')) ? String(item.scheduledTime) : '',
      dateLabel: String(item.dateLabel || '').trim(),
      timeLabel: String(item.timeLabel || '').trim(),
      status: String(item.status || 'pending').trim() || 'pending',
      reminderState: String(item.reminderState || 'pending').trim() || 'pending',
      snoozeUntil: Number(item.snoozeUntil || 0) || 0,
      remindedAt: Number(item.remindedAt || 0) || 0,
      openedAt: Number(item.openedAt || 0) || 0,
      arrivalState: String(item.arrivalState || 'pending').trim() || 'pending',
      arrivedAt: Number(item.arrivedAt || 0) || 0,
      inviteMessageId: String(item.inviteMessageId || '').trim(),
      replyMessageId: String(item.replyMessageId || '').trim(),
      scheduleEntryId: String(item.scheduleEntryId || '').trim(),
      createdAt: Number(item.createdAt || Date.now()) || Date.now(),
      updatedAt: Number(item.updatedAt || Date.now()) || Date.now()
    };
  }

  function normalizeState(state){
    state = state && typeof state === 'object' ? state : {};
    return {
      version: 1,
      records: Array.isArray(state.records) ? state.records.map(normalizeRecord) : []
    };
  }

  function readStateSync(){
    if(cache) return cloneJson(cache);
    var raw = null;
    try{ raw = global.localStorage.getItem(getScopedStoreKey()) || 'null'; }catch(err){ raw = 'null'; }
    var parsed = null;
    try{ parsed = JSON.parse(raw); }catch(err){ parsed = null; }
    cache = normalizeState(parsed);
    return cloneJson(cache);
  }

  function saveState(state){
    var next = normalizeState(state);
    cache = cloneJson(next);
    try{ global.localStorage.setItem(getScopedStoreKey(), JSON.stringify(next)); }catch(err){}
    return cloneJson(next);
  }

  function loadState(){
    return Promise.resolve(readStateSync());
  }

  function listRecords(state){
    var source = state ? normalizeState(state) : readStateSync();
    return source.records.slice().sort(function(a, b){
      var aa = Number(a.updatedAt || a.createdAt || 0) || 0;
      var bb = Number(b.updatedAt || b.createdAt || 0) || 0;
      return bb - aa;
    });
  }

  function upsertRecord(record){
    var next = readStateSync();
    var safe = normalizeRecord(record);
    var idx = next.records.findIndex(function(item){ return String(item.id || '') === String(safe.id || ''); });
    if(idx >= 0) next.records[idx] = safe;
    else next.records.unshift(safe);
    return saveState(next);
  }

  function patchRecord(id, patch){
    var safeId = String(id || '').trim();
    if(!safeId) return saveState(readStateSync());
    var next = readStateSync();
    var idx = next.records.findIndex(function(item){ return String(item.id || '') === safeId; });
    if(idx < 0) return saveState(next);
    next.records[idx] = normalizeRecord(Object.assign({}, next.records[idx] || {}, patch || {}, {
      id: safeId,
      updatedAt: Date.now()
    }));
    return saveState(next);
  }

  function removeRecord(id){
    var safeId = String(id || '').trim();
    var next = readStateSync();
    next.records = next.records.filter(function(item){ return String(item.id || '') !== safeId; });
    return saveState(next);
  }

  function getRecord(id){
    var safeId = String(id || '').trim();
    if(!safeId) return null;
    var state = readStateSync();
    var hit = state.records.find(function(item){ return String(item.id || '') === safeId; }) || null;
    return hit ? normalizeRecord(hit) : null;
  }

  global.OfflineInviteStore = {
    STORE_KEY: STORE_KEY,
    getScopedStoreKey: getScopedStoreKey,
    normalizeRecord: normalizeRecord,
    normalizeState: normalizeState,
    readStateSync: readStateSync,
    loadState: loadState,
    saveState: saveState,
    listRecords: listRecords,
    upsertRecord: upsertRecord,
    patchRecord: patchRecord,
    removeRecord: removeRecord,
    getRecord: getRecord,
    createId: createId
  };
})(window);
