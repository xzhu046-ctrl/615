(function(global){
  'use strict';

  var DB_NAME = 'PhoneAppDB';
  var DB_VERSION = 1;
  var STORE_NAMES = ['chats', 'moneyStates', 'memorySummaries', 'innerVoices', 'callRecords', 'kv'];
  var dbPromise = null;
  var writeQueue = Promise.resolve();

  function supportsIndexedDb(){
    return !!(global && global.indexedDB);
  }

  function ensureDb(){
    if(!supportsIndexedDb()) return Promise.resolve(null);
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      var request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function(event){
        var db = event.target.result;
        STORE_NAMES.forEach(function(name){
          if(!db.objectStoreNames.contains(name)){
            db.createObjectStore(name, { keyPath: 'id' });
          }
        });
      };
      request.onsuccess = function(event){
        resolve(event.target.result);
      };
      request.onerror = function(event){
        reject(event.target.error || new Error('IndexedDB open failed'));
      };
    });
    return dbPromise;
  }

  function withStore(storeName, mode, handler){
    return ensureDb().then(function(db){
      if(!db) return null;
      return new Promise(function(resolve, reject){
        var tx = db.transaction(storeName, mode);
        var store = tx.objectStore(storeName);
        var result;
        tx.oncomplete = function(){ resolve(result); };
        tx.onerror = function(event){
          reject((event.target && event.target.error) || tx.error || new Error('IndexedDB transaction failed'));
        };
        tx.onabort = function(event){
          reject((event.target && event.target.error) || tx.error || new Error('IndexedDB transaction aborted'));
        };
        result = handler(store, tx);
      });
    });
  }

  function enqueueWrite(task){
    writeQueue = writeQueue.catch(function(){ return null; }).then(task);
    return writeQueue;
  }

  function get(storeName, id){
    if(!supportsIndexedDb()) return Promise.resolve(null);
    return withStore(storeName, 'readonly', function(store){
      return new Promise(function(resolve, reject){
        var req = store.get(id);
        req.onsuccess = function(){ resolve(req.result || null); };
        req.onerror = function(event){
          reject((event.target && event.target.error) || new Error('IndexedDB get failed'));
        };
      });
    }).then(function(result){
      return result && typeof result.then === 'function' ? result : result;
    });
  }

  function put(storeName, record){
    if(!supportsIndexedDb()) return Promise.resolve(record || null);
    return enqueueWrite(function(){
      return withStore(storeName, 'readwrite', function(store){
        return new Promise(function(resolve, reject){
          var req = store.put(record);
          req.onsuccess = function(){ resolve(record || null); };
          req.onerror = function(event){
            reject((event.target && event.target.error) || new Error('IndexedDB put failed'));
          };
        });
      }).then(function(result){
        return result && typeof result.then === 'function' ? result : result;
      });
    });
  }

  function remove(storeName, id){
    if(!supportsIndexedDb()) return Promise.resolve();
    return enqueueWrite(function(){
      return withStore(storeName, 'readwrite', function(store){
        return new Promise(function(resolve, reject){
          var req = store.delete(id);
          req.onsuccess = function(){ resolve(); };
          req.onerror = function(event){
            reject((event.target && event.target.error) || new Error('IndexedDB delete failed'));
          };
        });
      }).then(function(result){
        return result && typeof result.then === 'function' ? result : undefined;
      });
    });
  }

  function clearStore(storeName){
    if(!supportsIndexedDb()) return Promise.resolve();
    return enqueueWrite(function(){
      return withStore(storeName, 'readwrite', function(store){
        return new Promise(function(resolve, reject){
          var req = store.clear();
          req.onsuccess = function(){ resolve(); };
          req.onerror = function(event){
            reject((event.target && event.target.error) || new Error('IndexedDB clear failed'));
          };
        });
      }).then(function(result){
        return result && typeof result.then === 'function' ? result : undefined;
      });
    });
  }

  function list(storeName){
    if(!supportsIndexedDb()) return Promise.resolve([]);
    return withStore(storeName, 'readonly', function(store){
      return new Promise(function(resolve, reject){
        var req = typeof store.getAll === 'function' ? store.getAll() : store.openCursor();
        if(req && typeof req.onsuccess === 'undefined'){
          resolve([]);
          return;
        }
        if(typeof store.getAll === 'function'){
          req.onsuccess = function(){ resolve(Array.isArray(req.result) ? req.result : []); };
          req.onerror = function(event){
            reject((event.target && event.target.error) || new Error('IndexedDB list failed'));
          };
          return;
        }
        var results = [];
        req.onsuccess = function(event){
          var cursor = event.target.result;
          if(!cursor){
            resolve(results);
            return;
          }
          results.push(cursor.value);
          cursor.continue();
        };
        req.onerror = function(event){
          reject((event.target && event.target.error) || new Error('IndexedDB cursor failed'));
        };
      });
    }).then(function(result){
      return result && typeof result.then === 'function' ? result : result;
    });
  }

  function clearAll(){
    if(!supportsIndexedDb()) return Promise.resolve();
    return STORE_NAMES.reduce(function(chain, name){
      return chain.then(function(){ return clearStore(name); });
    }, Promise.resolve());
  }

  function deleteDatabase(){
    if(!supportsIndexedDb()) return Promise.resolve(false);
    return Promise.resolve()
      .then(function(){
        if(dbPromise){
          return dbPromise.catch(function(){ return null; }).then(function(db){
            if(db && typeof db.close === 'function') db.close();
          });
        }
      })
      .catch(function(){ return null; })
      .then(function(){
        dbPromise = null;
        return new Promise(function(resolve){
          var request = global.indexedDB.deleteDatabase(DB_NAME);
          request.onsuccess = function(){ resolve(true); };
          request.onerror = function(){ resolve(false); };
          request.onblocked = function(){ resolve(false); };
        });
      });
  }

  function requestPersistentStorage(){
    if(!(global.navigator && global.navigator.storage && typeof global.navigator.storage.persist === 'function')){
      return Promise.resolve(false);
    }
    return Promise.resolve()
      .then(function(){
        if(typeof global.navigator.storage.persisted === 'function'){
          return global.navigator.storage.persisted().then(function(isPersisted){
            if(isPersisted) return true;
            return global.navigator.storage.persist();
          });
        }
        return global.navigator.storage.persist();
      })
      .then(function(result){
        return !!result;
      })
      .catch(function(){
        return false;
      });
  }

  function getJson(id){
    return get('kv', id).then(function(record){
      return record && Object.prototype.hasOwnProperty.call(record, 'data') ? record.data : null;
    });
  }

  function putJson(id, data){
    return put('kv', {
      id: id,
      updatedAt: Date.now(),
      data: data
    }).then(function(record){
      return record ? record.data : null;
    });
  }

  function removeJson(id){
    return remove('kv', id);
  }

  global.PhoneStorage = {
    STORE_NAMES: STORE_NAMES.slice(),
    supportsIndexedDb: supportsIndexedDb,
    get: get,
    put: put,
    remove: remove,
    clearStore: clearStore,
    clearAll: clearAll,
    deleteDatabase: deleteDatabase,
    list: list,
    getJson: getJson,
    putJson: putJson,
    removeJson: removeJson,
    requestPersistentStorage: requestPersistentStorage
  };
})(window);
