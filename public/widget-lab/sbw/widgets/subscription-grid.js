/* subscription-grid: Subscription Widget, Schedule Picker Style = Grid. Design: Final JSX 2/Subscription Widgets/Master 2.jsx
   One Time Purchase card; Subscribe & Save box with slide-up announcement carousel, UPTO pill, PICK YOUR SCHEDULE 2-col card grid
   (title, OFF pill, frequency, badge band), payment segmented + explainer, Freebies xN chip (popup) + How Subscriptions Work?,
   Total savings row (pricing popup); Subscribe Now bar; POWERED BY.
   Schedules = plans.schedules [{f, n, title?, badge?}]; title defaults to the plan duration (n x frequency interval). */
SBW.reg('subscription-grid', function (root, ctx) {
  var pl = ctx.plans, o = ctx.opts, freqs = pl.frequencies || [];
  var sch = pl.schedules || freqs.map(function (f) { return { f: f.id, n: (pl.counts || [6])[0] }; });
  var fq = function (id) { return freqs.filter(function (f) { return f.id === id; })[0] || freqs[0]; };
  var maxOff = Math.max.apply(null, freqs.map(function (f) { return f.off || 0; }).concat([0]));
  var modes = o.payModes || pl.payModes || ['prepaid', 'ppd'];
  var LABEL = { prepaid: 'Pay Upfront', ppd: 'Pay Per Delivery', payg: 'Pay As You Go', autopay: 'Auto Pay' };
  var st = { mode: ctx.mode0(o), sch: o.defaultSchedule != null ? o.defaultSchedule : Math.min(1, sch.length - 1), pay: modes[0] };
  var lines = o.banner || ['Save up to <b>' + maxOff + '% OFF</b> on all subscriptions', '🎁 Free gifts with every subscription plan'].filter(function (l, i) { return i === 0 || freqs.some(function (f) { return (f.free || []).length; }); });
  var UNIT = { d: 'Day', w: 'Week', m: 'Month', y: 'Year' };
  function title(s, F) {
    if (s.title) return s.title;
    var m = o.scheduleTitle !== 'deliveries' && /^(\d+)\s*([dwmy])$/i.exec(F.id || '');
    if (!m) return s.n + ' Deliveries';
    var t = +m[1] * s.n; return t + ' ' + UNIT[m[2].toLowerCase()] + (t > 1 ? 's' : '');
  }
  function badge(s, F) { var b = s.badge != null ? s.badge : F.badge; return b ? String(b).toUpperCase() : ''; }
  function offPill(F) { return F.off ? '<span class="sg-off">' + F.off + '% OFF</span>' : ''; }

  function picker() {
    return '<div class="sg-grid">' + sch.map(function (s, i) {
      var F = fq(s.f), b = badge(s, F);
      return '<button class="sg-card' + (i === st.sch ? ' on' : '') + '" data-a="sch" data-v="' + i + '"><span class="sg-top"><span class="sg-row"><b>' +
        ctx.esc(title(s, F)) + '</b>' + offPill(F) + '</span><span class="sg-sub">' + ctx.esc(F.label) + '</span></span>' +
        '<span class="sg-band' + (b ? '' : ' none') + '">' + ctx.esc(b) + '</span></button>';
    }).join('') + '</div>';
  }

  function render() {
    var sub = st.mode === 'sub', s = sch[st.sch], f = fq(s.f), n = s.n, base = ctx.base(), p = ctx.per(f.off), g = ctx.gifts(f, n);
    var up = st.pay === 'prepaid', save = up ? (base - p) * n : base - p;
    var h = '<button class="sg-otp' + (sub ? '' : ' on') + '" data-a="otp"><span class="l"><span class="sbw-dot"></span>One Time Purchase</span><span class="pr">' + ctx.money(base) + '</span></button>';
    h += '<div class="sg-box' + (sub ? '' : ' off') + '"><div class="sbw-ban"><div class="trk">' + lines.concat([lines[0]]).map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div></div>';
    h += '<div class="sg-in"><button class="sg-hd' + (sub ? ' on' : '') + '" data-a="sub"><span class="l"><span class="sbw-dot"></span>Subscribe &amp; Save</span><span class="sbw-pill">UPTO ' + maxOff + '% OFF</span></button>';
    if (sub) {
      h += '<div class="sg-pick"><span class="sg-h">PICK YOUR SCHEDULE</span>' + picker() + '</div>';
      if (modes.length > 1) h += '<div class="sbw-seg sg-pay">' + modes.map(function (m) { return '<button data-a="pay" data-v="' + m + '" class="' + (m === st.pay ? 'on' : '') + '">' + LABEL[m] + '</button>'; }).join('') + '</div>';
      h += '<div class="sbw-note sg-note">' + ctx.icon('info', 14, '#8b8b8b') + '<span>' + ctx.esc(ctx.payNote(st.pay)) + '</span></div>';
      h += '<div class="sg-fr">' + (g.length ? '<button class="sbw-chip" data-a="free"><span class="sbw-gift-ic">🎁</span>Freebies x' + g.length + ' ' + ctx.icon('info', 14) + '</button>' : '<span></span>') +
        '<button class="sbw-link" data-a="how">How Subscriptions Work?</button></div>';
      h += '<button class="sg-sv" data-a="price"><span class="l">Total savings ' + ctx.money(save) + ' <span class="sbw-pill acc">' + f.off + '%OFF</span></span>' + ctx.icon('right', 18, '#6b6b6b') + '</button>';
    }
    h += '</div></div>';
    if (sub) h += '<button class="sbw-cta"><span class="l"><b>Subscribe Now</b><span>Total savings ' + ctx.money(save) + ' • <i>' + f.off + '% OFF</i></span></span><span class="r">' + (up ? ctx.money(p * n) : ctx.money(p) + '<small>/delivery</small>') + '</span></button>';
    h += ctx.powered();
    root.innerHTML = h;
    ctx.setSubscribed(sub);
    st._g = g; st._rows = up
      ? [['Plan price (' + n + ' × ' + ctx.money(base) + ')', ctx.money(base * n)], ['Discount (' + f.off + '%)', '- ' + ctx.money((base - p) * n), 1], ['Freebies (' + g.length + ')', 'FREE', 1], ['You pay today', ctx.money(p * n)]]
      : [['Price per delivery', ctx.money(base)], ['Discount (' + f.off + '%)', '- ' + ctx.money(base - p), 1], ['Freebies (' + g.length + ')', 'FREE', 1], ['You pay per delivery', ctx.money(p)]];
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) return;
    var k = a.dataset.a, v = a.dataset.v;
    if (k === 'otp' || k === 'sub') st.mode = k;
    else if (k === 'sch') st.sch = +v;
    else if (k === 'pay') st.pay = v;
    else if (k === 'free') return ctx.freebiePopup(st._g);
    else if (k === 'how') return ctx.howPopup();
    else if (k === 'price') return ctx.pricePopup(st._rows);
    render();
  });
  return { render: render };
});
