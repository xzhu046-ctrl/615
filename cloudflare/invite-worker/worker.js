const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8'
};

const ADMIN_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>0615 邀请码管理</title>
<style>
  *{box-sizing:border-box}
  html,body{width:100%;max-width:100%;overflow-x:hidden}
  body{margin:0;background:#f6f6f3;color:#111;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif}
  .page{width:100%;max-width:980px;margin:0 auto;padding:34px 18px 48px;overflow-x:hidden}
  .hero{border:2px solid #111;background:#fff;padding:22px 20px 18px;box-shadow:8px 8px 0 #111}
  .kicker{font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:#555;font-weight:800}
  h1{margin:8px 0 6px;font-size:30px;line-height:1.05}
  .sub{margin:0;color:#555;line-height:1.6;font-size:14px}
  .panel{margin-top:20px;background:#fff;border:1.5px solid #111;padding:16px;box-shadow:5px 5px 0 rgba(0,0,0,.92)}
  .admin-gate-shell{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:22px;background:linear-gradient(135deg,#fff 0%,#e9e9e9 42%,#111 42%,#111 44%,#f7f7f7 44%,#fff 100%)}
  .admin-gate-shell[hidden],.page[hidden]{display:none}
  .admin-gate-card{position:relative;width:min(420px,100%);min-height:390px;border:2px solid #111;background:#fff;padding:28px 24px 22px;box-shadow:8px 8px 0 #111,0 22px 70px rgba(0,0,0,.18);overflow:hidden}
  .admin-gate-card::before{content:"";position:absolute;inset:10px;border:2px dashed rgba(17,17,17,.42);pointer-events:none}
  .admin-gate-staff{position:absolute;left:34px;right:24px;top:28px;display:flex;flex-direction:column;gap:10px;opacity:.22;pointer-events:none}
  .admin-gate-staff span{height:2px;background:#111}
  .admin-gate-card h1{position:relative;margin:62px 0 0;display:flex;flex-direction:column;gap:4px;font-size:34px;line-height:1.08;text-decoration-line:underline;text-decoration-style:dashed;text-decoration-thickness:4px;text-underline-offset:8px}
  .admin-gate-copy{position:relative;margin:22px 0 0;color:#333;font-size:13px;line-height:1.75;font-weight:800}
  .admin-gate-form{position:relative;margin-top:24px;display:grid;gap:9px}
  .admin-gate-status{min-height:20px;font-size:12px;font-weight:800;color:#555}
  .admin-gate-status.error{color:#9b1111}
  .admin-gate-status.ok{color:#111}
  .grid{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}
  .search-row{margin-top:14px}
  label{display:block;font-size:12px;color:#555;font-weight:800;margin-bottom:6px}
  input,select{width:100%;border:1.5px solid #111;background:#fff;color:#111;padding:11px 12px;font-size:15px;outline:none;border-radius:0}
  input[readonly]{background:#f7f7f7;cursor:default;font-weight:900}
  input:focus,select:focus{box-shadow:0 0 0 3px rgba(0,0,0,.12)}
  button{border:1.5px solid #111;background:#111;color:#fff;padding:11px 16px;font-weight:900;font-size:14px;cursor:pointer;box-shadow:3px 3px 0 rgba(0,0,0,.28);transition:transform .12s ease,box-shadow .12s ease}
  button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(0,0,0,.25)}
  button.secondary{background:#fff;color:#111}
  button.danger{background:#fff;color:#111;border-style:dashed}
  button:disabled{opacity:.45;cursor:not-allowed}
  .toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  .result{margin-top:14px;border:1.5px dashed #111;padding:14px;background:#fafafa;display:none}
  .name-box{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;margin-bottom:10px}
  .public-name{font-weight:900;font-size:18px}
  .small-copy{padding:8px 10px;font-size:12px}
  .keep-tip{font-size:12px;color:#555;line-height:1.6;margin-top:8px}
  .code{font-family:"SF Mono",Menlo,Consolas,monospace;font-size:22px;font-weight:900;word-break:break-all}
  .meta{font-size:12px;color:#555;margin-top:8px;line-height:1.6}
  .list{display:grid;gap:12px;margin-top:14px}
  .card{border:1.5px solid #111;background:#fff;padding:14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}
  .card.revoked{opacity:.55}
  .card-code{font-family:"SF Mono",Menlo,Consolas,monospace;font-weight:900;font-size:16px;word-break:break-all}
  .card-name{display:inline-flex;border:1.5px solid #111;background:#fafafa;padding:6px 9px;font-weight:900;margin-bottom:8px;box-shadow:2px 2px 0 rgba(0,0,0,.16)}
  .card-label{font-weight:800;margin-top:5px}
  .stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .pill{border:1px solid #111;padding:4px 8px;font-size:12px;background:#f7f7f7}
  .actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
  .empty{border:1.5px dashed #111;padding:18px;text-align:center;color:#555;background:#fff}
  .toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 14px;font-size:13px;display:none;z-index:5}
  @media (max-width:720px){
    .grid{grid-template-columns:1fr}
    .card{grid-template-columns:1fr}
    .actions{justify-content:flex-start}
  }
</style>
</head>
<body>
<section class="admin-gate-shell" id="adminGate">
  <div class="admin-gate-card" role="dialog" aria-modal="true" aria-labelledby="adminGateTitle">
    <div class="admin-gate-staff" aria-hidden="true">
      <span></span><span></span><span></span><span></span><span></span>
    </div>
    <div class="kicker">0615 admin pass</div>
    <h1 id="adminGateTitle"><span>欢迎管理</span><span>0615小手机^^</span></h1>
    <p class="admin-gate-copy">请输入管理员口令进入邀请码后台。</p>
    <form class="admin-gate-form" id="adminGateForm">
      <label for="adminGateToken">ADMIN PASS</label>
      <input id="adminGateToken" type="text" autocomplete="off" placeholder="输入管理员口令">
      <button id="adminGateSubmit" type="submit">进入</button>
      <div class="admin-gate-status" id="adminGateStatus"></div>
    </form>
  </div>
</section>
<main class="page" id="adminPage" hidden>
  <section class="panel">
    <div class="grid">
      <div>
        <label for="label">用户名（必填）</label>
        <input id="label" placeholder="例如：呆呆的水星" required>
      </div>
      <div>
        <label for="maxDevices">设备数</label>
        <select id="maxDevices">
          <option value="2" selected>2 台</option>
          <option value="1">1 台</option>
          <option value="3">3 台</option>
        </select>
      </div>
    </div>
    <div class="toolbar">
      <button id="createBtn">生成邀请码</button>
      <button class="secondary" id="refreshBtn">刷新记录</button>
      <button class="danger" id="resetAllBtn">清空所有登录设备</button>
    </div>
    <div class="result" id="result">
      <div class="name-box">
        <div>
          <label for="newName">USERNAME</label>
          <input class="public-name" id="newName" type="text" readonly value="">
        </div>
        <button class="secondary small-copy" id="copyNameBtn" type="button">复制</button>
      </div>
      <div class="code" id="newCode"></div>
      <div class="meta">邀请码已复制到剪贴板。把这个码发给用户即可。</div>
      <div class="keep-tip">小提醒：请玩家记得保留 USERNAME，之后找码会更快。</div>
    </div>
  </section>

  <section class="panel">
    <div class="kicker">records</div>
    <div class="search-row">
      <label for="searchBox">搜索用户名 / USERNAME / 邀请码</label>
      <input id="searchBox" placeholder="输入用户名、USERNAME 或邀请码">
    </div>
    <div id="list" class="list"><div class="empty">输入管理员口令后点击刷新记录</div></div>
  </section>
</main>
<div class="toast" id="toast"></div>
<script>
const gateEl = document.getElementById('adminGate');
const pageEl = document.getElementById('adminPage');
const gateFormEl = document.getElementById('adminGateForm');
const gateTokenEl = document.getElementById('adminGateToken');
const gateSubmitEl = document.getElementById('adminGateSubmit');
const gateStatusEl = document.getElementById('adminGateStatus');
const labelEl = document.getElementById('label');
const maxEl = document.getElementById('maxDevices');
const listEl = document.getElementById('list');
const resultEl = document.getElementById('result');
const newCodeEl = document.getElementById('newCode');
const newNameEl = document.getElementById('newName');
const copyNameBtn = document.getElementById('copyNameBtn');
const searchEl = document.getElementById('searchBox');
const toastEl = document.getElementById('toast');
let allRows = [];
let latestPublicName = '';
let adminTokenValue = '';

function toast(text){
  toastEl.textContent = text;
  toastEl.style.display = 'block';
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(()=>toastEl.style.display = 'none', 2200);
}

function token(){
  return adminTokenValue.trim();
}

function setGateStatus(text, kind){
  gateStatusEl.textContent = text || '';
  gateStatusEl.classList.toggle('error', kind === 'error');
  gateStatusEl.classList.toggle('ok', kind === 'ok');
}

async function api(path, body){
  const payload = Object.assign({}, body || {}, { adminToken: token() });
  const url = path + (path.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
  const res = await fetch(url, {
    method:'POST',
    cache:'no-store',
    headers:{ 'content-type':'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(()=>({ ok:false, message:'返回格式错误' }));
  if(!res.ok || !data.ok) throw new Error(data.message || '请求失败');
  return data;
}

function fmtTime(value){
  const n = Number(value || 0);
  if(!n) return '从未';
  return new Date(n).toLocaleString('zh-CN', { hour12:false });
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast('已复制');
  }catch(err){
    toast('已生成，请手动复制');
  }
}

function escapeHtml(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch)=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[ch]));
}

function renderRows(rows){
  if(!rows.length){
    listEl.innerHTML = '<div class="empty">还没有邀请码</div>';
    return;
  }
  listEl.innerHTML = rows.map((row)=>\`
    <article class="card \${Number(row.revoked || 0) ? 'revoked' : ''}">
      <div>
        <div class="card-name">\${escapeHtml(row.publicName || '未命名的通行证')}</div>
        <div class="card-code">\${escapeHtml(row.code)}</div>
        <div class="card-label">\${escapeHtml(row.label || '未填写用户名')}</div>
        <div class="stats">
          <span class="pill">设备 \${row.deviceCount || 0}/\${row.maxDevices || 2}</span>
          <span class="pill">验证 \${row.verifyCount || 0}</span>
          <span class="pill">续期 \${row.sessionCount || 0}</span>
          <span class="pill">最后 \${fmtTime(row.lastSeen)}</span>
          \${Number(row.revoked || 0) ? '<span class="pill">已停用</span>' : ''}
        </div>
      </div>
      <div class="actions">
        <button class="secondary" data-copy-name="\${escapeHtml(row.publicName || '')}">复制 USERNAME</button>
        <button class="secondary" data-copy="\${escapeHtml(row.code)}">复制邀请码</button>
        <button class="danger" data-reset="\${escapeHtml(row.code)}">清空设备</button>
        <button class="danger" data-toggle="\${escapeHtml(row.code)}" data-revoked="\${Number(row.revoked || 0)}">\${Number(row.revoked || 0) ? '启用' : '停用'}</button>
        <button class="danger" data-delete="\${escapeHtml(row.code)}">删除</button>
      </div>
    </article>
  \`).join('');
}

function renderFiltered(){
  const q = String(searchEl.value || '').trim().toLowerCase();
  if(!q) return renderRows(allRows);
  renderRows(allRows.filter((row)=>{
    return String(row.code || '').toLowerCase().includes(q)
      || String(row.label || '').toLowerCase().includes(q)
      || String(row.publicName || '').toLowerCase().includes(q);
  }));
}

async function refresh(){
  listEl.innerHTML = '<div class="empty">读取中...</div>';
  try{
    const data = await api('/admin/list');
    allRows = data.codes || [];
    renderFiltered();
  }catch(err){
    listEl.innerHTML = '<div class="empty">' + err.message + '</div>';
  }
}

gateFormEl.addEventListener('submit', async (event)=>{
  event.preventDefault();
  const nextToken = gateTokenEl.value.trim();
  if(!nextToken){
    gateTokenEl.focus();
    setGateStatus('请输入管理员口令。', 'error');
    return;
  }
  adminTokenValue = nextToken;
  gateSubmitEl.disabled = true;
  setGateStatus('正在验证口令...', '');
  try{
    const data = await api('/admin/list');
    allRows = data.codes || [];
    renderFiltered();
    gateEl.hidden = true;
    pageEl.hidden = false;
    setGateStatus('验证成功。', 'ok');
  }catch(err){
    adminTokenValue = '';
    setGateStatus(err.message || '管理员口令不对', 'error');
  }finally{
    gateSubmitEl.disabled = false;
  }
});

document.getElementById('createBtn').addEventListener('click', async ()=>{
  try{
    const label = labelEl.value.trim();
    if(!label){
      labelEl.focus();
      toast('请先填写用户名');
      return;
    }
    const data = await api('/admin/create', { label, maxDevices: Number(maxEl.value || 2) });
    latestPublicName = data.publicName || '';
    newNameEl.value = latestPublicName;
    newCodeEl.textContent = data.code;
    resultEl.style.display = 'block';
    labelEl.value = '';
    await copyText(data.code);
    await refresh();
  }catch(err){
    toast(err.message);
  }
});

document.getElementById('refreshBtn').addEventListener('click', refresh);
searchEl.addEventListener('input', renderFiltered);
copyNameBtn.addEventListener('click', ()=>copyText(latestPublicName));
document.getElementById('resetAllBtn').addEventListener('click', async ()=>{
  try{
    if(!confirm('确认清空所有邀请码已经绑定的登录设备吗？\\n\\n邀请码会保留，所有用户需要重新输入邀请码登录。')) return;
    await api('/admin/reset-all-devices');
    toast('所有登录设备已清空');
    return refresh();
  }catch(err){
    toast(err.message);
  }
});
listEl.addEventListener('click', async (event)=>{
  const actionEl = event.target.closest('button[data-copy],button[data-copy-name],button[data-reset],button[data-toggle],button[data-delete]');
  if(!actionEl) return;
  const copy = actionEl.getAttribute('data-copy');
  const copyName = actionEl.getAttribute('data-copy-name');
  const reset = actionEl.getAttribute('data-reset');
  const toggle = actionEl.getAttribute('data-toggle');
  const remove = actionEl.getAttribute('data-delete');
  try{
    if(copy) return copyText(copy);
    if(copyName) return copyText(copyName);
    if(reset){
      if(!confirm('确认清空这个邀请码已经绑定的设备吗？用户需要重新输入邀请码。')) return;
      await api('/admin/reset-devices', { code: reset });
      toast('设备已清空');
      return refresh();
    }
    if(toggle){
      const revoked = actionEl.getAttribute('data-revoked') === '1';
      await api('/admin/revoke', { code: toggle, revoked: revoked ? 0 : 1 });
      toast(revoked ? '已启用' : '已停用');
      return refresh();
    }
    if(remove){
      if(!confirm('确认永久删除这个邀请码吗？\\n\\n邀请码、绑定设备和使用记录都会一起删除。')) return;
      await api('/admin/delete', { code: remove });
      toast('已删除');
      return refresh();
    }
  }catch(err){
    toast(err.message);
  }
});
</script>
</body>
</html>`;

function corsHeaders(env){
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-admin-token',
    'access-control-max-age': '86400'
  };
}

function html(body, status, env){
  return new Response(body, {
    status: status || 200,
    headers: Object.assign({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    }, corsHeaders(env || {}))
  });
}

function json(data, status, env){
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({}, JSON_HEADERS, corsHeaders(env || {}))
  });
}

function normalizeCode(value){
  return String(value || '').trim().toUpperCase();
}

function normalizeDeviceHash(value){
  return String(value || '').trim().toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 128);
}

function nowMs(){
  return Date.now();
}

function randomToken(){
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b)=>b.toString(16).padStart(2, '0')).join('');
}

function randomInviteCode(){
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes).map((byte)=>alphabet[byte % alphabet.length]);
  return '0615-' + [
    chars.slice(0, 4).join(''),
    chars.slice(4, 8).join(''),
    chars.slice(8, 12).join('')
  ].join('-');
}

const PUBLIC_NAME_ADJECTIVES = [
  '开心','难受','温柔','勇敢','发呆','闪亮','安静','热烈','迷路','清醒',
  '浪漫','倔强','圆滚滚','慢吞吞','亮晶晶','会唱歌','不睡觉','爱冒险','软乎乎','认真'
];
const PUBLIC_NAME_NOUNS = [
  '水母','小红','月亮','黑猫','云朵','鲸鱼','玫瑰','星星','橘子','小狗',
  '邮票','纸船','雨伞','贝壳','蝴蝶','玻璃糖','小煤球','蒲公英','小行星','胶片'
];

function randomPublicNameCandidate(){
  const adjBytes = new Uint8Array(1);
  const nounBytes = new Uint8Array(1);
  crypto.getRandomValues(adjBytes);
  crypto.getRandomValues(nounBytes);
  const adjective = PUBLIC_NAME_ADJECTIVES[adjBytes[0] % PUBLIC_NAME_ADJECTIVES.length];
  const noun = PUBLIC_NAME_NOUNS[nounBytes[0] % PUBLIC_NAME_NOUNS.length];
  return adjective + '的' + noun;
}

async function ensureAdminSchema(env){
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS invite_deleted_codes (code TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL)'
  ).run();
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS invite_code_names (code TEXT PRIMARY KEY, public_name TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)'
  ).run();
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_invite_code_names_public_name ON invite_code_names (public_name)'
  ).run();
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS invite_public_names (device_hash TEXT PRIMARY KEY, public_name TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL)'
  ).run();
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_invite_public_names_public_name ON invite_public_names (public_name)'
  ).run();
}

async function deletedCodeExists(env, code){
  try{
    const row = await env.DB.prepare('SELECT code FROM invite_deleted_codes WHERE code = ?').bind(code).first();
    return !!row;
  }catch(err){
    return false;
  }
}

async function randomPublicName(env){
  for(let i = 0; i < 80; i += 1){
    const candidate = randomPublicNameCandidate();
    const exists = await env.DB.prepare(
      `SELECT public_name FROM invite_code_names WHERE public_name = ?
       UNION ALL
       SELECT public_name FROM invite_public_names WHERE public_name = ?
       LIMIT 1`
    ).bind(candidate, candidate).first();
    if(!exists) return candidate;
  }
  return randomPublicNameCandidate() + '-' + Math.floor(1000 + Math.random() * 9000);
}

async function getStablePublicName(env, deviceHash){
  const safeHash = normalizeDeviceHash(deviceHash);
  if(!safeHash) return randomPublicName(env);
  const existing = await env.DB.prepare(
    'SELECT public_name AS publicName FROM invite_public_names WHERE device_hash = ?'
  ).bind(safeHash).first();
  if(existing && existing.publicName){
    await env.DB.prepare(
      'UPDATE invite_public_names SET last_seen = ? WHERE device_hash = ?'
    ).bind(nowMs(), safeHash).run();
    return existing.publicName;
  }
  const publicName = await randomPublicName(env);
  const stamp = nowMs();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO invite_public_names (device_hash, public_name, created_at, last_seen) VALUES (?, ?, ?, ?)'
  ).bind(safeHash, publicName, stamp, stamp).run();
  const saved = await env.DB.prepare(
    'SELECT public_name AS publicName FROM invite_public_names WHERE device_hash = ?'
  ).bind(safeHash).first();
  return saved && saved.publicName ? saved.publicName : publicName;
}

async function backfillMissingPublicNames(env){
  const rows = await env.DB.prepare(
    `SELECT c.code
     FROM invite_codes c
     LEFT JOIN invite_code_names n ON n.code = c.code
     WHERE n.code IS NULL
       AND NOT EXISTS (SELECT 1 FROM invite_deleted_codes x WHERE x.code = c.code)
     ORDER BY c.created_at DESC
     LIMIT 300`
  ).all();
  const missing = rows.results || [];
  for(const row of missing){
    const code = normalizeCode(row.code);
    if(!code) continue;
    try{
      const publicName = await randomPublicName(env);
      await env.DB.prepare(
        'INSERT OR IGNORE INTO invite_code_names (code, public_name, created_at) VALUES (?, ?, ?)'
      ).bind(code, publicName, nowMs()).run();
    }catch(err){}
  }
}

async function sha256Hex(value){
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}

async function requestMeta(request, env){
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';
  const salt = String(env.LOG_SALT || 'phone-invite').trim();
  return {
    ipHash: await sha256Hex(salt + '|ip|' + ip),
    uaHash: await sha256Hex(salt + '|ua|' + ua)
  };
}

async function readJson(request){
  try{
    return await request.json();
  }catch(err){
    return {};
  }
}

async function logAccess(env, row){
  try{
    await env.DB.prepare(
      'INSERT INTO invite_access_logs (code, device_hash, action, ok, reason, ip_hash, ua_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      row.code || '',
      row.deviceHash || '',
      row.action || '',
      row.ok ? 1 : 0,
      row.reason || '',
      row.ipHash || '',
      row.uaHash || '',
      nowMs()
    ).run();
  }catch(err){}
}

async function reject(env, meta, code, deviceHash, action, message, status){
  await logAccess(env, {
    code,
    deviceHash,
    action,
    ok: false,
    reason: message,
    ipHash: meta.ipHash,
    uaHash: meta.uaHash
  });
  return json({ ok:false, message }, status || 400, env);
}

function adminSecret(env){
  return String(env.ADMIN_TOKEN || '').trim();
}

function adminTokenFromRequest(request, body){
  return String(request.headers.get('x-admin-token') || body.adminToken || '').trim();
}

function assertAdmin(request, env, body){
  const expected = adminSecret(env);
  if(!expected) return '管理员口令还没有配置。请先在 Worker Variables 里设置 ADMIN_TOKEN。';
  if(adminTokenFromRequest(request, body || {}) !== expected) return '管理员口令不对';
  return '';
}

async function handleAdminList(request, env){
  const body = await readJson(request);
  const error = assertAdmin(request, env, body);
  if(error) return json({ ok:false, message:error }, 403, env);
  await ensureAdminSchema(env);
  await backfillMissingPublicNames(env);
  const result = await env.DB.prepare(
    `SELECT
      c.code,
      c.label,
      n.public_name AS publicName,
      c.max_devices AS maxDevices,
      c.revoked,
      c.expires_at AS expiresAt,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM invite_devices d WHERE d.code = c.code AND d.revoked = 0) AS deviceCount,
      (SELECT MAX(d.last_seen) FROM invite_devices d WHERE d.code = c.code) AS lastSeen,
      (SELECT COUNT(*) FROM invite_access_logs l WHERE l.code = c.code AND l.action = 'verify' AND l.ok = 1) AS verifyCount,
      (SELECT COUNT(*) FROM invite_access_logs l WHERE l.code = c.code AND l.action = 'session' AND l.ok = 1) AS sessionCount
     FROM invite_codes c
     LEFT JOIN invite_code_names n ON n.code = c.code
     WHERE NOT EXISTS (SELECT 1 FROM invite_deleted_codes x WHERE x.code = c.code)
     ORDER BY c.created_at DESC
     LIMIT 300`
  ).all();
  return json({ ok:true, codes:result.results || [] }, 200, env);
}

async function handlePublicName(request, env){
  const body = await readJson(request);
  await ensureAdminSchema(env);
  const publicName = await getStablePublicName(env, body.deviceHash);
  return json({ ok:true, publicName }, 200, env);
}

async function handleAdminCreate(request, env){
  const body = await readJson(request);
  const error = assertAdmin(request, env, body);
  if(error) return json({ ok:false, message:error }, 403, env);
  const label = String(body.label || '').trim().slice(0, 80);
  if(!label) return json({ ok:false, message:'请先填写用户名' }, 400, env);
  const maxDevices = Math.max(1, Math.min(6, Number(body.maxDevices || 2) || 2));
  const stamp = nowMs();
  await ensureAdminSchema(env);
  const publicName = await randomPublicName(env);
  let code = randomInviteCode();
  for(let i = 0; i < 20; i += 1){
    const exists = await env.DB.prepare('SELECT code FROM invite_codes WHERE code = ?').bind(code).first();
    const deleted = await deletedCodeExists(env, code);
    if(!exists && !deleted) break;
    code = randomInviteCode();
  }
  await env.DB.prepare(
    'INSERT INTO invite_codes (code, label, max_devices, revoked, expires_at, created_at, updated_at) VALUES (?, ?, ?, 0, NULL, ?, ?)'
  ).bind(code, label, maxDevices, stamp, stamp).run();
  await env.DB.prepare(
    'INSERT INTO invite_code_names (code, public_name, created_at) VALUES (?, ?, ?)'
  ).bind(code, publicName, stamp).run();
  return json({ ok:true, code, label, publicName, maxDevices }, 200, env);
}

async function handleAdminRevoke(request, env){
  const body = await readJson(request);
  const error = assertAdmin(request, env, body);
  if(error) return json({ ok:false, message:error }, 403, env);
  const code = normalizeCode(body.code);
  const revoked = Number(body.revoked || 0) ? 1 : 0;
  if(!code) return json({ ok:false, message:'邀请码不能为空' }, 400, env);
  await env.DB.prepare('UPDATE invite_codes SET revoked = ?, updated_at = ? WHERE code = ?').bind(revoked, nowMs(), code).run();
  return json({ ok:true, code, revoked }, 200, env);
}

async function handleAdminResetDevices(request, env){
  const body = await readJson(request);
  const error = assertAdmin(request, env, body);
  if(error) return json({ ok:false, message:error }, 403, env);
  const code = normalizeCode(body.code);
  if(!code) return json({ ok:false, message:'邀请码不能为空' }, 400, env);
  await env.DB.prepare('DELETE FROM invite_devices WHERE code = ?').bind(code).run();
  await env.DB.prepare('UPDATE invite_codes SET updated_at = ? WHERE code = ?').bind(nowMs(), code).run();
  return json({ ok:true, code }, 200, env);
}

async function handleAdminResetAllDevices(request, env){
  const body = await readJson(request);
  const error = assertAdmin(request, env, body);
  if(error) return json({ ok:false, message:error }, 403, env);
  await env.DB.prepare('DELETE FROM invite_devices').run();
  await env.DB.prepare('UPDATE invite_codes SET updated_at = ?').bind(nowMs()).run();
  return json({ ok:true }, 200, env);
}

async function handleAdminDelete(request, env){
  const body = await readJson(request);
  const error = assertAdmin(request, env, body);
  if(error) return json({ ok:false, message:error }, 403, env);
  const code = normalizeCode(body.code);
  if(!code) return json({ ok:false, message:'邀请码不能为空' }, 400, env);
  await ensureAdminSchema(env);
  await env.DB.prepare(
    'INSERT OR REPLACE INTO invite_deleted_codes (code, deleted_at) VALUES (?, ?)'
  ).bind(code, nowMs()).run();
  const existing = await env.DB.prepare('SELECT code FROM invite_codes WHERE code = ?').bind(code).first();
  if(!existing) return json({ ok:true, code, deleted:0 }, 200, env);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM invite_devices WHERE code = ?').bind(code),
    env.DB.prepare('DELETE FROM invite_access_logs WHERE code = ?').bind(code),
    env.DB.prepare('DELETE FROM invite_codes WHERE code = ?').bind(code)
  ]);
  const stillExists = await env.DB.prepare('SELECT code FROM invite_codes WHERE code = ?').bind(code).first();
  return json({ ok:true, code, deleted:1, hidden:Number(!!stillExists) }, 200, env);
}

async function handleVerify(request, env){
  const body = await readJson(request);
  const meta = await requestMeta(request, env);
  const code = normalizeCode(body.code);
  const deviceHash = normalizeDeviceHash(body.deviceHash);
  if(!code) return reject(env, meta, code, deviceHash, 'verify', '邀请码不能为空', 400);
  if(!deviceHash) return reject(env, meta, code, deviceHash, 'verify', '设备信息无效', 400);
  if(await deletedCodeExists(env, code)) return reject(env, meta, code, deviceHash, 'verify', '邀请码不存在', 404);

  const invite = await env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(code).first();
  if(!invite) return reject(env, meta, code, deviceHash, 'verify', '邀请码不存在', 404);
  if(Number(invite.revoked || 0)) return reject(env, meta, code, deviceHash, 'verify', '邀请码已停用', 403);
  if(invite.expires_at && Number(invite.expires_at) < nowMs()) return reject(env, meta, code, deviceHash, 'verify', '邀请码已过期', 403);

  const existing = await env.DB.prepare(
    'SELECT * FROM invite_devices WHERE code = ? AND device_hash = ? AND revoked = 0'
  ).bind(code, deviceHash).first();

  const token = randomToken();
  if(existing){
    await env.DB.prepare(
      'UPDATE invite_devices SET session_token = ?, last_seen = ?, last_ip_hash = ?, last_ua_hash = ? WHERE code = ? AND device_hash = ?'
    ).bind(token, nowMs(), meta.ipHash, meta.uaHash, code, deviceHash).run();
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM invite_devices WHERE code = ? AND revoked = 0'
    ).bind(code).first();
    const count = Number(countRow && countRow.count || 0);
    await logAccess(env, { code, deviceHash, action:'verify', ok:true, reason:'existing_device', ipHash:meta.ipHash, uaHash:meta.uaHash });
    return json({ ok:true, code, token, deviceCount:count, maxDevices:Number(invite.max_devices || 2) || 2 }, 200, env);
  }

  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM invite_devices WHERE code = ? AND revoked = 0'
  ).bind(code).first();
  const count = Number(countRow && countRow.count || 0);
  const maxDevices = Number(invite.max_devices || 2) || 2;
  if(count >= maxDevices){
    return reject(env, meta, code, deviceHash, 'verify', '这个邀请码已经绑定满 ' + maxDevices + ' 台设备，请联系作者重置。', 403);
  }

  await env.DB.prepare(
    'INSERT INTO invite_devices (code, device_hash, session_token, first_seen, last_seen, last_ip_hash, last_ua_hash, revoked) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
  ).bind(code, deviceHash, token, nowMs(), nowMs(), meta.ipHash, meta.uaHash).run();
  await env.DB.prepare('UPDATE invite_codes SET updated_at = ? WHERE code = ?').bind(nowMs(), code).run();
  await logAccess(env, { code, deviceHash, action:'verify', ok:true, reason:'new_device', ipHash:meta.ipHash, uaHash:meta.uaHash });
  return json({ ok:true, code, token, deviceCount:count + 1, maxDevices }, 200, env);
}

async function handleSession(request, env){
  const body = await readJson(request);
  const meta = await requestMeta(request, env);
  const code = normalizeCode(body.code);
  const token = String(body.token || '').trim();
  const deviceHash = normalizeDeviceHash(body.deviceHash);
  if(!code || !token || !deviceHash) return reject(env, meta, code, deviceHash, 'session', '通行凭证无效，请重新输入邀请码。', 401);
  if(await deletedCodeExists(env, code)) return reject(env, meta, code, deviceHash, 'session', '邀请码已失效，请联系作者。', 403);

  const invite = await env.DB.prepare('SELECT * FROM invite_codes WHERE code = ?').bind(code).first();
  if(!invite || Number(invite.revoked || 0)) return reject(env, meta, code, deviceHash, 'session', '邀请码已失效，请联系作者。', 403);

  const device = await env.DB.prepare(
    'SELECT * FROM invite_devices WHERE code = ? AND device_hash = ? AND session_token = ? AND revoked = 0'
  ).bind(code, deviceHash, token).first();
  if(!device) return reject(env, meta, code, deviceHash, 'session', '这台设备没有通行权，请重新验证邀请码。', 401);

  await env.DB.prepare(
    'UPDATE invite_devices SET last_seen = ?, last_ip_hash = ?, last_ua_hash = ? WHERE code = ? AND device_hash = ?'
  ).bind(nowMs(), meta.ipHash, meta.uaHash, code, deviceHash).run();
  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM invite_devices WHERE code = ? AND revoked = 0'
  ).bind(code).first();
  await logAccess(env, { code, deviceHash, action:'session', ok:true, reason:'ok', ipHash:meta.ipHash, uaHash:meta.uaHash });
  return json({
    ok:true,
    code,
    deviceCount:Number(countRow && countRow.count || 0),
    maxDevices:Number(invite.max_devices || 2) || 2
  }, 200, env);
}

export default {
  async fetch(request, env){
    if(request.method === 'OPTIONS'){
      return new Response(null, { status: 204, headers: corsHeaders(env || {}) });
    }
    const url = new URL(request.url);
    if(url.pathname === '/admin' && request.method === 'GET'){
      return html(ADMIN_HTML, 200, env);
    }
    if(request.method !== 'POST'){
      return json({ ok:false, message:'Only POST is supported' }, 405, env);
    }
    if(!env.DB){
      return json({ ok:false, message:'D1 DB binding is missing' }, 500, env);
    }
    if(url.pathname === '/public-name') return handlePublicName(request, env);
    if(url.pathname === '/verify') return handleVerify(request, env);
    if(url.pathname === '/session') return handleSession(request, env);
    if(url.pathname === '/admin/list') return handleAdminList(request, env);
    if(url.pathname === '/admin/create') return handleAdminCreate(request, env);
    if(url.pathname === '/admin/revoke') return handleAdminRevoke(request, env);
    if(url.pathname === '/admin/reset-devices') return handleAdminResetDevices(request, env);
    if(url.pathname === '/admin/reset-all-devices') return handleAdminResetAllDevices(request, env);
    if(url.pathname === '/admin/delete') return handleAdminDelete(request, env);
    return json({ ok:false, message:'Not found' }, 404, env);
  }
};
