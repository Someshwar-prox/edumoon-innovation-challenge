/* AIBridge chat widget — drop-in script.
 * Usage on a customer site:
 *   <script src="https://your-cdn/aibridge-widget.js"
 *           data-business-id="UUID"
 *           data-api="https://api.your-domain.com"
 *           defer></script>
 *
 * Vanilla JS, no framework, no build. Single file, ~6 KB minified.
 */
(function () {
  if (window.AIBridgeWidget) return;
  window.AIBridgeWidget = { version: "0.1.0" };

  function getConfig() {
    var s = document.currentScript || document.querySelector('script[data-business-id]');
    var cfg = {
      businessId: s && s.getAttribute("data-business-id"),
      api: s && s.getAttribute("data-api"),
      title: s && s.getAttribute("data-title") || "Ask us anything",
      accent: s && s.getAttribute("data-accent") || "#0a0a0c",
      position: s && s.getAttribute("data-position") || "bottom-right",
    };
    if (!cfg.businessId) {
      console.warn("[AIBridgeWidget] missing data-business-id");
      return null;
    }
    if (!cfg.api) cfg.api = "http://127.0.0.1:8000";
    return cfg;
  }

  function uuidv4() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "style") Object.assign(e.style, attrs[k]);
        else if (k === "class") e.className = attrs[k];
        else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      });
    }
    (kids || []).forEach(function (k) {
      if (k == null) return;
      e.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
    });
    return e;
  }

  function injectStyles(accent, position) {
    var pos = position === "bottom-left"
      ? "left: 20px;"
      : "right: 20px;";
    var css = [
      ".ab-launcher{position:fixed;bottom:20px;" + pos + "z-index:2147483646;",
      "  width:56px;height:56px;border-radius:50%;background:" + accent + ";color:#fff;",
      "  display:flex;align-items:center;justify-content:center;cursor:pointer;",
      "  box-shadow:0 10px 30px -10px rgba(0,0,0,0.4);border:none;font:inherit;",
      "  transition:transform .2s cubic-bezier(.16,1,.3,1);}",
      ".ab-launcher:hover{transform:translateY(-2px);}",
      ".ab-launcher svg{width:24px;height:24px;}",
      ".ab-panel{position:fixed;bottom:90px;" + pos + "z-index:2147483646;",
      "  width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);",
      "  background:#fff;border-radius:16px;box-shadow:0 20px 60px -12px rgba(0,0,0,.25);",
      "  display:none;flex-direction:column;overflow:hidden;",
      "  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0a0a0c;",
      "  border:1px solid rgba(0,0,0,.08);}",
      ".ab-panel.ab-open{display:flex;animation:ab-in .25s cubic-bezier(.16,1,.3,1);}",
      "@keyframes ab-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}",
      ".ab-head{padding:16px 20px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:10px;}",
      ".ab-avatar{width:28px;height:28px;border-radius:8px;background:" + accent + ";color:#fff;",
      "  display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;}",
      ".ab-title{font-weight:600;font-size:14px;line-height:1.2;}",
      ".ab-sub{font-size:11.5px;color:#666;margin-top:1px;}",
      ".ab-log{flex:1;overflow-y:auto;padding:16px 16px 8px;background:#fafafb;}",
      ".ab-bubble{max-width:84%;padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.45;",
      "  margin-bottom:8px;word-wrap:break-word;}",
      ".ab-bubble.ab-user{background:" + accent + ";color:#fff;margin-left:auto;border-bottom-right-radius:4px;}",
      ".ab-bubble.ab-bot{background:#fff;border:1px solid #eee;color:#0a0a0c;border-bottom-left-radius:4px;}",
      ".ab-bubble.ab-sys{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;font-size:12.5px;}",
      ".ab-cites{margin:0 0 8px 6px;display:flex;flex-wrap:wrap;gap:4px;}",
      ".ab-cite{font-size:10.5px;color:#444;background:#fff;border:1px solid #e5e5e5;",
      "  padding:2px 8px;border-radius:999px;display:inline-flex;align-items:center;gap:4px;}",
      ".ab-input{display:flex;align-items:flex-end;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff;}",
      ".ab-input textarea{flex:1;resize:none;border:1px solid #e5e5e5;border-radius:10px;padding:8px 10px;",
      "  font:inherit;font-size:13.5px;outline:none;background:#fff;color:inherit;max-height:100px;}",
      ".ab-input textarea:focus{border-color:" + accent + ";}",
      ".ab-input button{background:" + accent + ";color:#fff;border:none;border-radius:10px;",
      "  padding:8px 12px;font:inherit;font-size:13px;font-weight:500;cursor:pointer;}",
      ".ab-input button:disabled{opacity:.5;cursor:not-allowed;}",
      ".ab-typing{display:inline-flex;gap:4px;padding:10px 14px;}",
      ".ab-typing span{width:6px;height:6px;border-radius:50%;background:#bbb;animation:ab-bounce 1.2s infinite;}",
      ".ab-typing span:nth-child(2){animation-delay:.15s;}",
      ".ab-typing span:nth-child(3){animation-delay:.3s;}",
      "@keyframes ab-bounce{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}",
    ].join("");
    var s = document.createElement("style");
    s.setAttribute("data-aibridge", "1");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function renderCitation(c) {
    var label;
    if (c.source_type === "document") {
      label = c.filename || ("doc " + (c.source_id || "").slice(0, 6));
    } else {
      try { label = new URL(c.source_id).hostname.replace(/^www\./, ""); }
      catch (e) { label = c.section_title || "site"; }
    }
    var span = el("span", { class: "ab-cite", title: c.snippet || "" });
    span.appendChild(document.createTextNode(label + " · " + (c.score || 0).toFixed(2)));
    return span;
  }

  function init() {
    var cfg = getConfig();
    if (!cfg) return;
    injectStyles(cfg.accent, cfg.position);

    var sessionId = (function () {
      try {
        var k = "ab_widget_session:" + cfg.businessId;
        var v = sessionStorage.getItem(k);
        if (!v) { v = uuidv4(); sessionStorage.setItem(k, v); }
        return v;
      } catch (e) { return uuidv4(); }
    })();

    var panel, log, ta, sendBtn, open = false, busy = false;
    var launcher = el("button", { class: "ab-launcher", "aria-label": "Open chat" });
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    document.body.appendChild(launcher);

    function openPanel() {
      if (!panel) build();
      panel.classList.add("ab-open");
      launcher.setAttribute("aria-label", "Close chat");
      setTimeout(function () { try { ta.focus(); } catch (e) {} }, 50);
    }
    function closePanel() {
      panel.classList.remove("ab-open");
      launcher.setAttribute("aria-label", "Open chat");
    }
    launcher.addEventListener("click", function () {
      open = !open;
      if (open) openPanel(); else closePanel();
    });

    function addBubble(role, text, cites) {
      var b = el("div", { class: "ab-bubble ab-" + role }, [text]);
      log.appendChild(b);
      if (cites && cites.length) {
        var row = el("div", { class: "ab-cites" });
        cites.slice(0, 4).forEach(function (c) { row.appendChild(renderCitation(c)); });
        log.appendChild(row);
      }
      log.scrollTop = log.scrollHeight;
    }

    function addTyping() {
      var wrap = el("div", { class: "ab-bubble ab-bot" });
      var t = el("div", { class: "ab-typing" });
      t.appendChild(el("span"));
      t.appendChild(el("span"));
      t.appendChild(el("span"));
      wrap.appendChild(t);
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
      return wrap;
    }

    async function send(q) {
      busy = true;
      sendBtn.disabled = true;
      addBubble("user", q);
      var typing = addTyping();
      try {
        var r = await fetch(cfg.api + "/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            business_id: cfg.businessId,
            question: q,
            session_id: sessionId,
            top_k: 6,
            score_threshold: 0.3,
          }),
        });
        var data = await r.json().catch(function () { return {}; });
        typing.remove();
        if (r.ok) {
          addBubble("bot", data.answer || "(no answer)", data.citations || []);
        } else {
          addBubble("sys", (data && data.error && data.error.message) || ("Request failed (" + r.status + ")"));
        }
      } catch (e) {
        typing.remove();
        addBubble("sys", "Network error: cannot reach " + cfg.api + ". Is FastAPI running?");
      } finally {
        busy = false;
        sendBtn.disabled = false;
        ta.value = "";
        ta.focus();
      }
    }

    function build() {
      panel = el("div", { class: "ab-panel", role: "dialog", "aria-label": cfg.title });
      var head = el("div", { class: "ab-head" });
      head.appendChild(el("div", { class: "ab-avatar" }, ["AI"]));
      var headText = el("div");
      headText.appendChild(el("div", { class: "ab-title" }, [cfg.title]));
      headText.appendChild(el("div", { class: "ab-sub" }, ["Powered by AIBridge"]));
      head.appendChild(headText);
      panel.appendChild(head);

      log = el("div", { class: "ab-log" });
      var intro = el("div", { class: "ab-bubble ab-bot" }, [
        "Hi! Ask me anything about this business. I answer from their website and uploaded documents.",
      ]);
      log.appendChild(intro);
      panel.appendChild(log);

      var input = el("div", { class: "ab-input" });
      ta = el("textarea", { rows: "1", placeholder: "Type a question…", "aria-label": "Message" });
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!busy && ta.value.trim()) send(ta.value.trim());
        }
      });
      sendBtn = el("button", { type: "button" }, ["Send"]);
      sendBtn.addEventListener("click", function () {
        if (!busy && ta.value.trim()) send(ta.value.trim());
      });
      input.appendChild(ta);
      input.appendChild(sendBtn);
      panel.appendChild(input);

      document.body.appendChild(panel);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
