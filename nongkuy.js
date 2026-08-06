// ============================================================
//  Answer Search GUI — paste into browser DevTools console
//  Ctrl+Shift+Z  →  toggle show/hide
// ============================================================

(function () {
  const DATA_URL =
    "https://raw.githubusercontent.com/NewToUdin/Hooked/refs/heads/main/ans.json";

  // ── prevent duplicate injection ──────────────────────────
  if (document.getElementById("__ans-gui__")) {
    document.getElementById("__ans-gui__").remove();
  }

  // ── Anti-cheat bypass ────────────────────────────────────
  const BL = ['playerExited','playerResumed','infractionType','extensionDetected','windowResizeDetected','rightClickDetected','pasteDetected'],
        blocked = d => typeof d === 'string' && BL.some(k => d.includes(k)),
        _fetch = window.fetch, _xhrSend = XMLHttpRequest.prototype.send, _parse = JSON.parse;

  window.fetch = async function(...a) {
    return a[1]?.body && blocked(a[1].body) ? new Response('{"success":true}', {status:200}) : _fetch.apply(this, a);
  };
  XMLHttpRequest.prototype.send = function(b) {
    if (blocked(b)) {
      Object.defineProperties(this, {readyState:{value:4,configurable:1},status:{value:200,configurable:1}});
      return this.onreadystatechange?.();
    }
    _xhrSend.apply(this, arguments);
  };
  JSON.parse = function(...a) {
    const r = _parse.apply(this, a);
    if (r?.type === 'RN_APP_STATE_CHANGE' && r.value === 'background') r.value = 'foreground';
    return r;
  };

  const _stop = e => e.stopImmediatePropagation();
  'visibilitychange blur mouseleave pagehide resize contextmenu copy paste fullscreenchange webkitfullscreenchange'
    .split(' ').forEach(e => (window.addEventListener(e, _stop, !0), document.addEventListener(e, _stop, !0)));

  const _def = (o, p, v) => { try { Object.getOwnPropertyDescriptor(o, p)?.configurable !== !1 && Object.defineProperty(o, p, {get:()=>v, configurable:!0}) } catch{} },
        _docEl = () => document.documentElement;
  for (const o of [Document.prototype, document]) {
    _def(o, 'visibilityState', 'visible'); _def(o, 'hidden', !1);
    _def(o, 'fullscreenElement', _docEl); _def(o, 'webkitFullscreenElement', _docEl);
  }
  window.onblur = document.onblur = null;
  document.hasFocus = () => true;
  // ─────────────────────────────────────────────────────────

  // ── state ─────────────────────────────────────────────────
  let db = [];
  let visible = true;

  // ── root container ────────────────────────────────────────
  const root = document.createElement("div");
  root.id = "__ans-gui__";
  Object.assign(root.style, {
    position: "fixed",
    top: "60px",
    right: "20px",
    width: "420px",
    minWidth: "260px",
    minHeight: "120px",
    maxHeight: "80vh",
    background: "#1e1e2e",
    color: "#cdd6f4",
    fontFamily: "'Segoe UI', sans-serif",
    fontSize: "14px",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,.55)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: "2147483647",
    resize: "both",          // ← user-resizable
    border: "1px solid #45475a",
  });

  // ── header (drag handle) ──────────────────────────────────
  const header = document.createElement("div");
  Object.assign(header.style, {
    background: "#313244",
    padding: "8px 12px",
    cursor: "move",
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #45475a",
    flexShrink: "0",
  });
  header.innerHTML = `
    <span style="font-weight:600;font-size:13px;letter-spacing:.5px;">
      🔍 Answer Finder
    </span>
    <span id="__ans-status__" style="font-size:11px;color:#a6e3a1;">Loading…</span>
  `;

  // ── search bar ────────────────────────────────────────────
  const searchWrap = document.createElement("div");
  Object.assign(searchWrap.style, {
    padding: "10px 12px 6px",
    flexShrink: "0",
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type keywords to search…";
  Object.assign(input.style, {
    width: "100%",
    boxSizing: "border-box",
    background: "#313244",
    border: "1px solid #585b70",
    borderRadius: "8px",
    color: "#cdd6f4",
    padding: "7px 10px",
    fontSize: "13px",
    outline: "none",
  });
  searchWrap.appendChild(input);

  // ── results area ──────────────────────────────────────────
  const results = document.createElement("div");
  Object.assign(results.style, {
    overflowY: "auto",
    flex: "1",
    padding: "6px 12px 12px",
  });

  // ── assemble ──────────────────────────────────────────────
  root.appendChild(header);
  root.appendChild(searchWrap);
  root.appendChild(results);
  document.body.appendChild(root);

  // ── drag logic ────────────────────────────────────────────
  let dragX = 0, dragY = 0, dragging = false;
  header.addEventListener("mousedown", (e) => {
    dragging = true;
    dragX = e.clientX - root.getBoundingClientRect().left;
    dragY = e.clientY - root.getBoundingClientRect().top;
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    root.style.left = e.clientX - dragX + "px";
    root.style.top  = e.clientY - dragY + "px";
    root.style.right = "auto";
  });
  document.addEventListener("mouseup", () => (dragging = false));

  // ── Ctrl+Shift+Z toggle ───────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") {
      visible = !visible;
      root.style.display = visible ? "flex" : "none";
    }
  });

  // ── render helpers ────────────────────────────────────────
  function highlight(text, query) {
    if (!query) return text;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return text.replace(re, '<mark style="background:#f9e2af;color:#1e1e2e;border-radius:3px;padding:0 2px;">$1</mark>');
  }

  function renderResults(items, query) {
    if (!items.length) {
      results.innerHTML = `<div style="color:#6c7086;text-align:center;margin-top:20px;">No results found</div>`;
      return;
    }
    results.innerHTML = items
      .slice(0, 50) // cap at 50 results
      .map((item) => {
        const qHtml = highlight(item.question, query);
        const aHtml = highlight(item.answer, query);
        const badgeColors = {
          MCQ:   ["#89b4fa", "#1e1e2e"],
          MSQ:   ["#cba6f7", "#1e1e2e"],
          BLANK: ["#a6e3a1", "#1e1e2e"],
          OPEN:  ["#f9e2af", "#1e1e2e"],
        };
        const [bg, fg] = badgeColors[item.type] || ["#585b70", "#cdd6f4"];
        const badge = `<span style="background:${bg};color:${fg};border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;">${item.type}</span>`;

        const optionsHtml =
          item.options && item.options.length
            ? `<div style="margin-top:4px;color:#a6adc8;font-size:12px;">
                Options: ${item.options.map((o) => `<em>${o}</em>`).join(" · ")}
               </div>`
            : "";

        return `
          <div style="background:#313244;border-radius:8px;padding:10px 12px;margin-bottom:8px;border-left:3px solid #89b4fa;">
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:5px;">
              ${badge}
              <span style="font-size:11px;color:#6c7086;">#${item.id.slice(-6)}</span>
            </div>
            <div style="margin-bottom:4px;line-height:1.4;">${qHtml}</div>
            ${optionsHtml}
            <div style="margin-top:6px;font-weight:700;color:#a6e3a1;">✔ ${aHtml}</div>
          </div>`;
      })
      .join("");

    if (items.length > 50) {
      results.innerHTML += `<div style="color:#6c7086;text-align:center;font-size:12px;">…and ${items.length - 50} more — refine your query</div>`;
    }
  }

  // ── search logic ─────────────────────────────────────────
  function doSearch(raw) {
    const q = raw.trim().toLowerCase();
    if (!q) { results.innerHTML = ""; return; }
    const hits = db.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        (item.options || []).some((o) => o.toLowerCase().includes(q))
    );
    renderResults(hits, q);
  }

  input.addEventListener("input", () => doSearch(input.value));

  // ── normalise one item from either old or new API format ─────────────────
  function normaliseItem(item) {
    const clean = t => (t || '').replace(/<\/?p>/g, '').trim().replace(/\s+/g, ' ');

    // New API format: answers is an array of objects { text, ... }
    if (Array.isArray(item.answers)) {
      const ansTexts = item.answers.map(a => clean(a.text)).filter(Boolean);
      return {
        id:       item.id || item._id || '',
        type:     item.type || 'MCQ',
        question: clean(item.question || item.structure?.query?.text || ''),
        answer:   ansTexts.join(' · ') || '(open-ended)',
        options:  Array.isArray(item.options)
                    ? item.options.map(o => clean(typeof o === 'object' ? o.text : o))
                    : [],
      };
    }

    // Old flat format: answer is already a string
    return {
      id:      item.id || item._id || '',
      type:    item.type || 'MCQ',
      question: clean(item.question || ''),
      answer:   clean(item.answer || ''),
      options:  (item.options || []).map(o => clean(typeof o === 'object' ? o.text : o)),
    };
  }

  // ── load data ─────────────────────────────────────────────
  const statusEl = () => document.getElementById("__ans-status__");

  _fetch(DATA_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      // Support top-level wrapper: { answers: [...] } or { data: { answers: [...] } } or plain array
      const raw = Array.isArray(data)
        ? data
        : (data.answers || data.data?.answers || []);
      db = raw.map(normaliseItem).filter(item => item.question);
      statusEl().textContent = `${db.length} questions loaded`;
      statusEl().style.color = "#a6e3a1";
      input.placeholder = `Search among ${db.length} questions…`;
    })
    .catch((err) => {
      statusEl().textContent = "⚠ Load failed";
      statusEl().style.color = "#f38ba8";
      results.innerHTML = `<div style="color:#f38ba8;padding:8px;">Error: ${err.message}</div>`;
    });

  console.log(
    "%c[Answer Finder] loaded — Ctrl+Shift+Z to toggle",
    "color:#a6e3a1;font-weight:bold;"
  );
})();
