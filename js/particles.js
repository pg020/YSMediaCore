/* YUESHI MEDIA CORE - particle overlay.
   Particles drift around the panel and back away from the mouse pointer.
   On Windows a tiny PowerShell helper reports the cursor position, so the particles also react when the
   mouse is OUTSIDE the panel. Loaded before theme.js. Exposes window.MSParticles. */
(function () {
  'use strict';
  var KEY = 'ms.particles';
  var DEF = { on: 1, speed: 100, color: '' };   // color '' = follow the theme accent
  var RADIUS = 130;        // how far from the pointer particles are pushed (px)
  var KICK = 2600;         // push strength

  function clampSpeed(v) { v = parseFloat(v); if (isNaN(v)) v = DEF.speed; return Math.max(0, Math.min(300, Math.round(v))); }
  function load() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
    return { on: o.on === undefined ? DEF.on : (o.on ? 1 : 0), speed: clampSpeed(o.speed === undefined ? DEF.speed : o.speed),
             color: /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color.toLowerCase() : '' };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var S = load();

  var app = document.getElementById('app') || document.body;
  var cv = document.createElement('canvas'); cv.id = 'particles';
  app.appendChild(cv);
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, P = [], rgb = [79, 209, 197];

  /* ---------- colour: follows the theme's accent ---------- */
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function readColor() {
    if (S.color) { rgb = hexToRgb(S.color); return; }       // the user's own colour wins over the theme
    var c = '';
    try { c = String(getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim(); } catch (e) {}
    var m;
    if ((m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c))) {
      var h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1], n = parseInt(h, 16);
      rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    } else if ((m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(c))) rgb = [+m[1], +m[2], +m[3]];
  }
  document.addEventListener('mstheme', readColor);
  readColor();

  /* ---------- particles ---------- */
  function spawn() {
    var a = Math.random() * 6.2832, sp = 8 + Math.random() * 14;
    var bx = Math.cos(a) * sp, by = Math.sin(a) * sp;
    return { x: Math.random() * W, y: Math.random() * H, vx: bx, vy: by, bx: bx, by: by,
             r: 1.1 + Math.random() * 2.1, a: 0.28 + Math.random() * 0.45, ph: Math.random() * 6.2832 };
  }
  function resize() {
    var w = cv.clientWidth || 0, h = cv.clientHeight || 0, d = window.devicePixelRatio || 1;
    if (w === W && h === H && d === dpr) return;
    W = w; H = h; dpr = d;
    cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.max(24, Math.min(120, Math.round(W * H / 9000)));
    while (P.length < n) P.push(spawn());
    if (P.length > n) P.length = n;
  }

  /* ---------- pointer: real events inside the panel, cursor helper outside ---------- */
  var ins = { x: 0, y: 0, on: false, t: 0 };           // mouse events inside the panel (CSS px)
  var poll = { x: 0, y: 0, t: 0 };                      // global cursor position from the helper (screen px)
  var ox = 0, oy = 0, cal = false;                      // screen position of the panel's top-left corner

  function onPoll(x, y) { poll.x = x; poll.y = y; poll.t = Date.now(); }
  function calibrate(cx, cy) {
    if (Date.now() - poll.t > 70) return;               // need a fresh helper sample taken at the same moment
    var nx = poll.x - cx * dpr, ny = poll.y - cy * dpr;
    if (!cal || Math.abs(nx - ox) > 40 || Math.abs(ny - oy) > 40) { ox = nx; oy = ny; cal = true; }   // first time, or the panel moved
    else { ox = ox * 0.8 + nx * 0.2; oy = oy * 0.8 + ny * 0.2; }                                      // smooth out timing jitter
  }
  document.addEventListener('mousemove', function (ev) {
    ins.x = ev.clientX; ins.y = ev.clientY; ins.on = true; ins.t = Date.now();
    calibrate(ev.clientX, ev.clientY);
  }, true);
  document.addEventListener('mouseout', function (ev) { if (!ev.relatedTarget) ins.on = false; }, true);

  function getPtr() {
    var now = Date.now();
    if (ins.on && now - ins.t < 100) return ins;                                       // moving over the panel
    if (cal && now - poll.t < 250) return { x: (poll.x - ox) / dpr, y: (poll.y - oy) / dpr };   // anywhere on screen
    return ins.on ? ins : null;
  }

  /* ---------- cursor helper (Windows only) ---------- */
  var child = null, helperFailed = false;
  var PS = [
    "Add-Type -Namespace MS -Name C -MemberDefinition '[StructLayout(LayoutKind.Sequential)] public struct P { public int X; public int Y; } [DllImport(\"user32.dll\")] public static extern bool GetCursorPos(out P p); [DllImport(\"user32.dll\")] public static extern bool SetProcessDPIAware();'",
    "[MS.C]::SetProcessDPIAware() | Out-Null",
    "$p = New-Object 'MS.C+P'",
    "while ($true) {",
    "  [MS.C]::GetCursorPos([ref]$p) | Out-Null",
    "  try { [Console]::Out.WriteLine(('{0} {1}' -f $p.X, $p.Y)) } catch { break }",
    "  Start-Sleep -Milliseconds 16",
    "}"
  ].join('\r\n');

  function startPoll() {
    if (child || helperFailed) return;
    if (typeof process === 'undefined' || process.platform !== 'win32') return;
    try {
      var cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
      var file = path.join(os.tmpdir(), 'msscrub-cursor.ps1');
      fs.writeFileSync(file, PS);
      child = cp.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      var buf = '';
      child.stdout.on('data', function (d) {
        buf += d.toString();
        var i;
        while ((i = buf.indexOf('\n')) > -1) {
          var m = buf.slice(0, i).trim().split(' '); buf = buf.slice(i + 1);
          if (m.length === 2 && !isNaN(+m[0]) && !isNaN(+m[1])) onPoll(+m[0], +m[1]);
        }
        if (buf.length > 200) buf = '';
      });
      child.on('exit', function () { child = null; if (!poll.t || Date.now() - poll.t > 2000) helperFailed = true; });
      child.on('error', function () { child = null; helperFailed = true; });
    } catch (e) { child = null; helperFailed = true; }
  }
  function stopPoll() { if (child) { try { child.kill(); } catch (e) {} child = null; } }
  window.addEventListener('unload', stopPoll);
  window.addEventListener('beforeunload', stopPoll);

  /* ---------- simulation ---------- */
  var raf = 0, last = 0, tt = 0;
  function step(sdt, p) {
    var R2 = RADIUS * RADIUS, damp = 1 - Math.exp(-1.8 * sdt), i, q, dx, dy, d2, d, f, k, m = 8;
    for (i = 0; i < P.length; i++) {
      q = P[i];
      if (p) {
        dx = q.x - p.x; dy = q.y - p.y; d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          d = Math.sqrt(d2) || 0.001; f = 1 - d / RADIUS; k = KICK * f * f * sdt;
          if (d2 < 0.01) { dx = 1; dy = 0; d = 1; }
          q.vx += dx / d * k; q.vy += dy / d * k;
        }
      }
      q.vx += (q.bx - q.vx) * damp; q.vy += (q.by - q.vy) * damp;
      var sp2 = q.vx * q.vx + q.vy * q.vy;
      if (sp2 > 640000) { var s = 800 / Math.sqrt(sp2); q.vx *= s; q.vy *= s; }        // never faster than 800 px/s
      q.x += q.vx * sdt; q.y += q.vy * sdt;
      if (q.x < -m) q.x = W + m; else if (q.x > W + m) q.x = -m;
      if (q.y < -m) q.y = H + m; else if (q.y > H + m) q.y = -m;
    }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var base = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',';
    for (var i = 0; i < P.length; i++) {
      var q = P[i], a = q.a * (0.75 + 0.25 * Math.sin(tt * 1.4 + q.ph));
      ctx.fillStyle = base + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.2832); ctx.fill();
    }
  }
  function frame(now) {
    raf = 0;
    if (!S.on || document.hidden) { last = 0; return; }
    resize();
    var dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0.016; last = now;
    var sdt = dt * S.speed / 100; tt += sdt;
    step(sdt, getPtr()); draw();
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && S.on && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', kick);

  /* ---------- on / off, status ---------- */
  var lastStatus = '', timer = 0;
  function status() {
    if (!S.on) return 'off';
    if (typeof process === 'undefined' || process.platform !== 'win32') return 'inside-only';
    if (helperFailed && !(Date.now() - poll.t < 1000)) return 'unavailable';
    if (!cal) return 'calibrate';
    return Date.now() - poll.t < 1000 ? 'active' : 'unavailable';
  }
  function tick() { var s = status(); if (s !== lastStatus) { lastStatus = s; if (api.onStatus) api.onStatus(s); } }
  function applyOn() {
    cv.style.display = S.on ? 'block' : 'none';
    if (S.on) { startPoll(); kick(); if (!timer) timer = setInterval(tick, 700); }
    else { stopPoll(); if (raf) { cancelAnimationFrame(raf); raf = 0; } if (timer) { clearInterval(timer); timer = 0; } ctx.clearRect(0, 0, W, H); }
    tick();
  }

  var api = window.MSParticles = {
    onStatus: null,
    get: function () { return { on: S.on, speed: S.speed, color: S.color }; },
    set: function (k, v) {
      if (k === 'on') { S.on = v ? 1 : 0; save(); applyOn(); }
      else if (k === 'speed') { S.speed = clampSpeed(v); save(); }
      else if (k === 'color') { S.color = /^#[0-9a-f]{6}$/i.test(v || '') ? String(v).toLowerCase() : ''; save(); readColor(); }
    },
    reset: function () { S.on = DEF.on; S.speed = DEF.speed; S.color = DEF.color; save(); readColor(); applyOn(); },
    status: status,
    /* hooks used by the test harness */
    _t: { onPoll: onPoll, frame: frame, particles: function () { return P; }, cal: function () { return { ox: ox, oy: oy, cal: cal }; }, getPtr: getPtr }
  };
  applyOn();
})();
