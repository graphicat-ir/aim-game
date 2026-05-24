// functions/_middleware.js
export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  
  // اگر درخواست برای api/sync بود، پاسخ ساختگی بده
  if (url.pathname === "/api/sync") {
    return new Response(JSON.stringify({ status: "sync_ok" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
  
  // اگر هدر x-host وجود داشت، درخواست رو به اون آدرس هدایت کن (پراکسی)
  const upstreamOrigin = request.headers.get("x-host");
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
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: cleanHeaders(upstreamResponse.headers, false),
      });
    } catch (error) {
      return new Response("Proxy Error: " + error.message, { status: 502 });
    }
  }
  
  // بقیه درخواست‌ها (مثل فایل index.html) رو بده به سیستم assets
  return next();
}

// تابع کمکی برای پاک کردن هدرهای اضافی
function cleanHeaders(headers, isRequest) {
  const newHeaders = new Headers();
  const skip = new Set([
    "connection", "keep-alive", "cf-connecting-ip", "cf-ray", 
    "cf-request-id", "cf-worker", "x-host"
  ]);
  if (isRequest) skip.add("host");
  for (const [key, value] of headers.entries()) {
    if (!skip.has(key.toLowerCase())) {
      newHeaders.set(key, value);
    }
  }
  return newHeaders;
}
