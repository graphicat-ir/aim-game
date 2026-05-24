// worker.js - معادل کامل relay.js برای Cloudflare Workers
const HOP_BY_HOP = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding",
  "upgrade", "forwarded", "x-forwarded-host",
  "x-forwarded-proto", "x-forwarded-port",
]);

function buildUpstreamUrl(origin, pathname, search) {
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    return `${origin}${pathname}${search}`;
  }
  const secure = !origin.includes(":") || origin.includes(":443");
  return `${secure ? "https" : "http"}://${origin}${pathname}${search}`;
}

function forwardHeaders(incoming) {
  const out = new Headers();
  let clientIp = null;
  for (const [key, value] of incoming.entries()) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    if (lower.startsWith("x-nf-") || lower.startsWith("x-netlify-")) continue;
    if (lower === "x-host") continue;
    if (lower === "x-real-ip") { clientIp = value; continue; }
    if (lower === "x-forwarded-for") { if (!clientIp) clientIp = value; continue; }
    out.set(lower, value);
  }
  if (clientIp) out.set("x-forwarded-for", clientIp);
  return out;
}

function cleanResponseHeaders(headers) {
  const out = new Headers();
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() !== "transfer-encoding") out.set(key, value);
  }
  return out;
}

function landingPage() {
  // ... کل محتوای HTML بازی (همان چیزی که در relay.js بود) ...
  // برای خلاص شدن از طولانی شدن پاسخ، من اینجا کل HTML را نمی‌نویسم،
  // شما همان landingPage() را از فایل relay.js خودتان عیناً کپی کنید.
  // اگر می‌خواهید همین الان کار کنید، من کل HTML را در ادامه می‌آورم.
  return `<!doctype html>...`; // <--- کد کامل HTML بازی را از فایل قبلی خودتان اینجا بچسبانید
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const upstream = request.headers.get("x-host");

    if (url.pathname === "/api/sync") {
      return new Response(JSON.stringify({ status: "sync_ok" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (!upstream) {
      if (url.pathname === "/") {
        return new Response(landingPage(), {
          headers: { "content-type": "text/html; charset=UTF-8" }
        });
      }
      return new Response("Missing x-host header", { status: 400 });
    }

    try {
      const target = buildUpstreamUrl(upstream, url.pathname, url.search);
      const method = request.method;
      const upstreamRes = await fetch(target, {
        method,
        headers: forwardHeaders(request.headers),
        redirect: "manual",
        body: method !== "GET" && method !== "HEAD" ? request.body : undefined,
      });
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: cleanResponseHeaders(upstreamRes.headers),
      });
    } catch {
      return new Response("Bad Gateway", { status: 502 });
    }
  }
};
