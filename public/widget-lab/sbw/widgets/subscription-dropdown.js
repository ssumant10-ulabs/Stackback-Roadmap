/* subscription-dropdown: Subscription Widget, Schedule Picker Style = Dropdown. Design: Final JSX/Subscription Widgets/Master 1.jsx
   One Time Purchase card; Subscribe & Save box with slide-up announcement carousel, UPTO pill, HOW OFTEN? + HOW MANY? dropdowns,
   Pay Upfront | Pay Per Delivery + explainer, Freebies xN pill (popup) + How Subscriptions Work?, Total savings row (pricing popup);
   Subscribe Now bar; POWERED BY. */
SBW.reg('subscription-dropdown', function (root, ctx) {
  var pl = ctx.plans, o = ctx.opts, freqs = pl.frequencies || [], counts = pl.counts || [6];
  /* Discount follows HOW MANY, not HOW OFTEN (merchant feedback 2026-11-19): plans.countOff
     maps a delivery count to its % off. Without it, the count inherits the frequency's rate. */
  var cOff = pl.countOff || {};
  var offFor = function (f, n) { return cOff[n] != null ? +cOff[n] : (f.off || 0); };
  var maxOff = Math.max.apply(null, (pl.countOff ? counts.map(function (c) { return +cOff[c] || 0; }) : freqs.map(function (f) { return f.off || 0; })).concat([0]));
  var modes = (o.payModes || pl.payModes || ['prepaid', 'ppd']).filter(function (m) { return m !== 'payg' || o.payModes || pl.payModes; });
  var LABEL = { prepaid: 'Pay Upfront', ppd: 'Pay Per Delivery', payg: 'Pay As You Go', autopay: 'Auto Pay' };
  var st = { mode: ctx.mode0(o), freq: (freqs[1] || freqs[0] || {}).id, count: counts[Math.min(1, counts.length - 1)], pay: modes[0], open: '' };
  var fq = function () { return freqs.filter(function (f) { return f.id === st.freq; })[0] || freqs[0]; };
  var lines = o.banner || ['Save up to <b>' + maxOff + '% OFF</b> on all subscriptions', '🎁 Free gifts with every subscription plan'].filter(function (l, i) { return i === 0 || freqs.some(function (f) { return (f.free || []).length; }); });

  function dd(key, label, val, items) {
    return '<div class="sbw-dd' + (st.open === key ? ' open' : '') + '"><label>' + label + '</label><button data-a="dd" data-v="' + key + '"><span>' + val + '</span>' + ctx.icon('chev', 16, '#6b6b6b') + '</button><div class="sbw-menu">' + items + '</div></div>';
  }
  function render() {
    var sub = st.mode === 'sub', f = fq(), n = st.count, off = offFor(f, n), base = ctx.base(), p = ctx.per(off), g = ctx.gifts(f, n);
    var up = st.pay === 'prepaid', save = up ? (base - p) * n : base - p;
    var h = '<button class="sd-otp' + (sub ? '' : ' on') + '" data-a="otp"><span class="l"><span class="sbw-dot"></span>One Time Purchase</span><span class="pr">' + ctx.money(base) + '</span></button>';
    h += '<div class="sd-box' + (sub ? '' : ' off') + '"><div class="sbw-ban"><div class="trk">' + lines.concat([lines[0]]).map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div></div>';
    h += '<div class="sd-in"><button class="sd-hd' + (sub ? ' on' : '') + '" data-a="sub"><span class="l"><span class="sbw-dot"></span>Subscribe &amp; Save</span><span class="sbw-pill">UPTO ' + maxOff + '% OFF</span></button>';
    if (sub) {
      h += '<div class="sd-dds">' +
        dd('freq', 'HOW OFTEN?', ctx.esc(f.label), freqs.map(function (x) { return '<button data-a="freq" data-v="' + x.id + '" class="' + (x.id === st.freq ? 'on' : '') + '"><span>' + ctx.esc(x.label) + '</span></button>'; }).join('')) +
        dd('count', 'HOW MANY?', n + ' Deliveries', counts.map(function (c) { var co = offFor(f, c); return '<button data-a="count" data-v="' + c + '" class="' + (c === n ? 'on' : '') + '"><span>' + c + ' Deliveries</span>' + (co ? '<em>' + co + '% OFF</em>' : '') + '</button>'; }).join('')) + '</div>';
      if (modes.length > 1) h += '<div class="sbw-seg sd-pay">' + modes.map(function (m) { return '<button data-a="pay" data-v="' + m + '" class="' + (m === st.pay ? 'on' : '') + '">' + LABEL[m] + '</button>'; }).join('') + '</div>';
      h += '<div class="sbw-note">' + ctx.icon('info', 14, '#8b8b8b') + '<span>' + ctx.esc(ctx.payNote(st.pay)) + '</span></div>';
      h += '<div class="sd-fr">' + (g.length ? '<button class="sbw-chip" data-a="free"><span class="sbw-gift-ic">🎁</span>Freebies x' + g.length + ' ' + ctx.icon('info', 14) + '</button>' : '<span></span>') +
        '<button class="sbw-link" data-a="how">How Subscriptions Work?</button></div>';
      h += '<button class="sd-sv" data-a="price"><span class="l">Total savings ' + ctx.money(save) + ' <span class="sbw-pill acc">' + off + '%OFF</span></span>' + ctx.icon('right', 18, '#6b6b6b') + '</button>';
    }
    h += '</div></div>';
    if (sub) h += '<button class="sbw-cta"><span class="l"><b>Subscribe Now</b><span>Total savings ' + ctx.money(save) + ' • <i>' + off + '% OFF</i></span></span><span class="r">' + (up ? ctx.money(p * n) : ctx.money(p) + '<small>/delivery</small>') + '</span></button>';
    h += ctx.powered();
    root.innerHTML = h;
    ctx.setSubscribed(sub);
    st._g = g; st._rows = up
      ? [['Plan price (' + n + ' × ' + ctx.money(base) + ')', ctx.money(base * n)], ['Discount (' + off + '%)', '- ' + ctx.money((base - p) * n), 1], ['Freebies (' + g.length + ')', 'FREE', 1], ['You pay today', ctx.money(p * n)]]
      : [['Price per delivery', ctx.money(base)], ['Discount (' + off + '%)', '- ' + ctx.money(base - p), 1], ['Freebies (' + g.length + ')', 'FREE', 1], ['You pay per delivery', ctx.money(p)]];
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) { if (st.open) { st.open = ''; render(); } return; }
    var k = a.dataset.a, v = a.dataset.v;
    if (k === 'dd') { st.open = st.open === v ? '' : v; return render(); }
    st.open = '';
    if (k === 'otp' || k === 'sub') st.mode = k;
    else if (k === 'freq') st.freq = v;
    else if (k === 'count') st.count = +v;
    else if (k === 'pay') st.pay = v;
    else if (k === 'free') return ctx.freebiePopup(st._g);
    else if (k === 'how') return ctx.howPopup();
    else if (k === 'price') return ctx.pricePopup(st._rows);
    render();
  });
  return { render: render };
});
