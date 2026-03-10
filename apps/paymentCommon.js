;(function(){
  function ensureAccounts(){
    if(window.AccountManager && typeof window.AccountManager.ensure === 'function'){
      return window.AccountManager.ensure() || [];
    }
    return [];
  }

  function getActiveAccount(){
    if(window.AccountManager && typeof window.AccountManager.getActive === 'function'){
      return window.AccountManager.getActive() || null;
    }
    return null;
  }

  function paymentStoreKey(){
    return 'qq_payment_service_store';
  }

  function paymentQueueKey(){
    return 'qq_payment_service_queue';
  }

  function loadPaymentStore(){
    try{
      var raw = JSON.parse(localStorage.getItem(paymentStoreKey()) || '{}');
      var balances = raw && raw.balances && typeof raw.balances === 'object' ? raw.balances : {};
      var logs = Array.isArray(raw.logs) ? raw.logs : [];
      return { balances: balances, logs: logs };
    }catch(e){
      return { balances: {}, logs: [] };
    }
  }

  function savePaymentStore(store){
    var next = store || { balances: {}, logs: [] };
    next.balances = next.balances && typeof next.balances === 'object' ? next.balances : {};
    next.logs = Array.isArray(next.logs) ? next.logs : [];
    try{ localStorage.setItem(paymentStoreKey(), JSON.stringify(next)); }catch(e){}
  }

  function normalizeMoney(val){
    var num = Number(val || 0);
    if(!Number.isFinite(num)) num = 0;
    return Math.max(0, Math.round(num * 100) / 100);
  }

  function formatCny(val){
    return normalizeMoney(val).toFixed(2);
  }

  function ensureBalance(accountId){
    var store = loadPaymentStore();
    var key = String(accountId || '');
    if(!key) return 0;
    if(typeof store.balances[key] === 'undefined'){
      store.balances[key] = 0;
      savePaymentStore(store);
    }
    return normalizeMoney(store.balances[key]);
  }

  function getBalance(accountId){
    return ensureBalance(accountId);
  }

  function setBalance(accountId, amount){
    var key = String(accountId || '');
    if(!key) return 0;
    var store = loadPaymentStore();
    store.balances[key] = normalizeMoney(amount);
    savePaymentStore(store);
    return store.balances[key];
  }

  function changeBalance(accountId, delta){
    var current = getBalance(accountId);
    return setBalance(accountId, current + Number(delta || 0));
  }

  function accountName(accountId){
    var id = String(accountId || '');
    var accounts = ensureAccounts();
    var hit = accounts.find(function(acc){ return String((acc && acc.id) || '') === id; });
    return hit ? String(hit.name || '账户') : '账户';
  }

  function makeLog(partial){
    var data = partial || {};
    return {
      id: String(data.id || ('pay_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7))),
      accountId: String(data.accountId || ''),
      kind: String(data.kind || 'misc'),
      title: String(data.title || '支付记录'),
      amount: Number(data.amount || 0) || 0,
      status: String(data.status || 'done'),
      direction: String(data.direction || 'in'),
      targetId: String(data.targetId || ''),
      targetName: String(data.targetName || ''),
      note: String(data.note || ''),
      detail: String(data.detail || ''),
      createdAt: Number(data.createdAt || Date.now()) || Date.now(),
      meta: data.meta && typeof data.meta === 'object' ? data.meta : {}
    };
  }

  function appendLog(partial){
    var store = loadPaymentStore();
    var log = makeLog(partial);
    store.logs.unshift(log);
    savePaymentStore(store);
    return log;
  }

  function updateLog(logId, patch){
    var store = loadPaymentStore();
    var idx = store.logs.findIndex(function(item){ return String((item && item.id) || '') === String(logId || ''); });
    if(idx < 0) return null;
    store.logs[idx] = Object.assign({}, store.logs[idx], patch || {});
    savePaymentStore(store);
    return store.logs[idx];
  }

  function logsForAccount(accountId){
    var key = String(accountId || '');
    var store = loadPaymentStore();
    return store.logs.filter(function(item){ return String((item && item.accountId) || '') === key; });
  }

  function loadQueue(){
    try{
      var raw = JSON.parse(localStorage.getItem(paymentQueueKey()) || '[]');
      return Array.isArray(raw) ? raw : [];
    }catch(e){
      return [];
    }
  }

  function saveQueue(queue){
    try{ localStorage.setItem(paymentQueueKey(), JSON.stringify(Array.isArray(queue) ? queue : [])); }catch(e){}
  }

  function enqueueEvent(evt){
    var queue = loadQueue();
    var item = Object.assign({
      id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      createdAt: Date.now()
    }, evt || {});
    queue.push(item);
    saveQueue(queue);
    return item;
  }

  function popEventsForChar(charId){
    var key = String(charId || '');
    var queue = loadQueue();
    var hit = [];
    var rest = [];
    queue.forEach(function(item){
      if(String((item && item.charId) || '') === key) hit.push(item);
      else rest.push(item);
    });
    saveQueue(rest);
    return hit;
  }

  window.PaymentService = {
    ensureAccounts: ensureAccounts,
    getActiveAccount: getActiveAccount,
    loadStore: loadPaymentStore,
    saveStore: savePaymentStore,
    getBalance: getBalance,
    setBalance: setBalance,
    changeBalance: changeBalance,
    formatCny: formatCny,
    appendLog: appendLog,
    updateLog: updateLog,
    logsForAccount: logsForAccount,
    accountName: accountName,
    enqueueEvent: enqueueEvent,
    popEventsForChar: popEventsForChar
  };
})();
