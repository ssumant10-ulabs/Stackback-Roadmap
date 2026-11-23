/* international-plan: Subscription Widget, International Plan (supply-duration cards for shoppers abroad, own currency).
   Design: Final JSX 2/Subscription Widgets/International Plan.jsx
   Stacked supply cards: radio + "<N>-Day Supply", badge pill + x%OFF pill, price / delivery (+ Save on the selected card), "Delivered
   <freq> for <n> deliveries.", gift icon (Freebies popup). Selected card scales up and expands: perks checklist, gift pill that
   expands inline into delivery milestone tiles. Underlined One Time Purchase link; Subscribe Now bar.
   options: supplies ([{f: freqId, n: deliveries, label?: '90-Day', badge?: 'BEST VALUE'}]; default plans.schedules, label from
   frequency id x n), currency (symbol, default cfg.currency), fx (multiplier on store prices, default 1), locale, decimals
   (default 0 when fx = 1 else 2), payMode ('ppd' | 'prepaid', default 'ppd': CTA per delivery vs upfront total), shippingLine,
   perks (array, replaces the checklist), defaultSupply (index). Reads optional freebies.<id>.value (strike price on tiles). */
SBW.reg('international-plan', function (root, ctx) {
  var pl = ctx.plans, o = ctx.opts, freqs = pl.frequencies || [];
  var fq = function (id) { return freqs.filter(function (f) { return f.id === id; })[0] || freqs[0]; };
  var UNIT = { d: 1, w: 7, m: 30, y: 365 };
  var sup = (o.supplies || pl.schedules || freqs.map(function (f) { return { f: f.id, n: (pl.counts || [3])[0] }; })).map(function (s) {
    var f = fq(s.f), m = String(f.id).match(/^(\d*)\s*([dwmy])/i);
    var days = m ? (+m[1] || 1) * UNIT[m[2].toLowerCase()] * s.n : 0;
    return { f: f, n: s.n, label: s.label || (days ? days + '-Day' : s.n + ' Deliveries'), badge: String(s.badge || f.badge || '').toUpperCase() };
  });
  var fx = +o.fx || 1, cur = o.currency || ctx.cfg.currency || '₹', dec = o.decimals != null ? o.decimals : (fx === 1 ? 0 : 2);
  var money = function (v) { return cur + (v * fx).toLocaleString(o.locale || ctx.cfg.locale || 'en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };
  var pay = o.payMode || 'ppd';
  var st = { mode: ctx.mode0(o), sel: o.defaultSupply != null ? o.defaultSupply : Math.min(1, sup.length - 1), gifts: true };
  root.style.setProperty('--ip-at', accText(ctx.cfg.tokens || {}));

  function card(s, i, sub) {
    var on = sub && i === st.sel, f = s.f, base = ctx.base(), per = ctx.per(f.off), g = ctx.gifts(f, s.n);
    var h = '<div class="ip-card' + (on ? ' on' : '') + '" data-a="pick" data-v="' + i + '"><div class="ip-r1"><span class="l"><span class="sbw-dot"></span><span class="ip-nm"><b>' + ctx.esc(s.label) + '</b> Supply</span></span><span class="ip-tags">' +
      (s.badge ? '<span class="ip-bd">' + ctx.esc(s.badge) + '</span>' : '') + (f.off ? '<span class="ip-off">' + f.off + '%OFF</span>' : '') + '</span></div>';
    h += '<div class="ip-r2"><div class="ip-pl"><span class="ip-p"><b>' + money(per) + '</b><small>/ delivery</small>' + (on && f.off ? '<em>Save ' + money(pay === 'prepaid' ? (base - per) * s.n : base - per) + '</em>' : '') + '</span>' +
      '<span class="ip-dl">Delivered <b>' + ctx.esc(f.label) + ' for ' + s.n + ' deliveries.</b></span></div>' +
      (g.length ? '<button class="ip-gi" data-a="free" data-v="' + i + '" aria-label="Freebies">🎁</button>' : '') + '</div>';
    if (on) {
      var days = g.map(function (x) { return ctx.ord(x[1]); });
      var perks = o.perks || ['Add, swap, or reschedule anytime', o.shippingLine || 'Free international shipping on all deliveries']
        .concat(g.length ? ['Includes ' + g.length + ' Freebie' + (g.length > 1 ? 's' : '') + ' on ' + (days.length > 1 ? days.slice(0, -1).join(', ') + ' and ' + days[days.length - 1] : days[0]) + ' order'] : []);
      h += '<hr class="ip-hr"><div class="ip-pk">' + perks.map(function (p) { return '<span>' + ctx.icon('check', 17, 'var(--p)', 2.2) + ctx.esc(p) + '</span>'; }).join('') + '</div>';
      if (g.length) {
        var first = g.reduce(function (m, x) { return Math.min(m, x[1]); }, 99);
        h += '<button class="ip-gp' + (st.gifts ? ' open' : '') + '" data-a="gifts"><span class="l"><span>🎁</span>' + (g.length > 1 ? g.length + ' Free Gifts' : 'Free Gift') + ' · Arrives from the ' +
          (first === 1 ? 'first' : ctx.ord(first)) + ' order</span>' + ctx.icon('right', 14, null, 2.2) + '</button>';
        if (st.gifts) h += '<div class="ip-ms">' + g.map(function (x) {
          var fb = ctx.freebie(x[0]) || { name: x[0] };
          return '<div class="ip-mt"><b>' + ctx.ord(x[1]) + ' Delivery</b><img src="' + ctx.esc(fb.image || '') + '" alt=""><span class="ip-fr">' + (fb.value ? '<s>' + money(fb.value) + '</s>' : '') +
            '<i>FREE</i></span><span class="ip-fn">' + ctx.esc(fb.name) + '</span></div>';
        }).join('') + '</div>';
      }
    }
    return h + '</div>';
  }
  function render() {
    var sub = st.mode === 'sub', s = sup[st.sel] || sup[0], per = ctx.per(s.f.off);
    var h = '<div class="ip-cards">' + sup.map(function (x, i) { return card(x, i, sub); }).join('') + '</div>';
    h += '<button class="ip-otp' + (sub ? '' : ' on') + '" data-a="otp">' + (sub ? '' : ctx.icon('check', 16, 'var(--p)', 2.6)) + '<span>One Time Purchase ' + money(ctx.base()) + '</span></button>';
    if (sub) h += '<button class="sbw-cta ip-cta"><span class="l"><b>Subscribe Now</b></span><span class="r">' + (pay === 'prepaid' ? money(per * s.n) + '<small>for ' + s.n + ' deliveries</small>' : money(per) + '<small>/ delivery</small>') + '</span></button>';
    root.innerHTML = h;
    ctx.setSubscribed(sub);
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) return;
    var k = a.dataset.a, v = a.dataset.v;
    if (k === 'free') { e.stopPropagation(); var x = sup[+v]; return ctx.freebiePopup(ctx.gifts(x.f, x.n)); }
    if (k === 'gifts') st.gifts = !st.gifts;
    else if (k === 'pick') { if (st.mode === 'sub' && st.sel === +v) return; st.mode = 'sub'; st.sel = +v; st.gifts = true; }
    else if (k === 'otp') st.mode = 'otp';
    render();
  });
  function accText(T) {
    var lum = function (hx) {
      hx = String(hx || '').replace('#', ''); if (hx.length === 3) hx = hx.replace(/(.)/g, '$1$1');
      var n = parseInt(hx, 16); if (isNaN(n)) return 1;
      return [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); })
        .reduce(function (s, c, i) { return s + c * [0.2126, 0.7152, 0.0722][i]; }, 0);
    };
    var a = lum(T.accent), b = lum(T.bg || '#ffffff');
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 2.2 ? 'var(--a)' : 'var(--p)';
  }
  return { render: render };
});
