/* prepaid-only: Subscription Widget, Prepaid Only (pay upfront for the whole plan). Design: Final JSX 2/Subscription Widgets/Prepiad Only.jsx
   One Time Purchase card; subscribe box with slide-up banner (How Subscriptions Work? + prepaid explainer, opens How popup),
   Subscribe & Save row + UPTO x%OFF pill, CHOOSE YOUR PLAN horizontal plan cards (Every <freq> + badge), per-delivery price + OFF pill,
   "Delivered <freq> [N Deliveries]" dropdown, freebie ticker (marching dashed border, opens Freebies popup), plan summary line;
   Subscribe Now bar outside the box (total savings | x% OFF, upfront total); POWERED BY.
   options: frequencies (array of frequency ids to show as plan cards, default all), badges ({freqId: 'MOST POPULAR'}; falls back to
   frequency.badge), banner (array of HTML lines), defaultFrequency, defaultCount. Reads optional freebies.<id>.value ("Worth" total). */
SBW.reg('prepaid-only', function (root, ctx) {
  var pl = ctx.plans, o = ctx.opts, counts = pl.counts || [6];
  var freqs = (pl.frequencies || []).filter(function (f) { return !o.frequencies || o.frequencies.indexOf(f.id) > -1; });
  var maxOff = Math.max.apply(null, freqs.map(function (f) { return f.off || 0; }).concat([0]));
  var st = { mode: ctx.mode0(o), freq: o.defaultFrequency || (freqs[0] || {}).id, count: o.defaultCount || counts[Math.min(1, counts.length - 1)], dd: false };
  var lines = o.banner || ['How Subscriptions Work?', ctx.esc(ctx.payNote('prepaid'))];
  var fq = function (id) { return freqs.filter(function (f) { return f.id === id; })[0] || freqs[0]; };
  var short = function (f) { return ctx.esc(String(f.label || f.short || '').replace(/^every\s+/i, '')); };
  var badge = function (f) { return String((o.badges || {})[f.id] || f.badge || '').toUpperCase(); };

  function render() {
    var sub = st.mode === 'sub', f = fq(st.freq), n = st.count, base = ctx.base(), per = ctx.per(f.off), g = ctx.gifts(f, n), save = (base - per) * n;
    var worth = g.reduce(function (s, x) { return s + (+((ctx.freebie(x[0]) || {}).value) || 0); }, 0);
    var h = '<button class="pp-otp' + (sub ? '' : ' on') + '" data-a="otp"><span class="l"><span class="sbw-dot"></span>One Time Purchase</span><span class="pr">' + ctx.money(base) + '</span></button>';
    h += '<div class="pp-box' + (sub ? ' on' : '') + '"><button class="sbw-ban pp-ban" data-a="how"><span class="trk">' + lines.concat([lines[0]]).map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</span></button>';
    h += '<div class="pp-in"><button class="pp-hd' + (sub ? ' on' : '') + '" data-a="sub"><span class="l"><span class="sbw-dot"></span>Subscribe &amp; Save</span><span class="pp-up">UPTO ' + maxOff + '%OFF</span></button>';
    if (sub) {
      h += '<div class="pp-lbl">CHOOSE YOUR PLAN</div><div class="pp-cards">' + freqs.map(function (x) {
        var b = badge(x);
        return '<button class="pp-card' + (x.id === f.id ? ' on' : '') + '" data-a="freq" data-v="' + x.id + '"><span>Every</span><b>' + short(x) + '</b>' + (b ? '<em>' + ctx.esc(b) + '</em>' : '') + '</button>';
      }).join('') + '</div>';
      h += '<div class="pp-pr"><div class="pp-pl"><span class="pp-p"><b>' + ctx.money(per) + '</b><small>/ delivery</small></span>' +
        '<span class="pp-dl">Delivered <b>' + ctx.esc(f.label) + '</b><span class="sbw-dd pp-dd' + (st.dd ? ' open' : '') + '"><button data-a="dd"><span>' + n + ' Deliveries</span>' + ctx.icon('chev', 14, '#6b6b6b') +
        '</button><span class="sbw-menu">' + counts.map(function (c) { return '<button data-a="count" data-v="' + c + '" class="' + (c === n ? 'on' : '') + '"><span>' + c + ' Deliveries</span></button>'; }).join('') + '</span></span></span></div>' +
        (f.off ? '<span class="pp-off">' + f.off + '%OFF</span>' : '') + '</div><hr class="pp-hr">';
      h += '<div class="pp-tk-w">' + (g.length ? '<button class="pp-tk" data-a="free"><svg class="pp-ants" aria-hidden="true"><rect x="1" y="1" rx="9" ry="9"></rect></svg><span class="pp-tk-t"><span class="pp-tk-i">🎁</span>' +
        (g.length > 1 ? g.length + ' Free Gifts' : '1 Free Gift') + (worth ? ' · Worth ' + ctx.money(worth) : '') + '</span>' + ctx.icon('info', 15) + '</button>' : '') +
        '<p class="pp-sum">Delivered ' + ctx.esc(String(f.label).toLowerCase()) + ' for ' + n + ' times' + (save > 0 ? ' · You save ' + ctx.money(save) : '') + '</p></div>';
    }
    h += '</div></div>';
    if (sub) h += '<button class="sbw-cta pp-cta"><span class="l"><b>Subscribe Now</b><span>Total savings ' + ctx.money(save) + ' <u>|</u> <i>' + f.off + '% OFF</i></span></span><span class="r">' +
      ctx.money(per * n) + '<small>for ' + n + ' deliveries</small></span></button>';
    h += ctx.powered();
    root.innerHTML = h;
    ctx.setSubscribed(sub);
    st._g = g;
    var sel = root.querySelector('.pp-card.on'), wrap = root.querySelector('.pp-cards');
    if (wrap) {
      wrap.scrollLeft = st._sl || 0;
      if (sel) { var l = sel.offsetLeft - wrap.offsetLeft, r = l + sel.offsetWidth;
        if (l < wrap.scrollLeft) wrap.scrollLeft = st._sl = Math.max(0, l - 16);
        else if (r > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = st._sl = r - wrap.clientWidth + 16; }
    }
  }
  root.addEventListener('scroll', function (e) { if (e.target.classList && e.target.classList.contains('pp-cards')) st._sl = e.target.scrollLeft; }, true);
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]');
    if (!a) { if (st.dd) { st.dd = false; render(); } return; }
    var k = a.dataset.a, v = a.dataset.v;
    if (k === 'dd') { st.dd = !st.dd; return render(); }
    st.dd = false;
    if (k === 'otp' || k === 'sub') st.mode = k;
    else if (k === 'freq') st.freq = v;
    else if (k === 'count') st.count = +v;
    else if (k === 'free') return ctx.freebiePopup(st._g);
    else if (k === 'how') return ctx.howPopup();
    render();
  });
  return { render: render };
});
