(function(global){
  var SUNNY_ID = 'sunny_support';

  var SUNNY_CHARACTER = {
    id: SUNNY_ID,
    name: 'Sunny',
    nickname: 'Sunny小客服',
    avatar: '🐶',
    imageData: 'assets/小金毛Sunny.jpg',
    description: '专属贴心客服，会热情帮老板处理小手机里的各种问题。',
    personality: [
      '温柔、黏人、忠诚、护着你、可爱、专业、耐心、很会安慰人。',
      '会先安抚用户，再认真解决问题。',
      '偶尔自然说“汪”，但不会卖萌到影响理解。'
    ].join('\n'),
    scenario: 'Sunny 是这部小手机自带的系统客服，只负责帮助用户理解和使用手机功能。',
    system_prompt: [
      '你叫 Sunny，是一只很贴心的小金毛客服。',
      '你会称呼用户为“老板”。',
      '你很偏心老板，会先安抚，再解决问题。',
      '你是系统内置客服，不参与普通角色世界书、聊天设置、记忆系统。',
      '解释不清的事情要老实说“汪...Sunny不知道诶，去问老板吧！”，不要瞎编。'
    ].join('\n'),
    first_mes: '汪！ 我是你的小狗客服Sunny，有什么能帮到您么？',
    alternate_greetings: [
      '老板我在呢，汪。你想先看设置、API，还是哪个 app 的用法呀？',
      '别急别急，我陪你一起看，汪。你说一声想查什么就好。'
    ],
    msgMin: 1,
    msgMax: 4,
    isSunnySupport: true
  };

  var KNOWLEDGE = [
    {
      id: 'api',
      keywords: ['api', 'key', '模型', 'model', 'openai', 'claude', 'gemini', 'openrouter', '设置在哪', '接口'],
      text: '老板别急，我带你去 API 设置那里，汪。进去以后可以填 provider、key 和 model，填好就能开始聊天啦。',
      buttons: [{ label: '打开设置', action: 'open_app', app: 'settings' }]
    },
    {
      id: 'worldbook',
      keywords: ['世界书', 'worldbook', '词条', '条目'],
      text: '世界书在单独的 app 里，老板。你可以进去看每个角色的世界书文件夹，也能继续编辑条目，汪。',
      buttons: [{ label: '打开世界书', action: 'open_app', app: 'worldbook' }]
    },
    {
      id: 'contacts',
      keywords: ['角色', '通讯录', '联系人', '导入角色', '导入char', '角色卡'],
      text: '角色管理在通讯录，老板。导入角色卡、改头像、看详情，都是从那里进去的，汪。',
      buttons: [{ label: '打开通讯录', action: 'open_app', app: 'characters' }]
    },
    {
      id: 'chat',
      keywords: ['聊天设置', '人称', '字数', '聊天怎么用', '聊天'],
      text: '聊天页里可以改角色人设、开场白、消息条数、用户设定、世界书开关这些，老板。要不要我先送你进去看看，汪？',
      buttons: [{ label: '打开聊天', action: 'open_app', app: 'chat' }]
    },
    {
      id: 'moments',
      keywords: ['朋友圈', '动态', '说说', 'moments'],
      text: '朋友圈在 QQ 里的小图标那边，老板。发说说、看图文、评论互动都在那里，汪。',
      buttons: [{ label: '打开 QQ', action: 'open_app', app: 'qq' }]
    },
    {
      id: 'appearance',
      keywords: ['外观', '壁纸', '主题', '主页', '小组件', '自定义'],
      text: '老板想改外观的话，去外观 app 就好。壁纸、桌面视觉、很多壳层样式都在那里，汪。',
      buttons: [{ label: '打开外观', action: 'open_app', app: 'customize' }]
    },
    {
      id: 'format',
      keywords: ['格式化', '恢复出厂', '清空手机', '重置手机', '重置数据', '初始化手机'],
      text: '格式化手机在设置里，老板。进去以后能找到清空整部小手机数据的入口，这个会把聊天、世界书、资源和本地记录都清掉，所以按之前一定要想清楚，汪。',
      buttons: [{ label: '打开设置', action: 'open_app', app: 'settings' }]
    },
    {
      id: 'map',
      keywords: ['地图', '位置', 'app6', '定位'],
      text: '地图在 app6，老板。角色位置共享和一些生活状态联动会用到它，汪。',
      buttons: [{ label: '打开地图', action: 'open_app', app: 'map6' }]
    }
  ];

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(text){
    return String(text || '').trim().toLowerCase();
  }

  function isSunnyCharacter(character){
    return !!(character && String(character.id || '').trim() === SUNNY_ID);
  }

  function getCharacter(){
    return clone(SUNNY_CHARACTER);
  }

  function getPinnedPreview(){
    return {
      id: SUNNY_ID,
      name: SUNNY_CHARACTER.name,
      nickname: SUNNY_CHARACTER.nickname,
      avatar: SUNNY_CHARACTER.avatar,
      imageData: SUNNY_CHARACTER.imageData,
      description: SUNNY_CHARACTER.description,
      isSunnySupport: true
    };
  }

  function matchKnowledge(userText){
    var source = normalize(userText);
    if(!source) return null;
    var best = null;
    var bestScore = 0;
    KNOWLEDGE.forEach(function(entry){
      var score = 0;
      (entry.keywords || []).forEach(function(keyword){
        if(source.indexOf(normalize(keyword)) !== -1) score += 1;
      });
      if(score > bestScore){
        best = entry;
        bestScore = score;
      }
    });
    return bestScore > 0 ? clone(best) : null;
  }

  function wantsProfileBuilder(userText){
    var text = String(userText || '').trim();
    if(!text) return false;
    return /(生|做|写|捏|搞|整|配).*(user|用户|我自己|我).*(设定|人设|档案|资料)|((设定|人设|档案|资料).*(生|做|写|捏|搞|整))|帮我.*(搞|做|写|生成|捏).*(设定|人设|档案|资料)|能不能.*(做|写|生成|捏).*(设定|人设|档案|资料)|怎么.*(做|写|生成).*(user|用户|我).*(设定|人设)/i.test(text);
  }

  function yamlEscape(value){
    var text = String(value == null ? '' : value);
    if(!text) return '""';
    return '"' + text.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function buildUserProfileYaml(payload){
    var data = payload || {};
    var traits = Array.isArray(data.personalityTraits) ? data.personalityTraits.filter(Boolean) : [];
    var worldbookTitles = Array.isArray(data.worldbookTitles) ? data.worldbookTitles.filter(Boolean) : [];
    var details = String(data.appearance || '').split(/[，,\n、]/).map(function(part){
      return String(part || '').trim();
    }).filter(Boolean);
    if(!details.length && data.appearance) details = [String(data.appearance).trim()];
    var lines = [
      'character:',
      '  name: ' + yamlEscape(data.userName || '未命名 user'),
      '  nickname: ' + yamlEscape(data.userName || '未命名 user'),
      '  role: ' + yamlEscape((data.characterName || '目标角色') + ' 的聊天搭档'),
      '',
      'core_identity:',
      '  target_character: ' + yamlEscape(data.characterName || ''),
      '  opening_reference: ' + yamlEscape(data.openingLabel || ''),
      '  summary: >',
      '    ' + String(data.vibe || '这是 Sunny 帮老板整理的一份 user 人设。').replace(/\n+/g, '\n    '),
      '',
      'worldbook_links:'
    ];
    if(worldbookTitles.length){
      worldbookTitles.forEach(function(title){
        lines.push('  - ' + yamlEscape(title));
      });
    }else{
      lines.push('  - ""');
    }
    lines.push('');
    lines.push('identity:');
    lines.push('  name: ' + yamlEscape(data.userName || ''));
    lines.push('  age: ' + yamlEscape(data.userAge || ''));
    lines.push('  occupation: ' + yamlEscape(data.userOccupation || ''));
    lines.push('');
    lines.push('personality:');
    lines.push('  traits:');
    if(traits.length){
      traits.forEach(function(trait){
        lines.push('    - ' + yamlEscape(trait));
      });
    }else{
      lines.push('    - ""');
    }
    lines.push('  description: >');
    lines.push('    ' + String(data.relationshipHook || '和目标角色之间有明确的关系张力与互动空间。').replace(/\n+/g, '\n    '));
    lines.push('');
    lines.push('appearance:');
    lines.push('  overall: ' + yamlEscape(data.appearance || ''));
    lines.push('  details:');
    if(details.length){
      details.forEach(function(detail){
        lines.push('    - ' + yamlEscape(detail));
      });
    }else{
      lines.push('    - ""');
    }
    lines.push('');
    lines.push('relationship_hook: ' + yamlEscape(data.relationshipHook || ''));
    lines.push('vibe: ' + yamlEscape(data.vibe || ''));
    lines.push('notes: ' + yamlEscape(data.notes || ''));
    return lines.join('\n');
  }

  function defaultFallback(){
    return {
      text: '汪...Sunny不知道诶，去问老板吧！',
      buttons: []
    };
  }

  function getKnowledgeEntries(){
    return clone(KNOWLEDGE);
  }

  function getKnowledgeDigest(){
    return KNOWLEDGE.map(function(entry, idx){
      return [
        (idx + 1) + '. 主题：' + String(entry.id || ''),
        '关键词：' + (entry.keywords || []).join(' / '),
        '回答方向：' + String(entry.text || ''),
        '可跳转 app：' + ((entry.buttons && entry.buttons[0] && entry.buttons[0].app) || '无')
      ].join('\n');
    }).join('\n\n');
  }

  global.SunnySupport = {
    ID: SUNNY_ID,
    getCharacter: getCharacter,
    getPinnedPreview: getPinnedPreview,
    isSunnyCharacter: isSunnyCharacter,
    matchKnowledge: matchKnowledge,
    getKnowledgeEntries: getKnowledgeEntries,
    getKnowledgeDigest: getKnowledgeDigest,
    wantsProfileBuilder: wantsProfileBuilder,
    buildUserProfileYaml: buildUserProfileYaml,
    defaultFallback: defaultFallback
  };
})(window);
