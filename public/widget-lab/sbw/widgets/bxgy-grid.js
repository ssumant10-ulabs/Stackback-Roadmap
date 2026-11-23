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
/* bxgy-grid: Buy X Get Y, grid layout. Design: Final JSX 2/Bundle Widgets/BXGY-Grid.jsx
   Buy Single card (default; opts.single=false hides it and keeps the offer always selected) | offer box:
   slide-up banner (free item), Buy X Get Y + FREE pill; selected: 3-col product cards with + joins,
   free row(s) with FREE pill (tap = freebie popup), Add to Cart bar with total + strike.
   When items > buy, the shopper taps X cards to pick them (check badge); total re-prices.
   Data: cfg.bundles['bxgy-grid'] = { buy, get, items: ['pdp'|catalogId...], free: [catalogId|freebieKey], off, label, banner } */
SBW.reg('bxgy-grid', function (root, ctx) {
  var B = window.SBWB, o = ctx.opts, b = (ctx.cfg.bundles || {})['bxgy-grid'] || {};
  var buy = b.buy || 3, items = b.items || ['pdp', 'pdp', 'pdp'], free = b.free || [];
  var pick = items.length > buy, st = { mode: o.single === false ? 'sub' : ctx.mode0(o), sel: items.slice(0, buy).map(function (_, i) { return i; }) };
  B.accVar(ctx, root);

  function render() {
    var bundle = st.mode === 'sub', its = items.map(function (id) { return B.item(ctx, id); }), fr = free.map(function (id) { return B.item(ctx, id); });
    var label = b.label || 'Buy ' + buy + ' Get ' + (b.get || fr.length || 1), name = fr[0] ? fr[0].title.split(/[,|(]/)[0].trim() : '';
    var lines = o.banner || b.banner || [(fr[0] && fr[0].image ? '<img src="' + ctx.esc(fr[0].image) + '" alt="">' : '') + ctx.esc(name) + ' - <b>FREE</b> 🎁', label + ' <b>FREE</b> on this bundle'];
    var h = (o.single === false ? '' : B.single(ctx, !bundle)) + '<div class="bw-box bx-box' + (bundle ? ' sel' : '') + '">' + B.ban(lines);
    h += '<' + (o.single === false ? 'div' : 'button data-a="bundle"') + ' class="bw-row bx-hd' + (bundle ? ' on' : '') + '"><span class="l">' + (o.single === false ? '' : '<span class="sbw-dot"></span>') + label +
      '</span><span class="bw-pulse"><span class="bx-fp">🎁 FREE</span></span></' + (o.single === false ? 'div' : 'button') + '>';
    if (bundle) {
      var left = buy - st.sel.length, ok = left <= 0, p = 0, full = 0;
      h += '<div class="bx-body"><div class="bw-grid">' + its.map(function (it, i) {
        var on = st.sel.indexOf(i) >= 0, pr = Math.round(it.price * (1 - (b.off || 0) / 100)), cmp = it.cmp && it.cmp > pr ? it.cmp : (pr < it.price ? it.price : 0);
        if (on || !pick) { p += pr; full += cmp || pr; }
        return '<' + (pick ? 'button data-a="pick" data-v="' + i + '"' : 'div') + ' class="bw-card bx-card' + (on && pick ? ' on' : '') + '"><img src="' + ctx.esc(it.image || '') + '" alt="">' +
          (pick ? '<span class="bx-ck">' + SBW.icon('check', 13, null, 3) + '</span>' : '') + '<span class="n">' + ctx.esc(it.title) + '</span><span class="m">' +
          (it.meta ? '<span>' + ctx.esc(it.meta) + '</span><span>•</span>' : '') + '<span>' + ctx.money(pr) + '</span>' + (cmp ? '<s>' + ctx.money(cmp) + '</s>' : '') + '</span>' +
          (i % 3 !== 2 && i !== its.length - 1 ? '<span class="bw-plus">' + SBW.icon('plus', 14, null, 3) + '</span>' : '') + '</' + (pick ? 'button' : 'div') + '>';
      }).join('') + '</div>' + fr.map(function (it) {
        full += it.price;
        return '<button class="bx-free" data-a="free"><img src="' + ctx.esc(it.image || '') + '" alt=""><span class="t"><b>' + ctx.esc(it.title) + '</b><span>' + ctx.esc(it.meta || (it.price ? 'Worth ' + ctx.money(it.price) : '1 unit')) + '</span></span>' +
          (ok ? '<span class="bx-gp">🎁 FREE</span>' : '<span class="bx-gp lock">Pick ' + left + ' more</span>') + '</button>';
      }).join('') + '</div></div>';
      h += B.cta(ctx, ok ? 'Add to Cart' : 'Pick ' + left + ' more', '', ctx.money(p), full > p ? ctx.money(full) : '', false, !ok);
      st._fr = fr;
    } else h += '</div>';
    root.innerHTML = '<div class="bw-root">' + h + '</div>';
    ctx.setSubscribed(bundle);
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) return;
    var k = a.dataset.a, v = +a.dataset.v;
    if (k === 'single') st.mode = 'otp';
    else if (k === 'bundle') st.mode = 'sub';
    else if (k === 'pick') { var i = st.sel.indexOf(v); if (i >= 0) st.sel.splice(i, 1); else { st.sel.push(v); if (st.sel.length > buy) st.sel.shift(); } }
    else if (k === 'free') return ctx.popup('Free with this offer', '<div class="sbw-col">' + st._fr.map(function (it) {
      return '<div class="sbw-gr"><img src="' + ctx.esc(it.image || '') + '" alt=""><div class="sbw-gr-n"><b>' + ctx.esc(it.title) + '</b><span>' + ctx.esc(it.meta || (it.price ? 'Worth ' + ctx.money(it.price) : '')) + '</span></div><span class="sbw-gr-tag">FREE</span></div>';
    }).join('') + '</div>');
    else return;
    render();
  });
  return { render: render };
});
