(function(global){
  var ACCOUNTS_KEY = 'qq_accounts_v1';
  var ACTIVE_KEY = 'qq_active_account_id_v1';
  var DEFAULT_KEY = 'qq_default_account_id_v1';

  function uid(){
    return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  function loadAccounts(){
    try{
      var arr = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }

  function saveAccounts(accounts){
    try{
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts || []));
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

  function saveAccountsWithQuotaFallback(accounts, idx){
    if(saveAccounts(accounts)) return true;
    if(!Array.isArray(accounts) || idx < 0 || idx >= accounts.length) return false;
    var account = Object.assign({}, accounts[idx]);
    var favorites = Array.isArray(account.favorites) ? account.favorites.slice() : [];
    if(!favorites.length) return false;
    account.favorites = favorites.map(trimFavoriteForQuota);
    accounts[idx] = account;
    if(saveAccounts(accounts)) return true;
    while(account.favorites.length > 0){
      account.favorites.pop();
      accounts[idx] = account;
      if(saveAccounts(accounts)) return true;
    }
    return false;
  }

  function ensure(){
    var accounts = loadAccounts();
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
      saveAccounts(accounts);
      localStorage.setItem(ACTIVE_KEY, main.id);
      localStorage.setItem(DEFAULT_KEY, main.id);
    }

    var activeId = localStorage.getItem(ACTIVE_KEY);
    var defaultId = localStorage.getItem(DEFAULT_KEY);
    if(!activeId || !accounts.some(function(a){ return a.id === activeId; })){
      activeId = accounts[0].id;
      localStorage.setItem(ACTIVE_KEY, activeId);
    }
    if(!defaultId || !accounts.some(function(a){ return a.id === defaultId; })){
      var d = accounts.find(function(a){ return a.isDefault; }) || accounts[0];
      defaultId = d.id;
      localStorage.setItem(DEFAULT_KEY, defaultId);
    }

    var changed = false;
    accounts.forEach(function(a){
      var should = a.id === defaultId;
      if(!!a.isDefault !== should){ a.isDefault = should; changed = true; }
      if(!Array.isArray(a.friends)){ a.friends = []; changed = true; }
      if(!Array.isArray(a.favorites)){ a.favorites = []; changed = true; }
    });
    if(changed) saveAccounts(accounts);
    return accounts;
  }

  function getActive(){
    var accounts = ensure();
    var activeId = localStorage.getItem(ACTIVE_KEY);
    return accounts.find(function(a){ return a.id === activeId; }) || accounts[0];
  }

  function updateActive(mutator){
    var accounts = ensure();
    var activeId = localStorage.getItem(ACTIVE_KEY);
    var idx = accounts.findIndex(function(a){ return a.id === activeId; });
    if(idx < 0) idx = 0;
    var copy = Object.assign({}, accounts[idx]);
    mutator(copy);
    accounts[idx] = copy;
    saveAccountsWithQuotaFallback(accounts, idx);
    return copy;
  }

  function setActive(id){
    var accounts = ensure();
    if(!accounts.some(function(a){ return a.id === id; })) return false;
    localStorage.setItem(ACTIVE_KEY, id);
    return true;
  }

  function setDefault(id){
    var accounts = ensure();
    if(!accounts.some(function(a){ return a.id === id; })) return false;
    localStorage.setItem(DEFAULT_KEY, id);
    accounts = accounts.map(function(a){
      a = Object.assign({}, a);
      a.isDefault = a.id === id;
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
    localStorage.setItem(ACTIVE_KEY, acct.id);
    return acct;
  }

  function scopedKey(base, accountId){
    var id = accountId || getActive().id;
    return base + '__acct_' + id;
  }

  function addFavorite(entry){
    try{
      updateActive(function(acct){
        acct.favorites = Array.isArray(acct.favorites) ? acct.favorites : [];
        acct.favorites.unshift(entry);
        acct.favorites = acct.favorites.slice(0, 200);
      });
      return true;
    }catch(err){
      return false;
    }
  }

  function addFriend(charId){
    updateActive(function(acct){
      acct.friends = Array.isArray(acct.friends) ? acct.friends : [];
      if(acct.friends.indexOf(charId) === -1) acct.friends.push(charId);
    });
  }

  function isFriend(charId){
    var acct = getActive();
    if(acct.isDefault) return true;
    return Array.isArray(acct.friends) && acct.friends.indexOf(charId) !== -1;
  }

  function deleteAccount(id){
    var accounts = ensure();
    if(accounts.length <= 1) return { ok:false, reason:'need_one' };
    var target = accounts.find(function(a){ return a.id === id; });
    if(!target) return { ok:false, reason:'missing' };
    var defaultId = localStorage.getItem(DEFAULT_KEY);
    if(defaultId === id) return { ok:false, reason:'default' };

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
          var nextChars = chars.filter(function(c){ return !c || c.ownerAccountId !== id; });
          if(nextChars.length !== chars.length){
            localStorage.setItem('characters', JSON.stringify(nextChars));
          }
        }
      }catch(err){}
      for(var i=localStorage.length-1;i>=0;i--){
        var k = localStorage.key(i);
        if(!k) continue;
        if(k.indexOf('__acct_' + id) !== -1){ localStorage.removeItem(k); continue; }
        for(var j=0;j<prefixes.length;j++){
          if(k.indexOf(prefixes[j]) === 0 && k.indexOf(id) !== -1){ localStorage.removeItem(k); break; }
        }
      }
    }catch(e){}

    accounts = accounts.filter(function(a){ return a.id !== id; });
    saveAccounts(accounts);
    if(localStorage.getItem(ACTIVE_KEY) === id){
      localStorage.setItem(ACTIVE_KEY, accounts[0].id);
    }
    return { ok:true };
  }

  global.AccountManager = {
    ensure: ensure,
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
    isFriend: isFriend,
    getDefaultId: function(){ ensure(); return localStorage.getItem(DEFAULT_KEY); }
  };
})(window);
