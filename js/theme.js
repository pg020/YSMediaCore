/* YUESHI MEDIA CORE - appearance: themes, custom colors, background image / GIF / video.
   Loaded before main.js. Exposes window.MSTheme.wave for the waveform painter. */
(function () {
  'use strict';
  var fs = null, os = null;
  try { fs = require('fs'); os = require('os'); } catch (e) {}
  var KEY = 'ms.theme';
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- colour helpers ---------- */
  function h2r(h) {
    h = String(h || '#000').replace('#', '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    var n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function r2h(r) {
    return '#' + r.map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }
  function mix(a, b, t) {
    var x = h2r(a), y = h2r(b);
    return r2h([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; }));
  }
  function lum(h) { var c = h2r(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function rgba(h, a) { var c = h2r(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function bright(h, f) { return r2h(h2r(h).map(function (v) { return v * f; })); }

  /* ---------- presets ---------- */
  var PRESETS = [
    { id: 'ys', name: 'YS Theme', bg: '#1c0e10', panel: '#2a1417', line: '#4a2226', text: '#fbefe3', dim: '#c9a396', accent: '#f2784b', video: '#ff9a5c', audio: '#fada53', image: '#f7b2a0' },
    { id: 'midnight', name: 'Midnight', bg: '#16181d', panel: '#1d2026', line: '#2b2f38', text: '#d9dde5', dim: '#8a92a0', accent: '#4fd1c5', video: '#7aa2f7', audio: '#e0a458', image: '#9ece6a' },
    { id: 'ember',    name: 'Ember',    bg: '#17120f', panel: '#211a15', line: '#33291f', text: '#eadfd4', dim: '#9a8878', accent: '#ff8a3d', video: '#6fa8dc', audio: '#f2c14e', image: '#8fbf6a' },
    { id: 'aurora',   name: 'Aurora',   bg: '#120f1f', panel: '#1b1730', line: '#2c2650', text: '#e6e1ff', dim: '#8f88b8', accent: '#b388ff', video: '#6ea8ff', audio: '#ff9ecf', image: '#7ef0c2' },
    { id: 'neon',     name: 'Neon',     bg: '#0a0a12', panel: '#11111f', line: '#26264a', text: '#e8f0ff', dim: '#7a82b0', accent: '#ff2e97', video: '#00e5ff', audio: '#fcee09', image: '#39ff88' },
    { id: 'forest',   name: 'Forest',   bg: '#101612', panel: '#17201a', line: '#24332a', text: '#dfeae1', dim: '#84998a', accent: '#5fd38d', video: '#6fb7d9', audio: '#e3b85c', image: '#b6d96a' },
    { id: 'paper',    name: 'Paper',    bg: '#f3f1ec', panel: '#ffffff', line: '#d9d5cb', text: '#26241f', dim: '#7a766b', accent: '#2f6fed', video: '#2f6fed', audio: '#c77700', image: '#3a8f3a' },
    { id: 'sakura',  name: 'Sakura',   bg: '#1a1218', panel: '#251a22', line: '#3a2733', text: '#f3e4ec', dim: '#a58898', accent: '#ff7eb6', video: '#8ec5ff', audio: '#ffc2a1', image: '#b5e8a0' },
    { id: 'ocean',   name: 'Ocean',    bg: '#0d1620', panel: '#132130', line: '#1f3347', text: '#dbe9f5', dim: '#7e97ad', accent: '#38bdf8', video: '#60a5fa', audio: '#fbbf24', image: '#34d399' },
    { id: 'ae',       name: 'Match After Effects', dynamic: true, accent: '#2d8ceb', video: '#5b9dff', audio: '#e0a458', image: '#8fcf6a' }
  ];

  var DEF = { zoom: 1, zoomAmt: 120, preset: 'ys', v: 2, accent: '', bg: '', panel: '', text: '', radius: 6, hs: 1, anim: 1, animSpeed: 'normal', bx: 0.5, by: 0.5, bs: 1, binit: 0,
              bgPath: '', dim: 55, blur: 0, fit: 'cover', pos: 'center', glass: 0 };
  var S = load();

  function load() {
    var o = {}, k;
    try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
    var r = {};
    for (k in DEF) r[k] = (o[k] === undefined || o[k] === null) ? DEF[k] : o[k];
    if (!o.v) { r.v = 2; if (r.preset === 'midnight') r.preset = 'ys'; }   /* one-time: earlier versions defaulted to Midnight */
    return r;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function clone(o) { var r = {}, k; for (k in o) r[k] = o[k]; return r; }
  function byId(id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return PRESETS[0]; }

  /* "Match After Effects": read the host's panel color */
  function aeBase(p) {
    var bg = '#232323';
    try {
      var env = JSON.parse(window.__adobe_cep__.getHostEnvironment());
      var c = env.appSkinInfo.panelBackgroundColor.color;
      bg = r2h([c.red, c.green, c.blue]);
    } catch (e) {}
    var light = lum(bg) > 0.5, r = clone(p);
    r.bg = bg;
    r.text = light ? '#1e1e1e' : '#d8d8d8';
    r.panel = mix(bg, light ? '#ffffff' : '#ffffff', light ? 0.55 : 0.06);
    r.line = mix(bg, light ? '#000000' : '#ffffff', light ? 0.16 : 0.14);
    r.dim = mix(r.text, bg, 0.45);
    return r;
  }

  function resolve() {
    var p = clone(byId(S.preset));
    if (p.dynamic) p = aeBase(p);
    var custom = !!(S.bg || S.panel || S.text);
    if (S.bg) p.bg = S.bg;
    if (S.text) p.text = S.text;
    if (S.bg && !S.panel) p.panel = mix(p.bg, p.text, 0.06);
    if (S.panel) p.panel = S.panel;
    if (custom) { p.line = mix(p.bg, p.text, 0.14); p.dim = mix(p.text, p.bg, 0.45); }
    if (S.accent) p.accent = S.accent;
    return p;
  }

  /* ---------- background layer ---------- */
  var VIDEO_EXT = ['.mp4', '.webm', '.m4v', '.mov', '.ogv'];
  function extOf(f) { var m = /\.[^.\\\/]+$/.exec(f || ''); return m ? m[0].toLowerCase() : ''; }
  function toUrl(p) {
    var u = p.replace(/\\/g, '/');
    if (u.charAt(0) !== '/') u = '/' + u;
    return 'file://' + encodeURI(u).replace(/#/g, '%23');
  }
  function fileExists(f) { try { return !!fs && fs.existsSync(f); } catch (e) { return false; } }

  var layer = document.createElement('div'); layer.id = 'bgLayer';
  var media = document.createElement('div'); media.id = 'bgMedia';
  var dimEl = document.createElement('div'); dimEl.id = 'bgDim';
  layer.appendChild(media); layer.appendChild(dimEl);
  document.body.insertBefore(layer, document.body.firstChild);

  function freeEl() { return media.querySelector('#bgFree'); }
  function natural(e) { return e ? [e.naturalWidth || e.videoWidth || 0, e.naturalHeight || e.videoHeight || 0] : [0, 0]; }
  function placeFree() {
    var e = freeEl(); if (!e) return;
    e.style.left = (S.bx * 100) + '%'; e.style.top = (S.by * 100) + '%'; e.style.width = (S.bs * 100) + '%';
  }
  function buildFree(url, isVideo) {
    var e = document.createElement(isVideo ? 'video' : 'img');
    e.id = 'bgFree'; e.src = url; e.draggable = false;
    e.style.cssText = 'position:absolute;transform:translate(-50%,-50%);height:auto;max-width:none;display:block;';
    function init() {
      var n = natural(e), W = layer.clientWidth, H = layer.clientHeight;
      if (!S.binit && n[0] && W && H) {            // first time: start at the same size as "Fill"
        S.bs = n[0] * Math.max(W / n[0], H / n[1]) / W; S.bx = 0.5; S.by = 0.5; S.binit = 1; save();
      }
      placeFree(); updateBox();
    }
    if (isVideo) { e.loop = true; e.muted = true; e.autoplay = true; e.setAttribute('playsinline', ''); e.onloadedmetadata = init; }
    else e.onload = init;
    media.appendChild(e); placeFree();
  }

  var bgKey = '';   // so slider drags don't reload the file
  function setBackground(t) {
    var ok = !!S.bgPath && fileExists(S.bgPath);
    layer.style.display = ok ? 'block' : 'none';
    document.body.classList.toggle('has-bg', ok);
    if (!ok) { media.innerHTML = ''; media.style.backgroundImage = ''; bgKey = ''; return false; }
    var isVideo = VIDEO_EXT.indexOf(extOf(S.bgPath)) > -1;
    var key = S.bgPath + '|' + S.fit + '|' + S.pos;
    if (key !== bgKey) {
      bgKey = key;
      media.innerHTML = ''; media.style.backgroundImage = '';
      var url = toUrl(S.bgPath);
      if (S.fit === 'free') { buildFree(url, isVideo); }
      else if (isVideo) {
        var v = document.createElement('video');
        v.src = url; v.loop = true; v.muted = true; v.autoplay = true; v.setAttribute('playsinline', '');
        v.style.objectFit = S.fit === 'stretch' ? 'fill' : (S.fit === 'contain' ? 'contain' : 'cover');
        v.style.objectPosition = S.pos;
        media.appendChild(v);
        try { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
      } else {
        media.style.backgroundImage = 'url("' + url + '")';
        media.style.backgroundSize = S.fit === 'repeat' ? 'auto' : (S.fit === 'stretch' ? '100% 100%' : S.fit);
        media.style.backgroundRepeat = S.fit === 'repeat' ? 'repeat' : 'no-repeat';
        media.style.backgroundPosition = S.pos;
      }
    }
    media.style.filter = S.blur > 0 ? 'blur(' + S.blur + 'px)' : '';
    media.style.transform = (S.blur > 0 && S.fit !== 'free') ? 'scale(1.06)' : '';
    dimEl.style.background = rgba(t.bg, S.dim / 100);
    return true;
  }

  /* ---------- apply ---------- */
  /* ---------- folder slide animation ---------- */
  var SPEEDS = { fast: [25, 220], normal: [45, 320], slow: [80, 480] };   // [ms between tiles, ms per tile]
  function slideIn(grid, dir) {
    if (!S.anim) return;
    var sp = SPEEDS[S.animSpeed] || SPEEDS.normal, tiles = [], i, c;
    for (i = 0; i < grid.children.length && tiles.length < 48; i++) {
      c = grid.children[i]; if (c.classList && c.classList.contains('tile')) tiles.push(c);
    }
    if (!tiles.length) return;
    var rows = [], lastTop = null;
    tiles.forEach(function (t) {
      if (t.offsetTop !== lastTop) { rows.push([]); lastTop = t.offsetTop; }
      rows[rows.length - 1].push(t);
    });
    var rank = 0, cls = 'slide-' + (dir === 'back' ? 'back' : 'fwd');
    root.style.setProperty('--slide-dur', sp[1] + 'ms');
    rows.forEach(function (row) {
      (dir === 'back' ? row.slice().reverse() : row).forEach(function (t) {     // forward: left to right, back: right to left
        t.style.animationDelay = (rank++ * sp[0]) + 'ms';
        t.classList.add(cls);
        t.addEventListener('animationend', function done(ev) {
          if (ev.target !== t) return;
          t.removeEventListener('animationend', done); t.classList.remove(cls); t.style.animationDelay = '';
        });
      });
    });
  }

  var MSTheme = window.MSTheme = { slideIn: slideIn, wave: { idle: '#e0a458', played: '#ffc46b', rest: '#7d6238' } };

  function apply() {
    var t = resolve(), light = lum(t.bg) > 0.5;
    var thumb = light ? mix(t.bg, '#000000', 0.07) : mix(t.bg, '#000000', 0.35);
    var hasBgNow = !!S.bgPath && fileExists(S.bgPath);
    var ga = hasBgNow ? 0.55 : 1;                       // tile / control translucency over a background
    function a(c) { return hasBgNow ? rgba(c, ga) : c; }
    var vars = {
      '--bg': t.bg, '--panel': t.panel, '--line': t.line, '--text': t.text, '--dim': t.dim,
      '--accent': t.accent, '--video': t.video, '--audio': t.audio, '--image': t.image,
      '--accent-ink': lum(t.accent) > 0.5 ? mix(t.accent, '#000000', 0.82) : '#ffffff',
      '--thumb': a(thumb),
      '--folder': a(mix(t.panel, t.bg, 0.5)),
      '--audio-a': a(light ? mix(t.bg, t.audio, 0.22) : mix(t.bg, t.audio, 0.13)),
      '--audio-b': a(light ? mix(t.bg, t.audio, 0.08) : mix(thumb, t.audio, 0.04)),
      '--ctl': hasBgNow ? rgba(t.panel, Math.max(0.3, S.glass / 100)) : t.panel,
      '--pill': rgba(t.bg, 0.6),
      '--tshadow': light ? '0 1px 3px rgba(255,255,255,.8)' : '0 1px 3px rgba(0,0,0,.8)',
      '--vis': light ? '#000000' : '#ffffff',
      '--hover': light ? '#000000' : '#ffffff',
      '--head': light ? '#1b1b1b' : '#ffffff',
      '--r': S.radius + 'px',
      '--rb': Math.round(S.radius * 0.67) + 'px'
    };
    for (var k in vars) root.style.setProperty(k, vars[k]);
    root.style.setProperty('--zoom', S.zoom ? Math.max(1, Math.min(2, S.zoomAmt / 100)) : 1);
    var hasBg = setBackground(t);
    root.style.setProperty('--chrome', hasBg ? rgba(t.bg, S.glass / 100) : 'transparent');
    root.style.setProperty('--overlay', t.bg);
    MSTheme.wave = {
      idle: t.audio,
      played: light ? mix(t.audio, '#000000', 0.2) : bright(t.audio, 1.15),
      rest: mix(t.audio, t.bg, light ? 0.55 : 0.5)
    };
    placeFree(); updateBox(); applyHeader();
    var ev = document.createEvent('Event'); ev.initEvent('mstheme', true, true); document.dispatchEvent(ev);
  }

  /* keep "Match After Effects" live when the user changes AE's brightness */
  try {
    window.__adobe_cep__.addEventListener('com.adobe.csxs.events.ThemeColorChanged', function () {
      if (S.preset === 'ae') { apply(); refreshUI(); }
    });
  } catch (e) {}

  /* ---------- settings panel ---------- */
  var panel = document.createElement('div');
  panel.id = 'themePanel'; panel.hidden = true;
  panel.innerHTML =
    '<div class="tp-head"><button id="tpBack">Back</button><strong>Settings</strong><button id="tpReset" title="Restore the default look">Reset all</button></div>' +
    '<div class="tp-body">' +
    '<section><h3>Theme</h3><div id="tpPresets" class="tp-presets"></div>' +
      '<h3 class="tp-sub">My presets</h3>' +
      '<div class="tp-row"><input id="tpName" type="text" placeholder="Name this look" maxlength="30"><button id="tpSave" title="Save the current colors, shape and background as a preset">Save</button></div>' +
      '<div id="tpMine" class="tp-mine"></div></section>' +
    '<section><h3>Custom colors</h3>' +
      colorRow('Accent', 'accent') + colorRow('Background', 'bg') + colorRow('Panels', 'panel') + colorRow('Text', 'text') +
      '<div class="tp-note">Picking a theme clears your color overrides.</div></section>' +
    '<section><h3>Folder animation</h3>' +
      '<div class="tp-row"><label class="tp-check"><input type="checkbox" id="tpAnim"> Slide tiles in when opening a folder (left to right) and going back (right to left)</label></div>' +
      '<div class="tp-row"><span class="tp-lbl">Speed</span><select id="tpAnimSpeed"><option value="fast">Fast</option><option value="normal">Normal</option><option value="slow">Slow</option></select></div></section>' +
    '<section><h3>Hover zoom</h3>' +
      '<div class=\"tp-row\"><label class=\"tp-check\"><input type=\"checkbox\" id=\"tpZoom\"> Zoom a file when the mouse is on it</label></div>' +
      '<div class=\"tp-row\"><span class=\"tp-lbl\">Amount</span><input id=\"tpZoomN\" class=\"tp-num\" type=\"number\" min=\"100\" max=\"200\" step=\"5\" title=\"Zoom in percent. 100 = no zoom\"><input id=\"tpZoomR\" type=\"range\" min=\"100\" max=\"200\" step=\"5\"></div></section>' +
    '<section><h3>Particles</h3>' +
      '<div class=\"tp-row\"><label class=\"tp-check\"><input type=\"checkbox\" id=\"tpPart\"> Show particles that move away from the mouse</label></div>' +
      '<div class=\"tp-row\"><span class=\"tp-lbl\">Speed</span><input id=\"tpPSpeedN\" class=\"tp-num\" type=\"number\" min=\"0\" max=\"300\" step=\"5\" title=\"Particle speed, 0 to 300 (100 = normal, 0 = still)\"><input id=\"tpPSpeed\" type=\"range\" min=\"0\" max=\"300\" step=\"5\"></div>' +
      colorRow('Color', 'pcolor') +
      '<div class=\"tp-note\" id=\"tpPNote\"></div></section>' +
    '<section><h3>Shape</h3>' +
      '<div class="tp-row"><span class="tp-lbl">Corners</span><input id="tpRadius" type="range" min="0" max="16" step="1"><span class="tp-val" id="tpRadiusV"></span></div></section>' +
    '<section><h3>Background image, GIF or video</h3>' +
      '<div class="tp-prev" id="tpPrev"><span>No background</span></div>' +
      '<div class="tp-row"><button id="tpChoose">Choose file...</button><button id="tpClear">Remove</button></div>' +
      '<div class="tp-note" id="tpBgName"></div>' +
      '<div class="tp-row"><span class="tp-lbl">Dim</span><input id="tpDim" type="range" min="0" max="95" step="1"><span class="tp-val" id="tpDimV"></span></div>' +
      '<div class="tp-row"><span class="tp-lbl">Blur</span><input id="tpBlur" type="range" min="0" max="24" step="1"><span class="tp-val" id="tpBlurV"></span></div>' +
      '<div class="tp-row"><span class="tp-lbl">Top bar fill</span><input id="tpGlass" type="range" min="0" max="100" step="1"><span class="tp-val" id="tpGlassV"></span></div>' +
      '<div class="tp-row"><button id="tpEdit" class="tp-wide">Drag &amp; resize image...</button></div>' +
      '<div class="tp-row"><span class="tp-lbl">Fit</span><select id="tpFit"><option value="cover">Fill (crop)</option><option value="contain">Fit inside</option><option value="stretch">Stretch</option><option value="repeat">Tile</option><option value="free">Free (drag &amp; resize)</option></select></div>' +
      '<div class="tp-row"><span class="tp-lbl">Position</span><select id="tpPos"><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></div>' +
      '<div class="tp-note">GIFs and videos loop on their own. The file is used from where it is, so keep it in place. Large GIFs/videos can use extra CPU; if the panel feels slow, use a still image.</div></section>' +
    '</div>';
  function colorRow(label, key) {
    return '<div class="tp-row"><span class="tp-lbl">' + label + '</span><input type="color" id="tpc_' + key + '"><button class="tp-mini" id="tpr_' + key + '" title="Use the theme\'s color">Reset</button></div>';
  }
  var app = $('app'); app.appendChild(panel);

  /* ----- draggable divider: scales the whole top section ----- */
  var header = document.querySelector('header'), split = document.createElement('div');
  split.id = 'split'; split.title = 'Drag up to make the top section smaller, down to make it bigger. Double-click to reset.';
  app.insertBefore(split, $('grid'));
  var HS_MIN = 0.45, HS_MAX = 1.6;
  /* hover zoom: a tile zoomed near the edge of the grid slides inward just enough to stay fully visible */
  var gridEl = document.getElementById('grid'), zTile = null;
  function zoomShift(t) {
    /* zoom always grows from the exact centre of the file; the grid has extra padding (padGrid) so nothing gets cut off */
    var z = S.zoom ? Math.max(1, Math.min(2, S.zoomAmt / 100)) : 1;
    t.style.removeProperty('--zx'); t.style.removeProperty('--zy');
    if (z === 1) t.style.removeProperty('--zs'); else t.style.setProperty('--zs', z);
  }
  var lastPad = '';
  function padGrid() {
    /* Extra room around the grid so a zoomed file is never cut off at the edge.
       Calculated only from the grid width and the tile-size setting (never from a measured tile),
       so it cannot feed back into the layout, and written only when the value really changes. */
    var z = S.zoom ? Math.max(1, Math.min(2, S.zoomAmt / 100)) : 1, pad = 8;
    if (z > 1) {
      var tile = parseFloat(getComputedStyle(gridEl).getPropertyValue('--tile')) || 140;
      var inner = Math.max(gridEl.clientWidth - 16, tile);
      var cols = Math.max(1, Math.floor((inner + 10) / (tile + 10)));
      var w = (inner - 10 * (cols - 1)) / cols;
      pad = 8 + Math.ceil((z - 1) / 2 * w * 1.15);
    }
    var v = pad + 'px';
    if (v !== lastPad) { lastPad = v; gridEl.style.padding = v; }
  }
  window.addEventListener('resize', padGrid);
  window.addEventListener('load', padGrid);
  document.addEventListener('input', function (e) { if (e.target && (e.target.id === 'size' || e.target.id === 'sizeR')) padGrid(); });
  document.addEventListener('mstheme', padGrid);
  padGrid();
  function tileOf(n) { while (n && n !== gridEl) { if (n.classList && n.classList.contains('tile')) return n; n = n.parentNode; } return null; }
  gridEl.addEventListener('mouseover', function (ev) {
    var t = tileOf(ev.target); if (!t || t === zTile) return;
    zTile = t; zoomShift(t);
  });
  gridEl.addEventListener('mouseout', function (ev) {
    if (zTile && !zTile.contains(ev.relatedTarget)) zTile = null;
  });
  function applyHeader() { header.style.zoom = S.hs && S.hs !== 1 ? S.hs : ''; }
  function headerH() { return header.getBoundingClientRect().height; }
  var hdrag = null;
  split.addEventListener('mousedown', function (ev) {
    hdrag = { y: ev.clientY, h: Math.max(20, headerH()), s: S.hs || 1 }; split.classList.add('drag'); ev.preventDefault();
  });
  document.addEventListener('mousemove', function (ev) {
    if (!hdrag) return;
    var f = (hdrag.h + ev.clientY - hdrag.y) / hdrag.h;                 // dragged height / original height
    S.hs = Math.round(Math.min(HS_MAX, Math.max(HS_MIN, hdrag.s * f)) * 100) / 100;
    applyHeader();
  });
  document.addEventListener('mouseup', function () { if (hdrag) { hdrag = null; split.classList.remove('drag'); save(); } });
  split.addEventListener('dblclick', function () { S.hs = 1; applyHeader(); save(); });
  applyHeader();

  /* ----- drag & resize editor ----- */
  var edit = document.createElement('div'); edit.id = 'bgEdit'; edit.hidden = true;
  edit.innerHTML = '<div id="beBox"><i class="be-h" data-c="nw"></i><i class="be-h" data-c="ne"></i><i class="be-h" data-c="sw"></i><i class="be-h" data-c="se"></i></div>' +
    '<div class="be-bar"><span class="be-tip">Drag to move. Pull a corner or scroll the mouse wheel to resize.</span>' +
    '<button id="beFill" title="Cover the whole panel">Fill</button><button id="beCenter" title="Center it">Center</button><button id="beDone" class="on">Done</button></div>';
  app.appendChild(edit);
  var drag = null;
  function lr() { return layer.getBoundingClientRect(); }
  function updateBox() {
    var e = freeEl(), box = $('beBox'); if (!box) return;
    if (edit.hidden || !e) return;
    var r = e.getBoundingClientRect(), L = lr();
    box.style.left = (r.left - L.left) + 'px'; box.style.top = (r.top - L.top) + 'px';
    box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
  }
  function setFromPx(cx, cy, w) {
    var L = lr(); if (!L.width || !L.height) return;
    S.bx = cx / L.width; S.by = cy / L.height; S.bs = Math.max(0.05, w / L.width);
    placeFree(); updateBox();
  }
  function startEdit() {
    if (S.fit !== 'free') { S.fit = 'free'; bgKey = ''; save(); apply(); }
    panel.hidden = true; edit.hidden = false;
    setTimeout(function () { placeFree(); updateBox(); }, 0);
  }
  function endEdit() { edit.hidden = true; drag = null; save(); panel.hidden = false; refreshUI(); }
  edit.addEventListener('mousedown', function (ev) {
    if (ev.target.closest && ev.target.closest('.be-bar')) return;
    var e = freeEl(); if (!e) return;
    var r = e.getBoundingClientRect(), n = natural(e), ar = n[1] ? n[0] / n[1] : r.width / (r.height || 1);
    var L = lr(), c = ev.target.getAttribute && ev.target.getAttribute('data-c');
    drag = { mode: c || 'move', x: ev.clientX, y: ev.clientY, r: r, L: L, ar: ar, bx: S.bx, by: S.by };
    ev.preventDefault();
  });
  document.addEventListener('mousemove', function (ev) {
    if (!drag) return;
    var L = drag.L, r = drag.r;
    if (drag.mode === 'move') {
      var cx = (drag.bx * L.width) + (ev.clientX - drag.x), cy = (drag.by * L.height) + (ev.clientY - drag.y);
      setFromPx(cx, cy, r.width); return;
    }
    var right = drag.mode.charAt(1) === 'e', bottom = drag.mode.charAt(0) === 's';
    var ox = right ? r.left : r.right, oy = bottom ? r.top : r.bottom;          // fixed opposite corner
    var sx = right ? 1 : -1, sy = bottom ? 1 : -1;
    var w = Math.max(30, (ev.clientX - ox) * sx, (ev.clientY - oy) * sy * drag.ar), h = w / drag.ar;
    var nx = ox + sx * w, ny = oy + sy * h;
    setFromPx((ox + nx) / 2 - L.left, (oy + ny) / 2 - L.top, w);
  });
  document.addEventListener('mouseup', function () { if (drag) { drag = null; save(); } });
  edit.addEventListener('wheel', function (ev) {
    var e = freeEl(); if (!e) return; ev.preventDefault();
    var r = e.getBoundingClientRect(), L = lr(), f = Math.exp(-ev.deltaY * 0.0015);
    var mx = ev.clientX, my = ev.clientY, ccx = r.left + r.width / 2, ccy = r.top + r.height / 2;
    setFromPx(mx + (ccx - mx) * f - L.left, my + (ccy - my) * f - L.top, r.width * f); save();
  });
  $('beDone').onclick = endEdit;
  $('beCenter').onclick = function () { S.bx = 0.5; S.by = 0.5; save(); placeFree(); updateBox(); };
  $('beFill').onclick = function () {
    var e = freeEl(), n = natural(e), W = layer.clientWidth, H = layer.clientHeight;
    if (!n[0] || !W) return;
    S.bs = n[0] * Math.max(W / n[0], H / n[1]) / W; S.bx = 0.5; S.by = 0.5; save(); placeFree(); updateBox();
  };
  window.addEventListener('resize', updateBox);

  function open() { panel.hidden = false; refreshUI(); }
  function close() { panel.hidden = true; }
  function changed() { save(); apply(); refreshUI(true); }

  /* ----- my presets: save / apply / delete the whole look ----- */
  var PKEY = 'ms.presets';
  var LOOK = ['preset', 'accent', 'bg', 'panel', 'text', 'radius', 'hs', 'bgPath', 'dim', 'blur', 'fit', 'pos', 'glass', 'bx', 'by', 'bs', 'binit'];
  function loadMine() { try { var a = JSON.parse(localStorage.getItem(PKEY) || '[]'); return a instanceof Array ? a : []; } catch (e) { return []; } }
  function saveMine(a) { try { localStorage.setItem(PKEY, JSON.stringify(a)); } catch (e) {} }
  function renderMine() {
    var host = $('tpMine'), a = loadMine(); host.innerHTML = '';
    if (!a.length) { host.innerHTML = '<div class="tp-note">Nothing saved yet. Set up a look, name it and press Save.</div>'; return; }
    a.forEach(function (p, i) {
      var row = document.createElement('div'); row.className = 'tp-mine-row';
      var b = document.createElement('button'); b.className = 'tp-mine-name'; b.textContent = p.name; b.title = 'Apply this preset';
      var x = document.createElement('button'); x.className = 'tp-mini'; x.textContent = 'Delete'; x.title = 'Delete this preset';
      b.onclick = function () { LOOK.forEach(function (k) { if (p.v[k] !== undefined) S[k] = p.v[k]; }); bgKey = ''; changed(); };
      x.onclick = function () { var l = loadMine(); l.splice(i, 1); saveMine(l); renderMine(); };
      row.appendChild(b); row.appendChild(x); host.appendChild(row);
    });
  }
  function saveCurrent() {
    var inp = $('tpName'), name = (inp.value || '').replace(/^\s+|\s+$/g, '');
    if (!name) { inp.focus(); return; }
    var v = {}; LOOK.forEach(function (k) { v[k] = S[k]; });
    var a = loadMine(), found = false;
    a.forEach(function (p) { if (p.name.toLowerCase() === name.toLowerCase()) { p.v = v; p.name = name; found = true; } });
    if (!found) a.push({ name: name, v: v });
    saveMine(a); inp.value = ''; renderMine();
  }

  function buildPresets() {
    var host = $('tpPresets'); host.innerHTML = '';
    PRESETS.forEach(function (p) {
      var r = p.dynamic ? aeBase(p) : p;
      var b = document.createElement('button'); b.className = 'tp-preset'; b.dataset.id = p.id;
      b.innerHTML = '<span class="sw"><i style="background:' + r.bg + '"></i><i style="background:' + r.panel + '"></i><i style="background:' + r.accent + '"></i><i style="background:' + r.audio + '"></i></span><span class="nm">' + p.name + '</span>';
      b.onclick = function () { S.preset = p.id; S.accent = S.bg = S.panel = S.text = ''; changed(); };
      host.appendChild(b);
    });
    renderMine();
  }

  var PNOTE = {
    off: '',
    'inside-only': 'Particles react to the mouse while it is over the panel. Following the mouse outside the panel works on Windows only.',
    unavailable: 'The cursor helper could not start, so particles only react while the mouse is over the panel.',
    calibrate: 'Move the mouse over the panel once, and the particles will also follow it outside the panel.',
    active: 'Also following the mouse outside the panel.'
  };
  function partNote() {
    var el = $('tpPNote'); if (!el) return;
    var st = window.MSParticles ? window.MSParticles.status() : 'off';
    el.textContent = PNOTE[st] || '';
  }

  function refreshUI(light) {
    if (panel.hidden && light) return;
    var t = resolve();
    Array.prototype.forEach.call(panel.querySelectorAll('.tp-preset'), function (b) { b.classList.toggle('on', b.dataset.id === S.preset); });
    ['accent', 'bg', 'panel', 'text'].forEach(function (k) {
      var inp = $('tpc_' + k); if (document.activeElement !== inp) inp.value = (S[k] || t[k]).toLowerCase();
      $('tpr_' + k).disabled = !S[k];
    });
    $('tpRadius').value = S.radius; $('tpRadiusV').textContent = S.radius + 'px';
    $('tpDim').value = S.dim; $('tpDimV').textContent = S.dim + '%';
    $('tpBlur').value = S.blur; $('tpBlurV').textContent = S.blur + 'px';
    $('tpGlass').value = S.glass; $('tpGlassV').textContent = S.glass + '%';
    var ps = window.MSParticles ? window.MSParticles.get() : { on: 0, speed: 100 };
    $('tpPart').checked = !!ps.on; $('tpPSpeed').value = ps.speed; $('tpPSpeed').disabled = !ps.on; $('tpPSpeedN').disabled = !ps.on;
    if (document.activeElement !== $('tpPSpeedN')) $('tpPSpeedN').value = ps.speed;
    var pc = $('tpc_pcolor'); if (document.activeElement !== pc) pc.value = (ps.color || t.accent).toLowerCase();
    pc.disabled = !ps.on; $('tpr_pcolor').disabled = !ps.on || !ps.color;
    partNote();
    $('tpZoom').checked = !!S.zoom; $('tpZoomR').value = S.zoomAmt; $('tpZoomR').disabled = !S.zoom; $('tpZoomN').disabled = !S.zoom;
    if (document.activeElement !== $('tpZoomN')) $('tpZoomN').value = S.zoomAmt;
    $('tpAnim').checked = !!S.anim; $('tpAnimSpeed').value = S.animSpeed; $('tpAnimSpeed').disabled = !S.anim;
    $('tpFit').value = S.fit; $('tpPos').value = S.pos;
    var has = !!S.bgPath, exists = has && fileExists(S.bgPath), prev = $('tpPrev');
    $('tpClear').disabled = !has;
    ['tpDim', 'tpBlur', 'tpGlass', 'tpFit', 'tpPos', 'tpEdit'].forEach(function (id) { $(id).disabled = !exists; });
    $('tpPos').disabled = !exists || S.fit === 'free';
    var name = has ? S.bgPath.replace(/\\/g, '/').split('/').pop() : '';
    $('tpBgName').textContent = !has ? '' : (exists ? name : 'File not found: ' + name + ' (it was moved or deleted)');
    if (exists && VIDEO_EXT.indexOf(extOf(S.bgPath)) < 0) {
      prev.style.backgroundImage = 'url("' + toUrl(S.bgPath) + '")'; prev.firstChild.style.display = 'none';
    } else {
      prev.style.backgroundImage = ''; prev.firstChild.style.display = '';
      prev.firstChild.textContent = exists ? 'Video: ' + name : 'No background';
    }
  }

  function wire() {
    buildPresets();
    ['accent', 'bg', 'panel', 'text'].forEach(function (k) {
      $('tpc_' + k).oninput = function (e) { S[k] = e.target.value; save(); apply(); refreshUI(); };
      $('tpr_' + k).onclick = function () { S[k] = ''; changed(); };
    });
    function slider(id, key, num) {
      $(id).oninput = function (e) { S[key] = parseInt(e.target.value, 10); save(); apply(); refreshUI(); };
    }
    slider('tpRadius', 'radius'); slider('tpDim', 'dim'); slider('tpBlur', 'blur'); slider('tpGlass', 'glass');
    $('tpPart').onchange = function (e) { if (window.MSParticles) window.MSParticles.set('on', e.target.checked ? 1 : 0); refreshUI(); };
    $('tpPSpeed').oninput = function (e) { if (window.MSParticles) window.MSParticles.set('speed', e.target.value); $('tpPSpeedN').value = e.target.value; };
    $('tpPSpeedN').oninput = function (e) {
      var v = parseInt(e.target.value, 10); if (isNaN(v)) return;
      v = Math.max(0, Math.min(300, v)); if (window.MSParticles) window.MSParticles.set('speed', v); $('tpPSpeed').value = v;
    };
    $('tpPSpeedN').onchange = function (e) {
      var v = parseInt(e.target.value, 10); if (isNaN(v)) v = 100;
      e.target.value = Math.max(0, Math.min(300, v)); e.target.oninput({ target: e.target });
    };
    $('tpc_pcolor').oninput = function (e) { if (window.MSParticles) window.MSParticles.set('color', e.target.value); refreshUI(); };
    $('tpr_pcolor').onclick = function () { if (window.MSParticles) window.MSParticles.set('color', ''); refreshUI(); };
    if (window.MSParticles) window.MSParticles.onStatus = partNote;
    $('tpZoom').onchange = function (e) { S.zoom = e.target.checked ? 1 : 0; changed(); };
    $('tpZoomR').oninput = function (e) { S.zoomAmt = parseInt(e.target.value, 10); save(); apply(); $('tpZoomN').value = S.zoomAmt; };
    $('tpZoomN').oninput = function (e) {
      var v = parseInt(e.target.value, 10); if (isNaN(v)) return;
      S.zoomAmt = Math.max(100, Math.min(200, v)); save(); apply(); $('tpZoomR').value = S.zoomAmt;
    };
    $('tpZoomN').onchange = function (e) {
      var v = parseInt(e.target.value, 10); if (isNaN(v)) v = 120;
      e.target.value = Math.max(100, Math.min(200, v)); e.target.oninput({ target: e.target });
    };
    $('tpAnim').onchange = function (e) { S.anim = e.target.checked ? 1 : 0; changed(); };
    $('tpAnimSpeed').onchange = function (e) { S.animSpeed = e.target.value; changed(); };
    $('tpFit').onchange = function (e) { S.fit = e.target.value; changed(); };
    $('tpPos').onchange = function (e) { S.pos = e.target.value; changed(); };
    $('tpChoose').onclick = function () {
      var start = (os ? os.homedir() : '') + '/Pictures';
      function legacy() {
        try {
          var r = window.cep.fs.showOpenDialog(false, false, 'Choose a background image, GIF or video', start,
            ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'mp4', 'webm', 'm4v', 'mov']);
          if (r && r.err === 0 && r.data && r.data.length) { S.bgPath = r.data[0]; bgKey = ''; changed(); }
        } catch (e) { $('tpBgName').textContent = 'Could not open the file dialog.'; }
      }
      try {
        /* After Effects' own dialog: the modern Explorer-style window (Organize, New folder, thumbnails) */
        window.__adobe_cep__.evalScript('pickBackground(' + JSON.stringify(start) + ')', function (res) {
          if (res === 'EvalScript error.' || (res && res.indexOf('error:') === 0)) { legacy(); return; }
          if (res) { S.bgPath = res; bgKey = ''; changed(); }
        });
      } catch (e) { legacy(); }
    };
    $('tpClear').onclick = function () { S.bgPath = ''; changed(); };
    $('tpReset').onclick = function () { var k; if (window.MSParticles) window.MSParticles.reset(); for (k in DEF) S[k] = DEF[k]; if (!edit.hidden) { edit.hidden = true; panel.hidden = false; } bgKey = ''; changed(); };
    $('tpBack').onclick = close;
    $('tpSave').onclick = saveCurrent;
    $('tpName').onkeydown = function (ev) { if (ev.key === 'Enter') saveCurrent(); ev.stopPropagation(); };
    $('tpEdit').onclick = startEdit;
    $('gear').onclick = function () { panel.hidden ? open() : close(); };
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!edit.hidden) endEdit(); else if (!panel.hidden) close();
    });
  }

  wire();
  apply();
})();
