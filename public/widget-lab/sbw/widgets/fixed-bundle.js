/* bundle kit (bw-): shared by fixed-bundle, byob, bxgy-list, bxgy-grid. Identical copy in each file; first loaded wins. */
(function () {
  if (window.SBWB) return;
  var B = window.SBWB = {};
  var hex = function (h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) || 0; }); };
  var lum = function (h) { return hex(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0); };
  B.contrast = function (a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // accent as text on white surfaces: accent when it reads, else the savings green token
  B.accVar = function (ctx, el) {
    var T = ctx.cfg.tokens || {};
    el.style.setProperty('--bw-acc', T.accent && B.contrast(T.accent, T.bg || '#ffffff') >= 2.2 ? 'var(--a)' : 'var(--ok)');
  };
  // 'pdp' = current product + selected variant; else catalog id; else freebie key
  B.item = function (ctx, id) {
    if (id === 'pdp') {
      var v = ctx.variant();
      return { id: 'pdp', title: ctx.cfg.product.title, price: ctx.base(), cmp: ctx.compareAt(), image: ctx.img(), meta: v && v.name };
    }
    var c = ctx.catalog.filter(function (x) { return x.id === id; })[0];
    if (c) return { id: id, title: c.title, price: +c.price || 0, cmp: c.compareAt, image: c.image, meta: c.meta, variants: c.variants };
    var f = ctx.freebie(id);
    return f ? { id: id, title: f.name, price: +f.price || 0, image: f.image, meta: f.meta } : { id: id, title: id, price: 0 };
  };
  B.single = function (ctx, on) {
    return '<button class="bw-single' + (on ? ' on' : '') + '" data-a="single"><span class="l"><span class="sbw-dot"></span>Buy Single</span><span class="pr">' + ctx.money(ctx.base()) + '</span></button>';
  };
  B.ban = function (lines) {
    lines = lines.length > 1 ? lines : [lines[0], lines[0]];
    return '<div class="sbw-ban bw-ban"><div class="trk">' + lines.slice(0, 2).concat([lines[0]]).map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div></div>';
  };
  B.arrow = '<svg class="sbw-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  B.divider = function (t) { return '<div class="bw-div"><i></i><span>' + t + '</span><i></i></div>'; };
  B.thumbs = function (ctx, items) {
    return '<span class="bw-av">' + items.slice(0, 3).map(function (it) { return '<img src="' + ctx.esc(it.image || '') + '" alt="">'; }).join('') + '</span>';
  };
  B.LABEL = { prepaid: 'Pay Upfront', ppd: 'Pay Per Delivery', payg: 'Pay As You Go', autopay: 'Auto Pay' };
  // subscription state shared by fixed-bundle and byob
  B.subState = function (ctx, o) {
    var pl = ctx.plans, freqs = pl.frequencies || [], counts = pl.counts || [6];
    var modes = o.payModes || pl.payModes || ['prepaid', 'ppd'];
    return { pt: 'otp', pm: modes[0], modes: modes, freq: (freqs[1] || freqs[0] || {}).id, count: counts[Math.min(1, counts.length - 1)], dd: '', open: true, subOn: o.subscribe !== false && freqs.length > 0 };
  };
  B.fq = function (ctx, st) { var f = ctx.plans.frequencies || []; return f.filter(function (x) { return x.id === st.freq; })[0] || f[0] || { off: 0 }; };
  B.subOff = function (b, f) { return b.subscribeOff != null ? +b.subscribeOff : +(f.off || 0); };
  function dd(st, key, label, val, items) {
    return '<div class="sbw-dd' + (st.dd === key ? ' open' : '') + '"><label>' + label + '</label><button data-a="dd" data-v="' + key + '"><span>' + val + '</span>' + SBW.icon('chev', 16, '#6b6b6b') + '</button><div class="sbw-menu">' + items + '</div></div>';
  }
  // Choose payment type: One Time | Subscribe, then frequency, count, pay mode + explainer, freebies
  B.payBlock = function (ctx, st, oneTimePrice, subOff, gifts) {
    var h = B.divider('Choose payment type') + '<div class="bw-pt">' +
      '<button class="bw-pc' + (st.pt === 'otp' ? ' on' : '') + '" data-a="pt" data-v="otp"><span class="sbw-dot"></span><span class="t"><b>One Time</b><i>' + ctx.money(oneTimePrice) + '</i></span></button>' +
      '<button class="bw-pc' + (st.pt === 'sub' ? ' on' : '') + '" data-a="pt" data-v="sub"><span class="sbw-dot"></span><span class="t"><b>Subscribe</b><i>More ' + subOff + '% OFF</i></span></button></div>';
    if (st.pt === 'sub') {
      var freqs = ctx.plans.frequencies || [], counts = ctx.plans.counts || [6], f = B.fq(ctx, st);
      h += '<div class="bw-sub"><div class="bw-dds">' +
        dd(st, 'freq', 'HOW OFTEN?', ctx.esc(f.label), freqs.map(function (x) { return '<button data-a="freq" data-v="' + x.id + '" class="' + (x.id === st.freq ? 'on' : '') + '"><span>' + ctx.esc(x.label) + (ctx.gifts(x, st.count).length ? ' 🎁' : '') + '</span></button>'; }).join('')) +
        dd(st, 'count', 'HOW MANY?', st.count + ' Deliveries', counts.map(function (c) { return '<button data-a="count" data-v="' + c + '" class="' + (c === st.count ? 'on' : '') + '"><span>' + c + ' Deliveries</span></button>'; }).join('')) + '</div>';
      if (st.modes.length > 1) h += '<div class="sbw-seg bw-pm">' + st.modes.map(function (m) { return '<button data-a="pm" data-v="' + m + '" class="' + (m === st.pm ? 'on' : '') + '">' + B.LABEL[m] + '</button>'; }).join('') + '</div>';
      h += '<div class="sbw-note">' + SBW.icon('info', 14, '#8b8b8b') + '<span>' + ctx.esc(ctx.payNote(st.pm)) + '</span></div>';
      if (gifts.length) h += '<div class="bw-fr"><button class="sbw-chip" data-a="free"><span class="sbw-gift-ic">🎁</span>Freebies x' + gifts.length + ' ' + SBW.icon('info', 14) + '</button></div>';
      h += '</div>';
    }
    return h;
  };
  B.savings = function (ctx, save, pct, pin) {
    return '<div class="bw-svb"><button class="bw-sv" data-a="price"><span class="l">Total savings ' + ctx.money(save) + (pct > 0 ? ' <span class="sbw-pill">' + pct + '%OFF</span>' : '') + '</span>' + SBW.icon('right', 20) + '</button>' +
      '<div class="bw-ship"><span>Shipping: <b>Free</b></span><button data-a="pin"><span>Pincode: <b>' + ctx.esc(pin) + '</b></span>' + B.arrow + '</button></div></div>';
  };
  B.cta = function (ctx, title, sub, price, strike, per, dis) {
    return '<button class="sbw-cta bw-cta' + (dis ? ' dis' : '') + '"><span class="l"><b>' + title + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</span><span class="r">' + price +
      (per ? '<small>/delivery</small>' : '') + (strike ? ' <s>' + strike + '</s>' : '') + '</span></button>' + ctx.powered();
  };
  // pincode popup (shared modal lives outside root, so it gets its own listener)
  B.pinPopup = function (ctx, pin, done) {
    B._pinDone = done;
    ctx.popup('Delivery location', '<div class="bw-pinp"><label>PINCODE</label><div class="row"><input data-bw-pin inputmode="numeric" maxlength="6" value="' + ctx.esc(pin) + '"><button data-bw-pinok>Check</button></div><p data-bw-pinmsg>' +
      SBW.icon('truck', 16) + ' Free shipping on every delivery to ' + ctx.esc(pin) + '</p></div>');
  };
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t.closest) return;
    var pop = t.closest('.sbw-pop'); if (!pop) return;
    var inp = pop.querySelector('[data-bw-pin]'); if (!inp) return;
    var v = inp.value.replace(/\D/g, '');
    if (t.closest('[data-bw-pinok]')) {
      var m = pop.querySelector('[data-bw-pinmsg]');
      m.innerHTML = v.length === 6 ? SBW.icon('truck', 16) + ' Free shipping on every delivery to ' + v : 'Please enter a valid 6-digit pincode';
      m.className = v.length === 6 ? '' : 'err';
    }
    if ((t.closest('[data-close]') || t.closest('[data-bw-pinok]')) && v.length === 6 && B._pinDone) B._pinDone(v);
  }, true);
  // common click actions for the subscription block; returns true when handled
  B.subClick = function (st, k, v) {
    if (k === 'dd') { st.dd = st.dd === v ? '' : v; return true; }
    if (k === 'pt') { st.pt = v; st.open = v === 'otp'; return true; }
    if (k === 'freq') { st.freq = v; return true; }
    if (k === 'count') { st.count = +v; return true; }
    if (k === 'pm') { st.pm = v; return true; }
    if (k === 'toggle') { st.open = !st.open; return true; }
    return false;
  };
})();
/* fixed-bundle: Curated (fixed) bundle. Design: Final JSX 2/Bundle Widgets/Fixed Bundle.jsx
   Buy Single card (default, theme Add to cart stays) | bundle box: slide-up banner, Buy Bundle + UPTO pill;
   selected: combo cards (scroll), 3-col product grid with + joins, Choose payment type (One Time | Subscribe),
   subscribe adds HOW OFTEN? / HOW MANY? / pay mode + explainer / freebies and collapses products behind an
   avatar toggle, Total savings (pricing popup), Shipping + Pincode (popup), Add to Cart / Subscribe Now bar.
   Data: cfg.bundles['fixed-bundle'] = { combos: [{ id, name, tag, items: ['pdp'|catalogId...], off | price }], subscribeOff, banner } */
SBW.reg('fixed-bundle', function (root, ctx) {
  var B = window.SBWB, o = ctx.opts, b = (ctx.cfg.bundles || {})['fixed-bundle'] || {};
  var combos = b.combos && b.combos.length ? b.combos : [{ id: 'all', name: 'Curated Bundle', items: ['pdp'].concat(ctx.catalog.slice(0, 5).map(function (c) { return c.id; })), off: 20 }];
  var st = B.subState(ctx, o, b);
  st.mode = ctx.mode0(o); st.combo = 0; st.pin = o.pincode || ctx.cfg.pincode || '400050';
  B.accVar(ctx, root);

  function price(c) {
    var items = c.items.map(function (id) { return B.item(ctx, id); });
    var mrp = items.reduce(function (s, it) { return s + it.price; }, 0);
    var p = c.price != null ? +c.price : Math.round(mrp * (1 - (c.off || 0) / 100));
    return { items: items, mrp: mrp, price: p, pct: mrp ? Math.round((mrp - p) / mrp * 100) : 0 };
  }
  function render() {
    var bundle = st.mode === 'sub', sub = st.subOn && st.pt === 'sub', f = B.fq(ctx, st), so = B.subOff(b, f);
    var C = combos[st.combo], P = price(C);
    var maxPct = Math.max.apply(null, combos.map(function (c) { return price(c).pct; })) + (st.subOn ? so : 0);
    var lines = o.banner || b.banner || ['Curated Bundles - <b>SAVE MORE TOGETHER</b>', 'Save up to <b>' + maxPct + '% OFF</b> on curated bundles'];
    var h = B.single(ctx, !bundle) + '<div class="bw-box' + (bundle ? ' sel' : '') + '">' + B.ban(lines);
    if (!bundle) {
      h += '<button class="bw-row" data-a="bundle"><span class="l"><span class="sbw-dot"></span>Buy Bundle</span><span class="bw-pulse"><span class="sbw-pill">UPTO ' + maxPct + '%OFF</span></span></button></div>';
    } else {
      var n = sub && st.pm === 'prepaid' ? st.count : 1;
      var per = sub ? Math.round(P.price * (1 - so / 100)) : P.price, total = per * n, gross = P.mrp * n, save = gross - total;
      var pct = gross ? Math.round(save / gross * 100) : 0, gifts = sub ? ctx.gifts(f, st.count) : [];
      h += '<div class="bw-in"><div class="bw-row on"><span class="l"><span class="sbw-dot"></span>Buy Bundle</span>' +
        (sub ? '<button class="bw-tg' + (st.open ? ' open' : '') + '" data-a="toggle">' + B.thumbs(ctx, P.items) + SBW.icon('chev', 16) + '</button>'
             : '<span class="bw-pulse"><span class="sbw-pill">UPTO ' + maxPct + '%OFF</span></span>') + '</div>';
      if (st.open) {
        h += '<div class="bw-scroll fb-combos">' + combos.map(function (c, i) {
          var on = i === st.combo, q = price(c);
          return '<button class="fb-combo' + (on ? ' on' : '') + '" data-a="combo" data-v="' + i + '"><span class="t"><b>' + ctx.esc(c.name) + '</b>' + (c.tag ? '<small>' + ctx.esc(c.tag) + '</small>' : '') +
            '</span><span class="fb-off">' + q.pct + '% OFF</span></button>';
        }).join('') + '</div>';
        h += '<div class="bw-pad"><div class="bw-grid">' + P.items.map(function (it, i) {
          var last = i === P.items.length - 1;
          return '<div class="bw-card"><img src="' + ctx.esc(it.image || '') + '" alt=""><span class="n">' + ctx.esc(it.title) + '</span><span class="m">' +
            (it.meta ? '<span>' + ctx.esc(it.meta) + '</span><span>•</span>' : '') + '<span>' + ctx.money(it.price) + '</span></span>' +
            (i % 3 !== 2 && !last ? '<span class="bw-plus">' + SBW.icon('plus', 14, null, 3) + '</span>' : '') + '</div>';
        }).join('') + '</div></div>';
      }
      h += '<div class="bw-pad">' + (st.subOn ? B.payBlock(ctx, st, P.price, so, gifts) : '') + B.savings(ctx, save, pct, st.pin) + '</div></div></div>';
      h += B.cta(ctx, sub ? 'Subscribe Now' : 'Add to Cart', ctx.esc(C.name) + ' - Bundle', ctx.money(total), '', sub && st.pm !== 'prepaid');
      st._g = gifts;
      st._rows = sub
        ? [['Bundle', C.name], ['Frequency', f.label], ['No. of deliveries', st.count + ' Deliveries'], ['Per delivery price', ctx.money(per), 1], ['Discount', pct + '% OFF', 1]]
          .concat(gifts.length ? [['Freebies (' + gifts.length + ')', 'FREE', 1]] : []).concat([['Shipping', 'Free', 1], [st.pm === 'prepaid' ? 'You pay today' : 'You pay per delivery', ctx.money(total)]])
        : [['Bundle', C.name], ['Products', P.items.length + ' items'], ['Bundle MRP', ctx.money(P.mrp)], ['Bundle price', ctx.money(P.price), 1], ['Total savings', ctx.money(save), 1], ['Shipping', 'Free', 1]];
    }
    root.innerHTML = '<div class="bw-root">' + h + '</div>';
    ctx.setSubscribed(bundle);
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) { if (st.dd) { st.dd = ''; render(); } return; }
    var k = a.dataset.a, v = a.dataset.v;
    if (k !== 'dd') st.dd = '';
    if (k === 'single') st.mode = 'otp';
    else if (k === 'bundle') { st.mode = 'sub'; st.open = st.pt === 'otp' || st.open; }
    else if (k === 'combo') st.combo = +v;
    else if (k === 'price') return ctx.pricePopup(st._rows);
    else if (k === 'free') return ctx.freebiePopup(st._g);
    else if (k === 'pin') return B.pinPopup(ctx, st.pin, function (p) { st.pin = p; render(); });
    else if (!B.subClick(st, k, v)) return;
    render();
  });
  return { render: render };
});
