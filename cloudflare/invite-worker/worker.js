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
  body{margin:0;background:#f6f6f3;color:#111;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif}
  .page{max-width:980px;margin:0 auto;padding:34px 18px 48px}
  .hero{border:2px solid #111;background:#fff;padding:22px 20px 18px;box-shadow:8px 8px 0 #111}
  .kicker{font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:#555;font-weight:800}
  h1{margin:8px 0 6px;font-size:30px;line-height:1.05}
  .sub{margin:0;color:#555;line-height:1.6;font-size:14px}
  .panel{margin-top:20px;background:#fff;border:1.5px solid #111;padding:16px;box-shadow:5px 5px 0 rgba(0,0,0,.92)}
  .grid{display:grid;grid-template-columns:1.2fr 1fr auto;gap:10px;align-items:end}
  label{display:block;font-size:12px;color:#555;font-weight:800;margin-bottom:6px}
  input,select{width:100%;border:1.5px solid #111;background:#fff;color:#111;padding:11px 12px;font-size:15px;outline:none;border-radius:0}
  input:focus,select:focus{box-shadow:0 0 0 3px rgba(0,0,0,.12)}
  button{border:1.5px solid #111;background:#111;color:#fff;padding:11px 16px;font-weight:900;font-size:14px;cursor:pointer;box-shadow:3px 3px 0 rgba(0,0,0,.28);transition:transform .12s ease,box-shadow .12s ease}
  button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(0,0,0,.25)}
  button.secondary{background:#fff;color:#111}
  button.danger{background:#fff;color:#111;border-style:dashed}
  button:disabled{opacity:.45;cursor:not-allowed}
  .toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  .result{margin-top:14px;border:1.5px dashed #111;padding:14px;background:#fafafa;display:none}
  .code{font-family:"SF Mono",Menlo,Consolas,monospace;font-size:22px;font-weight:900;word-break:break-all}
  .meta{font-size:12px;color:#555;margin-top:8px;line-height:1.6}
  .list{display:grid;gap:12px;margin-top:14px}
  .card{border:1.5px solid #111;background:#fff;padding:14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}
  .card.revoked{opacity:.55}
  .card-code{font-family:"SF Mono",Menlo,Consolas,monospace;font-weight:900;font-size:16px;word-break:break-all}
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
<main class="page">
  <section class="hero">
    <div class="kicker">0615 invite console</div>
    <h1>欢迎管理 0615 小手机邀请码</h1>
    <p class="sub">管理员不需要进 Cloudflare 后台。输入口令后，一键生成不可猜的邀请码；每个码默认绑定两台设备，使用次数和最后使用时间会在这里显示。</p>
  </section>

  <section class="panel">
    <div class="grid">
      <div>
        <label for="adminToken">管理员口令</label>
        <input id="adminToken" type="password" autocomplete="current-password" placeholder="输入管理员口令">
      </div>
      <div>
        <label for="label">备注</label>
        <input id="label" placeholder="例如：小A发放 / 用户昵称">
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
    </div>
    <div class="result" id="result">
      <div class="code" id="newCode"></div>
      <div class="meta">已复制到剪贴板。把这个码发给用户即可。</div>
    </div>
  </section>

  <section class="panel">
    <div class="kicker">records</div>
    <div id="list" class="list"><div class="empty">输入管理员口令后点击刷新记录</div></div>
  </section>
</main>
<div class="toast" id="toast"></div>
<script>
const tokenEl = document.getElementById('adminToken');
const labelEl = document.getElementById('label');
const maxEl = document.getElementById('maxDevices');
const listEl = document.getElementById('list');
const resultEl = document.getElementById('result');
const newCodeEl = document.getElementById('newCode');
const toastEl = document.getElementById('toast');
const saved = localStorage.getItem('0615_admin_token') || '';
if(saved) tokenEl.value = saved;

function toast(text){
  toastEl.textContent = text;
  toastEl.style.display = 'block';
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(()=>toastEl.style.display = 'none', 2200);
}

function token(){
  const value = tokenEl.value.trim();
  if(value) localStorage.setItem('0615_admin_token', value);
  return value;
}

async function api(path, body){
  const res = await fetch(path, {
    method:'POST',
    headers:{ 'content-type':'application/json', 'x-admin-token': token() },
    body: JSON.stringify(body || {})
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

function render(rows){
  if(!rows.length){
    listEl.innerHTML = '<div class="empty">还没有邀请码</div>';
    return;
  }
  listEl.innerHTML = rows.map((row)=>\`
    <article class="card \${Number(row.revoked || 0) ? 'revoked' : ''}">
      <div>
        <div class="card-code">\${row.code}</div>
        <div class="card-label">\${row.label || '未备注'}</div>
        <div class="stats">
          <span class="pill">设备 \${row.deviceCount || 0}/\${row.maxDevices || 2}</span>
          <span class="pill">验证 \${row.verifyCount || 0}</span>
          <span class="pill">续期 \${row.sessionCount || 0}</span>
          <span class="pill">最后 \${fmtTime(row.lastSeen)}</span>
          \${Number(row.revoked || 0) ? '<span class="pill">已停用</span>' : ''}
        </div>
      </div>
      <div class="actions">
        <button class="secondary" data-copy="\${row.code}">复制</button>
        <button class="danger" data-reset="\${row.code}">清空设备</button>
        <button class="danger" data-toggle="\${row.code}" data-revoked="\${Number(row.revoked || 0)}">\${Number(row.revoked || 0) ? '启用' : '停用'}</button>
      </div>
    </article>
  \`).join('');
}

async function refresh(){
  listEl.innerHTML = '<div class="empty">读取中...</div>';
  try{
    const data = await api('/admin/list');
    render(data.codes || []);
  }catch(err){
    listEl.innerHTML = '<div class="empty">' + err.message + '</div>';
  }
}

document.getElementById('createBtn').addEventListener('click', async ()=>{
  try{
    const data = await api('/admin/create', { label: labelEl.value.trim(), maxDevices: Number(maxEl.value || 2) });
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
listEl.addEventListener('click', async (event)=>{
  const copy = event.target.getAttribute('data-copy');
  const reset = event.target.getAttribute('data-reset');
  const toggle = event.target.getAttribute('data-toggle');
  try{
    if(copy) return copyText(copy);
    if(reset){
      if(!confirm('确认清空这个邀请码已经绑定的设备吗？用户需要重新输入邀请码。')) return;
      await api('/admin/reset-devices', { code: reset });
      toast('设备已清空');
      return refresh();
    }
    if(toggle){
      const revoked = event.target.getAttribute('data-revoked') === '1';
      await api('/admin/revoke', { code: toggle, revoked: revoked ? 0 : 1 });
      toast(revoked ? '已启用' : '已停用');
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
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes).map((byte)=>alphabet[byte % alphabet.length]);
  return '0615-' + [
    chars.slice(0, 4).join(''),
    chars.slice(4, 8).join(''),
    chars.slice(8, 12).join(''),
    chars.slice(12, 16).join('')
  ].join('-');
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
  const result = await env.DB.prepare(
    `SELECT
      c.code,
      c.label,
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
     ORDER BY c.created_at DESC
     LIMIT 300`
  ).all();
  return json({ ok:true, codes:result.results || [] }, 200, env);
}

async function handleAdminCreate(request, env){
  const body = await readJson(request);
  const error = assertAdmin(request, env, body);
  if(error) return json({ ok:false, message:error }, 403, env);
  const label = String(body.label || '').trim().slice(0, 80);
  const maxDevices = Math.max(1, Math.min(6, Number(body.maxDevices || 2) || 2));
  const stamp = nowMs();
  let code = randomInviteCode();
  for(let i = 0; i < 6; i += 1){
    const exists = await env.DB.prepare('SELECT code FROM invite_codes WHERE code = ?').bind(code).first();
    if(!exists) break;
    code = randomInviteCode();
  }
  await env.DB.prepare(
    'INSERT INTO invite_codes (code, label, max_devices, revoked, expires_at, created_at, updated_at) VALUES (?, ?, ?, 0, NULL, ?, ?)'
  ).bind(code, label, maxDevices, stamp, stamp).run();
  return json({ ok:true, code, label, maxDevices }, 200, env);
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
  await env.DB.prepare('UPDATE invite_devices SET revoked = 1 WHERE code = ?').bind(code).run();
  await env.DB.prepare('UPDATE invite_codes SET updated_at = ? WHERE code = ?').bind(nowMs(), code).run();
  return json({ ok:true, code }, 200, env);
}

async function handleVerify(request, env){
  const body = await readJson(request);
  const meta = await requestMeta(request, env);
  const code = normalizeCode(body.code);
  const deviceHash = normalizeDeviceHash(body.deviceHash);
  if(!code) return reject(env, meta, code, deviceHash, 'verify', '邀请码不能为空', 400);
  if(!deviceHash) return reject(env, meta, code, deviceHash, 'verify', '设备信息无效', 400);

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
    if(url.pathname === '/verify') return handleVerify(request, env);
    if(url.pathname === '/session') return handleSession(request, env);
    if(url.pathname === '/admin/list') return handleAdminList(request, env);
    if(url.pathname === '/admin/create') return handleAdminCreate(request, env);
    if(url.pathname === '/admin/revoke') return handleAdminRevoke(request, env);
    if(url.pathname === '/admin/reset-devices') return handleAdminResetDevices(request, env);
    return json({ ok:false, message:'Not found' }, 404, env);
  }
};
