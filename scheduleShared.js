(function(global){
  'use strict';

  var STORE_KEY = 'schedule_app_state_v1';
  var stateCache = null;

  function cloneJson(value){
    try{ return JSON.parse(JSON.stringify(value)); }catch(err){ return value; }
  }

  function safeParseJson(raw, fallback){
    try{
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    }catch(err){
      return fallback;
    }
  }

  function getAccountManager(){
    try{
      if(global.AccountManager) return global.AccountManager;
      if(global.parent && global.parent !== global && global.parent.AccountManager) return global.parent.AccountManager;
    }catch(err){}
    return null;
  }

  function getPhoneStorage(){
    try{
      if(global.PhoneStorage && typeof global.PhoneStorage.getJson === 'function') return global.PhoneStorage;
      if(global.parent && global.parent !== global && global.parent.PhoneStorage && typeof global.parent.PhoneStorage.getJson === 'function') return global.parent.PhoneStorage;
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

  function pad2(num){
    return String(Math.max(0, Number(num) || 0)).padStart(2, '0');
  }

  function toDateKey(date){
    var d = date instanceof Date ? date : new Date(date);
    if(Number.isNaN(d.getTime())) d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function toMonthKey(date){
    var d = date instanceof Date ? date : new Date(date);
    if(Number.isNaN(d.getTime())) d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  function normalizeTimeValue(value){
    var txt = String(value || '').trim();
    var match = txt.match(/^(\d{1,2})[:：](\d{1,2})$/);
    if(!match) return '';
    var hh = Math.max(0, Math.min(23, parseInt(match[1], 10) || 0));
    var mm = Math.max(0, Math.min(59, parseInt(match[2], 10) || 0));
    return pad2(hh) + ':' + pad2(mm);
  }

  function createId(prefix){
    return String(prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeComment(item){
    item = item && typeof item === 'object' ? item : {};
    return {
      id: String(item.id || createId('comment')),
      author: String(item.author || item.role || 'user').trim() || 'user',
      text: String(item.text || item.content || '').trim(),
      createdAt: Number(item.createdAt || Date.now()) || Date.now()
    };
  }

  function normalizeEvent(item){
    item = item && typeof item === 'object' ? item : {};
    return {
      id: String(item.id || createId('evt')),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : toDateKey(new Date()),
      start: normalizeTimeValue(item.start),
      end: normalizeTimeValue(item.end),
      title: String(item.title || '').trim(),
      note: String(item.note || '').trim(),
      location: String(item.location || '').trim(),
      type: String(item.type || 'event').trim() || 'event',
      visibleToChar: item.visibleToChar !== false,
      remindChar: !!item.remindChar,
      remindUser: !!item.remindUser,
      secret: !!item.secret,
      secretPassword: String(item.secretPassword || '').replace(/\D+/g, '').slice(0, 6),
      secretHint: String(item.secretHint || '').trim(),
      publicMask: String(item.publicMask || item.maskedTitle || '').trim(),
      source: String(item.source || 'user').trim() || 'user',
      comments: Array.isArray(item.comments) ? item.comments.map(normalizeComment).filter(function(comment){ return comment.text; }) : [],
      createdAt: Number(item.createdAt || Date.now()) || Date.now()
    };
  }

  function normalizeTodo(item){
    item = item && typeof item === 'object' ? item : {};
    return {
      id: String(item.id || createId('todo')),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : toDateKey(new Date()),
      text: String(item.text || '').trim(),
      note: String(item.note || '').trim(),
      done: !!item.done,
      remindEnabled: !!item.remindEnabled,
      remindAt: normalizeTimeValue(item.remindAt),
      remindedAt: Number(item.remindedAt || 0) || 0,
      remindedDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.remindedDate || '')) ? String(item.remindedDate) : '',
      visibleToChar: item.visibleToChar !== false,
      comments: Array.isArray(item.comments) ? item.comments.map(normalizeComment).filter(function(comment){ return comment.text; }) : [],
      createdAt: Number(item.createdAt || Date.now()) || Date.now()
    };
  }

  function normalizeCharTodo(item){
    item = item && typeof item === 'object' ? item : {};
    return {
      id: String(item.id || createId('chartodo')),
      text: String(item.text || item.title || '').trim(),
      note: String(item.note || '').trim(),
      done: !!item.done,
      comments: Array.isArray(item.comments) ? item.comments.map(normalizeComment).filter(function(comment){ return comment.text; }) : [],
      createdAt: Number(item.createdAt || Date.now()) || Date.now()
    };
  }

  function normalizeSpecialDate(item){
    item = item && typeof item === 'object' ? item : {};
    return {
      id: String(item.id || createId('special')),
      monthDay: /^\d{2}-\d{2}$/.test(String(item.monthDay || '')) ? String(item.monthDay) : '',
      yearDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.yearDate || '')) ? String(item.yearDate) : '',
      title: String(item.title || '').trim(),
      note: String(item.note || '').trim(),
      kind: String(item.kind || 'special').trim() || 'special',
      visibleToChar: item.visibleToChar !== false,
      remindChar: item.remindChar !== false,
      source: String(item.source || 'user').trim() || 'user'
    };
  }

  function normalizeTimelineItem(item){
    item = item && typeof item === 'object' ? item : {};
    return {
      id: String(item.id || createId('timeline')),
      start: normalizeTimeValue(item.start || item.time),
      end: normalizeTimeValue(item.end),
      title: String(item.title || '').trim(),
      note: String(item.note || '').trim(),
      kind: String(item.kind || 'char').trim() || 'char',
      secret: !!item.secret,
      secretPassword: String(item.secretPassword || '').replace(/\D+/g, '').slice(0, 6),
      secretHint: String(item.secretHint || '').trim(),
      publicMask: String(item.publicMask || item.maskedTitle || '').trim(),
      comments: Array.isArray(item.comments) ? item.comments.map(normalizeComment).filter(function(comment){ return comment.text; }) : []
    };
  }

  function normalizeCharDay(day, dateKey){
    day = day && typeof day === 'object' ? day : {};
    var timeline = Array.isArray(day.timeline) ? day.timeline.map(normalizeTimelineItem).filter(function(item){
      return !!(item.start || item.title || item.note);
    }) : [];
    timeline.sort(function(a, b){
      return String(a.start || '99:99').localeCompare(String(b.start || '99:99'));
    });
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(day.date || '')) ? String(day.date) : dateKey,
      diary: String(day.diary || '').trim(),
      calendarNote: String(day.calendarNote || '').trim(),
      comment: String(day.comment || '').trim(),
      timeline: timeline,
      todos: Array.isArray(day.todos || day.todoList) ? (day.todos || day.todoList).map(normalizeCharTodo).filter(function(item){ return item.text; }) : [],
      quoteDrafts: Array.isArray(day.quoteDrafts) ? day.quoteDrafts.map(function(item){
        item = item && typeof item === 'object' ? item : {};
        return {
          id: String(item.id || createId('quote')),
          title: String(item.title || '').trim(),
          excerpt: String(item.excerpt || '').trim(),
          reply: String(item.reply || '').trim(),
          sourceId: String(item.sourceId || '').trim(),
          sourceType: String(item.sourceType || '').trim()
        };
      }).filter(function(item){ return item.title || item.excerpt || item.reply; }) : [],
      generatedAt: Number(day.generatedAt || Date.now()) || Date.now()
    };
  }

  function defaultCharState(){
    return {
      monthKey: toMonthKey(new Date()),
      selectedDate: toDateKey(new Date()),
      events: [],
      todos: [],
      specialDates: [],
      charDays: {}
    };
  }

  function normalizeCharState(state){
    var next = defaultCharState();
    state = state && typeof state === 'object' ? state : {};
    next.monthKey = /^\d{4}-\d{2}$/.test(String(state.monthKey || '')) ? String(state.monthKey) : next.monthKey;
    next.selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(state.selectedDate || '')) ? String(state.selectedDate) : next.selectedDate;
    next.events = Array.isArray(state.events) ? state.events.map(normalizeEvent).filter(function(item){ return item.title; }) : [];
    next.todos = Array.isArray(state.todos) ? state.todos.map(normalizeTodo).filter(function(item){ return item.text; }) : [];
    next.specialDates = Array.isArray(state.specialDates) ? state.specialDates.map(normalizeSpecialDate).filter(function(item){ return item.title && (item.monthDay || item.yearDate); }) : [];
    next.charDays = {};
    if(state.charDays && typeof state.charDays === 'object'){
      Object.keys(state.charDays).forEach(function(key){
        if(!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
        next.charDays[key] = normalizeCharDay(state.charDays[key], key);
      });
    }
    return next;
  }

  function defaultState(){
    return {
      version: 1,
      globalTimeAwareness: true,
      lastViewedCharId: '',
      charOverrides: {},
      chars: {}
    };
  }

  function normalizeState(state){
    var next = defaultState();
    state = state && typeof state === 'object' ? state : {};
    next.version = 1;
    next.globalTimeAwareness = state.globalTimeAwareness !== false;
    next.lastViewedCharId = String(state.lastViewedCharId || '').trim();
    next.charOverrides = {};
    if(state.charOverrides && typeof state.charOverrides === 'object'){
      Object.keys(state.charOverrides).forEach(function(charId){
        var item = state.charOverrides[charId];
        if(!item || typeof item !== 'object') return;
        next.charOverrides[charId] = {
          timeAwarenessEnabled: item.timeAwarenessEnabled == null ? null : !!item.timeAwarenessEnabled,
          allowCalendarComments: item.allowCalendarComments !== false,
          allowChatQuotes: item.allowChatQuotes !== false
        };
      });
    }
    next.chars = {};
    if(state.chars && typeof state.chars === 'object'){
      Object.keys(state.chars).forEach(function(charId){
        next.chars[charId] = normalizeCharState(state.chars[charId]);
      });
    }
    return next;
  }

  function readLegacyState(){
    try{
      return normalizeState(safeParseJson(global.localStorage.getItem(getScopedStoreKey()) || 'null', null));
    }catch(err){
      return defaultState();
    }
  }

  function loadState(){
    var storage = getPhoneStorage();
    var key = getScopedStoreKey();
    if(storage && typeof storage.getJson === 'function'){
      return storage.getJson(key).catch(function(){ return null; }).then(function(stored){
        var next = normalizeState(stored || readLegacyState());
        stateCache = cloneJson(next);
        try{ global.localStorage.setItem(key, JSON.stringify(next)); }catch(err){}
        return cloneJson(next);
      });
    }
    var fallback = cloneJson(readLegacyState());
    stateCache = cloneJson(fallback);
    return Promise.resolve(fallback);
  }

  function readStateSync(){
    if(stateCache) return cloneJson(stateCache);
    var next = cloneJson(readLegacyState());
    stateCache = cloneJson(next);
    return next;
  }

  function saveState(state){
    var key = getScopedStoreKey();
    var next = normalizeState(state);
    stateCache = cloneJson(next);
    var storage = getPhoneStorage();
    if(storage && typeof storage.putJson === 'function'){
      return storage.putJson(key, next).then(function(saved){
        try{ global.localStorage.setItem(key, JSON.stringify(next)); }catch(err){}
        return cloneJson(saved || next);
      }).catch(function(){
        try{ global.localStorage.setItem(key, JSON.stringify(next)); }catch(err){}
        return cloneJson(next);
      });
    }
    try{ global.localStorage.setItem(key, JSON.stringify(next)); }catch(err){}
    return Promise.resolve(cloneJson(next));
  }

  function getCharState(state, charId){
    var safeCharId = String(charId || '').trim();
    var next = normalizeState(state);
    if(!safeCharId) return defaultCharState();
    if(!next.chars[safeCharId]) next.chars[safeCharId] = defaultCharState();
    return normalizeCharState(next.chars[safeCharId]);
  }

  function setCharState(state, charId, charState){
    var next = normalizeState(state);
    var safeCharId = String(charId || '').trim();
    if(!safeCharId) return next;
    next.chars[safeCharId] = normalizeCharState(charState);
    return next;
  }

  function getHolidayMap(year){
    var y = parseInt(year, 10) || new Date().getFullYear();
    var map = {};
    function push(monthDay, title, note){
      var key = y + '-' + monthDay;
      if(!map[key]) map[key] = [];
      map[key].push({ title:title, note:note || '', kind:'holiday', source:'system' });
    }
    push('01-01', 'New Year', '新年第一天');
    push('02-14', 'Valentine\'s Day', '情人节');
    push('03-08', 'Women\'s Day', '国际妇女节');
    push('04-01', 'April Fools', '愚人节');
    push('05-01', 'Labour Day', '劳动节');
    push('06-01', 'Children\'s Day', '儿童节');
    push('07-07', 'World Chocolate Day', '适合偷偷送点甜的');
    push('08-12', 'Youth Day', '国际青年日');
    push('09-01', 'Back to School', '开学季');
    push('10-31', 'Halloween', '万圣夜');
    push('11-11', 'Singles Day', '双十一');
    push('12-24', 'Christmas Eve', '平安夜');
    push('12-25', 'Christmas', '圣诞节');
    push('12-31', 'New Year\'s Eve', '跨年夜');
    return map;
  }

  function extractBirthday(text){
    var raw = String(text || '');
    if(!raw) return '';
    var kv = raw.match(/(?:birthday|birth\s*date|dob|born|生日|出生日期)\s*[:：=]\s*([^\n\r,;]+)/i);
    var candidate = kv && kv[1] ? kv[1].trim() : '';
    if(!candidate){
      var md = raw.match(/(?:(\d{1,2})[\/\-.月](\d{1,2})(?:日)?)/);
      candidate = md ? (pad2(md[1]) + '-' + pad2(md[2])) : '';
    }
    var monthDay = String(candidate || '').replace(/[年月]/g, '-').replace(/[日号]/g, '').replace(/\./g, '-').replace(/\//g, '-').trim();
    var parts = monthDay.split('-').filter(Boolean);
    if(parts.length >= 2){
      var mm = parseInt(parts[0], 10);
      var dd = parseInt(parts[1], 10);
      if(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31){
        return pad2(mm) + '-' + pad2(dd);
      }
    }
    return '';
  }

  function summarizeDayContext(state, charId, dateKey){
    var dayKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '')) ? String(dateKey) : toDateKey(new Date());
    var charState = getCharState(state, charId);
    var holidays = getHolidayMap(dayKey.slice(0, 4))[dayKey] || [];
    var specials = charState.specialDates.filter(function(item){
      return item.yearDate === dayKey || (item.monthDay && dayKey.slice(5) === item.monthDay);
    });
    return {
      date: dayKey,
      events: charState.events.filter(function(item){ return item.date === dayKey; }),
      todos: charState.todos.filter(function(item){ return item.date === dayKey; }),
      holidays: holidays.slice(),
      specialDates: specials.slice(),
      charDay: charState.charDays[dayKey] ? normalizeCharDay(charState.charDays[dayKey], dayKey) : null
    };
  }

  function timeToMinutes(value){
    var txt = normalizeTimeValue(value);
    if(!txt) return -1;
    var parts = txt.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }

  function isTimeAwarenessEnabled(state, charId){
    var next = normalizeState(state);
    var safeCharId = String(charId || '').trim();
    var globalEnabled = next.globalTimeAwareness !== false;
    if(!safeCharId) return globalEnabled;
    var override = next.charOverrides && next.charOverrides[safeCharId];
    if(!override || override.timeAwarenessEnabled == null) return globalEnabled;
    return override.timeAwarenessEnabled !== false;
  }

  function getLiveTimeContext(state, charId, nowDate){
    var now = nowDate instanceof Date ? nowDate : new Date(nowDate);
    if(Number.isNaN(now.getTime())) now = new Date();
    var dateKey = toDateKey(now);
    var ctx = summarizeDayContext(state, charId, dateKey);
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    var enabled = isTimeAwarenessEnabled(state, charId);

    function normalizeLiveItem(source, type){
      source = source && typeof source === 'object' ? source : {};
      var start = normalizeTimeValue(source.start || source.time);
      var end = normalizeTimeValue(source.end);
      var startMinutes = timeToMinutes(start);
      var endMinutes = timeToMinutes(end);
      if(startMinutes >= 0 && endMinutes < 0) endMinutes = startMinutes + 59;
      return {
        type: type,
        id: String(source.id || '').trim(),
        title: String(source.title || source.text || '').trim(),
        note: String(source.note || '').trim(),
        start: start,
        end: end,
        startMinutes: startMinutes,
        endMinutes: endMinutes,
        raw: cloneJson(source)
      };
    }

    var userItems = (ctx.events || [])
      .map(function(item){
        item = item && typeof item === 'object' ? item : {};
        if(item.visibleToChar === false){
          item = Object.assign({}, item, {
            title: String(item.publicMask || '这个时间段有安排').trim() || '这个时间段有安排',
            note: '具体内容没有公开'
          });
        }
        return normalizeLiveItem(item, 'user');
      })
      .filter(function(item){ return item.title; });
    var charItems = ((ctx.charDay && Array.isArray(ctx.charDay.timeline)) ? ctx.charDay.timeline : [])
      .map(function(item){ return normalizeLiveItem(item, 'char'); })
      .filter(function(item){ return item.title; });
    var allItems = userItems.concat(charItems).sort(function(a, b){
      var aa = a.startMinutes >= 0 ? a.startMinutes : 9999;
      var bb = b.startMinutes >= 0 ? b.startMinutes : 9999;
      if(aa !== bb) return aa - bb;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

    function findCurrent(items){
      return items.find(function(item){
        if(item.startMinutes < 0) return false;
        if(item.endMinutes >= item.startMinutes) return nowMinutes >= item.startMinutes && nowMinutes <= item.endMinutes;
        return nowMinutes >= item.startMinutes && nowMinutes <= item.startMinutes + 59;
      }) || null;
    }

    function findNext(items){
      return items.find(function(item){
        return item.startMinutes >= 0 && item.startMinutes > nowMinutes;
      }) || null;
    }

    return {
      enabled: enabled,
      dateKey: dateKey,
      nowTime: pad2(now.getHours()) + ':' + pad2(now.getMinutes()),
      currentUserItem: findCurrent(userItems),
      currentCharItem: findCurrent(charItems),
      nextUserItem: findNext(userItems),
      nextCharItem: findNext(charItems),
      allItems: allItems,
      hasItems: allItems.length > 0
    };
  }

  global.ScheduleShared = {
    STORE_KEY: STORE_KEY,
    getScopedStoreKey: getScopedStoreKey,
    loadState: loadState,
    readStateSync: readStateSync,
    saveState: saveState,
    normalizeState: normalizeState,
    getCharState: getCharState,
    setCharState: setCharState,
    normalizeEvent: normalizeEvent,
    normalizeTodo: normalizeTodo,
    normalizeSpecialDate: normalizeSpecialDate,
    normalizeCharDay: normalizeCharDay,
    getHolidayMap: getHolidayMap,
    summarizeDayContext: summarizeDayContext,
    getLiveTimeContext: getLiveTimeContext,
    isTimeAwarenessEnabled: isTimeAwarenessEnabled,
    extractBirthday: extractBirthday,
    toDateKey: toDateKey,
    toMonthKey: toMonthKey,
    createId: createId
  };
})(window);
