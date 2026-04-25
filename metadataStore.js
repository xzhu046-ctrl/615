(function(global){
  'use strict';

  var CHARACTERS_KEY = 'meta_characters_v1';
  var WORLDBOOKS_KEY = 'meta_worldbooks_v1';
  var listeners = [];
  var cache = {
    characters: null,
    worldbooks: null
  };
  var loaded = {
    characters: false,
    worldbooks: false
  };
  var pending = {
    characters: null,
    worldbooks: null
  };

  function cloneJson(value){
    try{
      return JSON.parse(JSON.stringify(value));
    }catch(err){
      return value;
    }
  }

  function safeParseJson(raw, fallback){
    try{
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    }catch(err){
      return fallback;
    }
  }

  function readLegacyCharacters(){
    var list = safeParseJson(global.localStorage.getItem('characters') || '[]', []);
    return Array.isArray(list) ? list : [];
  }

  function readLegacyWorldbooks(){
    var data = safeParseJson(global.localStorage.getItem('worldbooks') || '{}', {});
    return data && typeof data === 'object' ? data : {};
  }

  function mirrorLegacyKey(key, value){
    try{ global.localStorage.setItem(key, JSON.stringify(value)); }catch(err){}
  }

  function removeLegacyKey(key){
    // Keep legacy mirrors. Several older pages still read these keys
    // synchronously before IndexedDB hydration finishes.
    void key;
  }

  function notify(topic){
    listeners.slice().forEach(function(fn){
      try{ fn(topic); }catch(err){}
    });
    try{
      global.dispatchEvent(new CustomEvent('metadata-store-updated', { detail:{ topic: topic } }));
    }catch(err){}
  }

  function loadCharacters(force){
    var shouldForce = force === true;
    if(!shouldForce && loaded.characters && Array.isArray(cache.characters)) return Promise.resolve(cloneJson(cache.characters));
    if(!shouldForce && pending.characters) return pending.characters.then(cloneJson);
    var task = Promise.resolve()
      .then(function(){
        if(global.PhoneStorage && typeof global.PhoneStorage.getJson === 'function'){
          return global.PhoneStorage.getJson(CHARACTERS_KEY).catch(function(){ return null; });
        }
        return null;
      })
      .then(function(stored){
        var next = Array.isArray(stored) ? stored : readLegacyCharacters();
        cache.characters = Array.isArray(next) ? next : [];
        loaded.characters = true;
        if(cache.characters.length) mirrorLegacyKey('characters', cache.characters);
        if(!Array.isArray(stored) && cache.characters.length && global.PhoneStorage && typeof global.PhoneStorage.putJson === 'function'){
          global.PhoneStorage.putJson(CHARACTERS_KEY, cache.characters).then(function(){
            removeLegacyKey('characters');
          }).catch(function(){});
        }
        return cache.characters;
      });
    if(!shouldForce){
      pending.characters = task.finally(function(){
        pending.characters = null;
      });
      return pending.characters.then(cloneJson);
    }
    return task.then(cloneJson);
  }

  function loadWorldbooks(force){
    var shouldForce = force === true;
    if(!shouldForce && loaded.worldbooks && cache.worldbooks && typeof cache.worldbooks === 'object') return Promise.resolve(cloneJson(cache.worldbooks));
    if(!shouldForce && pending.worldbooks) return pending.worldbooks.then(cloneJson);
    var task = Promise.resolve()
      .then(function(){
        if(global.PhoneStorage && typeof global.PhoneStorage.getJson === 'function'){
          return global.PhoneStorage.getJson(WORLDBOOKS_KEY).catch(function(){ return null; });
        }
        return null;
      })
      .then(function(stored){
        var next = (stored && typeof stored === 'object') ? stored : readLegacyWorldbooks();
        cache.worldbooks = next && typeof next === 'object' ? next : {};
        loaded.worldbooks = true;
        if(Object.keys(cache.worldbooks).length) mirrorLegacyKey('worldbooks', cache.worldbooks);
        if((!stored || typeof stored !== 'object') && Object.keys(cache.worldbooks).length && global.PhoneStorage && typeof global.PhoneStorage.putJson === 'function'){
          global.PhoneStorage.putJson(WORLDBOOKS_KEY, cache.worldbooks).then(function(){
            removeLegacyKey('worldbooks');
          }).catch(function(){});
        }
        return cache.worldbooks;
      });
    if(!shouldForce){
      pending.worldbooks = task.finally(function(){
        pending.worldbooks = null;
      });
      return pending.worldbooks.then(cloneJson);
    }
    return task.then(cloneJson);
  }

  function saveCharacters(list){
    cache.characters = Array.isArray(list) ? cloneJson(list) : [];
    loaded.characters = true;
    mirrorLegacyKey('characters', cache.characters);
    if(global.PhoneStorage && typeof global.PhoneStorage.putJson === 'function'){
      return global.PhoneStorage.putJson(CHARACTERS_KEY, cache.characters).then(function(data){
        mirrorLegacyKey('characters', cache.characters);
        removeLegacyKey('characters');
        notify('characters');
        return cloneJson(data || cache.characters);
      });
    }
    try{ global.localStorage.setItem('characters', JSON.stringify(cache.characters)); }catch(err){}
    notify('characters');
    return Promise.resolve(cloneJson(cache.characters));
  }

  function saveWorldbooks(data){
    cache.worldbooks = (data && typeof data === 'object') ? cloneJson(data) : {};
    loaded.worldbooks = true;
    mirrorLegacyKey('worldbooks', cache.worldbooks);
    if(global.PhoneStorage && typeof global.PhoneStorage.putJson === 'function'){
      return global.PhoneStorage.putJson(WORLDBOOKS_KEY, cache.worldbooks).then(function(next){
        mirrorLegacyKey('worldbooks', cache.worldbooks);
        removeLegacyKey('worldbooks');
        notify('worldbooks');
        return cloneJson(next || cache.worldbooks);
      });
    }
    try{ global.localStorage.setItem('worldbooks', JSON.stringify(cache.worldbooks)); }catch(err){}
    notify('worldbooks');
    return Promise.resolve(cloneJson(cache.worldbooks));
  }

  function getCharactersSync(){
    if(loaded.characters && Array.isArray(cache.characters)) return cloneJson(cache.characters);
    var legacy = readLegacyCharacters();
    return cloneJson(Array.isArray(legacy) ? legacy : []);
  }

  function getWorldbooksSync(){
    if(loaded.worldbooks && cache.worldbooks && typeof cache.worldbooks === 'object') return cloneJson(cache.worldbooks);
    var legacy = readLegacyWorldbooks();
    return cloneJson(legacy && typeof legacy === 'object' ? legacy : {});
  }

  function init(){
    return Promise.all([loadCharacters(), loadWorldbooks()]);
  }

  function subscribe(fn){
    if(typeof fn !== 'function') return function(){};
    listeners.push(fn);
    return function(){
      var idx = listeners.indexOf(fn);
      if(idx >= 0) listeners.splice(idx, 1);
    };
  }

  global.MetadataStore = {
    init: init,
    loadCharacters: loadCharacters,
    loadWorldbooks: loadWorldbooks,
    reloadCharacters: function(){ return loadCharacters(true); },
    reloadWorldbooks: function(){ return loadWorldbooks(true); },
    saveCharacters: saveCharacters,
    saveWorldbooks: saveWorldbooks,
    getCharactersSync: getCharactersSync,
    getWorldbooksSync: getWorldbooksSync,
    subscribe: subscribe
  };
  init().catch(function(){});
})(window);
