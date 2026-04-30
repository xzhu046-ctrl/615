(function(){
  var DB_NAME = 'phone_asset_store';
  var STORE_NAME = 'assets';
  var MARKER = '__asset__';
  var dbPromise = null;

  function openDb(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      try{
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function(){
          var db = req.result;
          if(!db.objectStoreNames.contains(STORE_NAME)){
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ reject(req.error); };
      }catch(err){
        reject(err);
      }
    });
    return dbPromise;
  }

  function withStore(mode, runner){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, mode);
        var store = tx.objectStore(STORE_NAME);
        var request = runner(store);
        tx.oncomplete = function(){ resolve(request && request.result); };
        tx.onerror = function(){ reject(tx.error || (request && request.error)); };
        tx.onabort = function(){ reject(tx.error || new Error('asset transaction aborted')); };
      });
    });
  }

  function safeStorageGet(key){
    try{ return localStorage.getItem(key) || ''; }catch(err){ return ''; }
  }

  function safeStorageSet(key, value){
    try{ localStorage.setItem(key, value); }catch(err){}
  }

  function safeStorageRemove(key){
    try{ localStorage.removeItem(key); }catch(err){}
  }

  function looksLikeAsset(value){
    return typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http'));
  }

  window.assetStore = {
    marker: MARKER,

    get: function(key){
      return withStore('readonly', function(store){ return store.get(key); }).then(function(result){
        return result || '';
      }).catch(function(){
        return '';
      });
    },

    set: function(key, value){
      return withStore('readwrite', function(store){ return store.put(value, key); }).then(function(){
        safeStorageRemove(key);
        return value;
      }).catch(function(){
        var text = String(value || '');
        if(text && !looksLikeAsset(text) && text.length <= 4096) safeStorageSet(key, text);
        else safeStorageRemove(key);
        return value;
      });
    },

    remove: function(key){
      return withStore('readwrite', function(store){ return store.delete(key); }).catch(function(){}).then(function(){
        safeStorageRemove(key);
      });
    },

    clearAll: function(){
      return withStore('readwrite', function(store){ return store.clear(); }).catch(function(){}).then(function(){
        try{
          Object.keys(localStorage).forEach(function(key){
            if(localStorage.getItem(key) === MARKER) localStorage.removeItem(key);
          });
        }catch(err){}
      });
    },

    load: function(key){
      var legacy = safeStorageGet(key);
      if(looksLikeAsset(legacy)){
        this.set(key, legacy);
        return Promise.resolve(legacy);
      }
      if(legacy && legacy !== MARKER){
        return Promise.resolve(legacy);
      }
      return this.get(key).then(function(value){
        if(value) safeStorageRemove(key);
        return value || '';
      });
    },

    listAll: function(){
      return withStore('readonly', function(store){
        return new Promise(function(resolve, reject){
          var items = {};
          if(typeof store.openCursor !== 'function'){
            resolve(items);
            return;
          }
          var req = store.openCursor();
          req.onsuccess = function(event){
            var cursor = event.target.result;
            if(!cursor){
              resolve(items);
              return;
            }
            items[cursor.key] = cursor.value;
            cursor.continue();
          };
          req.onerror = function(event){
            reject((event.target && event.target.error) || new Error('asset list failed'));
          };
        });
      }).then(function(result){
        return result && typeof result.then === 'function' ? result : (result || {});
      }).catch(function(){
        return {};
      });
    },

    saveOrFallback: function(key, value){
      if(!value){
        return this.remove(key).then(function(){ return true; });
      }
      return this.set(key, value).then(function(){ return true; }).catch(function(){
        safeStorageRemove(key);
        return false;
      });
    }
  };
})();
