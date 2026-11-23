/* payg-only: Subscription Widget, PAYG Only (pay per delivery only). Design: Final JSX 2/Subscription Widgets/PAYG Only.jsx
   One Time Purchase pill; subscribe box with slide-up banner (PAY PER DELIVERY + explainer), UPTO x%OFF bar with Get Free Gifts
   (Freebies popup), Subscribe & Save row, HOW OFTEN? 3-slot frequency rotator (selected slot + 2 others + arrow), price row with
   strike + OFF pill, "Delivered <freq> for [N Deliveries]" dropdown, gift milestone pill expanding inline into delivery tiles,
   Subscribe Now bar (Pay per delivery), POWERED BY inside the box.
   options: payMode ('ppd' | 'payg', default 'ppd') drives banner explainer + CTA subline; banner (array of HTML lines);
   defaultFrequency (frequency id); defaultCount (number). Reads optional freebies.<id>.value (strike price on gift tiles). */
SBW.reg('payg-only', function (root, ctx) {
  var pl = ctx.plans, o = ctx.opts, freqs = pl.frequencies || [], counts = pl.counts || [6];
  var maxOff = Math.max.apply(null, freqs.map(function (f) { return f.off || 0; }).concat([0]));
  var pay = o.payMode || 'ppd';
  var PAYLBL = { ppd: 'Pay Per Delivery', payg: 'Pay As You Go' };
  var fid0 = o.defaultFrequency && freqs.some(function (f) { return f.id === o.defaultFrequency; }) ? o.defaultFrequency : (freqs[0] || {}).id;
  var st = { mode: ctx.mode0(o), sel: fid0, others: freqs.map(function (f) { return f.id; }).filter(function (id) { return id !== fid0; }),
    count: o.defaultCount || counts[Math.min(1, counts.length - 1)], dd: false, gifts: true, anim: '' };
  var lines = o.banner || [PAYLBL[pay].toUpperCase(), ctx.esc(ctx.payNote(pay))];
  var fq = function (id) { return freqs.filter(function (f) { return f.id === id; })[0] || freqs[0]; };
  var short = function (f) { return ctx.esc(String(f.label || f.short || '').replace(/^every\s+/i, '')); };
  // accent as text on light surfaces: design falls back when contrast < 2.2 (helper local to this widget)
  root.style.setProperty('--pg-at', accText(ctx.cfg.tokens || {}));

  function slot(f, on, cls) {
    var g = ctx.gifts(f, st.count).length;
    return '<button class="pg-sl' + (on ? ' on' : '') + (cls || '') + '" data-a="' + (on ? 'noop' : 'freq') + '" data-v="' + f.id + '">' + (g ? '<i class="pg-gd"></i>' : '') +
      '<span>Every</span><b>' + short(f) + '</b></button>';
  }
  function render() {
    var sub = st.mode === 'sub', f = fq(st.sel), n = st.count, base = ctx.base(), per = ctx.per(f.off), g = ctx.gifts(f, n);
    var anyGift = freqs.some(function (x) { return ctx.gifts(x, Math.max.apply(null, counts)).length; });
    var h = '<button class="pg-otp' + (sub ? '' : ' on') + '" data-a="otp"><span class="l"><span class="sbw-dot"></span>One Time Purchase</span><span class="pr">' + ctx.money(base) + '</span></button>';
    h += '<div class="pg-box' + (sub ? ' on' : '') + '">';
    if (sub) h += '<div class="sbw-ban pg-ban"><div class="trk">' + lines.concat([lines[0]]).map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div></div>';
    h += '<div class="pg-bar"><span>UPTO ' + maxOff + '%OFF</span>' + (anyGift ? '<button class="pg-gg" data-a="free"><span class="sbw-gift-ic">🎁</span>' + (sub ? 'Get Free Gifts' : 'Subscriber Gifts Included') + '</button>' : '') + '</div>';
    h += '<button class="pg-hd' + (sub ? ' on' : '') + '" data-a="sub"><span class="l"><span class="sbw-dot"></span>Subscribe &amp; Save</span>' +
      (sub ? '' : '<span class="r"><small>Per delivery</small><b>' + ctx.money(per) + '</b></span>') + '</button>';
    if (sub) {
      var vis = st.others.slice(0, 2).map(fq);
      h += '<div class="pg-in"><div class="pg-lbl">HOW OFTEN?</div><div class="pg-rot"><div class="pg-trk">' + slot(f, true, st.anim === 'sel' ? ' in' : '') +
        '<div class="pg-oth' + (st.anim === 'rot' ? ' in' : '') + '">' + vis.map(function (x) { return slot(x, false); }).join('') + '</div></div>' +
        (st.others.length > 1 ? '<button class="pg-arr" data-a="rot" aria-label="More frequencies">' + ctx.icon('right', 16, null, 2.2) + '</button>' : '') + '</div>';
      h += '<div class="pg-pr"><div class="pg-pl"><span class="pg-p">' + (f.off ? '<s>' + ctx.money(base) + '</s>' : '') + '<b>' + ctx.money(per) + '</b><small>/ delivery</small></span>' +
        '<span class="pg-dl">Delivered <b>' + ctx.esc(f.label) + '</b> for <span class="sbw-dd pg-dd' + (st.dd ? ' open' : '') + '"><button data-a="dd"><span>' + n + ' Deliveries</span>' + ctx.icon('chev', 14, '#6b6b6b') +
        '</button><span class="sbw-menu">' + counts.map(function (c) { return '<button data-a="count" data-v="' + c + '" class="' + (c === n ? 'on' : '') + '"><span>' + c + ' Deliveries</span></button>'; }).join('') + '</span></span></span></div>' +
        (f.off ? '<span class="pg-off">' + f.off + '%OFF</span>' : '') + '</div><hr class="pg-hr">';
      if (g.length) {
        var first = g.reduce(function (m, x) { return Math.min(m, x[1]); }, 99);
        h += '<button class="pg-gp' + (st.gifts ? ' open' : '') + '" data-a="gifts"><span class="l"><span>🎁</span>' + (g.length > 1 ? g.length + ' Free Gifts' : 'Free Gift') + ' · Arrives from the ' +
          (first === 1 ? 'first' : ctx.ord(first)) + ' order</span>' + ctx.icon('right', 14, null, 2.2) + '</button>';
        if (st.gifts) h += '<div class="pg-ms">' + g.map(function (x) {
          var fb = ctx.freebie(x[0]) || { name: x[0] };
          return '<div class="pg-mt"><b>' + ctx.ord(x[1]) + ' Delivery</b><img src="' + ctx.esc(fb.image || '') + '" alt=""><span class="pg-fr">' + (fb.value ? '<s>' + ctx.money(fb.value) + '</s>' : '') +
            '<i>FREE</i></span><span class="pg-fn">' + ctx.esc(fb.name) + '</span></div>';
        }).join('') + '</div>';
      }
      h += '<button class="sbw-cta pg-cta"><span class="l"><b>Subscribe Now</b><span>' + (pay === 'payg' ? 'Pay as you go' : 'Pay per delivery') + '</span></span><span class="r">' + ctx.money(per) + '<small>/ delivery</small></span></button>';
      h += ctx.powered() + '</div>';
    }
    h += '</div>';
    root.innerHTML = h;
    st.anim = '';
    ctx.setSubscribed(sub);
    st._g = g.length ? g : ctx.gifts(freqs.filter(function (x) { return ctx.gifts(x, n).length; })[0], n);
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]');
    if (!a) { if (st.dd) { st.dd = false; render(); } return; }
    var k = a.dataset.a, v = a.dataset.v;
    if (k === 'dd') { st.dd = !st.dd; return render(); }
    st.dd = false;
    if (k === 'otp' || k === 'sub') st.mode = k;
    else if (k === 'freq') { var i = st.others.indexOf(v); st.others.splice(i, 1); st.others.push(st.sel); st.sel = v; st.anim = 'sel'; }
    else if (k === 'rot') { st.others.push(st.others.shift()); st.anim = 'rot'; }
    else if (k === 'count') st.count = +v;
    else if (k === 'gifts') st.gifts = !st.gifts;
    else if (k === 'free') return ctx.freebiePopup(st._g || []);
    else if (k === 'noop') return;
    render();
  });
  function accText(T) {
    var lum = function (hx) {
      hx = String(hx || '').replace('#', ''); if (hx.length === 3) hx = hx.replace(/(.)/g, '$1$1');
      var n = parseInt(hx, 16); if (isNaN(n)) return 1;
      return [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); })
        .reduce(function (s, c, i) { return s + c * [0.2126, 0.7152, 0.0722][i]; }, 0);
    };
    var a = lum(T.accent), b = lum(T.tile || '#ffffff');
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 2.2 ? 'var(--a)' : 'var(--p)';
  }
  return { render: render };
});
