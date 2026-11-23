/* multi-delivery: Subscription Widget, one frequency, shopper picks the number of deliveries.
   Design: Final JSX 2/Subscription Widgets/Multi-Delivery.jsx
   One Time Purchase card; Subscribe & Save box: "How Subscriptions Work?" bar (popup), radio + UPTO pill, plan summary
   (frequency, N Deliveries, price / Delivery), CHOOSE DELIVERIES tiles, pay-mode toggle + explainer, check list
   (freebie line opens Freebies popup); Subscribe Now bar; POWERED BY. One-time: card + collapsed box header only.
   options: frequency (id to pin, default plans.frequencies[1]), counts (default plans.counts), defaultCount,
   payModes (default plans.payModes), defaultPay, freeShippingLine (bool), banner (array of HTML lines shown in the bar
   on One-time; default "Limited Time Deal | UPTO X% OFF"), defaultMode.
   Local helper: accent text colour falls back to primary when accent is too light on bg (design accentSafe). */
SBW.reg('multi-delivery', function (root, ctx) {
  var pl = ctx.plans, o = ctx.opts, freqs = pl.frequencies || [];
  var f = freqs.filter(function (x) { return x.id === o.frequency; })[0] || freqs[1] || freqs[0] || { label: '', off: 0 };
  var counts = o.counts || pl.counts || [3, 6, 12];
  var modes = o.payModes || pl.payModes || ['prepaid', 'ppd'];
  var LABEL = { prepaid: 'Pay Upfront', ppd: 'Pay Per Delivery', payg: 'Pay As You Go', autopay: 'Auto Pay' };
  var st = { mode: ctx.mode0(o), n: +o.defaultCount || counts[0], pay: o.defaultPay || modes[0] };
  root.style.setProperty('--xa', accSafe(ctx.cfg.tokens || {}));

  function giftLine(g) {
    if (!g.length) return '';
    var ds = g.map(function (x) { return ctx.ord(x[1]); });
    return 'Includes ' + g.length + ' Freebie' + (g.length > 1 ? 's' : '') + ' on ' + (ds.length > 1 ? ds.slice(0, -1).join(', ') + ' and ' + ds[ds.length - 1] : ds[0]) + ' delivery';
  }
  function render() {
    var sub = st.mode === 'sub', n = st.n, base = ctx.base(), p = ctx.per(f.off), g = ctx.gifts(f, n), up = st.pay === 'prepaid';
    var ban = o.banner || ['Limited Time Deal <i></i> <b>UPTO ' + f.off + '% OFF</b>'];
    var h = '<button class="md-otp' + (sub ? '' : ' on') + '" data-a="otp"><span class="l"><span class="sbw-dot"></span>One Time Purchase</span><span class="pr">' + ctx.money(base) + '</span></button>';
    h += '<div class="md-box' + (sub ? ' on' : '') + '">';
    h += sub ? '<button class="sbw-ban md-bar" data-a="how"><div class="trk" style="animation:none"><span><b>How Subscriptions Work?</b></span></div></button>'
      : '<div class="sbw-ban md-bar"><div class="trk"' + (ban.length > 1 ? '' : ' style="animation:none"') + '>' + (ban.length > 1 ? ban.concat([ban[0]]) : ban).map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div></div>';
    h += '<div class="md-in"><button class="md-hd" data-a="sub"><span class="l"><span class="sbw-dot"></span>Subscribe &amp; Save</span>' +
      (sub ? '<span class="sbw-pill md-pulse">UPTO ' + f.off + '% OFF</span>' : '<span class="md-pd"><small>Per delivery</small><b>' + ctx.money(p) + '</b></span>') + '</button>';
    if (sub) {
      h += '<div class="md-sum"><div><b>' + ctx.esc(f.label) + '</b><span>' + n + ' Deliveries</span></div><div class="md-p"><b>' + ctx.money(p) + '</b><small>/ Delivery</small></div></div><hr class="md-hr">';
      h += '<div class="md-ch"><label>CHOOSE DELIVERIES</label><div class="md-tiles">' + counts.map(function (c) {
        return '<button data-a="n" data-v="' + c + '" class="' + (c === n ? 'on' : '') + '">' + c + '</button>';
      }).join('') + '</div>';
      if (modes.length > 1) h += '<div class="sbw-seg md-pay">' + modes.map(function (m) { return '<button data-a="pay" data-v="' + m + '" class="' + (m === st.pay ? 'on' : '') + '">' + LABEL[m] + '</button>'; }).join('') + '</div>';
      h += '<div class="sbw-note">' + ctx.icon('info', 14, '#8b8b8b') + '<span>' + ctx.esc(ctx.payNote(st.pay)) + '</span></div></div>';
      var ls = [['Add, swap, or reschedule anytime']];
      if (o.freeShippingLine) ls.push(['Free shipping for all deliveries']);
      if (g.length) ls.push([giftLine(g), 1]);
      h += '<div class="md-ul">' + ls.map(function (l) {
        return l[1] ? '<button class="md-li md-gl" data-a="free">' + ctx.icon('check', 18, 'var(--p)', 2.4) + '<span>' + ctx.esc(l[0]) + '</span>' + ctx.icon('info', 14, '#8b8b8b') + '</button>'
          : '<div class="md-li">' + ctx.icon('check', 18, 'var(--p)', 2.4) + '<span>' + ctx.esc(l[0]) + '</span></div>';
      }).join('') + '</div>';
    }
    h += '</div></div>';
    if (sub) h += '<button class="sbw-cta md-cta"><span class="l"><b>Subscribe Now</b><span>' + (up ? 'Pay upfront for ' + n + ' deliveries' : LABEL[st.pay].charAt(0) + LABEL[st.pay].slice(1).toLowerCase()) + '</span></span><span class="r">' +
      (up ? ctx.money(p * n) + '<small>total</small>' : ctx.money(p) + '<small>/ delivery</small>') + '</span></button>';
    h += ctx.powered();
    root.innerHTML = h;
    st._g = g;
    ctx.setSubscribed(sub);
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) return;
    var k = a.dataset.a, v = a.dataset.v;
    if (k === 'how') return ctx.howPopup();
    if (k === 'free') return ctx.freebiePopup(st._g);
    if (k === 'otp' || k === 'sub') st.mode = k;
    else if (k === 'n') st.n = +v;
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
