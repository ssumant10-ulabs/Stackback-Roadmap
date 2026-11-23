/* multi-frequency: Subscription Widget, fixed number of deliveries, shopper picks the frequency.
   Design: Final JSX 2/Subscription Widgets/Multi-Frequency.jsx
   One Time Purchase card; Subscribe & Save box: bar ("How Subscriptions Work?" popup on subscribe, offer line on
   One-time), radio + UPTO pill, plan summary (N Deliveries, Delivered <frequency>, price / delivery), frequency and
   payment dropdowns + explainer, check list (freebie line opens Freebies popup); Subscribe Now bar.
   One-time: card + collapsed box header (Per delivery price) only.
   options: count (fixed deliveries, default plans.counts[1]), frequencies (array of frequency ids to offer, default all),
   defaultFrequency (id, default 2nd offered), payModes (default plans.payModes), defaultPay, freeShippingLine (bool),
   banner (array of HTML lines for the One-time bar; default "Limited Time Deal | UPTO X% OFF"), defaultMode.
   Local helper: accent text colour falls back to primary when accent is too light on bg (design accentSafe). */
SBW.reg('multi-frequency', function (root, ctx) {
  var pl = ctx.plans, o = ctx.opts, all = pl.frequencies || [];
  var freqs = o.frequencies ? all.filter(function (x) { return o.frequencies.indexOf(x.id) > -1; }) : all;
  var counts = pl.counts || [6], n = +o.count || counts[1] || counts[0];
  var modes = o.payModes || pl.payModes || ['prepaid', 'ppd'];
  var LABEL = { prepaid: 'Pay Upfront', ppd: 'Pay Per Delivery', payg: 'Pay As You Go', autopay: 'Auto Pay' };
  var maxOff = Math.max.apply(null, freqs.map(function (x) { return x.off || 0; }).concat([0]));
  var st = { mode: ctx.mode0(o), freq: o.defaultFrequency || (freqs[1] || freqs[0] || {}).id, pay: o.defaultPay || modes[0], open: '' };
  var fq = function () { return freqs.filter(function (x) { return x.id === st.freq; })[0] || freqs[0] || { label: '', off: 0 }; };
  root.style.setProperty('--xa', accSafe(ctx.cfg.tokens || {}));

  function giftLine(g) {
    var ds = g.map(function (x) { return ctx.ord(x[1]); });
    return 'Includes ' + g.length + ' Freebie' + (g.length > 1 ? 's' : '') + ' on ' + (ds.length > 1 ? ds.slice(0, -1).join(', ') + ' and ' + ds[ds.length - 1] : ds[0]) + ' delivery';
  }
  function dd(key, val, items) {
    return '<div class="sbw-dd mf-dd' + (st.open === key ? ' open' : '') + '"><button data-a="dd" data-v="' + key + '"><span>' + val + '</span>' + ctx.icon('chev', 16, '#6b6b6b') + '</button><div class="sbw-menu">' + items + '</div></div>';
  }
  function render() {
    var sub = st.mode === 'sub', f = fq(), base = ctx.base(), p = ctx.per(f.off), g = ctx.gifts(f, n), up = st.pay === 'prepaid';
    var ban = o.banner || ['Limited Time Deal <i></i> <b>UPTO ' + maxOff + '% OFF</b>'];
    var h = '<button class="mf-otp' + (sub ? '' : ' on') + '" data-a="otp"><span class="l"><span class="sbw-dot"></span>One Time Purchase</span><span class="pr">' + ctx.money(base) + '</span></button>';
    h += '<div class="mf-box' + (sub ? ' on' : '') + '">';
    h += sub ? '<button class="sbw-ban mf-bar" data-a="how"><div class="trk" style="animation:none"><span><b>How Subscriptions Work?</b></span></div></button>'
      : '<div class="sbw-ban mf-bar"><div class="trk"' + (ban.length > 1 ? '' : ' style="animation:none"') + '>' + (ban.length > 1 ? ban.concat([ban[0]]) : ban).map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div></div>';
    h += '<button class="mf-hd" data-a="sub"><span class="l"><span class="sbw-dot"></span>Subscribe &amp; Save</span>' +
      (sub ? '<span class="sbw-pill mf-pulse">UPTO ' + maxOff + '% OFF</span>' : '<span class="mf-pd"><small>Per delivery</small><b>' + ctx.money(p) + '</b></span>') + '</button>';
    if (sub) {
      h += '<div class="mf-in"><hr class="mf-hr"><div class="mf-sum"><div><b>' + n + ' Deliveries</b><span>Delivered <em>' + ctx.esc(f.label) + '</em></span></div><div class="mf-p"><b>' + ctx.money(p) + '</b><small>/ delivery</small></div></div><hr class="mf-hr">';
      h += '<div class="mf-dds">' +
        dd('freq', ctx.esc(f.label), freqs.map(function (x) { var gg = ctx.gifts(x, n).length; return '<button data-a="freq" data-v="' + x.id + '" class="' + (x.id === st.freq ? 'on' : '') + '"><span>' + ctx.esc(x.label) + (gg ? ' 🎁' : '') + '</span><em>' + x.off + '% OFF</em></button>'; }).join('')) +
        (modes.length > 1 ? dd('pay', LABEL[st.pay], modes.map(function (m) { return '<button data-a="pay" data-v="' + m + '" class="' + (m === st.pay ? 'on' : '') + '"><span>' + LABEL[m] + '</span></button>'; }).join('')) : '') + '</div>';
      h += '<div class="sbw-note">' + ctx.icon('info', 14, '#8b8b8b') + '<span>' + ctx.esc(ctx.payNote(st.pay)) + '</span></div>';
      var ls = [['Add, swap, or reschedule anytime']];
      if (o.freeShippingLine) ls.push(['Free shipping for all deliveries']);
      if (g.length) ls.push([giftLine(g), 1]);
      h += '<div class="mf-ul">' + ls.map(function (l) {
        return l[1] ? '<button class="mf-li mf-gl" data-a="free">' + ctx.icon('check', 18, 'var(--p)', 2.4) + '<span>' + ctx.esc(l[0]) + '</span>' + ctx.icon('info', 14, '#8b8b8b') + '</button>'
          : '<div class="mf-li">' + ctx.icon('check', 18, 'var(--p)', 2.4) + '<span>' + ctx.esc(l[0]) + '</span></div>';
      }).join('') + '</div></div>';
    }
    h += '</div>';
    if (sub) h += '<button class="sbw-cta mf-cta"><span class="l"><b>Subscribe Now</b></span><span class="r">' +
      (up ? ctx.money(p * n) + '<small>total</small>' : ctx.money(p) + '<small>/ delivery</small>') + '</span></button>';
    root.innerHTML = h;
    st._g = g;
    ctx.setSubscribed(sub);
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) { if (st.open) { st.open = ''; render(); } return; }
    var k = a.dataset.a, v = a.dataset.v;
    if (k === 'dd') { st.open = st.open === v ? '' : v; return render(); }
    st.open = '';
    if (k === 'how') return ctx.howPopup();
    if (k === 'free') return ctx.freebiePopup(st._g);
    if (k === 'otp' || k === 'sub') st.mode = k;
    else if (k === 'freq') st.freq = v;
    else if (k === 'pay') st.pay = v;
    render();
  });
  return { render: render };

  function accSafe(T) {
    var rgb = function (h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
    var lum = function (h) { var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    if (!/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(T.accent || '')) return T.primary || '#111';
    var a = lum(T.accent), b = lum(T.bg || '#ffffff');
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 2.2 ? T.accent : (T.primary || '#111');
  }
});
