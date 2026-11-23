/* StackBack widget preview runtime: core.
   Contract for widget files:  SBW.reg('<type>', function (root, ctx) { return { render: fn } });
   The core calls render() on boot, on variant change and whenever ctx.refresh() is called.
   Widgets keep their own state in the closure and use event delegation on root via data-a="action". */
(function () {
  var SBW = window.SBW = window.SBW || { types: {} };
  SBW.reg = function (type, factory) { SBW.types[type] = factory; };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  SBW.$ = $; SBW.$$ = $$;
  SBW.esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  SBW.ord = function (n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  var ICONS = {
    chev: '<path d="m6 9 6 6 6-6"/>', right: '<path d="m9 6 6 6-6 6"/>', left: '<path d="m15 6-6 6 6 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    pin: '<path d="M12 22s7-8 7-13a7 7 0 0 0-14 0c0 5 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/>',
    truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
  };
  SBW.icon = function (name, size, color, sw) {
    return '<svg class="sbw-ic" width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="' +
      (color || 'currentColor') + '" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  };

  SBW.boot = function (cfg) {
    var cur = (cfg.currency || '₹');
    var money = function (v) { return cur + Math.round(v).toLocaleString(cfg.locale || 'en-IN'); };
    var P = cfg.product, variant = P.selected || (P.variants[0] && P.variants[0].name);
    var findV = function (n) { return P.variants.filter(function (v) { return v.name === n; })[0] || P.variants[0]; };
    // ---- place the host next to cfg.pdp.anchor (CSS selector): position 'before' (default) or 'after'
    var host = document.createElement('div'); host.id = 'sbw-host';
    var pdp = cfg.pdp || {};
    var anchor = (pdp.anchor && $(pdp.anchor)) || $('form[action*="/cart/add"]');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, pdp.position === 'after' ? anchor.nextSibling : anchor);
    else document.body.insertBefore(host, document.body.firstChild);
    // anchor inside a flex parent that reorders children (CSS order): copy the anchor's order so DOM position holds
    if (anchor && anchor.parentNode && /flex|grid/.test(getComputedStyle(anchor.parentNode).display)) {
      host.style.order = getComputedStyle(anchor).order; host.style.flex = '0 0 100%'; host.style.width = '100%';
    }
    var widgets = [], active = 0;
    var popEl;

    // ---- theme tokens -> CSS vars on host and popup
    var T = cfg.tokens || {};
    var vars = { '--p': T.primary, '--s': T.secondary, '--a': T.accent, '--ink': T.tileText, '--tile': T.tile, '--bg': T.bg,
      '--line': T.line || '#968a74', '--mute': T.mute || '#6b6b6b', '--ok': T.ok || '#2e7d32', '--okbg': T.okBg || '#eaf6e4',
      '--onp': T.onPrimary || '#ffffff', '--ona': T.onAccent || '#1c2417' };

    /* Widget settings beyond colour: corner radius, font, and the outer frame (chrome). */
    if (T.radius != null && T.radius !== '') vars['--r'] = (+T.radius) + 'px';
    if (T.font) vars['--font'] = "'" + String(T.font).replace(/['"<>;]/g, '') + "'";
    var framed = T.outer || (T.shadow && T.shadow !== 'none');
    if (framed) {
      host.classList.add('sbw-chrome');
      host.setAttribute('data-shadow', T.shadow || 'none');
      vars['--chrome'] = T.outer ? (T.chrome || T.line || '#968a74') : 'transparent';
    }

    /* Text that sits on a colour is picked by contrast when the theme does not name it, and
       the banner's highlighted amount falls back to the bar's own text colour when the accent
       matches the bar: a store whose accent IS its primary showed "Save up to ___". */
    function lumOf(h) {
      var m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null;
      var n = parseInt(m[1], 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
      return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
    }
    function ratio(a, b) { var x = lumOf(a), y = lumOf(b); if (x == null || y == null) return 21; return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
    function textOn(bg) { return ratio('#ffffff', bg) >= ratio('#1c1c1c', bg) ? '#ffffff' : '#1c1c1c'; }
    if (!T.onAccent && T.accent) vars['--ona'] = textOn(T.accent);
    vars['--banhi'] = ratio(vars['--a'], vars['--p']) >= 2 ? vars['--a'] : vars['--onp'];

    /* Widget settings the admin carries beyond colour (cfg.settings). Each one is a flag on
       the host that the stylesheet reads, so it holds for every widget type without each
       widget learning it. */
    var S = cfg.settings || {};
    if (S.selected === 'border-only') vars['--s'] = vars['--tile'] || '#ffffff';
    ['cta', 'badge'].forEach(function (k) { if (S[k]) host.setAttribute('data-' + k, S[k]); });
    if (S.noOneTime) host.setAttribute('data-noonetime', '');
    if (S.noHow) host.setAttribute('data-nohow', '');
    if (S.noBrand) host.setAttribute('data-nobrand', '');
    if (S.fontScale && +S.fontScale !== 100) host.style.zoom = String(Math.min(1.3, Math.max(0.8, +S.fontScale / 100)));

    function applyVars(el) { Object.keys(vars).forEach(function (k) { if (vars[k]) el.style.setProperty(k, vars[k]); }); }
    applyVars(host);

    // ---- shared popup
    popEl = document.createElement('div');
    popEl.className = 'sbw sbw-pop'; applyVars(popEl);
    popEl.innerHTML = '<div class="sbw-pc"><div class="sbw-pc-hd"><span data-pt></span><button data-close aria-label="Close">' + SBW.icon('x', 16) + '</button></div><hr><div data-pb></div><button class="sbw-done" data-close>Done</button></div>';
    document.body.appendChild(popEl);
    popEl.addEventListener('click', function (e) { if (e.target === popEl || e.target.closest('[data-close]')) popEl.classList.remove('open'); });

    var Q = {};
    decodeURIComponent(location.hash.slice(1)).split('&').forEach(function (kv) { var i = kv.indexOf('='); if (kv) Q[i < 0 ? kv : kv.slice(0, i)] = i < 0 ? true : kv.slice(i + 1); });
    var ctx = {
      q: Q, mode0: function (o) { return Q.mode || (o && o.defaultMode) || 'otp'; },
      cfg: cfg, money: money, ord: SBW.ord, esc: SBW.esc, icon: SBW.icon,
      variant: function () { return findV(variant); },
      base: function () { return findV(variant).price; },
      compareAt: function () { return findV(variant).compareAt; },
      img: function () { return findV(variant).image || P.image; },
      per: function (off) { return Math.round(findV(variant).price * (1 - (off || 0) / 100)); },
      plans: cfg.plans || {},
      freebie: function (id) { return (cfg.freebies || {})[id]; },
      gifts: function (freq, n) { return ((freq && freq.free) || []).filter(function (g) { return !n || g[1] <= n; }); },
      catalog: cfg.catalog || [],
      popup: function (title, html) { $('[data-pt]', popEl).textContent = title; $('[data-pb]', popEl).innerHTML = html; popEl.classList.add('open'); },
      // subscribed=true hides the theme qty / add-to-cart / sticky bar (cfg.pdp.hideOnSubscribe)
      setSubscribed: function (w, on) { w._sub = !!on; syncPdp(); },
      refresh: function () { renderActive(); }
    };

    // ---- shared fragments
    ctx.giftRows = function (gifts, style) {
      return gifts.map(function (g) {
        var f = ctx.freebie(g[0]) || { name: g[0] };
        return '<div class="sbw-gr"><img src="' + SBW.esc(f.image || '') + '" alt=""><div class="sbw-gr-n"><b>' + SBW.esc(f.name) + '</b><span>' + SBW.esc(f.meta || '') +
          '</span></div>' + (style === 'tag' ? '<span class="sbw-gr-tag">FREE · ' + SBW.ord(g[1]) + ' delivery</span>' : '<span class="sbw-gr-d">' + SBW.ord(g[1]) + ' Delivery</span>') + '</div>';
      }).join('');
    };
    ctx.freebiePopup = function (gifts) { ctx.popup('Freebies', '<div class="sbw-col">' + ctx.giftRows(gifts) + '</div>'); };
    ctx.howPopup = function () {
      var steps = cfg.howItWorks || [
        ['Pick your plan', 'Choose how often and how many deliveries. It arrives fresh, on schedule.'],
        ['Choose how you pay', 'Pay upfront for the whole plan, or pay as each delivery goes out.'],
        ['Free gifts on the way', 'Freebies ride along on the deliveries shown in your plan.'],
        ['Stay in control', 'Skip, swap, reschedule or cancel anytime from your account.']];
      ctx.popup('How Subscriptions Work?', '<div class="sbw-col">' + steps.map(function (s, i) {
        return '<div class="sbw-hs"><i>' + (i + 1) + '</i><div><b>' + SBW.esc(s[0]) + '</b><span>' + SBW.esc(s[1]) + '</span></div></div>';
      }).join('') + '</div>');
    };
    ctx.pricePopup = function (rows) {
      ctx.popup('Pricing Summary', '<div class="sbw-col">' + rows.map(function (r) {
        return '<div class="sbw-kv' + (r[2] ? ' ac' : '') + '"><span>' + SBW.esc(r[0]) + '</span><b>' + SBW.esc(r[1]) + '</b></div>';
      }).join('') + '</div>');
    };
    ctx.payNote = function (mode) {
      var n = cfg.payNotes || {};
      return n[mode] || { prepaid: 'One payment today, all deliveries covered', ppd: 'Pay each time a delivery goes out, cancel anytime',
        payg: 'Pay for each delivery by link before it ships', autopay: 'Auto-debit each delivery with UPI AutoPay' }[mode] || '';
    };
    ctx.powered = function (style) {
      return style === 'right' ? '<div class="sbw-pow-r">Powered by <b>StackBack</b></div>' : '<div class="sbw-pow">POWERED BY: STACKBACK.AI</div>';
    };

    // ---- tabs
    (cfg.tabs || []).forEach(function (t, i) {
      var f = SBW.types[t.type];
      var el = document.createElement('div');
      el.className = 'sbw sbw-w sbw-t-' + t.type; el.hidden = true; host.appendChild(el);
      if (!f) { el.innerHTML = '<div class="sbw-miss">Unknown widget type: ' + SBW.esc(t.type) + '</div>'; widgets.push({ el: el, render: function () {} }); return; }
      var w = { el: el, t: t, _sub: false };
      var c = Object.create(ctx); c.tab = t; c.opts = t.options || {};
      c.setSubscribed = function (on) { w._sub = !!on; syncPdp(); };
      var api = f(el, c) || {};
      w.render = api.render || function () {};
      widgets.push(w);
    });

    function syncPdp() {
      var w = widgets[active], hide = !!(w && w._sub);
      ((cfg.pdp && cfg.pdp.hideOnSubscribe) || []).forEach(function (sel) {
        $$(sel).forEach(function (n) { n.style.display = hide ? 'none' : ''; });
      });
    }
    function renderActive() {
      widgets.forEach(function (w, i) { w.el.hidden = i !== active; });
      if (widgets[active]) widgets[active].render();
      $$('#sbw-tabs button').forEach(function (b, i) { b.classList.toggle('on', i === active); });
      syncPdp();
    }

    if (widgets.length > 1 || cfg.alwaysShowTabs) {
      var bar = document.createElement('div'); bar.id = 'sbw-tabs';
      bar.innerHTML = widgets.map(function (w, i) { return '<button data-i="' + i + '">' + (i + 1) + ' · ' + SBW.esc((w.t && (w.t.label || w.t.type)) || '') + '</button>'; }).join('');
      document.body.appendChild(bar);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        active = +b.dataset.i; history.replaceState(null, '', '#tab' + (active + 1)); renderActive();
      });
    }

    // ---- theme variant tiles drive price
    var vt = cfg.pdp && cfg.pdp.variantTiles;
    if (vt && vt.selector) {
      document.addEventListener('click', function (e) {
        var el = e.target.closest && e.target.closest(vt.selector);
        if (!el) return;
        var name = vt.attr ? el.getAttribute(vt.attr) : el.textContent.trim();
        if (P.variants.some(function (v) { return v.name === name; })) { variant = name; setTimeout(renderActive, 0); }
      }, true);
    }

    var m = location.hash.match(/tab=?(\d+)/); if (m && widgets[+m[1] - 1]) active = +m[1] - 1;
    renderActive();
    // render harness: #tab=2&mode=sub&click=<css>|<css>  clicks run in order inside the active widget (or document for popups)
    if (Q.click) Q.click.split('|').forEach(function (sel) {
      var el = $(sel, widgets[active] && widgets[active].el) || $(sel);
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    var r = host.getBoundingClientRect(), pr = popEl.classList.contains('open') ? $('.sbw-pc', popEl).getBoundingClientRect() : null;
    document.documentElement.setAttribute('data-sbw-rect', JSON.stringify({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
      pop: pr && { x: pr.left + scrollX, y: pr.top + scrollY, w: pr.width, h: pr.height } }));
    document.addEventListener('DOMContentLoaded', syncPdp); window.addEventListener('load', syncPdp);
    SBW.ctx = ctx; SBW.widgets = widgets;
  };
})();
