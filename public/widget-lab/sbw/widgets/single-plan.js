/* single-plan: Subscription Widget, one fixed plan. Design: Final JSX 2/Subscription Widgets/Single Plan.jsx
   One Time Purchase card + one "Subscribe & <pay mode>" card per pay mode, all on the same pinned plan
   (one frequency x fixed deliveries). Selected subscription: freebie block (opens Freebies popup), pay explainer,
   Subscribe Now bar. One-time: option cards only, theme qty + Add to cart stay visible.
   options: frequency (id, default plans.frequencies[1]), count (deliveries, default the schedules entry for that
   frequency, else plans.counts[0]), payModes (default plans.payModes), defaultMode.
   Reads freebies[id].value (optional, legacy .price): struck-through value next to "Free" in the freebie block.
   Local helper: accent text colour falls back to primary when accent is too light on bg (design accentSafe). */
SBW.reg('single-plan', function (root, ctx) {
  var pl = ctx.plans, o = ctx.opts, freqs = pl.frequencies || [];
  var f = freqs.filter(function (x) { return x.id === o.frequency; })[0] || freqs[1] || freqs[0] || { label: '', off: 0 };
  var sch = (pl.schedules || []).filter(function (s) { return s.f === f.id; })[0];
  var n = +o.count || (sch && sch.n) || (pl.counts || [6])[0];
  var modes = o.payModes || pl.payModes || ['prepaid', 'ppd'];
  var LABEL = { prepaid: 'Pay Upfront', ppd: 'Pay Per Delivery', payg: 'Pay As You Go', autopay: 'Auto Pay' };
  var st = { sel: ctx.mode0(o) === 'sub' ? modes[0] : 'otp' };
  root.style.setProperty('--xa', accSafe(ctx.cfg.tokens || {}));

  // "Every 2 Weeks" x 6 -> "Every 2 Weeks for 12 Weeks"; unknown units fall back to "for N deliveries"
  function span() {
    var m = /every\s+(\d+\s+)?(day|week|month|year)s?/i.exec(f.label || '');
    if (!m) return ctx.esc(f.label) + ' for ' + n + ' deliveries';
    var k = (parseInt(m[1], 10) || 1) * n, u = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
    return ctx.esc(f.label) + ' for ' + k + ' ' + u + (k > 1 ? 's' : '');
  }
  function render() {
    var sub = st.sel !== 'otp', base = ctx.base(), p = ctx.per(f.off), g = ctx.gifts(f, n), save = (base - p) * n;
    var gift = '<span class="sp-gi">🎁</span>';
    var h = '<div class="sp-cards"><button class="sp-card sp-otp' + (sub ? '' : ' on') + '" data-a="sel" data-v="otp"><span class="sp-l"><span class="sbw-dot"></span><span class="sp-t">One Time Purchase</span></span><span class="sp-pr">' + ctx.money(base) + '</span></button>';
    h += modes.map(function (m) {
      var on = st.sel === m, up = m === 'prepaid';
      var c = '<button class="sp-card' + (on ? ' on' : '') + '" data-a="sel" data-v="' + m + '"><span class="sp-hd"><span class="sp-l"><span class="sbw-dot"></span><span class="sp-t">Subscribe &amp; <em>' + LABEL[m] + '</em></span></span>';
      c += up ? '<span class="sp-r"><span class="sp-pr">' + ctx.money(p * n) + '</span><span class="sp-sv">Save ' + ctx.money(save) + '</span></span>'
        : '<span class="sp-r"><span class="sp-pr">' + ctx.money(p) + '</span><span class="sp-u">/ delivery</span></span>';
      c += '</span><span class="sp-hr"></span><span class="sp-bd">';
      c += up ? '<span class="sp-dl"><span>Delivered <b>' + span() + '.</b></span><small>Add, swap, or reschedule anytime</small></span><span class="sp-pill"><b>' + ctx.money(p) + '</b>/ delivery</span>'
        : '<span class="sp-dl"><span>Delivered <b>' + span() + '.</b> <i>Save ' + ctx.money(save) + '</i></span></span>' + (g.length ? gift : '');
      return c + '</span></button>';
    }).join('') + '</div>';
    if (sub) {
      h += '<div class="sbw-note">' + ctx.icon('info', 14, '#8b8b8b') + '<span>' + ctx.esc(ctx.payNote(st.sel)) + '</span></div>';
      if (g.length) {
        var fb = ctx.freebie(g[0][0]) || { name: g[0][0] };
        h += '<button class="sp-fb" data-a="free"><img src="' + ctx.esc(fb.image || '') + '" alt=""><span class="sp-fbt"><span class="sp-fbn"><b>' + ctx.esc(fb.name) + '</b><span class="sp-fbp">' +
          ((fb.value||fb.price) ? '<s>' + ctx.money(fb.value||fb.price) + '</s>' : '') + '<i>Free</i>' + gift + '</span></span><span class="sp-fbd">Delivered free with your <b>' + ctx.ord(g[0][1]) + ' delivery.</b></span><span class="sp-fbc">' +
          (fb.meta ? '<span class="sp-chip">' + ctx.esc(fb.meta) + '</span>' : '') + (g.length > 1 ? '<span class="sp-more">+' + (g.length - 1) + ' more free gift' + (g.length > 2 ? 's' : '') + '</span>' : '') + '</span></span></button>';
      }
      var up = st.sel === 'prepaid';
      h += '<button class="sbw-cta sp-cta"><span class="l"><b>Subscribe Now</b></span><span class="r">' + (up ? ctx.money(p * n) : ctx.money(p) + '<small>/ delivery</small>') + '</span></button>';
    }
    root.innerHTML = h;
    st._g = g;
    ctx.setSubscribed(sub);
  }
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'free') return ctx.freebiePopup(st._g);
    st.sel = a.dataset.v; render();
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
