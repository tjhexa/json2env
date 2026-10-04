/* json2env app — fully offline, zero dependencies.
   Conversion core preserved from old/json2env.html. */
(function () {
  "use strict";

  var jsonInputEl = document.getElementById("jsonInput");
  var envInputEl = document.getElementById("envInput");
  var jsonErrorEl = document.getElementById("jsonError");
  var envErrorEl = document.getElementById("envError");
  var jsonStatsEl = document.getElementById("jsonStats");
  var envStatsEl = document.getElementById("envStats");
  var liveToggle = document.getElementById("liveToggle");
  var headerToggle = document.getElementById("headerToggle");
  var sortToggle = document.getElementById("sortToggle");
  var toastEl = document.getElementById("toast");
  var fileInputEl = document.getElementById("fileInput");
  var toastTimer = null;
  var liveTimer = null;
  var liveSource = null; // "json" | "env" | null — tracks last edited side
  var uploadTarget = "json";

  /* ---------- Core (preserved verbatim semantics) ---------- */

  function isPlainObject(value) {
    if (value === null) return false;
    if (Array.isArray(value)) return false;
    return typeof value === "object";
  }

  function isPrimitive(value) {
    var t = typeof value;
    return value === null || t === "string" || t === "number" || t === "boolean";
  }

  function toEnvKey(pathParts) {
    return pathParts.join("_").toUpperCase();
  }

  function toJsonKeyPart(part) {
    return part.toLowerCase();
  }

  function jsonToEnvLines(jsonValue) {
    var lines = [];

    function handleArray(path, arr) {
      if (arr.length === 0) {
        lines.push(toEnvKey(path) + "=");
        return;
      }
      var allPrimitive = arr.every(isPrimitive);
      if (allPrimitive) {
        lines.push(toEnvKey(path) + "=" + String(arr.join(",")));
        return;
      }
      arr.forEach(function (item, index) {
        walk(path.concat(String(index)), item);
      });
    }

    function walk(path, value) {
      if (Array.isArray(value)) {
        handleArray(path, value);
        return;
      }
      if (isPlainObject(value)) {
        Object.keys(value).forEach(function (key) {
          walk(path.concat(toJsonKeyPart(key)), value[key]);
        });
        return;
      }
      if (!isPrimitive(value)) return;
      var envKey = toEnvKey(path);
      if (value === null) {
        lines.push(envKey + "=");
        return;
      }
      lines.push(envKey + "=" + String(value));
    }

    if (!isPlainObject(jsonValue)) {
      throw new Error("Top-level JSON must be an object.");
    }
    Object.keys(jsonValue).forEach(function (key) {
      walk([toJsonKeyPart(key)], jsonValue[key]);
    });
    return lines;
  }

  function parseEnv(envText) {
    var result = {};
    envText.split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line || line.charAt(0) === "#") return;
      // Support optional `export ` prefix
      var body = line.replace(/^export\s+/, "");
      var eqIndex = body.indexOf("=");
      if (eqIndex === -1) return;
      var key = body.slice(0, eqIndex).trim();
      if (!key) return;
      var rawValue = body.slice(eqIndex + 1).trim();
      var value = parseEnvValue(stripQuotes(rawValue));
      var keyParts = key.split("_").map(toJsonKeyPart);
      assignNested(result, keyParts, value);
    });
    return result;
  }

  function stripQuotes(value) {
    if (value.length >= 2) {
      var first = value.charAt(0);
      var last = value.charAt(value.length - 1);
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return value.slice(1, -1);
      }
    }
    return value;
  }

  function parseEnvValue(value) {
    if (value === "") return "";
    if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
    if (/^[+-]?\d+$/.test(value)) {
      var num = Number(value);
      if (Number.isSafeInteger(num)) return num;
    }
    if (value.indexOf(",") !== -1) {
      return value.split(",").map(function (p) {
        return parseEnvValuePrimitive(p.trim());
      });
    }
    return value;
  }

  function parseEnvValuePrimitive(value) {
    if (value === "") return "";
    if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
    if (/^[+-]?\d+$/.test(value)) {
      var num = Number(value);
      if (Number.isSafeInteger(num)) return num;
    }
    return value;
  }

  function assignNested(target, pathParts, value) {
    var current = target;
    for (var i = 0; i < pathParts.length; i += 1) {
      var part = pathParts[i];
      var isLast = i === pathParts.length - 1;
      var index = Number(part);
      var isIndex = Number.isInteger(index) && String(index) === part;
      if (isLast) {
        if (isIndex && Array.isArray(current)) {
          current[index] = value;
        } else {
          current[part] = value;
        }
        return;
      }
      if (isIndex) {
        if (!Array.isArray(current[part])) current[part] = [];
        current = current[part];
      } else {
        if (!isPlainObject(current[part]) && !Array.isArray(current[part])) {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }

  function sortDeep(value) {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (isPlainObject(value)) {
      var out = {};
      Object.keys(value).sort().forEach(function (k) {
        out[k] = sortDeep(value[k]);
      });
      return out;
    }
    return value;
  }

  /* ---------- Small utilities ---------- */

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2200);
  }

  function setError(el, message) {
    el.textContent = message || "";
  }

  function countKeys(value) {
    if (Array.isArray(value)) {
      return value.reduce(function (n, v) { return n + countKeys(v); }, 0);
    }
    if (isPlainObject(value)) {
      return Object.keys(value).reduce(function (n, k) {
        return n + 1 + countKeys(value[k]);
      }, 0);
    }
    return 0;
  }

  function updateStats() {
    var jsonLines = jsonInputEl.value ? jsonInputEl.value.split(/\r?\n/).length : 0;
    var jsonKeys = 0;
    try {
      var parsed = jsonInputEl.value.trim() ? JSON.parse(jsonInputEl.value) : null;
      if (parsed && isPlainObject(parsed)) jsonKeys = countKeys(parsed);
    } catch (e) { /* stats stay best-effort on invalid JSON */ }
    jsonStatsEl.textContent = jsonLines + (jsonLines === 1 ? " line · " : " lines · ") + jsonKeys + " keys";

    var envText = envInputEl.value;
    var envLines = envText ? envText.split(/\r?\n/).length : 0;
    var envVars = 0;
    envText.split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim().replace(/^export\s+/, "");
      if (!line || line.charAt(0) === "#") return;
      if (line.indexOf("=") !== -1) envVars += 1;
    });
    envStatsEl.textContent = envLines + (envLines === 1 ? " line · " : " lines · ") + envVars + " vars";
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function copyText(text, what) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showToast(what + " copied to clipboard.");
      } catch (e) {
        showToast("Copy failed — select the text manually.");
      }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(what + " copied to clipboard.");
      }, fallback);
    } else {
      fallback();
    }
  }

  /* ---------- Conversions ---------- */

  function convertJsonToEnv(options) {
    options = options || {};
    setError(jsonErrorEl, "");
    setError(envErrorEl, "");
    var text = jsonInputEl.value.trim();
    if (!text) {
      if (!options.silent) setError(jsonErrorEl, "Please provide JSON to convert.");
      return false;
    }
    try {
      var parsed = JSON.parse(text);
      var lines = jsonToEnvLines(parsed);
      if (sortToggle.checked) lines.sort();
      var output = (headerToggle.checked ? "# Environment Variables\n\n" : "") + lines.join("\n");
      envInputEl.value = output;
      updateStats();
      return true;
    } catch (err) {
      setError(jsonErrorEl, "Invalid JSON: " + err.message);
      if (!options.silent) jsonInputEl.focus();
      return false;
    }
  }

  function convertEnvToJson(options) {
    options = options || {};
    setError(jsonErrorEl, "");
    setError(envErrorEl, "");
    var text = envInputEl.value;
    if (!text.trim()) {
      if (!options.silent) setError(envErrorEl, "Please provide .env content to convert.");
      return false;
    }
    try {
      var obj = parseEnv(text);
      if (sortToggle.checked) obj = sortDeep(obj);
      jsonInputEl.value = JSON.stringify(obj, null, 2);
      updateStats();
      return true;
    } catch (err) {
      setError(envErrorEl, "Error parsing .env: " + err.message);
      if (!options.silent) envInputEl.focus();
      return false;
    }
  }

  function scheduleLive() {
    if (!liveToggle.checked) return;
    if (liveTimer) clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      if (liveSource === "json") convertJsonToEnv({ silent: true });
      else if (liveSource === "env") convertEnvToJson({ silent: true });
    }, 320);
  }

  /* ---------- Samples ---------- */

  var SAMPLES = {
    basic: '{\n  "app": {\n    "name": "MyApplication",\n    "port": 3000,\n    "debug": true\n  }\n}',
    nested: '{\n  "app": {\n    "name": "MyApplication",\n    "version": "1.0.0",\n    "debug": false\n  },\n  "db": {\n    "host": "localhost",\n    "port": 5432,\n    "pool": 10\n  },\n  "features": ["auth", "api", "websocket"],\n  "limits": {\n    "rate": [100, 200, 500]\n  }\n}',
    env: "# Environment Variables\n\nAPP_NAME=MyApplication\nAPP_PORT=3000\nAPP_DEBUG=true\nDB_HOST=localhost\nDB_PORT=5432\nFEATURES=auth,api,websocket"
  };

  function loadSample(kind) {
    if (kind === "env") {
      envInputEl.value = SAMPLES.env;
      liveSource = "env";
      convertEnvToJson({ silent: true });
      envInputEl.focus();
    } else {
      jsonInputEl.value = SAMPLES[kind] || SAMPLES.basic;
      liveSource = "json";
      convertJsonToEnv({ silent: true });
      jsonInputEl.focus();
    }
    showToast("Sample loaded — edit freely.");
  }

  /* ---------- Theme ---------- */

  var themeToggleBtn = document.getElementById("themeToggle");
  var themeLabel = document.getElementById("themeLabel");
  var themeMeta = document.getElementById("themeColorMeta");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var isDark = theme === "dark";
    themeToggleBtn.setAttribute("aria-pressed", String(isDark));
    themeToggleBtn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    themeLabel.textContent = isDark ? "Dark" : "Light";
    themeMeta.setAttribute("content", isDark ? "#0b1220" : "#f3efe4");
    try { localStorage.setItem("json2env-theme", theme); } catch (e) { /* private mode */ }
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem("json2env-theme"); } catch (e) { stored = null; }
    if (stored === "dark" || stored === "light") {
      applyTheme(stored);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      applyTheme("light");
    } else {
      applyTheme("dark");
    }
  }

  /* ---------- Reveal on scroll (subtle, interruptible) ---------- */

  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Wiring ---------- */

  document.getElementById("jsonToEnvBtn").addEventListener("click", function () {
    if (convertJsonToEnv()) showToast("JSON converted to .env.");
  });
  document.getElementById("envToJsonBtn").addEventListener("click", function () {
    if (convertEnvToJson()) showToast(".env converted to JSON.");
  });

  document.getElementById("clearJsonBtn").addEventListener("click", function () {
    jsonInputEl.value = "";
    setError(jsonErrorEl, "");
    updateStats();
    jsonInputEl.focus();
  });
  document.getElementById("clearEnvBtn").addEventListener("click", function () {
    envInputEl.value = "";
    setError(envErrorEl, "");
    updateStats();
    envInputEl.focus();
  });
  document.getElementById("clearAllBtn").addEventListener("click", function () {
    jsonInputEl.value = "";
    envInputEl.value = "";
    setError(jsonErrorEl, "");
    setError(envErrorEl, "");
    updateStats();
    showToast("Both sides cleared.");
  });

  document.getElementById("swapBtn").addEventListener("click", function () {
    var tmp = jsonInputEl.value;
    jsonInputEl.value = envInputEl.value;
    envInputEl.value = tmp;
    setError(jsonErrorEl, "");
    setError(envErrorEl, "");
    updateStats();
    showToast("Sides swapped.");
  });

  document.getElementById("copyJsonBtn").addEventListener("click", function () {
    var text = jsonInputEl.value;
    if (!text.trim()) { setError(jsonErrorEl, "Nothing to copy. Generate or paste JSON first."); return; }
    setError(jsonErrorEl, "");
    copyText(text, "JSON");
  });
  document.getElementById("copyEnvBtn").addEventListener("click", function () {
    var text = envInputEl.value;
    if (!text.trim()) { setError(envErrorEl, "Nothing to copy. Generate or paste .env first."); return; }
    setError(envErrorEl, "");
    copyText(text, ".env");
  });

  document.getElementById("downloadJsonBtn").addEventListener("click", function () {
    var text = jsonInputEl.value;
    if (!text.trim()) { setError(jsonErrorEl, "Nothing to download. Generate or paste JSON first."); return; }
    setError(jsonErrorEl, "");
    downloadText("config.json", text);
    showToast("config.json downloaded.");
  });
  document.getElementById("downloadEnvBtn").addEventListener("click", function () {
    var text = envInputEl.value;
    if (!text.trim()) { setError(envErrorEl, "Nothing to download. Generate or paste .env first."); return; }
    setError(envErrorEl, "");
    downloadText(".env", text);
    showToast(".env downloaded.");
  });

  document.getElementById("formatJsonBtn").addEventListener("click", function () {
    var text = jsonInputEl.value.trim();
    if (!text) { setError(jsonErrorEl, "Nothing to format. Paste JSON first."); return; }
    try {
      var parsed = JSON.parse(text);
      jsonInputEl.value = JSON.stringify(sortToggle.checked ? sortDeep(parsed) : parsed, null, 2);
      setError(jsonErrorEl, "");
      updateStats();
      showToast("JSON formatted.");
    } catch (err) {
      setError(jsonErrorEl, "Invalid JSON: " + err.message);
    }
  });

  document.getElementById("heroSampleBtn").addEventListener("click", function () {
    loadSample("basic");
    document.getElementById("converter").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelectorAll("[data-sample]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      loadSample(btn.getAttribute("data-sample"));
    });
  });

  /* Upload: button + same hidden input, drag-drop on textareas */
  function openFilePicker(target) {
    uploadTarget = target;
    fileInputEl.click();
  }
  document.getElementById("uploadJsonBtn").addEventListener("click", function () { openFilePicker("json"); });
  document.getElementById("uploadEnvBtn").addEventListener("click", function () { openFilePicker("env"); });

  fileInputEl.addEventListener("change", function () {
    var file = fileInputEl.files && fileInputEl.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || "");
      if (uploadTarget === "json") {
        jsonInputEl.value = text;
        liveSource = "json";
        setError(jsonErrorEl, "");
        if (liveToggle.checked) convertJsonToEnv({ silent: true });
      } else {
        envInputEl.value = text;
        liveSource = "env";
        setError(envErrorEl, "");
        if (liveToggle.checked) convertEnvToJson({ silent: true });
      }
      updateStats();
      showToast(file.name + " loaded.");
    };
    reader.readAsText(file);
    fileInputEl.value = "";
  });

  [jsonInputEl, envInputEl].forEach(function (ta) {
    ta.addEventListener("dragover", function (e) {
      e.preventDefault();
      ta.classList.add("drag-over");
    });
    ta.addEventListener("dragleave", function () { ta.classList.remove("drag-over"); });
    ta.addEventListener("drop", function (e) {
      e.preventDefault();
      ta.classList.remove("drag-over");
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        ta.value = String(reader.result || "");
        liveSource = ta === jsonInputEl ? "json" : "env";
        updateStats();
        if (liveToggle.checked) {
          if (liveSource === "json") convertJsonToEnv({ silent: true });
          else convertEnvToJson({ silent: true });
        }
        showToast(file.name + " dropped in.");
      };
      reader.readAsText(file);
    });
  });

  jsonInputEl.addEventListener("input", function () {
    liveSource = "json";
    setError(jsonErrorEl, "");
    updateStats();
    scheduleLive();
  });
  envInputEl.addEventListener("input", function () {
    liveSource = "env";
    setError(envErrorEl, "");
    updateStats();
    scheduleLive();
  });

  headerToggle.addEventListener("change", function () {
    if (liveToggle.checked && liveSource === "json") convertJsonToEnv({ silent: true });
  });
  sortToggle.addEventListener("change", function () {
    if (!liveToggle.checked) return;
    if (liveSource === "json") convertJsonToEnv({ silent: true });
    else if (liveSource === "env") convertEnvToJson({ silent: true });
  });

  themeToggleBtn.addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  /* Warn before leaving with unsaved work (guideline: unsaved-changes guard) */
  var dirty = false;
  [jsonInputEl, envInputEl].forEach(function (ta) {
    ta.addEventListener("input", function () { dirty = true; }, { once: true });
  });
  window.addEventListener("beforeunload", function (e) {
    if (dirty && (jsonInputEl.value.trim() || envInputEl.value.trim())) {
      e.preventDefault();
    }
  });

  /* ---------- Init ---------- */
  initTheme();
  initReveal();
  updateStats();
})();
