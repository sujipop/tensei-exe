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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await api(req, env, url) } catch (e) { return J({ error: "server error" }, 500) }
    }
    return env.ASSETS.fetch(req);
  },
};
