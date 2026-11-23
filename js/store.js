/* YUESHI MEDIA CORE - settings that survive clearing the cache.
   Everything the panel saves (ms.* keys) is mirrored to a file outside the CEP cache:
     Windows: %APPDATA%\YSMediaCore\settings.json
     macOS:   ~/Library/Application Support/YSMediaCore/settings.json
   Must load before every other script. */
(function () {
  'use strict';
  var fs, path, os;
  try { fs = require('fs'); path = require('path'); os = require('os'); } catch (e) { return; }
  var base = process.env.APPDATA ||
    (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
  var dir = path.join(base, 'YSMediaCore'), file = path.join(dir, 'settings.json');
  var P = 'ms.';
  var oldFile = path.join(base, 'MediaScrub', 'settings.json');   /* settings from the earlier "Media Scrub" version */

  function readFile() {
    try { var o = JSON.parse(fs.readFileSync(file, 'utf8')); return (o && typeof o === 'object') ? o : null; } catch (e) { return null; }
  }
  function snapshot() {
    var o = {}, i, k;
    for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); if (k.indexOf(P) === 0) o[k] = localStorage.getItem(k); }
    return o;
  }
  function writeFile() {
    try {
      fs.mkdirSync(dir, { recursive: true });
      var tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(snapshot(), null, 1));
      fs.renameSync(tmp, file);
    } catch (e) {}
  }

  /* 1. restore: the file is the source of truth (after a cache clear localStorage is empty) */
  var saved = readFile(), k;
  if (!saved) { try { var old = JSON.parse(fs.readFileSync(oldFile, 'utf8')); if (old && typeof old === 'object') saved = old; } catch (e) {} }
  if (saved) { for (k in saved) { if (k.indexOf(P) === 0 && typeof saved[k] === 'string') localStorage.setItem(k, saved[k]); } }
  writeFile();                            /* keep the file in step (also migrates old settings) */

  /* 2. mirror every later change to the file */
  var timer = null;
  function later() { clearTimeout(timer); timer = setTimeout(writeFile, 250); }
  var sp = Storage.prototype, oSet = sp.setItem, oRem = sp.removeItem;
  sp.setItem = function (a, b) { oSet.call(this, a, b); if (this === localStorage && String(a).indexOf(P) === 0) later(); };
  sp.removeItem = function (a) { oRem.call(this, a); if (this === localStorage && String(a).indexOf(P) === 0) later(); };
  window.addEventListener('beforeunload', function () { clearTimeout(timer); writeFile(); });
})();
