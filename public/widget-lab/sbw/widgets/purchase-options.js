/* purchase-options: the live master widget (Widget Theme). Source of truth = live storefront, not a JSX.
   One-time | Subscribe & Save toggle; Subscribe shows product line + qty, payment modes, schedule cards
   (freebie chip expands the gift list inline), Powered by, footer total + Subscribe Now. One-time shows the
   toggle only and leaves the theme's qty + Add to cart visible. */
SBW.reg('purchase-options', function (root, ctx) {
  var pl = ctx.plans, o = ctx.opts;
  var freqs = pl.frequencies || [], sch = pl.schedules || freqs.map(function (f) { return { f: f.id, n: (pl.counts || [6])[0] }; });
  var modes = o.payModes || pl.payModes || ['prepaid', 'ppd'];
  var LABEL = { prepaid: 'Prepaid', payg: 'Pay as you go', ppd: 'Pay Per Delivery', autopay: 'Auto Pay' };
  var fq = function (id) { return freqs.filter(function (f) { return f.id === id; })[0] || freqs[0]; };
  var maxOff = Math.max.apply(null, freqs.map(function (f) { return f.off || 0; }).concat([0]));
  var st = { mode: ctx.mode0(o), pay: modes[0], sch: o.defaultSchedule != null ? o.defaultSchedule : Math.min(1, sch.length - 1), exp: -1 };

  function render() {
    var sub = st.mode === 'sub', cur = sch[st.sch], f = fq(cur.f), per = ctx.per(f.off);
    var h = '<div class="po-seg"><button data-a="otp" class="' + (sub ? '' : 'on') + '">One-time</button>' +
      '<button data-a="sub" class="' + (sub ? 'on' : '') + '">Subscribe &amp; <span class="sv">Save</span><small>UP TO ' + maxOff + '% OFF</small></button></div>';
    if (sub) {
      h += '<div class="sbw-prod po-prod"><img src="' + ctx.esc(ctx.img()) + '" alt=""><div class="t"><b>' + ctx.esc(ctx.cfg.product.title) + '</b><span>' +
        ctx.esc(ctx.variant().name) + ' · ' + ctx.money(per) + ' per delivery</span></div>' +
        '<div class="sbw-step"><button>−</button><span>1</span><button>+</button></div></div>';
      if (modes.length > 1) {
        h += '<div class="po-pay"><div class="sbw-seg">' + modes.map(function (m) { return '<button data-a="pay" data-v="' + m + '" class="' + (m === st.pay ? 'on' : '') + '">' + LABEL[m] + '</button>'; }).join('') +
          '</div><div class="po-note">' + ctx.esc(ctx.payNote(st.pay)) + '</div></div>';
      }
      h += '<div class="po-h">PICK YOUR SCHEDULE</div><div class="po-sch">' + sch.map(function (s, i) {
        var F = fq(s.f), g = ctx.gifts(F, s.n), ex = st.exp === i;
        return '<div class="po-card' + (i === st.sch ? ' on' : '') + '" data-a="sch" data-v="' + i + '">' + (F.badge ? '<span class="po-flag">' + ctx.esc(F.badge) + '</span>' : '') +
          '<div class="po-row"><span class="sbw-dot"></span><span class="tx"><b>' + s.n + ' deliveries plan</b><span>' + ctx.esc(F.short || F.label) + ' · ' + s.n + ' deliveries</span>' +
          (g.length ? '<span class="po-gift' + (ex ? ' open' : '') + '" data-a="gift" data-v="' + i + '">🎁 ' + g.length + ' free gift' + (g.length > 1 ? 's' : '') + ' ' + ctx.icon('chev', 13, null, 2.5) + '</span>' : '') +
          '</span><span class="po-off">' + F.off + '% OFF</span></div>' +
          (g.length && ex ? '<div class="po-gl sbw-col">' + ctx.giftRows(g, 'tag') + '</div>' : '') + '</div>';
      }).join('') + '</div>';
      if (o.freeShippingLine) h += '<div class="po-ship">' + ctx.icon('pin', 15, '#e5484d') + ' Free shipping on every delivery</div>';
      h += ctx.powered('right') + '<div class="po-foot"><div><span>' + ctx.esc(f.short || f.label) + ' · ' + cur.n + ' deliveries</span><b>' +
        (st.pay === 'prepaid' ? ctx.money(per * cur.n) + ' total' : ctx.money(per) + ' / delivery') + '</b> <i>▲</i></div><button>Subscribe Now</button></div>';
    }
    root.innerHTML = h;
    ctx.setSubscribed(sub);
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) return;
    var k = a.dataset.a, v = a.dataset.v;
    if (k === 'gift') { e.stopPropagation(); st.sch = +v; st.exp = st.exp === +v ? -1 : +v; }
    else if (k === 'otp' || k === 'sub') st.mode = k;
    else if (k === 'pay') st.pay = v;
    else if (k === 'sch') st.sch = +v;
    render();
  });
  return { render: render };
});
