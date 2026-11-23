/* addon-2: Add-On Bundle, layout 2. Design: Final JSX 2/Bundle Widgets/Add-On 2.jsx
   Same box, banner, header and Add to Cart bar as addon-1; one horizontal carousel with the locked base product card first
   and a plus badge in the first gap, add-on cards after it.
   Shared core = guarded copy of window.SBWAddon (identical to addon-1.js) so this file runs standalone. */
(function () {
  if (window.SBWAddon) return;
  var A = window.SBWAddon = {};

  // ---- colour maths: pick a readable accent (design accentSafe)
  function rgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(h) { var c = rgb(h); if (!c) return 1; c = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  A.contrast = function (a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  // option value: "500g" or ["500g", 390] (priced value overrides the add-on price)
  function normOpt(o) { return (o || []).map(function (v) { return Array.isArray(v) ? { l: String(v[0]), p: v[1] } : { l: String(v), p: null }; }); }

  A.make = function (layout) {
    return function (root, ctx) {
      var o = ctx.opts, type = ctx.tab.type, bs = ctx.cfg.bundles || {};
      var B = bs[o.bundle || type] || bs.addon || {};
      var T = ctx.cfg.tokens || {};
      var cat = {}; ctx.catalog.forEach(function (p) { cat[p.id] = p; });
      var items = (B.addons || ctx.catalog.slice(0, 6).map(function (p) { return p.id; })).map(function (a) {
        if (typeof a === 'string') a = { id: a };
        var c = cat[a.id] || {};
        return { id: a.id, title: a.title || c.title || a.id, price: a.price != null ? a.price : (c.price || 0), image: a.image || c.image || '', options: (a.options || []).map(normOpt) };
      }).filter(function (x) { return cat[x.id] || x.price; });
      var byId = {}; items.forEach(function (x) { byId[x.id] = x; });
      var max = B.max || 3;
      var tiers = B.tiers || { 1: 10, 2: 20, 3: 30 };
      var tierKeys = Object.keys(tiers).map(Number).sort(function (a, b) { return a - b; });
      var pctFor = function (n) { var p = 0; tierKeys.forEach(function (k) { if (n >= k) p = tiers[k]; }); return p; };
      var upto = B.upto != null ? B.upto : Math.max.apply(null, tierKeys.map(function (k) { return tiers[k]; }).concat([0]));
      var lines = B.banner || ['Curated Bundles - <b>ADD MORE TOGETHER</b>', 'Add more, save more: <b>UPTO ' + upto + '% OFF</b>'];
      lines = lines.slice(0, 2);
      // readable accent for text on the widget bg and outlines on the tile (else primary)
      root.style.setProperty('--ao-acc', A.contrast(T.accent, T.bg || '#fff') >= 2.2 ? 'var(--a)' : 'var(--p)');
      root.style.setProperty('--ao-acc2', A.contrast(T.accent, T.tile || '#fff') >= 2.2 ? 'var(--a)' : 'var(--p)');
      root.classList.add('ao', 'ao-l' + layout);

      var pre = ctx.mode0(o) === 'sub' ? (B.preselected || (items[0] ? [items[0].id] : [])) : [];
      var st = { picked: pre.filter(function (id) { return byId[id]; }).slice(0, max), sel: {}, open: '' };
      items.forEach(function (x) { st.sel[x.id] = x.options.map(function () { return 0; }); });
      var isOn = function (id) { return st.picked.indexOf(id) >= 0; };
      var priceOf = function (x) { var p = x.price; x.options.forEach(function (op, k) { var v = op[st.sel[x.id][k]]; if (v && v.p != null) p = v.p; }); return p; };

      function cb(on, base) { return '<span class="ao-cb' + (on ? ' on' : '') + (base ? ' base' : '') + '"' + (base ? ' title="Included in this bundle"' : '') + '>' + ctx.icon('check', 15, 'currentColor', 3.2) + '</span>'; }
      function dds(x) {
        if (!x.options.length) return '';
        return '<div class="ao-dds">' + x.options.map(function (op, k) {
          var key = x.id + ':' + k;
          return '<button class="ao-dd' + (st.open === key ? ' open' : '') + '" data-a="dd" data-v="' + ctx.esc(key) + '"><span>' + ctx.esc(op[st.sel[x.id][k]].l) + '</span>' + ctx.icon('chev', 15, null, 2) + '</button>';
        }).join('') + '</div>';
      }
      function card(x, lock) {
        var on = isOn(x.id);
        return '<div class="ao-card' + (on ? ' on' : '') + (lock ? ' lock' : '') + '" data-a="tog" data-v="' + ctx.esc(x.id) + '">' +
          '<div class="ao-im"><img src="' + ctx.esc(x.image) + '" alt=""></div>' +
          '<div class="ao-nm"><span>' + ctx.esc(x.title) + '</span><b>' + ctx.money(priceOf(x)) + '</b></div>' + dds(x) + cb(on) + '</div>';
      }
      function row(x, lock) {
        var on = isOn(x.id);
        return '<div class="ao-row' + (on ? ' on' : '') + (lock ? ' lock' : '') + '" data-a="tog" data-v="' + ctx.esc(x.id) + '">' +
          '<img src="' + ctx.esc(x.image) + '" alt=""><div class="t"><span class="nm">' + ctx.esc(x.title) + '</span>' + dds(x) + '</div>' +
          '<b class="pr">' + ctx.money(priceOf(x)) + '</b>' + cb(on) + '</div>';
      }
      function baseRow() {
        return '<div class="ao-base"><img src="' + ctx.esc(ctx.img()) + '" alt=""><div class="t"><b>' + ctx.esc(ctx.cfg.product.title) + '</b><span>' +
          ctx.esc(ctx.variant().name) + ' • ' + ctx.money(ctx.base()) + '</span></div>' + cb(true, true) + '</div>';
      }
      function baseCard() {
        return '<div class="ao-bwrap"><div class="ao-card ao-bcard"><div class="ao-im"><img src="' + ctx.esc(ctx.img()) + '" alt=""></div>' +
          '<div class="ao-nm"><span>' + ctx.esc(ctx.cfg.product.title) + '</span><b>' + ctx.money(ctx.base()) + '</b></div>' +
          '<div class="ao-tag"><span>' + ctx.esc(ctx.variant().name) + '</span>' + (B.baseTag ? '<span>•</span><span>' + ctx.esc(B.baseTag) + '</span>' : '') + '</div>' +
          cb(true, true) + '</div><span class="ao-plus">' + ctx.icon('plus', 14, 'currentColor', 3) + '</span></div>';
      }
      function gifts(n) {
        var g = B.freebies || []; if (!g.length) return '';
        var got = g.filter(function (x) { return n >= x[1]; }).length, next = g.filter(function (x) { return n < x[1]; })[0];
        return '<div class="ao-gf"><button class="sbw-chip" data-a="gifts"><span class="sbw-gift-ic">🎁</span>' +
          (got ? 'Free gift' + (got > 1 ? 's' : '') + ' unlocked x' + got : 'Free gift with ' + next[1] + ' add-on' + (next[1] > 1 ? 's' : '')) + ' ' + ctx.icon('info', 14) + '</button>' +
          (got && next ? '<span class="ao-gn">Add ' + (next[1] - n) + ' more for another gift</span>' : '') + '</div>';
      }
      function giftPopup() {
        var n = st.picked.length;
        ctx.popup('Freebies', '<div class="sbw-col">' + (B.freebies || []).map(function (g) {
          var f = ctx.freebie(g[0]) || { name: g[0] };
          return '<div class="sbw-gr"><img src="' + ctx.esc(f.image || '') + '" alt=""><div class="sbw-gr-n"><b>' + ctx.esc(f.name) + '</b><span>' + ctx.esc(f.meta || '') + '</span></div>' +
            (n >= g[1] ? '<span class="sbw-gr-tag">FREE · Unlocked</span>' : '<span class="sbw-gr-d">With ' + g[1] + ' add-on' + (g[1] > 1 ? 's' : '') + '</span>') + '</div>';
        }).join('') + '</div>');
      }

      function render() {
        var sc = root.querySelector('.ao-scroll'), sl = sc ? sc.scrollLeft : 0, stp = sc ? sc.scrollTop : 0;
        var n = st.picked.length, atCap = n >= max, pct = pctFor(n), base = ctx.base();
        var sub = st.picked.reduce(function (s, id) { return s + priceOf(byId[id]); }, 0);
        var save = Math.round(sub * pct / 100), gross = base + sub, total = gross - save;
        var lock = function (x) { return atCap && !isOn(x.id); };
        var h = '<div class="ao-box"><div class="sbw-ban ao-ban' + (lines.length < 2 ? ' one' : '') + '"><div class="trk">' +
          lines.concat(lines.length > 1 ? [lines[0]] : []).map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div></div>';
        h += '<div class="ao-body"><div class="ao-hd ao-px"><span class="l"><b>' + ctx.esc(B.title || 'Add Products & Save') + '</b><span class="ao-up' + (atCap ? '' : ' pulse') + '">UPTO ' + upto + '% OFF</span></span>' +
          '<span class="ao-cnt">' + n + ' of ' + max + '</span></div>';
        if (layout === 1) {
          h += '<div class="ao-stack"><div class="ao-px">' + baseRow() + '</div><div class="ao-px"><hr class="ao-hr"></div>' +
            '<div><div class="ao-sub ao-px">' + ctx.esc(B.subtitle || 'Add More Products') + '</div><div class="ao-scroll ao-car">' +
            items.map(function (x) { return card(x, lock(x)); }).join('') + '</div></div></div>';
        } else if (layout === 2) {
          h += '<div class="ao-scroll ao-car">' + baseCard() + items.map(function (x) { return card(x, lock(x)); }).join('') + '</div>';
        } else {
          h += '<div class="ao-stack3">' + baseRow() + '<div class="ao-seam"><span class="ao-plus">' + ctx.icon('plus', 16, 'currentColor', 3) + '</span></div>' +
            '<div class="ao-scroll ao-list">' + items.map(function (x) { return row(x, lock(x)); }).join('') + '</div></div>';
        }
        h += gifts(n) + '</div></div>';
        if (n) h += '<button class="sbw-cta ao-cta" data-a="cta"><span class="l"><b>' + ctx.esc(B.cta || 'Add to Cart') + '</b><span>' + (n + 1) + ' items' +
          (save > 0 ? ' · Saved ' + ctx.money(save) : '') + '</span></span><span class="r">' + ctx.money(total) + (save > 0 ? ' <s>' + ctx.money(gross) + '</s>' : '') + '</span></button>';
        h += ctx.powered();
        if (st.open) {
          var k = st.open.split(':'), x = byId[k[0]], op = x && x.options[+k[1]];
          if (op) h += '<div class="ao-menu">' + op.map(function (v, i) {
            return '<button data-a="opt" data-v="' + ctx.esc(st.open + ':' + i) + '" class="' + (i === st.sel[x.id][+k[1]] ? 'on' : '') + '">' + ctx.esc(v.l) + (v.p != null ? '<em>' + ctx.money(v.p) + '</em>' : '') + '</button>';
          }).join('') + '</div>';
        }
        root.innerHTML = h;
        sc = root.querySelector('.ao-scroll'); if (sc) { sc.scrollLeft = sl; sc.scrollTop = stp; st.sl = sc.scrollLeft; st.st = sc.scrollTop; }
        var menu = root.querySelector('.ao-menu'), trg = root.querySelector('.ao-dd.open');
        if (menu && trg) {
          var rr = root.getBoundingClientRect(), tr = trg.getBoundingClientRect();
          menu.style.top = (tr.bottom - rr.top + 4) + 'px'; menu.style.left = (tr.left - rr.left) + 'px'; menu.style.minWidth = Math.max(tr.width, 110) + 'px';
        }
        ctx.setSubscribed(n > 0);
      }

      root.addEventListener('click', function (e) {
        e.__ao = 1;
        var a = e.target.closest('[data-a]');
        if (!a) { if (st.open) { st.open = ''; render(); } return; }
        var k = a.dataset.a, v = a.dataset.v;
        if (k === 'dd') { st.open = st.open === v ? '' : v; return render(); }
        if (k === 'opt') { var p = v.split(':'); st.sel[p[0]][+p[1]] = +p[2]; st.open = ''; return render(); }
        if (st.open) { st.open = ''; }
        if (k === 'tog') {
          var i = st.picked.indexOf(v);
          if (i >= 0) st.picked.splice(i, 1); else if (st.picked.length < max) st.picked.push(v);
        } else if (k === 'gifts') return giftPopup();
        render();
      });
      root.addEventListener('scroll', function (e) {
        var t = e.target; if (!st.open || !t.classList || !t.classList.contains('ao-scroll')) return;
        if (t.scrollLeft !== st.sl || t.scrollTop !== st.st) { st.open = ''; render(); }
      }, true);
      document.addEventListener('click', function (e) { if (st.open && !e.__ao) { st.open = ''; render(); } });
      return { render: render };
    };
  };
})();
SBW.reg('addon-2', window.SBWAddon.make(2));
