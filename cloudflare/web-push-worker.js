import webpush from 'web-push';

function json(data, init){
  return new Response(JSON.stringify(data), {
    status: (init && init.status) || 200,
    headers: Object.assign({ 'content-type':'application/json; charset=utf-8' }, (init && init.headers) || {})
  });
}

function corsHeaders(origin){
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

function subscriptionId(sub){
  return 'sub:' + String(sub && sub.endpoint || '').trim();
}

async function readJson(req){
  try{
    return await req.json();
  }catch(err){
    return {};
  }
}

async function saveSubscription(env, subscription){
  if(!env.PUSH_SUBSCRIPTIONS) throw new Error('Missing PUSH_SUBSCRIPTIONS KV binding');
  await env.PUSH_SUBSCRIPTIONS.put(subscriptionId(subscription), JSON.stringify(subscription));
}

async function deleteSubscription(env, subscription){
  if(!env.PUSH_SUBSCRIPTIONS) throw new Error('Missing PUSH_SUBSCRIPTIONS KV binding');
  await env.PUSH_SUBSCRIPTIONS.delete(subscriptionId(subscription));
}

async function listSubscriptions(env){
  if(!env.PUSH_SUBSCRIPTIONS) throw new Error('Missing PUSH_SUBSCRIPTIONS KV binding');
  var listed = await env.PUSH_SUBSCRIPTIONS.list({ prefix:'sub:' });
  var keys = Array.isArray(listed && listed.keys) ? listed.keys : [];
  var rows = await Promise.all(keys.map(async (item)=>{
    var raw = await env.PUSH_SUBSCRIPTIONS.get(item.name);
    if(!raw) return null;
    try{ return JSON.parse(raw); }catch(err){ return null; }
  }));
  return rows.filter(Boolean);
}

function configureVapid(env){
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
}

async function sendPushToSubscription(env, subscription, payload){
  configureVapid(env);
  return await webpush.sendNotification(subscription, JSON.stringify(payload));
}

export default {
  async fetch(request, env){
    var url = new URL(request.url);
    var headers = corsHeaders(request.headers.get('origin'));
    if(request.method === 'OPTIONS'){
      return new Response(null, { status:204, headers: headers });
    }

    if(url.pathname === '/subscribe' && request.method === 'POST'){
      var data = await readJson(request);
      var subscription = data && data.subscription;
      if(!subscription || !subscription.endpoint){
        return json({ ok:false, error:'missing subscription' }, { status:400, headers: headers });
      }
      await saveSubscription(env, subscription);
      return json({ ok:true }, { headers: headers });
    }

    if(url.pathname === '/unsubscribe' && request.method === 'POST'){
      var dataUnsub = await readJson(request);
      var subscriptionUnsub = dataUnsub && dataUnsub.subscription;
      if(subscriptionUnsub && subscriptionUnsub.endpoint){
        await deleteSubscription(env, subscriptionUnsub);
      }
      return json({ ok:true }, { headers: headers });
    }

    if(url.pathname === '/test' && request.method === 'POST'){
      var testData = await readJson(request);
      var sub = testData && testData.subscription;
      if(!sub || !sub.endpoint){
        return json({ ok:false, error:'missing subscription' }, { status:400, headers: headers });
      }
      await sendPushToSubscription(env, sub, {
        title: testData.title || '测试通知',
        body: testData.body || 'Web Push 正常工作中',
        icon: testData.icon || '',
        data: testData.data || {}
      });
      return json({ ok:true }, { headers: headers });
    }

    if(url.pathname === '/broadcast' && request.method === 'POST'){
      var body = await readJson(request);
      var all = await listSubscriptions(env);
      var payload = {
        title: body.title || 'Char 来找你了',
        body: body.body || '刚刚有新的动静',
        icon: body.icon || '',
        data: body.data || {}
      };
      var results = await Promise.all(all.map(async (sub)=>{
        try{
          await sendPushToSubscription(env, sub, payload);
          return { ok:true };
        }catch(err){
          return { ok:false, error:String(err && err.message || err) };
        }
      }));
      return json({ ok:true, total: all.length, results: results }, { headers: headers });
    }

    return json({ ok:true, service:'web-push-worker' }, { headers: headers });
  }
};
