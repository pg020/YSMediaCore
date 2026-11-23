(function () {
  var fs = require('fs'), path = require('path'), os = require('os');
  var cep = window.__adobe_cep__;

  var EXT = {
    video: ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv', '.mxf', '.mpeg', '.mpg', '.mpe', '.m2v', '.m2t', '.m2ts', '.mts'],
    audio: ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg', '.aif', '.aiff'],
    image: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.webp', '.svg', '.psd', '.ai']
  };
  var PREVIEWABLE_IMG = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
  var MAX_WAVE_BYTES = 120 * 1e6;  // compressed audio above this gets a plain placeholder (WAV has no limit)

  var ICON = {
    folder: '<svg viewBox="0 0 24 24"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>',
    video: '<svg viewBox="0 0 24 24"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm6 4v6l5-3-5-3z"/></svg>',
    audio: '<svg viewBox="0 0 24 24"><path d="M9 3v11.3A3.5 3.5 0 1 0 11 17.5V8h6V3H9z"/></svg>',
    image: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-3 10h16v-3l-4-4-5 5-2-2-5 4z"/></svg>'
  };
  function glyph(t) { return '<span class="glyph">' + ICON[t] + '</span>'; }

  var home = os.homedir();
  var QUICK = {
    desktop: path.join(home, 'Desktop'), downloads: path.join(home, 'Downloads'),
    videos: path.join(home, process.platform === 'darwin' ? 'Movies' : 'Videos'),
    music: path.join(home, 'Music'), pictures: path.join(home, 'Pictures')
  };

  var state = {
    dir: localStorage.getItem('ms.dir') || QUICK.videos,
    vol: parseFloat(localStorage.getItem('ms.vol') || '0.7'),
    q: '', f: { video: 1, audio: 1, image: 1 }
  };
  var hist = [{ dir: state.dir, scroll: 0 }], hidx = 0;
  var navAnim = '';   // 'fwd' | 'back' while a folder change is being drawn (see theme.js slideIn)
  function norm(p) { return String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() + '/'; }
  function isAncestor(a, b) { return a !== b && norm(b).indexOf(norm(a)) === 0; }
  var drives = [];
  var $ = function (id) { return document.getElementById(id); };
  var grid = $('grid'), statusEl = $('status'), msgEl = $('msg');
  $('vol').value = Math.round(state.vol * 100); $('volR').value = $('vol').value;
  var savedSize = parseInt(localStorage.getItem('ms.size') || '140', 10);
  $('size').value = savedSize; $('sizeR').value = savedSize; grid.style.setProperty('--tile', savedSize + 'px');

  // .mpeg / .mpg files are sometimes really audio (an MP3 saved as .mpeg). Look at the first bytes to tell.
  var AMBIGUOUS = ['.mpeg', '.mpg', '.mpe'];
  function looksLikeAudio(file) {
    var fd = null;
    try {
      fd = fs.openSync(file, 'r');
      var b = Buffer.alloc(4);
      fs.readSync(fd, b, 0, 4, 0);
      if (b.toString('ascii', 0, 3) === 'ID3') return true;          // MP3 with a tag at the start
      if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) return true;      // raw MPEG audio frame
      return false;                                                  // 00 00 01 BA / B3 = real MPEG video
    } catch (e) { return false; }
    finally { if (fd !== null) { try { fs.closeSync(fd); } catch (x) {} } }
  }

  function typeOf(name) {
    var e = path.extname(name).toLowerCase();
    for (var t in EXT) if (EXT[t].indexOf(e) > -1) return t;
    return null;
  }
  function toUrl(p) {
    var u = p.replace(/\\/g, '/');
    if (u.charAt(0) !== '/') u = '/' + u;
    return 'file://' + encodeURI(u).replace(/#/g, '%23');
  }
  function fmt(s) {
    if (!isFinite(s)) return '0:00';
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function size(b) {
    if (b > 1e9) return (b / 1e9).toFixed(1) + ' GB';
    if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
    return Math.max(1, Math.round(b / 1e3)) + ' KB';
  }
  var HINT = 'Click audio to play or pause (click the waveform where you want to start). Move over video to scrub. Double-click to import. Shift + double-click to import and add to the active comp.';
  var hintOpen = localStorage.getItem('ms.hint') !== 'closed', sayTimer = null;
  function showHint() {
    clearTimeout(sayTimer);
    if (hintOpen) { msgEl.textContent = HINT; statusEl.style.display = 'flex'; }
    else statusEl.style.display = 'none';
  }
  function say(t) {                       // short messages (import results, errors) show for a few seconds
    clearTimeout(sayTimer);
    msgEl.textContent = t; statusEl.style.display = 'flex';
    sayTimer = setTimeout(showHint, 5000);
  }

  /* ---------- Video: idle tiles show a still snapshot, the real <video> is only loaded while hovering ---------- */
  var snapQ = [], snapBusy = 0;
  /* Some codecs (for example 10-bit H.264/HEVC) decode to a flat green picture instead of failing. Spot that so it is never shown. */
  var probeCv = document.createElement('canvas'); probeCv.width = 16; probeCv.height = 10;
  var probeG = probeCv.getContext('2d');
  function looksGreen(v) {
    try {
      probeG.drawImage(v, 0, 0, 16, 10);
      var d = probeG.getImageData(0, 0, 16, 10).data, n = 0, i;
      for (i = 0; i < d.length; i += 4) if (d[i + 1] > d[i] + 30 && d[i + 1] > d[i + 2] + 30) n++;
      return n >= 144;                       // 90% of the 160 samples are green
    } catch (e) { return false; }
  }
  function snapPump() {
    while (snapBusy < 2 && snapQ.length) { var t = snapQ.shift(); if (t._snap) { snapBusy++; t._snap(function () { snapBusy--; snapPump(); }); } }
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var t = en.target;
      if (en.isIntersecting && t._snap && !t._snapDone && !t._snapQueued) { t._snapQueued = true; snapQ.push(t); snapPump(); }
    });
  }, { root: grid, rootMargin: '200px' });

  /* ---------- Audio: waveform generation (one file at a time) ---------- */
  var current = null;
  function stopCurrent(reset) { if (!current) return; var c = current; current = null; c.stop(reset); }
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  var actx = null, peakCache = {}, queue = [], busy = false;
  function getCtx() {
    if (!actx) { var C = window.AudioContext || window.webkitAudioContext; actx = new C(); }
    return actx;
  }
  function drawWave(canvas, peaks, prog) {
    var w = canvas.width, h = canvas.height, g = canvas.getContext('2d');
    var W = (window.MSTheme && window.MSTheme.wave) || { idle: '#e0a458', played: '#ffc46b', rest: '#7d6238' };
    g.clearRect(0, 0, w, h);
    var n = peaks.length, bw = w / n;
    for (var i = 0; i < n; i++) {
      g.fillStyle = prog < 0 ? W.idle : (i / n < prog ? W.played : W.rest);
      var bh = Math.max(3, peaks[i] * h * 0.86);
      g.fillRect(i * bw + 0.5, (h - bh) / 2, Math.max(1, bw - 1.5), bh);
    }
  }
  function paint(tile, prog) { if (tile._peaks) drawWave(tile._canvas, tile._peaks, prog); }
  function flatPeaks() { var a = []; for (var i = 0; i < 70; i++) a.push(0.12 + 0.1 * Math.abs(Math.sin(i * 0.7))); return a; }

  function makePeaks(audio) {
    var d = audio.getChannelData(0), n = 70, step = Math.floor(d.length / n) || 1, peaks = [], top = 0.0001;
    for (var i = 0; i < n; i++) {
      var max = 0, stride = Math.max(1, Math.floor(step / 300));
      for (var j = i * step; j < (i + 1) * step && j < d.length; j += stride) {
        var v = Math.abs(d[j]); if (v > max) max = v;
      }
      peaks.push(max); if (max > top) top = max;
    }
    return peaks.map(function (p) { return p / top; });
  }

  /* Long WAV files: read the waveform straight from the file in small slices (no full decode, no size limit) */
  function wavPeaks(file, fileSize, cb) {
    fs.open(file, 'r', function (e, fd) {
      if (e) return cb(null);
      var finish = function (r) { fs.close(fd, function () {}); cb(r); };
      var head = Buffer.alloc(65536);
      fs.read(fd, head, 0, 65536, 0, function (e2, got) {
        if (e2 || got < 44) return finish(null);
        var tag0 = head.toString('ascii', 0, 4);
        if (tag0 !== 'RIFF' && tag0 !== 'RF64') return finish(null);
        var pos = 12, fmt = null, dataPos = 0, dataLen = 0;
        while (pos + 8 <= got) {
          var id = head.toString('ascii', pos, pos + 4), len = head.readUInt32LE(pos + 4);
          if (id === 'fmt ') {
            fmt = { tag: head.readUInt16LE(pos + 8), ch: head.readUInt16LE(pos + 10), rate: head.readUInt32LE(pos + 12), bits: head.readUInt16LE(pos + 22) };
            if (fmt.tag === 0xFFFE && len >= 26) fmt.tag = head.readUInt16LE(pos + 32);
          } else if (id === 'data') { dataPos = pos + 8; dataLen = len; break; }
          pos += 8 + len + (len & 1);
        }
        if (!fmt || !dataPos || !fmt.ch || !fmt.rate) return finish(null);
        var okFmt = (fmt.tag === 1 && [8, 16, 24, 32].indexOf(fmt.bits) > -1) || (fmt.tag === 3 && fmt.bits === 32);
        if (!okFmt) return finish(null);
        var bpf = fmt.ch * fmt.bits / 8;
        dataLen = Math.min(dataLen, fileSize - dataPos);
        var frames = Math.floor(dataLen / bpf);
        if (frames < 1) return finish(null);
        var N = 70, peaks = [], top = 0.0001, i = 0, blockFrames = 2048, buf = Buffer.alloc(blockFrames * bpf);
        var sample = function (off) {
          if (fmt.tag === 3) return Math.abs(buf.readFloatLE(off));
          if (fmt.bits === 16) return Math.abs(buf.readInt16LE(off)) / 32768;
          if (fmt.bits === 24) return Math.abs(buf.readIntLE(off, 3)) / 8388608;
          if (fmt.bits === 32) return Math.abs(buf.readInt32LE(off)) / 2147483648;
          return Math.abs(buf[off] - 128) / 128;
        };
        (function next() {
          if (i >= N) {
            return finish({ peaks: peaks.map(function (p) { return p / top; }), dur: frames / fmt.rate });
          }
          var startFrame = Math.floor(i * frames / N);
          var want = Math.min(blockFrames, frames - startFrame) * bpf;
          fs.read(fd, buf, 0, want, dataPos + startFrame * bpf, function (er, n) {
            if (er) return finish(null);
            var max = 0, step = fmt.bits / 8;
            for (var o = 0; o + step <= n; o += bpf) { var v = sample(o); if (v > max) max = v; }
            peaks.push(max); if (max > top) top = max;
            i++; next();
          });
        })();
      });
    });
  }

  function runJob(job, done) {
    var finished = false, timer = null;
    var end = function () { if (finished) return; finished = true; clearTimeout(timer); done(); };
    var apply = function (peaks, dur) {
      if (finished) return;
      peakCache[job.path] = { peaks: peaks, dur: dur };
      job.tile._peaks = peaks; job.tile._dur = dur; job.tile._setDur(dur);
      paint(job.tile, -1); end();
    };
    var fallback = function () {
      if (finished) return;
      job.tile._peaks = flatPeaks(); paint(job.tile, -1);
      var a = new Audio(); a.preload = 'metadata';       // read the length from the file header only
      a.onloadedmetadata = function () { job.tile._setDur(a.duration); a.removeAttribute('src'); };
      a.src = toUrl(job.path);
      end();
    };
    timer = setTimeout(fallback, 15000);                  // a slow file can never block the ones after it

    var cached = peakCache[job.path];
    if (cached) return apply(cached.peaks, cached.dur);

    fs.stat(job.path, function (e, st) {
      if (e) return fallback();
      var decode = function () {
        if (st.size > MAX_WAVE_BYTES) return fallback();
        fs.readFile(job.path, function (err, buf) {
          if (err) return fallback();
          var ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          try {
            getCtx().decodeAudioData(ab, function (audio) { apply(makePeaks(audio), audio.duration); }, fallback);
          } catch (ex) { fallback(); }
        });
      };
      if (path.extname(job.path).toLowerCase() === '.wav') {
        wavPeaks(job.path, st.size, function (r) { if (r) apply(r.peaks, r.dur); else decode(); });
      } else decode();
    });
  }
  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    runJob(queue.shift(), function () { busy = false; setTimeout(pump, 0); });
  }
  var waveObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var t = en.target;
      if (en.isIntersecting && !t._waveQueued) {
        t._waveQueued = true; waveObs.unobserve(t);
        queue.push({ path: t._path, canvas: t._canvas, tile: t });
        pump();
      }
    });
  }, { root: grid, rootMargin: '200px' });

  /* ---------- Folder listing ---------- */
  function listDir() {
    var out = [];
    try {
      fs.readdirSync(state.dir).forEach(function (n) {
        if (n.charAt(0) === '.') return;
        var full = path.join(state.dir, n), st;
        try { st = fs.statSync(full); } catch (e) { return; }
        if (st.isDirectory()) out.push({ name: n, full: full, type: 'folder' });
        else {
          var t = typeOf(n);
          if (t === 'video' && AMBIGUOUS.indexOf(path.extname(n).toLowerCase()) > -1 && looksLikeAudio(full)) t = 'audio';
          if (t && state.f[t]) out.push({ name: n, full: full, type: t, bytes: st.size });
        }
      });
    } catch (e) { say('Cannot read this folder: ' + e.message); }
    var q = state.q.toLowerCase();
    if (q) out = out.filter(function (i) { return i.name.toLowerCase().indexOf(q) > -1; });
    out.sort(function (a, b) {
      if ((a.type === 'folder') !== (b.type === 'folder')) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    return out;
  }

  /* ---------- Drives (C:, D:, E: ... or /Volumes on Mac) ---------- */
  function markDrives() {
    var cur = state.dir.toLowerCase();
    Array.prototype.forEach.call($('drives').querySelectorAll('button'), function (b) {
      b.classList.toggle('on', cur.indexOf(b.dataset.root.toLowerCase()) === 0);
    });
  }
  function drawDrives() {
    var box = $('drives'); box.innerHTML = '';
    if (!drives.length) return;
    var l = document.createElement('span'); l.className = 'lbl'; l.textContent = 'Drives'; box.appendChild(l);
    drives.forEach(function (d) {
      var b = document.createElement('button');
      b.textContent = d.label; b.dataset.root = d.root; b.title = d.root;
      b.onclick = function () { go(d.root); };
      box.appendChild(b);
    });
    markDrives();
  }
  function scanDrives() {
    if (process.platform === 'win32') {
      var letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), found = [], left = letters.length;
      letters.forEach(function (L) {
        fs.access(L + ':\\', function (err) {
          if (!err) found.push({ label: L + ':', root: L + ':\\' });
          if (--left === 0) {
            found.sort(function (a, b) { return a.label < b.label ? -1 : 1; });
            drives = found; drawDrives();
          }
        });
      });
    } else {
      var roots = process.platform === 'darwin' ? ['/Volumes'] : ['/media/' + os.userInfo().username, '/mnt', '/run/media/' + os.userInfo().username];
      var out = [{ label: '/', root: '/' }];
      roots.forEach(function (r) {
        try { fs.readdirSync(r).forEach(function (n) { if (n.charAt(0) !== '.') out.push({ label: n, root: path.join(r, n) }); }); } catch (e) {}
      });
      drives = out; drawDrives();
    }
  }
  var lastScan = 0;
  window.addEventListener('focus', function () {   // picks up USB drives plugged in while the panel is open
    if (Date.now() - lastScan > 2000) { lastScan = Date.now(); scanDrives(); }
  });

  function buildCrumbs() {
    var el = $('path'); el.innerHTML = '';
    var parts = state.dir.split(/[\\/]+/).filter(Boolean);
    var acc = process.platform === 'win32' ? '' : '/';
    parts.forEach(function (p, i) {
      if (i === 0 && /:$/.test(p)) acc = p + '\\'; else acc = path.join(acc, p);
      var s = document.createElement('span');
      s.className = 'crumb' + (i === parts.length - 1 ? ' cur' : '');
      s.textContent = p;
      (function (target) { if (i < parts.length - 1) s.onclick = function () { go(target); }; })(acc);
      el.appendChild(s);
      if (i < parts.length - 1) { var sp = document.createElement('span'); sp.className = 'sep'; sp.textContent = '\u203A'; el.appendChild(sp); }
    });
    el.title = state.dir; el.scrollLeft = el.scrollWidth;   /* long paths: keep the current folder in view */
  }

  function render(scroll) {
    stopCurrent(true); io.disconnect(); waveObs.disconnect(); queue.length = 0; snapQ.length = 0;
    buildCrumbs(); markDrives();
    $('back').disabled = hidx <= 0;
    $('fwd').disabled = hidx >= hist.length - 1;
    $('up').disabled = path.dirname(state.dir) === state.dir;
    grid.innerHTML = '';
    var items = listDir();
    var files = items.filter(function (i) { return i.type !== 'folder'; }).length;
    $('count').textContent = files + (files === 1 ? ' file' : ' files');
    if (!items.length) {
      var e = document.createElement('div');
      e.id = 'empty';
      e.textContent = 'No media here. Pick another folder or turn a filter back on.';
      grid.appendChild(e);
      return;
    }
    var frag = document.createDocumentFragment();
    items.forEach(function (it) { frag.appendChild(makeTile(it)); });
    grid.appendChild(frag);
    grid.scrollTop = scroll || 0;
    if (navAnim && window.MSTheme && window.MSTheme.slideIn) window.MSTheme.slideIn(grid, navAnim);
    navAnim = '';
  }

  function makeTile(it) {
    var tile = document.createElement('div');
    tile.className = 'tile'; tile.tabIndex = 0; tile.dataset.type = it.type; tile.title = it.name;
    var thumb = document.createElement('div'); thumb.className = 'thumb';
    var bar = document.createElement('div'); bar.className = 'bar';
    var time = document.createElement('div'); time.className = 'time';
    var head = null, ghost = null, pbtn = null;
    var durEl = document.createElement('div'); durEl.className = 'durbadge';
    tile._setDur = function (d) { if (isFinite(d) && d > 0) { durEl.textContent = fmt(d); durEl.classList.add('has'); } };
    var meta = document.createElement('div'); meta.className = 'meta';
    var name = document.createElement('div'); name.className = 'name'; name.textContent = it.name;
    var sub = document.createElement('div'); sub.className = 'sub';
    meta.appendChild(name); meta.appendChild(sub);
    var media = null;
    var ext = path.extname(it.name).toLowerCase();

    if (it.type === 'folder') {
      thumb.innerHTML = glyph('folder');
      tile.addEventListener('click', function () { go(it.full); });
    } else if (it.type === 'image') {
      if (PREVIEWABLE_IMG.indexOf(ext) > -1) {
        var img = new Image(); img.src = toUrl(it.full); thumb.appendChild(img);
      } else thumb.innerHTML = glyph('image');
    } else if (it.type === 'video') {
      media = document.createElement('video');
      media.muted = true; media.preload = 'metadata'; media.style.display = 'none';
      var snap = document.createElement('canvas'); snap.width = 280; snap.height = 175;
      thumb.appendChild(snap); thumb.appendChild(media);
      tile._src = toUrl(it.full) + '#t=0.1';
      function unloadVideo() {
        if (!media) return;
        media.style.display = 'none';
        if (media.getAttribute('src')) { media.pause(); media.removeAttribute('src'); media.load(); }
      }
      /* one-off: load the first frame, paint it onto the canvas, then free the video again */
      function paintFrame(m) {            /* draw the current frame onto the canvas (cover-fit); false if it is empty or a green decode error */
        var vw = m.videoWidth, vh = m.videoHeight;
        if (!vw || !vh || looksGreen(m)) return false;
        var g = snap.getContext('2d'), cw = snap.width, ch = snap.height, k = Math.max(cw / vw, ch / vh), dw = vw * k, dh = vh * k;
        g.drawImage(m, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
        return true;
      }
      var base = null;                    /* copy of the first frame, put back when the mouse leaves */
      function noPreview(m) {             /* the codec cannot be previewed here: neat placeholder, import still works */
        var d = m.duration;
        try { m.onseeked = null; m.pause(); m.removeAttribute('src'); m.load(); } catch (e) {}
        io.unobserve(tile);
        thumb.innerHTML = glyph('video');
        thumb.appendChild(bar); thumb.appendChild(time); thumb.appendChild(durEl);
        tile._setDur(d);
        tile.title = it.name + ' (no preview for this codec, imports fine)';
        tile._snapDone = true; media = null;
      }
      tile._snap = function (finish) {
        var m = media, ended = false, timer;
        if (!m) { finish(); return; }
        function done(ok) {
          if (ended) return; ended = true; clearTimeout(timer);
          m.onloadeddata = null; m.onerror = null;
          if (!ok) tile._snapQueued = false;          // try again the next time it scrolls into view
          if (media === m) { if (tile._live) { if (ok) tile._vready = true; } else unloadVideo(); }
          finish();
        }
        function accept() {
          base = document.createElement('canvas'); base.width = snap.width; base.height = snap.height;
          base.getContext('2d').drawImage(snap, 0, 0);
          tile._setDur(m.duration); tile._dur = m.duration; tile._snapDone = true;
          done(true);
        }
        /* first frame; if it is green or empty try two later positions, then give up gracefully */
        var spots = [0, 0.12, 0.3], n = 0;
        function attempt() {
          if (ended) return;
          if (paintFrame(m)) { accept(); return; }
          if (++n >= spots.length || !m.duration) { ended = true; clearTimeout(timer); noPreview(m); finish(); return; }
          m.onseeked = function () { m.onseeked = null; setTimeout(attempt, 80); };
          m.currentTime = m.duration * spots[n];
        }
        m.onloadeddata = function () { m.onloadeddata = null; setTimeout(attempt, 40); };
        m.onerror = function () { done(false); };
        timer = setTimeout(function () { done(false); }, 8000);
        m.src = tile._src;
      };
      tile._unloadVideo = unloadVideo;
      io.observe(tile);
    } else if (it.type === 'audio') {
      media = document.createElement('audio'); media.preload = 'none'; media.src = toUrl(it.full);
      var canvas = document.createElement('canvas'); canvas.width = 280; canvas.height = 175;
      thumb.appendChild(canvas);
      head = document.createElement('div'); head.className = 'head'; thumb.appendChild(head);
      ghost = document.createElement('div'); ghost.className = 'ghost'; thumb.appendChild(ghost);
      pbtn = document.createElement('div'); pbtn.className = 'pbtn'; pbtn.innerHTML = PLAY; thumb.appendChild(pbtn);
      tile._path = it.full; tile._canvas = canvas;
      waveObs.observe(tile);
    }
    thumb.appendChild(bar); thumb.appendChild(time); thumb.appendChild(durEl);
    tile.appendChild(thumb); tile.appendChild(meta);

    if (it.type === 'video') {
      // Video: hover and move to scrub through the frames
      var pend = null;
      tile.addEventListener('mouseenter', function () {
        tile.classList.add('live'); tile._live = true;
        if (media && !media.getAttribute('src')) {
          media.onloadeddata = function () { media.onloadeddata = null; tile._vready = true; };
          media.src = tile._src;
        }
      });
      tile.addEventListener('mousemove', function (ev) {
        if (!media || !tile._vready || !media.duration) return;
        var r = thumb.getBoundingClientRect();
        var p = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
        bar.style.width = (p * 100) + '%';
        time.textContent = fmt(p * media.duration) + ' / ' + fmt(media.duration);
        var target = p * media.duration;
        if (media.seeking) pend = target; else media.currentTime = target;   // never stack seeks: only the newest position waits
      });
      /* a frame is shown only once it is fully decoded, so the picture never goes blank between seeks */
      media.addEventListener('seeked', function () {
        if (!tile._live || !media) return;
        paintFrame(media);                 // a green or empty frame is simply skipped
        if (pend !== null) { var t = pend; pend = null; media.currentTime = t; }
      });
      tile.addEventListener('mouseleave', function () {
        tile.classList.remove('live'); tile._live = false; tile._vready = false; pend = null; bar.style.width = '0';
        if (base) snap.getContext('2d').drawImage(base, 0, 0);
        if (tile._unloadVideo) tile._unloadVideo();
      });
      media.addEventListener('error', function () {
        if (media && media.getAttribute('src')) {
          io.unobserve(tile);
          thumb.innerHTML = glyph('video');
          thumb.appendChild(bar); thumb.appendChild(time);
          tile.title = it.name + ' (no preview, imports fine)';
          media = null;
        }
      });
    }

    if (it.type === 'audio') {
      // Audio: click = play / pause, hover = see where a click will start
      var pending = 0;
      var fracAt = function (ev) {
        var r = thumb.getBoundingClientRect();
        return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      };
      var setPlaying = function (on) {
        tile.classList.toggle('playing', on);
        pbtn.innerHTML = on ? PAUSE : PLAY;
      };
      tile._stop = function (reset) {
        media.pause(); setPlaying(false);
        if (reset) {
          try { media.currentTime = 0; } catch (e) {}
          tile.classList.remove('started'); bar.style.width = '0'; paint(tile, -1);
        }
      };
      var toggle = function (p) {
        if (!media.paused) { media.pause(); setPlaying(false); return; }
        stopCurrent(true);
        media.volume = state.vol; media.preload = 'auto';
        if (media.readyState > 0 && media.duration) media.currentTime = p * media.duration;
        else pending = p;                       // applied as soon as the file has loaded
        tile.classList.add('started'); setPlaying(true);
        current = { tile: tile, media: media, stop: tile._stop };
        var pr = media.play(); if (pr && pr.catch) pr.catch(function () { setPlaying(false); });
      };
      tile._toggle = toggle;
      tile.addEventListener('click', function (ev) { toggle(fracAt(ev)); });
      tile.addEventListener('mouseenter', function () { tile.classList.add('live'); });
      tile.addEventListener('mousemove', function (ev) {
        var p = fracAt(ev), dur = media.duration || tile._dur;
        ghost.style.left = (p * 100) + '%';
        if (dur) time.textContent = fmt(p * dur) + ' / ' + fmt(dur);
      });
      tile.addEventListener('mouseleave', function () {
        tile.classList.remove('live');
        if (media.duration && tile.classList.contains('started'))
          time.textContent = fmt(media.currentTime) + ' / ' + fmt(media.duration);
      });
      media.addEventListener('loadedmetadata', function () {
        sub.textContent = fmt(media.duration); tile._dur = media.duration; tile._setDur(media.duration);
        if (pending) { media.currentTime = pending * media.duration; pending = 0; }
      });
      media.addEventListener('timeupdate', function () {
        if (!media.duration) return;
        var p = media.currentTime / media.duration;
        head.style.left = (p * 100) + '%'; bar.style.width = (p * 100) + '%';
        paint(tile, p);
        if (!tile.classList.contains('live')) time.textContent = fmt(media.currentTime) + ' / ' + fmt(media.duration);
      });
      media.addEventListener('ended', function () { tile._stop(true); if (current && current.tile === tile) current = null; });
    }

    if (it.type !== 'folder') {
      tile.addEventListener('dblclick', function (ev) {
        if (tile._stop) { tile._stop(true); if (current && current.tile === tile) current = null; }
        importFile(it, ev.shiftKey);
      });
      tile.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') importFile(it, ev.shiftKey);
        if (ev.key === ' ' && tile._toggle) {
          ev.preventDefault();
          tile._toggle(media && media.duration ? media.currentTime / media.duration : 0);
        }
      });
    }
    return tile;
  }

  function importFile(it, addToComp) {
    say('Importing ' + it.name + '...');
    cep.evalScript('importMedia(' + JSON.stringify(it.full) + ',' + (addToComp ? 'true' : 'false') + ')', function (res) {
      say(it.name + ': ' + res);
    });
  }

  function resetSearch() { state.q = ''; $('search').value = ''; }
  function go(dir) {
    if (dir === state.dir) return;
    hist[hidx].scroll = grid.scrollTop;
    navAnim = isAncestor(dir, state.dir) ? 'back' : 'fwd';     // heading up the tree reads as "back"
    hist = hist.slice(0, hidx + 1); hist.push({ dir: dir, scroll: 0 }); hidx = hist.length - 1;
    state.dir = dir; localStorage.setItem('ms.dir', dir); resetSearch(); render(0);
  }
  function navTo(i) {
    if (i < 0 || i >= hist.length) return;
    hist[hidx].scroll = grid.scrollTop;
    navAnim = i < hidx ? 'back' : 'fwd';
    hidx = i; state.dir = hist[i].dir; localStorage.setItem('ms.dir', state.dir);
    resetSearch(); render(hist[i].scroll);          // comes back to the same scroll position
  }

  $('back').onclick = function () { navTo(hidx - 1); };
  $('fwd').onclick = function () { navTo(hidx + 1); };
  document.addEventListener('mouseup', function (ev) {
    if (ev.button === 3) navTo(hidx - 1);
    if (ev.button === 4) navTo(hidx + 1);
  });
  $('up').onclick = function () { var p = path.dirname(state.dir); if (p !== state.dir) go(p); };
  $('choose').onclick = function () {
    function legacy() {
      var r = window.cep.fs.showOpenDialog(false, true, 'Choose your media folder', state.dir);
      if (r && r.data && r.data.length) go(r.data[0]);
    }
    try {
      cep.evalScript('pickFolder(' + JSON.stringify(state.dir) + ')', function (res) {
        if (res === 'EvalScript error.' || (res && res.indexOf('error:') === 0)) { legacy(); return; }
        if (res) go(res);
      });
    } catch (e) { legacy(); }
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-q]'), function (b) {
    b.onclick = function () { go(QUICK[b.dataset.q]); };
  });
  Array.prototype.forEach.call(document.querySelectorAll('.flt'), function (b) {
    b.onclick = function () { b.classList.toggle('on'); state.f[b.dataset.f] = b.classList.contains('on') ? 1 : 0; render(); };
  });
  $('search').oninput = function (e) { state.q = e.target.value; render(); };
  $('size').oninput = function (e) {
    var v = parseInt(e.target.value, 10);
    if (isNaN(v) || v < 80) return;
    v = Math.min(400, v);
    grid.style.setProperty('--tile', v + 'px'); localStorage.setItem('ms.size', v);
    $('sizeR').value = v;
  };
  $('size').onchange = function (e) {
    var v = parseInt(e.target.value, 10); if (isNaN(v)) v = 140;
    e.target.value = Math.min(400, Math.max(80, v)); e.target.oninput({ target: e.target });
  };
  $('vol').onchange = function (e) { var v = parseInt(e.target.value, 10); e.target.value = isNaN(v) ? 70 : Math.min(100, Math.max(0, v)); };
  $('vol').oninput = function (e) {
    var v = parseInt(e.target.value, 10);
    if (isNaN(v)) return;
    v = Math.min(100, Math.max(0, v));
    state.vol = v / 100; localStorage.setItem('ms.vol', state.vol);
    $('volR').value = v;
    if (current) current.media.volume = state.vol;
  };

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') stopCurrent(true); });

  $('sizeR').oninput = function (e) { $('size').value = e.target.value; $('size').oninput({ target: $('size') }); };
  $('volR').oninput = function (e) { $('vol').value = e.target.value; $('vol').oninput({ target: $('vol') }); };

  $('closeHint').onclick = function () {
    hintOpen = false; localStorage.setItem('ms.hint', 'closed'); showHint();
  };
  $('help').onclick = function () {
    hintOpen = true; localStorage.setItem('ms.hint', 'open'); showHint();
  };

  // theme changed: repaint idle waveforms in the new colors
  document.addEventListener('mstheme', function () {
    Array.prototype.forEach.call(grid.querySelectorAll('.tile'), function (t) {
      if (t._peaks && !t.classList.contains('playing')) paint(t, -1);
    });
  });

  showHint();
  scanDrives();
  render();
})();
