// این فایل جایگزین فایل‌های relay.js و netlify.toml می‌شود.

// تابع کمکی برای تمیز کردن هدرهای درخواست
function cleanHeaders(headers, isRequest = true) {
  const newHeaders = new Headers();
  for (const [key, value] of headers.entries()) {
    const lowerKey = key.toLowerCase();
    // حذف هدرهای Hop-by-hop و هدرهای خاص Cloudflare
    if (['connection', 'keep-alive', 'cf-connecting-ip', 'cf-ray', 'cf-request-id'].includes(lowerKey)) continue;
    if (lowerKey === 'host' && isRequest) continue; // هدر Host را بعداً خودمان می‌سازیم
    if (lowerKey === 'x-host') continue;
    newHeaders.set(key, value);
  }
  return newHeaders;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const upstreamOrigin = request.headers.get("x-host");

    // --- میزبانی فایل‌های استاتیک (مثل فایل اصلی بازی) ---
    // اینجا منطق اصلی بازی و فایل‌های استاتیک دیگر قرار می‌گیرد.
    if (url.pathname === "/" || url.pathname === "/index.html") {
      try {
        // تلاش می‌کنیم فایل index.html را از assets بیاوریم
        const staticAsset = await env.ASSETS.fetch(request);
        if (staticAsset.ok) return staticAsset;
      } catch (e) {
        // اگر فایل پیدا نشد، پیغام خطا می‌دهیم
        return new Response("Page Not Found", { status: 404 });
      }
    }

    // --- منطق API برای دریافت تله‌متری (Telemetry) ---
    if (url.pathname === "/api/sync") {
      // فقط یک پاسخ موفقیت‌آمیز برمی‌گردانیم تا خطایی در کنسول مرورگر نشان ندهد.
      return new Response(JSON.stringify({ status: "sync_ok" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    // --- منطق پراکسی (Proxy) داینامیک ---
    // اگر هدر x-host وجود داشت، درخواست را به آن سمت هدایت کن
    if (upstreamOrigin) {
      try {
        const targetUrl = `${upstreamOrigin}${url.pathname}${url.search}`;
        const newRequest = new Request(targetUrl, {
          method: request.method,
          headers: cleanHeaders(request.headers, true),
          body: request.body,
        });
        newRequest.headers.set('Host', new URL(targetUrl).host);

        const upstreamResponse = await fetch(newRequest);
        const responseHeaders = cleanHeaders(upstreamResponse.headers, false);
        
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: responseHeaders,
        });
      } catch (error) {
        return new Response("Proxy Error: " + error.message, { status: 502 });
      }
    }

    // اگر هیچکدام از شرایط بالا برقرار نبود، یک خطای عمومی برگردان
    return new Response("Not Found", { status: 404 });
  },
};