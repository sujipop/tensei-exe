// TENSEI.EXE: serves the static site and a small likes/comments API (Cloudflare D1)
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const KEY = /^[a-z0-9-]{1,40}$/, DEV = /^[a-z0-9-]{8,64}$/;

async function hash(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s + "tensei"));
  return [...new Uint8Array(b)].slice(0, 8).map(x => x.toString(16).padStart(2, "0")).join("");
}
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

async function api(req, env, url) {
  const p = url.pathname;
  if (!env.DB) return J({ error: "no database" }, 503);

  if (req.method === "GET" && p === "/api/ep") {
    const k = url.searchParams.get("k") || "", d = url.searchParams.get("d") || "";
    if (!KEY.test(k)) return J({ error: "bad key" }, 400);
    const [n, mine, cm] = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) AS c FROM likes WHERE k=?").bind(k),
      env.DB.prepare("SELECT 1 AS x FROM likes WHERE k=? AND d=?").bind(k, DEV.test(d) ? d : "-"),
      env.DB.prepare("SELECT id,name,body,t FROM comments WHERE k=? ORDER BY id DESC LIMIT 60").bind(k),
    ]);
    return J({ likes: n.results[0].c, liked: mine.results.length > 0, comments: cm.results });
  }

  if (req.method === "POST" && p === "/api/like") {
    let b; try { b = await req.json() } catch { return J({ error: "bad json" }, 400) }
    if (!KEY.test(b.k || "") || !DEV.test(b.d || "")) return J({ error: "bad input" }, 400);
    if (b.on) await env.DB.prepare("INSERT OR IGNORE INTO likes (k,d,t) VALUES (?,?,?)").bind(b.k, b.d, Date.now()).run();
    else await env.DB.prepare("DELETE FROM likes WHERE k=? AND d=?").bind(b.k, b.d).run();
    const n = await env.DB.prepare("SELECT COUNT(*) AS c FROM likes WHERE k=?").bind(b.k).first();
    return J({ likes: n.c, liked: !!b.on });
  }

  if (req.method === "POST" && p === "/api/comment") {
    let b; try { b = await req.json() } catch { return J({ error: "bad json" }, 400) }
    if (b.website) return J({ ok: true }); // honeypot
    const name = clean(b.name, 24), body = clean(b.body, 400);
    if (!KEY.test(b.k || "")) return J({ error: "bad key" }, 400);
    if (!name || body.length < 2) return J({ error: "Add a name and a comment." }, 400);
    if (/https?:\/\/|www\./i.test(name + " " + body)) return J({ error: "Links are not allowed." }, 400);
    const ip = await hash(req.headers.get("cf-connecting-ip") || "x"), now = Date.now();
    const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM comments WHERE ip=? AND t>?").bind(ip, now - 60000).first();
    if (r.c >= 3) return J({ error: "Slow down, try again in a minute." }, 429);
    const res = await env.DB.prepare("INSERT INTO comments (k,name,body,t,ip) VALUES (?,?,?,?,?)").bind(b.k, name, body, now, ip).run();
    return J({ id: res.meta.last_row_id, name, body, t: now });
  }

  // moderation: DELETE /api/comment?id=123 with "Authorization: Bearer <ADMIN_TOKEN>" (only if ADMIN_TOKEN is set)
  if (req.method === "DELETE" && p === "/api/comment") {
    if (!env.ADMIN_TOKEN || req.headers.get("authorization") !== "Bearer " + env.ADMIN_TOKEN) return J({ error: "not found" }, 404);
    await env.DB.prepare("DELETE FROM comments WHERE id=?").bind(Number(url.searchParams.get("id")) || 0).run();
    return J({ ok: true });
  }
  return J({ error: "not found" }, 404);
}

/* ---------- video editor: ArtCraft pass-through + temporary clip hosting (KV, auto-deleted) ---------- */
const AC = "https://api.storyteller.ai";
const okKeys = new Map(); // hash(key) -> time it was confirmed valid (per isolate, never stored)
async function keyOk(auth) {
  if (!/^(Bearer |Key )?artcraft_api_[a-z0-9]{20,80}$/i.test(auth || "")) return false;
  const h = await hash(auth), t = okKeys.get(h);
  if (t && Date.now() - t < 600000) return true;
  const r = await fetch(AC + "/v1/omni_api/job_status/job/jinf_check", { headers: { authorization: auth } });
  if (r.status === 401 || r.status === 403) return false;
  okKeys.set(h, Date.now()); return true;
}
const CT = { mp4: "video/mp4", mov: "video/quicktime", png: "image/png", jpg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav" };
async function editorApi(req, env, url) {
  const p = url.pathname;
  // GET /api/clip/<id>.<ext>  public, so ArtCraft can fetch the clip
  let m = p.match(/^\/api\/clip\/([a-f0-9]{32})\.(mp4|mov|png|jpg|webp|mp3|wav)$/);
  if (m && (req.method === "GET" || req.method === "HEAD")) {
    if (!env.CLIPS) return J({ error: "no storage" }, 503);
    const v = await env.CLIPS.get(m[1], { type: "arrayBuffer" });
    if (!v) return new Response("not found", { status: 404 });
    return new Response(req.method === "HEAD" ? null : v, { headers: { "content-type": CT[m[2]], "content-length": String(v.byteLength), "cache-control": "public, max-age=3600", "access-control-allow-origin": "*", "x-robots-tag": "noindex" } });
  }
  const auth = req.headers.get("authorization") || "";
  // POST /api/clip?ext=mp4  body = file bytes, needs a valid ArtCraft key; kept 3 days
  if (p === "/api/clip" && req.method === "POST") {
    if (!env.CLIPS) return J({ error: "no storage" }, 503);
    const ext = url.searchParams.get("ext") || "mp4";
    if (!CT[ext]) return J({ error: "unsupported file type" }, 400);
    if (!(await keyOk(auth))) return J({ error: "ArtCraft key not accepted" }, 401);
    const len = Number(req.headers.get("content-length") || 0);
    if (len > 25 * 1024 * 1024) return J({ error: "File too big (max 25 MB). Trim it shorter." }, 413);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 25 * 1024 * 1024) return J({ error: "File empty or too big (max 25 MB)." }, 413);
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, "0")).join("");
    await env.CLIPS.put(id, buf, { expirationTtl: 3 * 86400 });
    return J({ url: url.origin + "/api/clip/" + id + "." + ext });
  }
  // /api/ac/v1/omni_api/...  forwards to ArtCraft with your key (key is not stored)
  if (p.startsWith("/api/ac/v1/omni_api/") || (req.method === "GET" && /^\/api\/ac\/v1\/media_files\/file\/m_[a-z0-9]{6,60}$/.test(p))) {
    const target = AC + p.slice(7) + url.search;
    const isUpload = /^\/api\/ac\/v1\/omni_api\/upload\/(video|image|audio)$/.test(p) && req.method === "POST";
    const h = { "content-type": isUpload ? (req.headers.get("content-type") || "") : "application/json", accept: "application/json" };
    if (auth) h.authorization = auth;
    const body = req.method === "GET" ? undefined : isUpload ? await req.arrayBuffer() : await req.text();
    const r = await fetch(target, { method: req.method, headers: h, body });
    return new Response(await r.text(), { status: r.status, headers: { "content-type": r.headers.get("content-type") || "application/json", "cache-control": "no-store" } });
  }
  // GET /api/media?u=<https url>  fetches a finished video so the page can trim/store it (needs a valid ArtCraft key)
  if (p === "/api/media" && req.method === "GET") {
    const u = url.searchParams.get("u") || "";
    let t; try { t = new URL(u) } catch { return J({ error: "bad url" }, 400) }
    if (t.protocol !== "https:") return J({ error: "https only" }, 400);
    if (!(await keyOk(auth))) return J({ error: "ArtCraft key not accepted" }, 401);
    const r = await fetch(t.toString(), { redirect: "follow" });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok) return J({ error: "source returned " + r.status }, 502);
    if (!/^(video|image|audio)\/|octet-stream/.test(ct)) return J({ error: "not a media file" }, 415);
    const n = Number(r.headers.get("content-length") || 0);
    if (n > 200 * 1024 * 1024) return J({ error: "file too big" }, 413);
    return new Response(r.body, { headers: { "content-type": ct, "cache-control": "no-store" } });
  }
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/clip") || url.pathname.startsWith("/api/ac/") || url.pathname === "/api/media") {
      try { const r = await editorApi(req, env, url); if (r) return r } catch (e) { return J({ error: "server error: " + String(e && e.message || e).slice(0, 200) }, 500) }
      return J({ error: "not found" }, 404);
    }
    if (url.pathname.startsWith("/api/")) {
      try { return await api(req, env, url) } catch (e) { return J({ error: "server error" }, 500) }
    }
    return env.ASSETS.fetch(req);
  },
};
