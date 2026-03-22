(() => {
  const USER_LOCATION_KEY = 'presence_user_location_v1';
  const CHAR_SETTINGS_PREFIX = 'presence_char_presence_';
  const DEFAULT_USER_CITY = 'edmonton';
  const DEFAULT_CHAR_CITY = 'beijing';

  const CITY_CATALOG = [
    { id:'edmonton', name:'Edmonton', country:'Canada', lat:53.5461, lng:-113.4938, tz:-6 },
    { id:'calgary', name:'Calgary', country:'Canada', lat:51.0447, lng:-114.0719, tz:-6 },
    { id:'vancouver', name:'Vancouver', country:'Canada', lat:49.2827, lng:-123.1207, tz:-8 },
    { id:'toronto', name:'Toronto', country:'Canada', lat:43.6532, lng:-79.3832, tz:-5 },
    { id:'montreal', name:'Montreal', country:'Canada', lat:45.5017, lng:-73.5673, tz:-5 },
    { id:'newyork', name:'New York', country:'USA', lat:40.7128, lng:-74.0060, tz:-5 },
    { id:'losangeles', name:'Los Angeles', country:'USA', lat:34.0522, lng:-118.2437, tz:-8 },
    { id:'sanfrancisco', name:'San Francisco', country:'USA', lat:37.7749, lng:-122.4194, tz:-8 },
    { id:'london', name:'London', country:'UK', lat:51.5072, lng:-0.1276, tz:0 },
    { id:'paris', name:'Paris', country:'France', lat:48.8566, lng:2.3522, tz:1 },
    { id:'tokyo', name:'Tokyo', country:'Japan', lat:35.6762, lng:139.6503, tz:9 },
    { id:'seoul', name:'Seoul', country:'Korea', lat:37.5665, lng:126.9780, tz:9 },
    { id:'beijing', name:'北京', country:'中国', lat:39.9042, lng:116.4074, tz:8 },
    { id:'shanghai', name:'上海', country:'中国', lat:31.2304, lng:121.4737, tz:8 },
    { id:'guangzhou', name:'广州', country:'中国', lat:23.1291, lng:113.2644, tz:8 },
    { id:'shenzhen', name:'深圳', country:'中国', lat:22.5431, lng:114.0579, tz:8 },
    { id:'chengdu', name:'成都', country:'中国', lat:30.5728, lng:104.0668, tz:8 },
    { id:'wuhan', name:'武汉', country:'中国', lat:30.5928, lng:114.3055, tz:8 },
    { id:'hangzhou', name:'杭州', country:'中国', lat:30.2741, lng:120.1551, tz:8 },
    { id:'nanjing', name:'南京', country:'中国', lat:32.0603, lng:118.7969, tz:8 }
  ];

  const CITY_LOOKUP = CITY_CATALOG.reduce((acc, city) => {
    acc[city.id] = city;
    return acc;
  }, {});

  function accountScopedKey(base){
    try{
      if(window.AccountManager){
        window.AccountManager.ensure();
        return window.AccountManager.scopedKey(base);
      }
    }catch(err){}
    return base;
  }

  function safeJsonParse(raw, fallback){
    try{
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    }catch(err){
      return fallback;
    }
  }

  function clamp(num, min, max){
    return Math.min(max, Math.max(min, num));
  }

  function getCity(cityId){
    return CITY_LOOKUP[String(cityId || '').trim()] || CITY_LOOKUP[DEFAULT_CHAR_CITY];
  }

  function listCities(){
    return CITY_CATALOG.slice();
  }

  function findNearestCatalogCity(lat, lng){
    var target = { lat:Number(lat), lng:Number(lng) };
    if(!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return getCity(DEFAULT_USER_CITY);
    var best = null;
    CITY_CATALOG.forEach(function(city){
      var dist = getDistanceKm(target, city);
      if(!best || dist < best.dist) best = { city: city, dist: dist };
    });
    return best && best.city ? best.city : getCity(DEFAULT_USER_CITY);
  }

  function inferProfile(character){
    const corpus = [
      character && character.name || '',
      character && character.nickname || '',
      character && character.description || '',
      character && character.personality || '',
      character && character.scenario || '',
      character && character.system_prompt || '',
      character && character.livePresenceWorldHint || '',
      character && character.livePresence && character.livePresence.worldHint || ''
    ].join('\n').toLowerCase();
    const score = {
      medical: 0,
      student: 0,
      artist: 0,
      freelance: 0,
      nightowl: 0,
      office: 0
    };
    function hit(profile, regex, weight){
      if(regex.test(corpus)) score[profile] += weight;
    }
    hit('medical', /医生|医院|护士|急诊|手术|medical|doctor|hospital|clinic|值班|门诊|病房/, 7);
    hit('student', /学生|大学|高中|教授|课堂|campus|student|school|college|研究生|本科|宿舍|社团|选修/, 5);
    hit('student', /图书馆|自习|考试周|复习|讲义|课表|学分|导师/, 3);
    hit('artist', /歌手|演员|艺人|乐队|演出|拍摄|studio|idol|artist|singer|actor|练习生|录音棚|片场|舞台/, 6);
    hit('freelance', /自由职业|作家|插画|博主|freelance|writer|designer|illustrator|撰稿|接稿|工作室/, 5);
    hit('nightowl', /夜猫子|熬夜|失眠|nocturnal|night owl|凌晨|通宵|昼夜颠倒/, 5);
    hit('office', /上班|工作|公司|开会|总裁|老板|秘书|助理|经理|总监|律师|法务|金融|白领|社畜|hr|ceo|office|meeting|company|corporate|firm|business/, 7);
    hit('office', /客户|项目|汇报|述职|应酬|打卡|写字楼|部门|同事|老板/, 4);
    if(score.office >= 7) score.student = Math.max(0, score.student - 4);
    if(score.medical >= 7) score.office = Math.max(0, score.office - 2);
    if(score.artist >= 6) score.office = Math.max(0, score.office - 2);
    var best = 'office';
    Object.keys(score).forEach(function(key){
      if(score[key] > score[best]) best = key;
    });
    if(score[best] <= 0) return 'office';
    if(best === 'student' && score.office >= score.student) return 'office';
    if(best === 'student' && /上班|公司|开会|总裁|社畜|客户|老板/.test(corpus)) return 'office';
    return best;
  }

  function getDefaultCharSettings(character){
    const profile = inferProfile(character);
    return {
      shareEnabled: true,
      autoReplyEnabled: true,
      cityId: DEFAULT_CHAR_CITY,
      schedule: profile,
      preciseShare: true,
      busyReply: '我现在在{place}，{activity}，晚一点再认真回你。',
      sleepReply: '我现在已经在休息了，醒了就来找你。',
      commuteReply: '我还在路上，等我到地方再回你。',
      freeReply: ''
    };
  }

  function getCharSettings(character){
    const charId = character && character.id ? String(character.id) : '';
    const defaults = getDefaultCharSettings(character);
    if(!charId) return Object.assign({}, defaults);
    const stored = safeJsonParse(localStorage.getItem(accountScopedKey(CHAR_SETTINGS_PREFIX + charId)) || '{}', {});
    const embedded = character && character.livePresence && typeof character.livePresence === 'object' ? character.livePresence : {};
    return Object.assign({}, defaults, embedded, stored);
  }

  function saveCharSettings(charId, next){
    if(!charId) return;
    localStorage.setItem(accountScopedKey(CHAR_SETTINGS_PREFIX + String(charId)), JSON.stringify(next || {}));
  }

  function getDefaultUserLocation(){
    const city = getCity(DEFAULT_USER_CITY);
    return {
      shareEnabled: true,
      mode: 'manual',
      cityId: city.id,
      label: city.name,
      lat: city.lat,
      lng: city.lng,
      updatedAt: Date.now(),
      accuracy: 0
    };
  }

  function weatherSettingsStorageKey(role, charId){
    var safeRole = role === 'user' ? 'user' : 'char';
    var safeCharId = String(charId || '').trim();
    if(safeRole === 'char'){
      return accountScopedKey('real_weather_char_' + safeCharId);
    }
    return accountScopedKey('real_weather_user_' + safeCharId);
  }

  function getWeatherConfiguredLocation(role, charId){
    try{
      var parsed = safeJsonParse(localStorage.getItem(weatherSettingsStorageKey(role, charId)) || 'null', null);
      if(!parsed) return null;
      var lat = Number(parsed.latitude);
      var lng = Number(parsed.longitude);
      if(!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      var displayName = String(parsed.aliasName || parsed.resolvedName || parsed.realName || '').trim();
      var nearest = findNearestCatalogCity(lat, lng);
      return {
        cityId: nearest.id,
        label: displayName || nearest.name,
        lat: lat,
        lng: lng,
        weatherName: String(parsed.resolvedName || parsed.realName || '').trim(),
        timezone: String(parsed.timezone || '').trim()
      };
    }catch(err){
      return null;
    }
  }

  function getUserLocation(){
    const defaults = getDefaultUserLocation();
    const stored = safeJsonParse(localStorage.getItem(accountScopedKey(USER_LOCATION_KEY)) || '{}', {});
    const merged = Object.assign({}, defaults, stored);
    if(merged.mode !== 'device'){
      const city = getCity(merged.cityId || DEFAULT_USER_CITY);
      merged.cityId = city.id;
      merged.label = merged.label || city.name;
      merged.lat = Number.isFinite(Number(merged.lat)) ? Number(merged.lat) : city.lat;
      merged.lng = Number.isFinite(Number(merged.lng)) ? Number(merged.lng) : city.lng;
    }
    return merged;
  }

  function saveUserLocation(next){
    localStorage.setItem(accountScopedKey(USER_LOCATION_KEY), JSON.stringify(next || {}));
  }

  function requestDeviceLocation(){
    return new Promise((resolve, reject) => {
      if(!(navigator && navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function')){
        reject(new Error('当前设备不支持定位'));
        return;
      }
      navigator.geolocation.getCurrentPosition((pos) => {
        var nearest = findNearestCatalogCity(pos.coords && pos.coords.latitude, pos.coords && pos.coords.longitude);
        resolve({
          shareEnabled: true,
          mode: 'device',
          cityId: nearest.id,
          label: nearest.name,
          lat: Number(pos.coords && pos.coords.latitude) || 0,
          lng: Number(pos.coords && pos.coords.longitude) || 0,
          updatedAt: Date.now(),
          accuracy: Number(pos.coords && pos.coords.accuracy) || 0
        });
      }, (err) => {
        reject(err || new Error('定位失败'));
      }, { enableHighAccuracy:true, timeout:10000, maximumAge:120000 });
    });
  }

  function getLocalParts(timezoneOffset, now){
    const shifted = new Date(Number(now || Date.now()) + Number(timezoneOffset || 0) * 3600000);
    return {
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      weekday: shifted.getUTCDay(),
      daySeed: shifted.getUTCFullYear() * 1000 + Math.ceil((Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - Date.UTC(shifted.getUTCFullYear(), 0, 0)) / 86400000)
    };
  }

  function seededRatio(seedStr){
    const str = String(seedStr || '');
    let h = 2166136261;
    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
  }

  function offsetPoint(city, eastKm, northKm){
    const lat = Number(city.lat);
    const lng = Number(city.lng);
    const deltaLat = northKm / 110.574;
    const deltaLng = eastKm / (111.320 * Math.cos((lat * Math.PI) / 180) || 1);
    return { lat: lat + deltaLat, lng: lng + deltaLng };
  }

  function segmentForProfile(profile, parts){
    const hour = parts.hour + parts.minute / 60;
    const weekend = parts.weekday === 0 || parts.weekday === 6;
    if(profile === 'student'){
      if(hour < 7.5) return { key:'sleep', place:'家里', activity:'还在睡觉', availability:'sleep', freeAt:8.4 };
      if(hour < 8.4) return { key:'commute', place:'路上', activity:'赶去学校', availability:'busy', freeAt:12.1 };
      if(hour < 12.1) return { key:'campus', place:'教学楼', activity:'正在上课', availability:'busy', freeAt:12.6 };
      if(hour < 13.2) return { key:'canteen', place:'食堂', activity:'在吃饭', availability:'limited', freeAt:13.4 };
      if(hour < 17.2) return { key:'library', place:'图书馆', activity:'在学习', availability:'busy', freeAt:18.1 };
      if(hour < 18.1) return { key:'commute', place:'路上', activity:'准备回去', availability:'busy', freeAt:19.0 };
      if(hour < 22.8) return { key: weekend ? 'hangout' : 'home', place: weekend ? '外面' : '宿舍', activity: weekend ? '在外面晃悠' : '在休息', availability:'available', freeAt:22.9 };
      return { key:'sleep', place:'床上', activity:'快睡着了', availability:'sleep', freeAt:8.6 };
    }
    if(profile === 'freelance'){
      if(hour < 8.8) return { key:'sleep', place:'家里', activity:'还在补觉', availability:'sleep', freeAt:9.5 };
      if(hour < 11.3) return { key:'home', place:'家里', activity:'在慢慢开工', availability:'limited', freeAt:12.3 };
      if(hour < 14.2) return { key:'cafe', place:'咖啡店', activity:'在工作', availability:'busy', freeAt:14.4 };
      if(hour < 17.4) return { key:'studio', place:'工作室', activity:'在忙自己的事情', availability:'busy', freeAt:18.2 };
      if(hour < 22.6) return { key: weekend ? 'hangout' : 'home', place: weekend ? '外面' : '家里', activity: weekend ? '在外面透气' : '在家放松', availability:'available', freeAt:22.7 };
      return { key:'night', place:'家里', activity:'在夜里磨时间', availability:'limited', freeAt:10.1 };
    }
    if(profile === 'artist'){
      if(hour < 9.8) return { key:'sleep', place:'家里', activity:'还没睡醒', availability:'sleep', freeAt:10.5 };
      if(hour < 12.3) return { key:'studio', place:'工作室', activity:'在练习', availability:'busy', freeAt:13.2 };
      if(hour < 14.2) return { key:'cafe', place:'外面', activity:'在吃饭', availability:'limited', freeAt:14.4 };
      if(hour < 18.6) return { key:'studio', place:'工作室', activity:'在排练', availability:'busy', freeAt:19.2 };
      if(hour < 22.5) return { key:'venue', place:'外面', activity:'在外面活动', availability:'limited', freeAt:23.1 };
      return { key:'night', place:'回家路上', activity:'刚散场', availability:'limited', freeAt:11.2 };
    }
    if(profile === 'medical'){
      if(hour < 6.8) return { key:'sleep', place:'家里', activity:'在休息', availability:'sleep', freeAt:7.2 };
      if(hour < 7.8) return { key:'commute', place:'路上', activity:'准备去医院', availability:'busy', freeAt:12.3 };
      if(hour < 12.3) return { key:'hospital', place:'医院', activity:'在忙工作', availability:'busy', freeAt:12.8 };
      if(hour < 13.1) return { key:'break', place:'医院附近', activity:'在短暂休息', availability:'limited', freeAt:13.4 };
      if(hour < 18.4) return { key:'hospital', place:'医院', activity:'还在值班', availability:'busy', freeAt:19.2 };
      if(hour < 19.2) return { key:'commute', place:'路上', activity:'刚下班', availability:'busy', freeAt:20.0 };
      if(hour < 22.8) return { key:'home', place:'家里', activity:'在休息', availability:'available', freeAt:22.9 };
      return { key:'sleep', place:'家里', activity:'已经睡了', availability:'sleep', freeAt:7.6 };
    }
    if(profile === 'nightowl'){
      if(hour < 4.2) return { key:'night', place:'家里', activity:'还醒着', availability:'limited', freeAt:13.0 };
      if(hour < 12.6) return { key:'sleep', place:'家里', activity:'在睡觉', availability:'sleep', freeAt:13.0 };
      if(hour < 15.1) return { key:'home', place:'家里', activity:'刚醒', availability:'limited', freeAt:15.6 };
      if(hour < 19.2) return { key:'cafe', place:'外面', activity:'在外面晃', availability:'available', freeAt:19.3 };
      if(hour < 23.6) return { key:'hangout', place:'外面', activity:'在外面待着', availability:'available', freeAt:23.7 };
      return { key:'night', place:'家里', activity:'夜里还很精神', availability:'limited', freeAt:13.1 };
    }
    if(weekend){
      if(hour < 9.5) return { key:'sleep', place:'家里', activity:'还在赖床', availability:'sleep', freeAt:10.4 };
      if(hour < 12.3) return { key:'brunch', place:'外面', activity:'在吃点东西', availability:'available', freeAt:12.4 };
      if(hour < 18.2) return { key:'hangout', place:'外面', activity:'在外面转', availability:'available', freeAt:18.3 };
      if(hour < 22.6) return { key:'home', place:'家里', activity:'在放松', availability:'available', freeAt:22.7 };
      return { key:'sleep', place:'家里', activity:'准备睡了', availability:'sleep', freeAt:10.4 };
    }
    if(hour < 6.4) return { key:'sleep', place:'家里', activity:'还在睡', availability:'sleep', freeAt:7.1 };
    if(hour < 7.3) return { key:'home', place:'家里', activity:'在准备出门', availability:'limited', freeAt:8.6 };
    if(hour < 8.6) return { key:'commute', place:'路上', activity:'在通勤', availability:'busy', freeAt:12.2 };
    if(hour < 12.2) return { key:'office', place:'公司', activity:'在上班', availability:'busy', freeAt:12.8 };
    if(hour < 13.2) return { key:'lunch', place:'公司附近', activity:'在吃饭', availability:'limited', freeAt:13.5 };
    if(hour < 18.1) return { key:'office', place:'公司', activity:'还在上班', availability:'busy', freeAt:18.8 };
    if(hour < 18.9) return { key:'commute', place:'路上', activity:'正在回去', availability:'busy', freeAt:19.4 };
    if(hour < 22.5) return { key:'home', place:'家里', activity:'在休息', availability:'available', freeAt:22.7 };
    return { key:'sleep', place:'家里', activity:'快睡着了', availability:'sleep', freeAt:7.2 };
  }

  function pointForSegment(city, segment, seed){
    const ratio = seededRatio(seed);
    const ratio2 = seededRatio(seed + ':b');
    switch(segment.key){
      case 'office': return offsetPoint(city, 4.5 + ratio * 3.2, 1.2 + ratio2 * 2.4);
      case 'campus': return offsetPoint(city, 3.1 + ratio * 2.2, 2.5 + ratio2 * 2.6);
      case 'library': return offsetPoint(city, 2.4 + ratio * 1.6, 1.8 + ratio2 * 2.1);
      case 'cafe': return offsetPoint(city, 1.1 + ratio * 1.4, -0.7 - ratio2 * 1.5);
      case 'studio': return offsetPoint(city, 2.2 + ratio * 2.5, -1.1 - ratio2 * 1.6);
      case 'hospital': return offsetPoint(city, 3.6 + ratio * 2.1, 1.4 + ratio2 * 1.7);
      case 'hangout': return offsetPoint(city, -1.8 - ratio * 3.8, 1.5 + ratio2 * 2.3);
      case 'venue': return offsetPoint(city, 1.5 + ratio * 4.2, -2.5 - ratio2 * 1.6);
      case 'canteen': return offsetPoint(city, 2.8 + ratio * 1.6, 2.4 + ratio2 * 1.0);
      case 'brunch': return offsetPoint(city, -0.6 - ratio * 1.9, 0.7 + ratio2 * 1.4);
      case 'lunch': return offsetPoint(city, 3.4 + ratio * 1.6, 0.8 + ratio2 * 0.8);
      case 'commute': return offsetPoint(city, 2.2 + ratio * 2.8, 0.3 + ratio2 * 1.4);
      case 'break': return offsetPoint(city, 3.1 + ratio * 1.0, 1.7 + ratio2 * 0.9);
      case 'night': return offsetPoint(city, -0.8 - ratio * 1.6, -0.2 - ratio2 * 1.1);
      case 'home':
      case 'sleep':
      default: return offsetPoint(city, -0.5 - ratio * 0.8, -0.3 - ratio2 * 0.9);
    }
  }

  function formatClockHour(floatHour){
    const normalized = ((Number(floatHour) || 0) + 24) % 24;
    const hour = Math.floor(normalized);
    const minute = Math.round((normalized - hour) * 60);
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  }

  function getCharPresence(character, now){
    const settings = getCharSettings(character);
    const charWeatherLoc = getWeatherConfiguredLocation('char', character && character.id);
    const city = charWeatherLoc ? findNearestCatalogCity(charWeatherLoc.lat, charWeatherLoc.lng) : getCity(settings.cityId || DEFAULT_CHAR_CITY);
    const parts = getLocalParts(city.tz, now);
    const profile = settings.schedule === 'auto' ? inferProfile(character) : String(settings.schedule || 'office');
    const segment = segmentForProfile(profile, parts);
    const point = charWeatherLoc
      ? { lat:Number(charWeatherLoc.lat), lng:Number(charWeatherLoc.lng) }
      : pointForSegment(city, segment, [character && character.id || '', parts.daySeed, segment.key].join(':'));
    return {
      settings,
      city,
      profile,
      availability: segment.availability,
      placeLabel: segment.place,
      activityLabel: segment.activity,
      localTimeLabel: formatClockHour(parts.hour + parts.minute / 60),
      freeAtLabel: formatClockHour(segment.freeAt),
      point,
      shareEnabled: settings.shareEnabled !== false,
      autoReplyEnabled: settings.autoReplyEnabled !== false
    };
  }

  function toRadians(value){
    return Number(value || 0) * Math.PI / 180;
  }

  function getDistanceKm(pointA, pointB){
    if(!pointA || !pointB) return 0;
    const lat1 = Number(pointA.lat);
    const lng1 = Number(pointA.lng);
    const lat2 = Number(pointB.lat);
    const lng2 = Number(pointB.lng);
    if(!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) return 0;
    const earthRadius = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng/2) * Math.sin(dLng/2);
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function formatDistanceKm(distanceKm){
    const dist = Math.max(0, Number(distanceKm) || 0);
    if(dist < 1) return (dist * 1000).toFixed(0) + ' 米';
    if(dist < 100) return dist.toFixed(1) + ' 公里';
    return Math.round(dist) + ' 公里';
  }

  function estimateTravel(pointA, pointB){
    const distanceKm = getDistanceKm(pointA, pointB);
    let mode = 'walk';
    let speed = 4.5;
    let bufferMin = 3;
    let label = '步行';
    if(distanceKm >= 2 && distanceKm < 18){
      mode = 'drive'; speed = 32; bufferMin = 8; label = '开车';
    }else if(distanceKm >= 18 && distanceKm < 180){
      mode = 'rail'; speed = 88; bufferMin = 18; label = '高铁 / 长途';
    }else if(distanceKm >= 180){
      mode = 'flight'; speed = 820; bufferMin = 180; label = '飞过来';
    }
    const totalMinutes = Math.max(1, Math.round(distanceKm / speed * 60 + bufferMin));
    return {
      distanceKm,
      mode,
      label,
      totalMinutes,
      text: label + '约 ' + formatDuration(totalMinutes)
    };
  }

  function formatDuration(totalMinutes){
    const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if(hours <= 0) return mins + ' 分钟';
    if(mins === 0) return hours + ' 小时';
    return hours + ' 小时 ' + mins + ' 分钟';
  }

  function buildAutoReply(character, presence){
    const settings = presence && presence.settings ? presence.settings : getCharSettings(character);
    const template = presence.availability === 'sleep'
      ? settings.sleepReply
      : presence.availability === 'busy'
        ? (presence.activityLabel.indexOf('路') !== -1 ? settings.commuteReply : settings.busyReply)
        : settings.freeReply;
    const source = String(template || '').trim();
    if(!source) return '';
    return source
      .replace(/\{place\}/g, String(presence.placeLabel || '外面'))
      .replace(/\{activity\}/g, String(presence.activityLabel || '在忙'))
      .replace(/\{freeAt\}/g, String(presence.freeAtLabel || '晚一点'));
  }

  function getPresenceSnapshot(character, now){
    const charId = character && character.id ? String(character.id) : '';
    const storedUser = getUserLocation();
    const weatherUserLoc = getWeatherConfiguredLocation('user', charId);
    const user = storedUser.mode === 'device'
      ? storedUser
      : Object.assign({}, storedUser, weatherUserLoc || {});
    const charPresence = getCharPresence(character, now);
    const userPoint = { lat:Number(user.lat), lng:Number(user.lng) };
    const charPoint = charPresence.point;
    const travel = estimateTravel(userPoint, charPoint);
    return {
      user,
      char: charPresence,
      travel,
      distanceLabel: formatDistanceKm(travel.distanceKm)
    };
  }

  function projectWorldPoint(point, width, height){
    const lng = clamp(Number(point && point.lng) || 0, -180, 180);
    const lat = clamp(Number(point && point.lat) || 0, -85, 85);
    return {
      x: ((lng + 180) / 360) * width,
      y: ((90 - lat) / 180) * height
    };
  }

  window.PresenceShared = {
    listCities,
    getCity,
    getUserLocation,
    saveUserLocation,
    requestDeviceLocation,
    getCharSettings,
    saveCharSettings,
    getCharPresence,
    getPresenceSnapshot,
    getDistanceKm,
    formatDistanceKm,
    estimateTravel,
    formatDuration,
    buildAutoReply,
    inferProfile,
    projectWorldPoint,
    accountScopedKey
  };
})();
