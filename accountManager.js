(function(global){
  var ACCOUNTS_KEY = 'qq_accounts_v1';
  var ACTIVE_KEY = 'qq_active_account_id_v1';
  var DEFAULT_KEY = 'qq_default_account_id_v1';
  var FAVORITES_FALLBACK_PREFIX = 'qq_favorites_fallback__acct_';
  var KV_ACCOUNTS_ID = 'account_manager_accounts_v2';
  var KV_ACTIVE_ID = 'account_manager_active_id_v2';
  var KV_DEFAULT_ID = 'account_manager_default_id_v2';
  var KV_FAVORITES_PREFIX = 'account_manager_favorites_v2__';

  var accountsCache = null;
  var activeIdCache = '';
  var defaultIdCache = '';
  var hydratePromise = null;
  var favoritesFallbackCache = Object.create(null);

  function uid(){
    return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  function cloneAccount(account){
    var next = account && typeof account === 'object' ? Object.assign({}, account) : {};
    next.id = String(next.id || uid());
    next.name = String(next.name || '我哥天下第一好');
    next.avatar = String(next.avatar || '');
    next.friends = Array.isArray(next.friends) ? next.friends.slice() : [];
    next.favorites = Array.isArray(next.favorites) ? next.favorites.slice() : [];
    next.createdAt = Number(next.createdAt || Date.now()) || Date.now();
    next.isDefault = !!next.isDefault;
    return next;
  }

  function normalizeAccounts(accounts){
    return (Array.isArray(accounts) ? accounts : []).map(cloneAccount).filter(function(a){ return !!a.id; });
  }

  function getPhoneStorage(){
    try{
      if(global.PhoneStorage && typeof global.PhoneStorage.get === 'function') return global.PhoneStorage;
    }catch(err){}
    try{
      if(global.parent && global.parent !== global && global.parent.PhoneStorage && typeof global.parent.PhoneStorage.get === 'function'){
        return global.parent.PhoneStorage;
      }
    }catch(err2){}
    return null;
  }

  function readLegacyAccounts(){
    try{
      var arr = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      return normalizeAccounts(arr);
    }catch(e){ return []; }
  }

  function readLegacyText(key){
    try{ return String(localStorage.getItem(key) || '').trim(); }catch(err){ return ''; }
  }

  function writeLegacyText(key, value){
    try{ localStorage.setItem(key, String(value || '')); }catch(err){}
  }

  function removeLegacyKey(key){
    try{ localStorage.removeItem(key); }catch(err){}
  }

  function getRecordValue(record){
    return record && Object.prototype.hasOwnProperty.call(record, 'value') ? record.value : null;
  }

  function putKv(id, value){
    var storage = getPhoneStorage();
    if(storage && typeof storage.put === 'function'){
      return storage.put('kv', { id:id, value:value, updatedAt:Date.now() }).catch(function(){});
    }
    return Promise.resolve(false);
  }

  async function getKv(id){
    var storage = getPhoneStorage();
    if(!(storage && typeof storage.get === 'function')) return null;
    try{ return getRecordValue(await storage.get('kv', id)); }catch(err){ return null; }
  }

  function scheduleHydrate(){
    if(hydratePromise) return hydratePromise;
    hydratePromise = hydrateFromStorage().catch(function(){ return false; });
    return hydratePromise;
  }

  async function hydrateFromStorage(){
    var storage = getPhoneStorage();
    if(!(storage && typeof storage.get === 'function')){
      if(!accountsCache) accountsCache = readLegacyAccounts();
      if(!activeIdCache) activeIdCache = readLegacyText(ACTIVE_KEY);
      if(!defaultIdCache) defaultIdCache = readLegacyText(DEFAULT_KEY);
      return false;
    }
    var storedAccounts = await getKv(KV_ACCOUNTS_ID);
    var storedActiveId = await getKv(KV_ACTIVE_ID);
    var storedDefaultId = await getKv(KV_DEFAULT_ID);
    var accounts = normalizeAccounts(storedAccounts);
    if(!accounts.length){
      accounts = readLegacyAccounts();
      if(accounts.length) putKv(KV_ACCOUNTS_ID, accounts);
    }
    accountsCache = accounts;
    activeIdCache = String(storedActiveId || readLegacyText(ACTIVE_KEY) || '').trim();
    defaultIdCache = String(storedDefaultId || readLegacyText(DEFAULT_KEY) || '').trim();
    ensure();
    return true;
  }

  function persistActiveId(id){
    activeIdCache = String(id || '').trim();
    if(getPhoneStorage()) putKv(KV_ACTIVE_ID, activeIdCache);
    else writeLegacyText(ACTIVE_KEY, activeIdCache);
  }

  function persistDefaultId(id){
    defaultIdCache = String(id || '').trim();
    if(getPhoneStorage()) putKv(KV_DEFAULT_ID, defaultIdCache);
    else writeLegacyText(DEFAULT_KEY, defaultIdCache);
  }

  function loadAccounts(){
    if(!accountsCache){
      accountsCache = readLegacyAccounts();
      activeIdCache = readLegacyText(ACTIVE_KEY);
      defaultIdCache = readLegacyText(DEFAULT_KEY);
    }
    scheduleHydrate();
    return accountsCache;
  }

  function saveAccounts(accounts){
    accountsCache = normalizeAccounts(accounts);
    if(getPhoneStorage()){
      putKv(KV_ACCOUNTS_ID, accountsCache);
      return true;
    }
    try{
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accountsCache));
      return true;
    }catch(e){
      return false;
    }
  }

  function trimFavoriteForQuota(entry){
    var item = entry && typeof entry === 'object' ? Object.assign({}, entry) : {};
    if(item.richPayload && item.richPayload !== '__asset__'){
      item.richPayload = '';
    }
    if(typeof item.text === 'string' && item.text.length > 60000){
      item.text = item.text.slice(0, 60000);
    }
    if(typeof item.previewText === 'string' && item.previewText.length > 200){
      item.previewText = item.previewText.slice(0, 200);
    }
    return item;
  }

  function favoritesFallbackKey(accountId){
    return FAVORITES_FALLBACK_PREFIX + String(accountId || '');
  }

  function loadFavoritesFallback(accountId){
    if(!accountId) return [];
    if(Array.isArray(favoritesFallbackCache[accountId])) return favoritesFallbackCache[accountId].slice();
    try{
      var arr = JSON.parse(localStorage.getItem(favoritesFallbackKey(accountId)) || '[]');
      var safe = Array.isArray(arr) ? arr : [];
      favoritesFallbackCache[accountId] = safe;
      if(safe.length) putKv(KV_FAVORITES_PREFIX + accountId, safe);
      return safe.slice();
    }catch(err){
      return [];
    }
  }

  function saveFavoritesFallback(accountId, list){
    if(!accountId) return false;
    var safeList = (Array.isArray(list) ? list : []).map(trimFavoriteForQuota).slice(0, 200);
    favoritesFallbackCache[accountId] = safeList.slice();
    if(getPhoneStorage()){
      putKv(KV_FAVORITES_PREFIX + accountId, safeList);
      removeLegacyKey(favoritesFallbackKey(accountId));
      return true;
    }
    try{
      localStorage.setItem(favoritesFallbackKey(accountId), JSON.stringify(safeList));
      return true;
    }catch(err){
      return false;
    }
  }

  function saveAccountsWithQuotaFallback(accounts, idx){
    if(saveAccounts(accounts)) return true;
    if(!Array.isArray(accounts) || idx < 0 || idx >= accounts.length) return false;
    var account = Object.assign({}, accounts[idx]);
    var favorites = Array.isArray(account.favorites) ? account.favorites.slice() : [];
    if(!favorites.length) return false;
    account.favorites = favorites.map(trimFavoriteForQuota).slice(0, 120);
    accounts[idx] = account;
    return saveAccounts(accounts);
  }

  function ensure(){
    var accounts = normalizeAccounts(loadAccounts());
    if(!accounts.length){
      var main = {
        id: uid(),
        name: '我哥天下第一好',
        avatar: '',
        friends: [],
        favorites: [],
        createdAt: Date.now(),
        isDefault: true
      };
      accounts = [main];
      activeIdCache = main.id;
      defaultIdCache = main.id;
      saveAccounts(accounts);
      persistActiveId(main.id);
      persistDefaultId(main.id);
    }

    if(!activeIdCache || !accounts.some(function(a){ return a.id === activeIdCache; })){
      persistActiveId(accounts[0].id);
    }
    if(!defaultIdCache || !accounts.some(function(a){ return a.id === defaultIdCache; })){
      var d = accounts.find(function(a){ return a.isDefault; }) || accounts[0];
      persistDefaultId(d.id);
    }

    var changed = false;
    accounts.forEach(function(a){
      var should = a.id === defaultIdCache;
      if(!!a.isDefault !== should){ a.isDefault = should; changed = true; }
      if(!Array.isArray(a.friends)){ a.friends = []; changed = true; }
      if(!Array.isArray(a.favorites)){ a.favorites = []; changed = true; }
      var fallbackFavs = loadFavoritesFallback(a.id);
      if(fallbackFavs.length && fallbackFavs.length >= a.favorites.length){
        a.favorites = fallbackFavs;
        changed = true;
      }
    });
    accountsCache = accounts;
    if(changed) saveAccounts(accounts);
    return accounts;
  }

  function getActive(){
    var accounts = ensure();
    return accounts.find(function(a){ return a.id === activeIdCache; }) || accounts[0];
  }

  function updateActive(mutator){
    var accounts = ensure();
    var idx = accounts.findIndex(function(a){ return a.id === activeIdCache; });
    if(idx < 0) idx = 0;
    var copy = Object.assign({}, accounts[idx]);
    mutator(copy);
    accounts[idx] = cloneAccount(copy);
    saveAccountsWithQuotaFallback(accounts, idx);
    if(Array.isArray(copy.favorites)){
      saveFavoritesFallback(copy.id || activeIdCache, copy.favorites);
    }
    return accounts[idx];
  }

  function setActive(id){
    var accounts = ensure();
    var safeId = String(id || '').trim();
    if(!accounts.some(function(a){ return a.id === safeId; })) return false;
    persistActiveId(safeId);
    return true;
  }

  function setDefault(id){
    var accounts = ensure();
    var safeId = String(id || '').trim();
    if(!accounts.some(function(a){ return a.id === safeId; })) return false;
    persistDefaultId(safeId);
    accounts = accounts.map(function(a){
      a = Object.assign({}, a);
      a.isDefault = a.id === safeId;
      return a;
    });
    saveAccounts(accounts);
    return true;
  }

  function createAccount(){
    var accounts = ensure();
    if(accounts.length >= 2) return null;
    var acct = {
      id: uid(),
      name: '我哥天下第一好',
      avatar: '',
      friends: [],
      favorites: [],
      createdAt: Date.now(),
      isDefault: false
    };
    accounts.push(acct);
    saveAccounts(accounts);
    persistActiveId(acct.id);
    return acct;
  }

  function scopedKey(base, accountId){
    var active = getActive();
    var id = String(accountId || (active && active.id) || '').trim();
    return base + '__acct_' + id;
  }

  function addFavorite(entry){
    var accounts = ensure();
    var idx = accounts.findIndex(function(a){ return a.id === activeIdCache; });
    if(idx < 0) idx = 0;
    var acct = Object.assign({}, accounts[idx]);
    var list = Array.isArray(acct.favorites) ? acct.favorites.slice() : [];
    list.unshift(trimFavoriteForQuota(entry));
    acct.favorites = list.slice(0, 200);
    accounts[idx] = cloneAccount(acct);
    var saved = saveAccountsWithQuotaFallback(accounts, idx);
    var fallbackSaved = saveFavoritesFallback(acct.id || activeIdCache, acct.favorites);
    return !!(saved || fallbackSaved);
  }

  function addFriend(charId){
    updateActive(function(acct){
      acct.friends = Array.isArray(acct.friends) ? acct.friends : [];
      if(acct.friends.indexOf(charId) === -1) acct.friends.push(charId);
    });
  }

  function removeFriend(charId){
    var safeId = String(charId || '').trim();
    if(!safeId) return;
    updateActive(function(acct){
      acct.friends = Array.isArray(acct.friends) ? acct.friends : [];
      acct.friends = acct.friends.filter(function(id){
        return String(id || '').trim() !== safeId;
      });
    });
  }

  function isFriend(charId){
    var acct = getActive();
    if(acct.isDefault) return true;
    return Array.isArray(acct.friends) && acct.friends.indexOf(charId) !== -1;
  }

  function deleteAccount(id){
    var accounts = ensure();
    var safeId = String(id || '').trim();
    if(accounts.length <= 1) return { ok:false, reason:'need_one' };
    var target = accounts.find(function(a){ return a.id === safeId; });
    if(!target) return { ok:false, reason:'missing' };
    if(defaultIdCache === safeId) return { ok:false, reason:'default' };

    var prefixes = [
      'chat_',
      'greeting_idx_',
      'wb_enabled_',
      'wb_book_states_',
      'user_name_',
      'user_persona_',
      'user_avatar_'
    ];
    try{
      try{
        var chars = JSON.parse(localStorage.getItem('characters') || '[]');
        if(Array.isArray(chars)){
          var nextChars = chars.filter(function(c){ return !c || c.ownerAccountId !== safeId; });
          if(nextChars.length !== chars.length){
            localStorage.setItem('characters', JSON.stringify(nextChars));
          }
        }
      }catch(err){}
      for(var i=localStorage.length-1;i>=0;i--){
        var k = localStorage.key(i);
        if(!k) continue;
        if(k.indexOf('__acct_' + safeId) !== -1){ localStorage.removeItem(k); continue; }
        for(var j=0;j<prefixes.length;j++){
          if(k.indexOf(prefixes[j]) === 0 && k.indexOf(safeId) !== -1){ localStorage.removeItem(k); break; }
        }
      }
    }catch(e){}

    accounts = accounts.filter(function(a){ return a.id !== safeId; });
    saveAccounts(accounts);
    if(activeIdCache === safeId){
      persistActiveId(accounts[0].id);
    }
    return { ok:true };
  }

  function getDefaultId(){
    ensure();
    return defaultIdCache;
  }

  global.AccountManager = {
    ensure: ensure,
    hydrateFromStorage: hydrateFromStorage,
    loadAccounts: loadAccounts,
    saveAccounts: saveAccounts,
    getActive: getActive,
    updateActive: updateActive,
    setActive: setActive,
    setDefault: setDefault,
    createAccount: createAccount,
    deleteAccount: deleteAccount,
    scopedKey: scopedKey,
    addFavorite: addFavorite,
    addFriend: addFriend,
    removeFriend: removeFriend,
    isFriend: isFriend,
    getDefaultId: getDefaultId
  };

  setTimeout(function(){ scheduleHydrate(); }, 0);
})(window);
