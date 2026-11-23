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
/* byob: Build Your Own Box. Design: Final JSX 2/Bundle Widgets/BYOB.jsx
   Buy Single card (default) | bundle box: slide-up banner, Build your Bundle; selected: collection pills (scroll),
   tier progress panel (Add N more products to unlock), product carousel with ADD / qty stepper + variant dropdown,
   Choose payment type (One Time | Subscribe + plan, pay mode, explainer, freebies), Total savings (pricing popup),
   Shipping + Pincode (popup), Add to Cart / Subscribe Now bar.
   Data: cfg.bundles.byob = { collections: [{ id, name, items, off? }], tiers: [{ n, off }], max, start: { id: qty }, subscribeOff, banner } */
SBW.reg('byob', function (root, ctx) {
  var B = window.SBWB, o = ctx.opts, b = (ctx.cfg.bundles || {}).byob || {};
  var allIds = ['pdp'].concat(ctx.catalog.map(function (c) { return c.id; }));
  var cols = b.collections && b.collections.length ? b.collections : [{ id: 'all', name: 'Your Box', items: allIds }];
  var tiers = (b.tiers && b.tiers.length ? b.tiers : [{ n: 3, off: 5 }, { n: 5, off: 10 }, { n: 8, off: 15 }]).slice().sort(function (x, y) { return x.n - y.n; });
  var max = b.max || tiers[tiers.length - 1].n, maxTier = tiers[tiers.length - 1].off;
  var st = B.subState(ctx, o);
  st.mode = ctx.mode0(o); st.col = 0; st.pin = o.pincode || ctx.cfg.pincode || '400050';
  st.cart = JSON.parse(JSON.stringify(b.start || {})); st.vsel = {}; st.vdd = '';
  B.accVar(ctx, root);

  // item with its own variant choice inside the box (pdp starts on the theme-selected variant)
  function itm(id) {
    var it = B.item(ctx, id), vs = id === 'pdp' ? ctx.cfg.product.variants : it.variants;
    if (vs && vs.length > 1) {
      var name = st.vsel[id] || it.meta || vs[0].name, v = vs.filter(function (x) { return x.name === name; })[0] || vs[0];
      it.vs = vs; it.vname = v.name; it.price = +v.price || it.price; if (v.image) it.image = v.image;
    }
    return it;
  }
  function count() { return Object.keys(st.cart).reduce(function (s, k) { return s + st.cart[k]; }, 0); }
  function tierPanel(n) {
    var ni = -1; tiers.some(function (t, i) { if (t.n > n) { ni = i; return true; } return false; });
    var next = ni < 0 ? null : tiers[ni], earned = tiers.filter(function (t) { return t.n <= n; }).pop();
    var cs = tiers.map(function (_, i) { return (i + 0.5) * 100 / tiers.length; }), fill;
    if (!next) fill = 100;
    else { var pt = ni ? tiers[ni - 1].n : 0, pc = ni ? cs[ni - 1] : 0; fill = pc + (n - pt) / (next.n - pt) * (cs[ni] - pc); }
    var left = next ? next.n - n : 0;
    return '<div class="bb-tier"><div class="hd"><span>' + (next ? 'Add ' + left + ' more product' + (left === 1 ? '' : 's') + ' to unlock' : 'Maximum discount unlocked') +
      '</span><span class="sbw-pill acc">' + (next || earned).off + '%OFF</span></div>' +
      '<div class="bar"><div class="tr"><i style="width:' + fill + '%"></i></div>' + cs.map(function (c, i) { return '<b class="' + (tiers[i].n <= n ? 'ok' : '') + '" style="left:' + c + '%"></b>'; }).join('') +
      (n ? '<em style="left:' + fill + '%"></em>' : '') + '</div><div class="lb">' + tiers.map(function (t, i) {
        var lit = ni < 0 || i <= ni;
        return '<span class="' + (ni === i ? 'nx' : '') + (lit ? ' lit' : '') + '"><b>' + t.off + '% OFF</b><small>' + t.n + ' Products</small></span>';
      }).join('') + '</div></div>';
  }
  function card(id) {
    var it = itm(id), q = st.cart[id] || 0, full = count() >= max;
    var dd = it.vs ? '<div class="bb-dd' + (st.vdd === id ? ' open' : '') + '"><button data-a="vdd" data-v="' + id + '"><span>' + ctx.esc(it.vname) + '</span>' + SBW.icon('chev', 14) + '</button>' +
      (st.vdd === id ? '<div class="bb-menu">' + it.vs.map(function (v) { return '<button data-a="var" data-v="' + id + '|' + ctx.esc(v.name) + '" class="' + (v.name === it.vname ? 'on' : '') + '">' + ctx.esc(v.name) + '</button>'; }).join('') + '</div>' : '') + '</div>'
      : (it.meta ? '<div class="bb-meta">' + ctx.esc(it.meta) + '</div>' : '');
    return '<div class="bb-card' + (q ? ' on' : '') + '"><div class="im"><img src="' + ctx.esc(it.image || '') + '" alt="">' +
      (q ? '<div class="bb-q"><button data-a="dec" data-v="' + id + '">' + SBW.icon('minus', 13, null, 3) + '</button><span>' + q + '</span><button data-a="inc" data-v="' + id + '"' + (full ? ' class="off"' : '') + '>' + SBW.icon('plus', 13, null, 3) + '</button></div>'
         : '<button class="bb-add' + (full ? ' off' : '') + '" data-a="inc" data-v="' + id + '">ADD</button>') +
      '</div><div class="nm"><span>' + ctx.esc(it.title) + '</span><b>' + ctx.money(it.price) + '</b></div>' + dd + '</div>';
  }
  function render() {
    var bundle = st.mode === 'sub', sub = st.subOn && st.pt === 'sub', f = B.fq(ctx, st), so = B.subOff(b, f), C = cols[st.col];
    var upto = maxTier + (st.subOn ? so : 0);
    var lines = o.banner || b.banner || ['Curated Bundles - <b>ADD MORE TOGETHER</b>', 'Unlock up to <b>' + upto + '% OFF</b> as you add more'];
    var h = B.single(ctx, !bundle) + '<div class="bw-box' + (bundle ? ' sel' : '') + '">' + B.ban(lines);
    if (!bundle) {
      h += '<button class="bw-row st" data-a="bundle"><span class="l"><span class="sbw-dot"></span>Buy Bundle</span><span class="bw-pulse"><span class="sbw-pill">UPTO ' + upto + '%OFF</span></span></button></div>';
    } else {
      var n = count(), inBox = Object.keys(st.cart).map(itm);
      var subtotal = inBox.reduce(function (s, it) { return s + it.price * st.cart[it.id]; }, 0);
      var tier = tiers.filter(function (t) { return t.n <= n; }).pop(), tp = tier ? tier.off : 0, sp = sub ? so : 0;
      var k = sub && st.pm === 'prepaid' ? st.count : 1;
      var otp = Math.round(subtotal * (1 - tp / 100)), save = Math.round(subtotal * (tp + sp) / 100) * k, total = subtotal * k - save;
      var gifts = sub ? ctx.gifts(f, st.count) : [];
      h += '<div class="bw-in"><div class="bw-row on"><span class="l"><span class="sbw-dot"></span>Build your Bundle</span>' +
        (sub ? '<button class="bw-tg' + (st.open ? ' open' : '') + '" data-a="toggle">' + B.thumbs(ctx, inBox.length ? inBox : C.items.map(itm)) + SBW.icon('chev', 16) + '</button>' : '') + '</div>';
      if (st.open) {
        if (cols.length > 1) h += '<div class="bw-scroll bb-cols">' + cols.map(function (c, i) {
          return '<button class="bb-col' + (i === st.col ? ' on' : '') + '" data-a="col" data-v="' + i + '"><b>' + ctx.esc(c.name) + '</b><span>' + (c.off != null ? c.off : maxTier) + '% OFF</span></button>';
        }).join('') + '</div>';
        h += '<div class="bw-pad">' + tierPanel(n) + '</div><div class="bw-scroll bb-car">' + C.items.map(card).join('') + '</div>';
      }
      h += '<div class="bw-pad">' + (st.subOn ? B.payBlock(ctx, st, otp, so, gifts) : '') + B.savings(ctx, save, tp + sp, st.pin) + '</div></div></div>';
      h += B.cta(ctx, sub ? 'Subscribe Now' : 'Add to Cart', ctx.esc(C.name) + ' - ' + n + ' item' + (n === 1 ? '' : 's'), ctx.money(total), '', sub && st.pm !== 'prepaid', !n);
      st._g = gifts;
      st._rows = [['Bundle', C.name], ['Products in bundle', n + ' item' + (n === 1 ? '' : 's')], ['Subtotal', ctx.money(subtotal * k)], ['Bundle discount', tp + '% OFF', 1]]
        .concat(sub ? [['Subscription bonus', sp + '% OFF', 1], ['Frequency', f.label], ['No. of deliveries', st.count + ' Deliveries']] : [])
        .concat(gifts.length ? [['Freebies (' + gifts.length + ')', 'FREE', 1]] : [])
        .concat([['Total savings', ctx.money(save), 1], ['Shipping', 'Free', 1], [sub && st.pm !== 'prepaid' ? 'You pay per delivery' : 'You pay today', ctx.money(total)]]);
    }
    root.innerHTML = '<div class="bw-root">' + h + '</div>';
    ctx.setSubscribed(bundle);
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) { if (st.dd || st.vdd) { st.dd = st.vdd = ''; render(); } return; }
    var k = a.dataset.a, v = a.dataset.v;
    if (k !== 'dd') st.dd = '';
    if (k !== 'vdd') st.vdd = '';
    if (k === 'single') st.mode = 'otp';
    else if (k === 'bundle') { st.mode = 'sub'; st.open = st.pt === 'otp' || st.open; }
    else if (k === 'col') st.col = +v;
    else if (k === 'inc') { if (count() >= max) return; st.cart[v] = (st.cart[v] || 0) + 1; }
    else if (k === 'dec') { st.cart[v] = (st.cart[v] || 0) - 1; if (st.cart[v] <= 0) delete st.cart[v]; }
    else if (k === 'vdd') st.vdd = st.vdd === v ? '' : v;
    else if (k === 'var') { var p = v.split('|'); st.vsel[p[0]] = p.slice(1).join('|'); }
    else if (k === 'price') return ctx.pricePopup(st._rows);
    else if (k === 'free') return ctx.freebiePopup(st._g);
    else if (k === 'pin') return B.pinPopup(ctx, st.pin, function (pp) { st.pin = pp; render(); });
    else if (!B.subClick(st, k, v)) return;
    render();
  });
  return { render: render };
});
