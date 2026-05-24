// این فایل مستقیماً در ریشه پروژه قرار می‌گیرد: /_worker.js
// معادل کامل relay.js برای Cloudflare Pages

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

// کل صفحه HTML بازی (دقیقاً همانی که در relay.js بود)
function landingPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Aim Smasher PRO - Elite Challenge</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap');

    * {
      box-sizing: border-box; margin: 0; padding: 0;
      user-select: none; -webkit-user-select: none; touch-action: manipulation;
    }

    body {
      background-color: #0d0d1a; color: #fff;
      font-family: 'Montserrat', sans-serif;
      overflow: hidden; transition: background-color 0.1s;
    }

    body.miss-flash { background-color: #4a0000; }
    body.bomb-flash { background-color: #ffb703; }

    #game-container { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; overflow: hidden; }

    .shake { animation: screenShake 0.4s active; }
    @keyframes screenShake {
      0%, 100% { transform: translate(0, 0); }
      10%, 30%, 50%, 70%, 90% { transform: translate(-10px, 5px); }
      20%, 40%, 60%, 80% { transform: translate(10px, -5px); }
    }

    .hud {
      position: absolute; top: 20px; left: 0; width: 100%;
      display: flex; justify-content: space-between; padding: 0 30px;
      font-size: 26px; font-weight: 900; z-index: 10; pointer-events: none;
    }

    .time-box { color: #ff0055; text-shadow: 0 0 10px #ff0055; }
    .score-box { color: #00ffff; text-shadow: 0 0 10px #00ffff; }

    #taunt-text {
      position: absolute; top: 85px; width: 100%;
      font-size: 28px; font-weight: 900; color: #fff; text-align: center;
      pointer-events: none; z-index: 10; text-transform: uppercase;
    }

    @keyframes megaPunch {
      0% { transform: scale(0.3) rotate(-15deg); opacity: 0; filter: blur(5px); }
      50% { transform: scale(1.4) rotate(10deg); color: #ff0055; text-shadow: 0 0 30px #ff0055; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; text-shadow: 0 0 15px #00ffff; }
    }

    #target-box {
      width: 110px; height: 110px;
      background: linear-gradient(135deg, #7b2cbf, #3a0ca3);
      border: 4px solid #00ffff; border-radius: 20px; box-shadow: 0 0 25px #00ffff;
      display: flex; align-items: center; justify-content: center;
      font-size: 50px; cursor: pointer; position: absolute; z-index: 5; transition: width 0.2s, height 0.2s;
    }

    #bomb-box {
      width: 95px; height: 95px;
      background: linear-gradient(135deg, #d90429, #ef233c);
      border: 4px solid #ffb703; border-radius: 50px; box-shadow: 0 0 25px #d90429;
      display: flex; align-items: center; justify-content: center;
      font-size: 45px; cursor: pointer; position: absolute; z-index: 4;
    }

    .stage-1 { background: linear-gradient(135deg, #ff0055, #9d0208) !important; border-color: #ff0055 !important; box-shadow: 0 0 35px #ff0055 !important; }
    .stage-2 { background: linear-gradient(135deg, #ffb703, #fb8500) !important; border-color: #ffb703 !important; box-shadow: 0 0 45px #ffb703 !important; }
    .stage-3 { background: linear-gradient(135deg, #fff, #00ffff) !important; border-color: #fff !important; box-shadow: 0 0 60px #fff, 0 0 90px #00ffff !important; }

    #target-box:active, #bomb-box:active { transform: scale(0.85); }

    .screen {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(13, 13, 26, 0.96); backdrop-filter: blur(10px);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 20px; z-index: 20;
    }

    .hidden { display: none !important; }

    h1 { font-size: 36px; font-weight: 900; color: #00ffff; text-shadow: 0 0 20px #00ffff; margin-bottom: 10px; text-transform: uppercase; }

    .rules {
      background: rgba(0, 255, 255, 0.08); border: 2px solid #00ffff;
      padding: 20px; border-radius: 15px; font-size: 15px; line-height: 1.8;
      margin-bottom: 25px; text-align: center;
    }
    .rules strong { color: #ff0055; font-size: 18px;}
    .warning { color: #ffcc00; font-weight: bold; margin-top: 12px; font-size: 13px; text-shadow: 0 0 5px rgba(255,200,0,0.3); }

    button {
      background: #ff0055; color: #fff; border: none; font-family: inherit;
      font-weight: 900; font-size: 22px; padding: 15px 45px; border-radius: 12px;
      cursor: pointer; box-shadow: 0 0 25px #ff0055; text-transform: uppercase; transition: transform 0.2s;
    }
    button:active { transform: scale(0.95); }

    .final-score { font-size: 65px; color: #ffcc00; text-shadow: 0 0 25px #ffcc00; margin: 15px 0; font-weight: 900; }
    .prize-msg { font-size: 18px; font-weight: bold; margin-bottom: 25px; line-height: 1.6; }

    .floating-text { position: absolute; font-weight: 900; font-size: 28px; pointer-events: none; animation: floatUp 0.5s ease-out forwards; z-index: 6; }
    @keyframes floatUp { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-50px) scale(1.4); } }
  </style>
</head>
<body>

  <div id="game-container">
    <div class="hud hidden" id="game-hud">
      <div class="time-box">⏱ <span id="time-val">15</span>s</div>
      <div class="score-box">SCORE: <span id="score-val">0</span></div>
    </div>
    <div id="taunt-text" class="hidden">READY UP! 🎮</div>
    <div id="target-box" class="hidden">📦</div>
    <div id="bomb-box" class="hidden">💣</div>

    <div id="start-screen" class="screen">
      <h1>Aim Smasher PRO</h1>
      <p style="margin-bottom: 12px; letter-spacing: 1px;">SHOW YOUR ELITE GAMER SKILLS!</p>
      <div class="rules">
        🎯 <strong>REWARDS TIER (15s):</strong><br>
        30+ Hits: 10% Off Any PS5 Game<br>
        50+ Hits: 20% Off Plus / Gift Cards<br>
        70+ Hits: <strong>FREE Game Account! 💎</strong>
        <div class="warning">⚠️ BEWARE: 💣 Bombs steal 3 SECONDS! Missing costs 1 Point.</div>
      </div>
      <button onclick="startGame()">START MASHING!</button>
    </div>

    <div id="end-screen" class="screen hidden">
      <h1>TIME'S UP!</h1>
      <div class="final-score" id="final-score-val">0</div>
      <div id="prize-msg" class="prize-msg"></div>
      <p style="font-size: 13px; margin-bottom: 25px; color: #aaa;">Take a screenshot & DM us to claim your prize!</p>
      <button onclick="resetGame()">TRY AGAIN</button>
    </div>
  </div>

  <script>
    function sendTelemetry(action, payload) {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: action, t: Date.now(), s: score, p: payload }),
        keepalive: true
      }).catch(()=>{});
    }

    let audioCtx = null;
    function initAudio() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    function playSound(type) {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'hit') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.08);
        gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now + 0.08);
        osc.start(now); osc.stop(now + 0.08);
      } else if (type === 'miss') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(120, now);
        gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
      } else if (type === 'bomb') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.35);
        gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0, now + 0.35);
        osc.start(now); osc.stop(now + 0.35);
      } else if (type === 'levelup') {
        osc.type = 'square'; osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.08); osc.frequency.setValueAtTime(900, now + 0.16);
        gain.gain.setValueAtTime(0.15, now); gain.gain.linearRampToValueAtTime(0, now + 0.25);
        osc.start(now); osc.stop(now + 0.25);
      }
    }

    const targetBox = document.getElementById('target-box');
    const bombBox = document.getElementById('bomb-box');
    const container = document.getElementById('game-container');
    const scoreVal = document.getElementById('score-val');
    const timeVal = document.getElementById('time-val');
    const tauntText = document.getElementById('taunt-text');

    let score = 0; let timeLeft = 15; let isPlaying = false;
    let gameInterval, telemetryInterval;

    const taunts = {
      low: ["Is that a turtle tapping? 🐢💤", "MISS AGAIN? Ultimate Noob! 🤡", "Wake up, lagger! 🥱❌"],
      mid: ["Okay, you have fingers... 🙄", "Don't choke now! 🤫🔥", "Average bot gameplay 🤖💀"],
      high: ["OMG HE IS COOKING! 🔥💥", "Your screen is crying! 📱😭", "Insane Aim! 🎯✨"],
      god: ["AIMBOT DETECTED! 🚨🤖", "GODLIKE SPEED! ⚡👽", "STOP IT, PRO GAMER! 🤯🛑"]
    };

    function updateTaunt() {
      let currentCategory = "low";
      if (score > 55) currentCategory = "god";
      else if (score > 35) currentCategory = "high";
      else if (score > 15) currentCategory = "mid";
      const categoryTaunts = taunts[currentCategory];
      tauntText.innerText = categoryTaunts[Math.floor(Math.random() * categoryTaunts.length)];
      tauntText.style.animation = 'none'; void tauntText.offsetWidth; 
      tauntText.style.animation = 'megaPunch 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both';
    }

    function moveElements() {
      const maxX = window.innerWidth - 130; const maxY = window.innerHeight - 150;
      const targetX = Math.max(30, Math.random() * maxX); const targetY = Math.max(140, Math.random() * maxY);
      targetBox.style.left = targetX + 'px'; targetBox.style.top = targetY + 'px';
      if (Math.random() < 0.35) {
        let bombX = Math.max(30, Math.random() * maxX); let bombY = Math.max(140, Math.random() * maxY);
        if (Math.abs(bombX - targetX) < 100 && Math.abs(bombY - targetY) < 100) bombX = (bombX + 130) % maxX;
        bombBox.style.left = bombX + 'px'; bombBox.style.top = bombY + 'px';
        bombBox.classList.remove('hidden');
      } else {
        bombBox.classList.add('hidden');
      }
    }

    targetBox.addEventListener('pointerdown', (e) => {
      if (!isPlaying) return;
      e.stopPropagation(); 
      score++; scoreVal.innerText = score; playSound('hit');
      if (score === 15) { targetBox.className = "stage-1"; targetBox.innerText = "🔥"; playSound('levelup'); }
      else if (score === 35) { targetBox.className = "stage-2"; targetBox.innerText = "⚡"; playSound('levelup'); }
      else if (score === 55) { targetBox.className = "stage-3"; targetBox.innerText = "💎"; playSound('levelup'); }
      if (score % 4 === 0) updateTaunt();
      createFloatingText(e.clientX, e.clientY, "+1", "#00ffff");
      sendTelemetry('hit', { score: score });
      moveElements();
    });

    bombBox.addEventListener('pointerdown', (e) => {
      if (!isPlaying) return;
      e.stopPropagation();
      timeLeft = Math.max(0, timeLeft - 3); timeVal.innerText = timeLeft;
      playSound('bomb');
      document.body.classList.add('bomb-flash'); container.classList.add('shake');
      setTimeout(() => { document.body.classList.remove('bomb-flash'); container.classList.remove('shake'); }, 400);
      createFloatingText(e.clientX, e.clientY, "-3s 💥", "#ffb703");
      bombBox.classList.add('hidden');
      sendTelemetry('bomb_hit', { penalty: 3 });
    });

    container.addEventListener('pointerdown', (e) => {
      if (!isPlaying) return;
      score = Math.max(0, score - 1); scoreVal.innerText = score;
      playSound('miss');
      document.body.classList.add('miss-flash');
      setTimeout(() => document.body.classList.remove('miss-flash'), 100);
      createFloatingText(e.clientX, e.clientY, "-1 💩", "#ff0055");
      sendTelemetry('miss', { score: score });
    });

    let lastMove = 0;
    container.addEventListener('pointermove', (e) => {
      if(!isPlaying) return;
      if(Date.now() - lastMove > 350) {
        sendTelemetry('aim_track', { x: e.clientX, y: e.clientY });
        lastMove = Date.now();
      }
    });

    function createFloatingText(x, y, text, color) {
      const el = document.createElement('div'); el.classList.add('floating-text');
      el.innerText = text; el.style.color = color; el.style.textShadow = '0 0 12px ' + color + ', 0 0 5px #000';
      el.style.left = (x - 25) + 'px'; el.style.top = (y - 30) + 'px';
      container.appendChild(el);
      setTimeout(() => el.remove(), 500);
    }

    function startGame() {
      initAudio(); if (audioCtx) audioCtx.resume();
      score = 0; timeLeft = 15; scoreVal.innerText = score; timeVal.innerText = timeLeft;
      targetBox.className = ""; targetBox.innerText = "📦"; tauntText.innerText = "TAP FAST! 🎯";
      document.getElementById('start-screen').classList.add('hidden');
      document.getElementById('end-screen').classList.add('hidden');
      targetBox.classList.remove('hidden'); document.getElementById('game-hud').classList.remove('hidden'); tauntText.classList.remove('hidden');
      isPlaying = true;
      moveElements();
      sendTelemetry('game_start', {});
      telemetryInterval = setInterval(() => { sendTelemetry('heartbeat', { alive: true }); }, 1000);
      gameInterval = setInterval(() => {
        timeLeft--; timeVal.innerText = timeLeft;
        if (timeLeft <= 0) endGame();
      }, 1000);
    }

    function endGame() {
      isPlaying = false;
      clearInterval(gameInterval); clearInterval(telemetryInterval);
      sendTelemetry('game_end', { finalScore: score });
      targetBox.classList.add('hidden'); bombBox.classList.add('hidden');
      document.getElementById('game-hud').classList.add('hidden'); tauntText.classList.add('hidden');
      document.getElementById('end-screen').classList.remove('hidden');
      document.getElementById('final-score-val').innerText = score;
      const msg = document.getElementById('prize-msg');
      if (score >= 70) { msg.innerHTML = "🔥 GODLIKE AIM! 🔥<br><span style='color:#00ffff'>FREE PS5 Game Account!</span>"; msg.style.color = "#fff"; }
      else if (score >= 50) { msg.innerHTML = "⚡ PRO GAMER! ⚡<br><span style='color:#ffb703'>20% OFF PS Plus!</span>"; msg.style.color = "#fff"; }
      else if (score >= 30) { msg.innerHTML = "👍 GOOD JOB! 👍<br><span style='color:#0f0'>10% OFF Any PS5 Game!</span>"; msg.style.color = "#fff"; }
      else { msg.innerHTML = "🐢 NOOB ALERT! 🐢<br><span style='color:#ff0055'>Try with your eyes open!</span>"; msg.style.color = "#fff"; }
    }

    function resetGame() { document.getElementById('end-screen').classList.add('hidden'); document.getElementById('start-screen').classList.remove('hidden'); }
  </script>
</body>
</html>`;
}

// ورودی اصلی Worker برای Cloudflare Pages
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const upstream = request.headers.get("x-host");

    // مسیر api/sync برای تله‌متری بازی (مشابه Netlify)
    if (url.pathname === "/api/sync") {
      return new Response(JSON.stringify({ status: "sync_ok" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    // اگر هدر x-host وجود نداشت و مسیر ریشه بود، صفحه بازی را نشان بده
    if (!upstream) {
      if (url.pathname === "/") {
        return new Response(landingPage(), {
          headers: { "content-type": "text/html; charset=UTF-8" },
        });
      }
      return new Response("Missing x-host header", { status: 400 });
    }

    // در غیر این صورت، به عنوان پراکسی عمل کن (دقیقاً مثل relay.js)
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
    } catch (err) {
      return new Response("Bad Gateway", { status: 502 });
    }
  }
};
