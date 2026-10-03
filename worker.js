// NEON ARCADE API Server — chạy trên Cloudflare Workers + KV
// Tạo KV namespace rồi điền ID vào wrangler.jsonc (xem HD trong file đó).

const enc = new TextEncoder();
async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', enc.encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const K = {
  users: 'na:users',            // mảng tên user
  user: n => 'na:user:' + n,    // {name,pass,coins,hs,lastDaily,role}
  sess: t => 'na:sess:' + t,    // -> name
};
async function getUsers(env) { return (await env.KV.get(K.users, 'json')) || []; }
async function getUser(env, n) { return await env.KV.get(K.user(n), 'json'); }
async function putUser(env, u) { await env.KV.put(K.user(u.name), JSON.stringify(u)); }
async function seedAdmin(env) {
  const users = await getUsers(env);
  if (!users.includes('admin')) {
    users.push('admin');
    await env.KV.put(K.users, JSON.stringify(users));
    await putUser(env, { name: 'admin', pass: await sha256('admin:admin123'), coins: 9999, hs: {}, lastDaily: '', role: 'admin' });
  }
}
function pub(u) { return { name: u.name, coins: u.coins, hs: u.hs, role: u.role || 'member' }; }
async function me(request, env) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!t) return null;
  const name = await env.KV.get(K.sess(t));
  if (!name) return null;
  const u = await getUser(env, name);
  if (!u) return null;
  return { user: u, token: t };
}
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      // Frontend tĩnh NEON ARCADE (public/index.html + mini.js)
      return env.ASSETS.fetch(request);
    }
    await seedAdmin(env);
    const path = url.pathname.slice(4);

    if (path === '/health') return json({ ok: true, server: 'neon-arcade' });

    if (request.method === 'POST' && (path === '/register' || path === '/login')) {
      const { name, pass } = await request.json().catch(() => ({}));
      if (!name || name.length < 3 || !pass || pass.length < 4)
        return json({ error: 'Tên ≥3 ký tự, mật khẩu ≥4 ký tự!' }, 400);
      const users = await getUsers(env);
      if (path === '/register') {
        if (users.includes(name)) return json({ error: 'Tên này đã có người dùng!' }, 400);
        const u = { name, pass: await sha256(name + ':' + pass), coins: 100, hs: {}, lastDaily: '', role: 'member' };
        users.push(name);
        await env.KV.put(K.users, JSON.stringify(users));
        await putUser(env, u);
        const t = crypto.randomUUID();
        await env.KV.put(K.sess(t), name, { expirationTtl: 2592000 });
        return json({ token: t, user: pub(u) });
      } else {
        const u = await getUser(env, name);
        if (!u || u.pass !== await sha256(name + ':' + pass))
          return json({ error: 'Sai tên đăng nhập hoặc mật khẩu!' }, 401);
        const t = crypto.randomUUID();
        await env.KV.put(K.sess(t), name, { expirationTtl: 2592000 });
        return json({ token: t, user: pub(u) });
      }
    }

    const auth = await me(request, env);
    const u = auth?.user || null;
    if (!u) return json({ error: 'Chưa đăng nhập!' }, 401);

    if (path === '/me') return json({ user: pub(u) });
    if (path === '/logout' && request.method === 'POST') {
      if (auth.token) await env.KV.delete(K.sess(auth.token));
      return json({ ok: true });
    }
    if (path === '/spend' && request.method === 'POST') {
      const { amount } = await request.json().catch(() => ({}));
      const n = amount | 0;
      if (!n || n <= 0 || n > 100000) return json({ error: 'Số coin không hợp lệ!' }, 400);
      if (u.coins < n) return json({ error: 'Hết coin!', coins: u.coins }, 402);
      u.coins -= n; await putUser(env, u);
      return json({ coins: u.coins });
    }
    if (path === '/earn' && request.method === 'POST') {
      const { amount } = await request.json().catch(() => ({}));
      const n = Math.min(1000, Math.max(0, amount | 0)); // chặn hack coin: tối đa 1000/lần
      u.coins += n; await putUser(env, u);
      return json({ coins: u.coins });
    }
    if (path === '/daily' && request.method === 'POST') {
      const today = new Date().toISOString().slice(0, 10);
      if (u.lastDaily === today) return json({ error: 'Hôm nay đã nhận rồi!', coins: u.coins }, 400);
      u.lastDaily = today; u.coins += 50; await putUser(env, u);
      return json({ coins: u.coins });
    }
    if (path === '/hs' && request.method === 'POST') {
      const { game, score } = await request.json().catch(() => ({}));
      const s = score | 0;
      if (!game || typeof game !== 'string' || game.length > 32 || !s || s < 0 || s > 10000000)
        return json({ error: 'Điểm không hợp lệ!' }, 400);
      const old = u.hs[game] || 0;
      const isNew = s > old;
      if (isNew) { u.hs[game] = s; await putUser(env, u); }
      return json({ hs: Math.max(old, s), isNew });
    }
    if (path === '/board') {
      const users = await getUsers(env);
      const rows = [];
      for (const n of users.slice(0, 100)) {
        const x = await getUser(env, n);
        if (x) rows.push({ name: x.name, coins: x.coins, total: Object.values(x.hs).reduce((a, b) => a + b, 0) });
      }
      rows.sort((a, b) => b.total - a.total);
      return json({ board: rows.slice(0, 20) });
    }

    // ---- ADMIN ----
    if (path.startsWith('/admin/')) {
      if (u.role !== 'admin') return json({ error: 'Cần quyền ADMIN!' }, 403);
      const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
      if (path === '/admin/users') {
        const users = await getUsers(env);
        const rows = [];
        for (const n of users) { const x = await getUser(env, n); if (x) rows.push(pub(x)); }
        return json({ users: rows });
      }
      const t = await getUser(env, body.name);
      if (!t) return json({ error: 'Không tìm thấy user!' }, 404);
      if (path === '/admin/give') { t.coins += body.amount | 0; await putUser(env, t); return json({ coins: t.coins }); }
      if (path === '/admin/reset') {
        if (!body.pass || body.pass.length < 4) return json({ error: 'MK ≥4 ký tự!' }, 400);
        t.pass = await sha256(t.name + ':' + body.pass); await putUser(env, t); return json({ ok: true });
      }
      if (path === '/admin/role') { t.role = body.role === 'admin' ? 'admin' : 'member'; await putUser(env, t); return json({ ok: true }); }
      if (path === '/admin/delete') {
        if (t.name === 'admin') return json({ error: 'Không xóa admin gốc!' }, 400);
        await env.KV.delete(K.user(t.name));
        await env.KV.put(K.users, JSON.stringify((await getUsers(env)).filter(x => x !== t.name)));
        return json({ ok: true });
      }
    }
    return json({ error: 'API không tồn tại!' }, 404);
  }
};
