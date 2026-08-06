// ==UserScript==
// @name         Answer Highlighter
// @namespace    http://tampermonkey.net/
// @match        https://wayground.com/*
// @match        https://yoursite.com/*
// @grant        GM_addStyle
// @run-at       document-end
// @version      7.0
// ==/UserScript==
(function() {
    'use strict';

    // ── Anti-cheat bypass ─────────────────────────────────────────────────────
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

    const stop = e => e.stopImmediatePropagation();
    'visibilitychange blur mouseleave pagehide resize contextmenu copy paste fullscreenchange webkitfullscreenchange'
        .split(' ').forEach(e => (window.addEventListener(e, stop, !0), document.addEventListener(e, stop, !0)));

    const def = (o, p, v) => { try { Object.getOwnPropertyDescriptor(o, p)?.configurable !== !1 && Object.defineProperty(o, p, {get:()=>v, configurable:!0}) } catch{} },
          docEl = () => document.documentElement;
    for (const o of [Document.prototype, document]) {
        def(o, 'visibilityState', 'visible'); def(o, 'hidden', !1);
        def(o, 'fullscreenElement', docEl); def(o, 'webkitFullscreenElement', docEl);
    }
    window.onblur = document.onblur = null;
    document.hasFocus = () => !0;

    // ── State ─────────────────────────────────────────────────────────────────
    const DATA_URL = 'https://raw.githubusercontent.com/NewToUdin/Hooked/refs/heads/main/ans.json';
    const cache    = new Map();
    let lastQid    = '';
    let highlightOn = true;

    const clean = t => t?.replace(/<\/?p>/g, '').trim().replace(/\s+/g, ' ') || '';
    const $  = s => document.querySelector(s);
    const $$ = s => [...document.querySelectorAll(s)];

    // ── Load answers ──────────────────────────────────────────────────────────
    async function loadAnswers() {
        try {
            const res  = await _fetch(DATA_URL);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.answers || data.data?.answers || []);

            for (const item of list) {
                const id = item.id || item._id;
                if (!id) continue;

                if (item.type === 'OPEN') { cache.set(id, '📝'); continue; }

                if (item.type === 'MSQ' && Array.isArray(item.answers)) {
                    const ans = item.answers.map(a => clean(a.text)).filter(Boolean);
                    if (ans.length) cache.set(id, ans);
                    continue;
                }

                if (typeof item.answer === 'string') {
                    const ans = clean(item.answer);
                    if (ans) cache.set(id, ans);
                    continue;
                }

                if (Array.isArray(item.answers)) {
                    const ans = clean(item.answers[0]?.text);
                    if (ans) cache.set(id, ans);
                }
            }

            if (cache.size) startObserver();
        } catch(e) {
            console.warn('[Highlighter] load failed:', e.message);
        }
    }

    // ── Question reader ───────────────────────────────────────────────────────
    function getQuestion() {
        const container = $('[data-quesid]');
        if (!container) return null;
        return {
            qid: container.dataset.quesid,
            options: $$('.option.is-selectable').map(el => ({
                text: clean(el.querySelector('.option-text-inner, .text-container')?.innerText),
                element: el,
            })),
        };
    }

    // ── Highlight ─────────────────────────────────────────────────────────────
    function clearHighlights() {
        $$('.option.is-selectable').forEach(el => el.style.removeProperty('box-shadow'));
    }

    function highlight() {
        if (!highlightOn || !cache.size) return;
        const q = getQuestion();
        if (!q?.qid) return;
        clearHighlights();

        const ans = cache.get(q.qid);
        if (!ans || ans === '📝') return;

        const targets = Array.isArray(ans) ? ans : [ans];
        targets.forEach(target => {
            const opt = q.options.find(o =>
                o.text.toLowerCase().trim() === target.toLowerCase().trim()
            );
            if (opt) opt.element.style.boxShadow = 'inset 0 0 0 3px #000000';
        });
    }

    // ── Toggle Ctrl+Shift+X ───────────────────────────────────────────────────
    window.addEventListener('keydown', e => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
            e.preventDefault();
            e.stopImmediatePropagation();
            highlightOn = !highlightOn;
            highlightOn ? highlight() : clearHighlights();
        }
    }, true);

    // ── Observer ──────────────────────────────────────────────────────────────
    function startObserver() {
        new MutationObserver(() => {
            const qid = $('[data-quesid]')?.dataset.quesid;
            if (qid && qid !== lastQid) {
                lastQid = qid;
                clearHighlights();
                setTimeout(highlight, 500);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    window.addEventListener('load', () => setTimeout(loadAnswers, 1000));
})();
