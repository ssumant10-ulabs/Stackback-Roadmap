/* Widget lab preview page.
 *
 * Settings come from the address (#c=<base64url JSON>), written by the Widget lab. Three sources
 * for the product page under the widget:
 *   - sample (default): the neutral page in pdp.html, which belongs to no brand;
 *   - src.u: a merchant's product link, fetched through /api/widget-lab/pdp;
 *   - src.up: a saved product page uploaded in the lab, handed over in sessionStorage.
 * For a merchant page only the product section is kept, every script and handler is removed,
 * and the widget is placed inside their own product form. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- config */
  function readCfg() {
    var m = location.hash.match(/(?:^#|&)c=([A-Za-z0-9_-]+)/);
    if (!m) return {};
    try {
      var b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      var bin = atob(b), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { return { _bad: true }; }
  }

  var L = readCfg();
  var WIDGETS = ['purchase-options', 'subscription-dropdown', 'subscription-grid', 'subscription-list', 'subscription-collapsible',
    'single-plan', 'multi-delivery', 'multi-frequency', 'payg-only', 'prepaid-only', 'international-plan',
    'fixed-bundle', 'byob', 'bxgy-list', 'bxgy-grid', 'addon-1', 'addon-2', 'addon-3'];
  var type = WIDGETS.indexOf(L.w) >= 0 ? L.w : 'purchase-options';
  var embedded = parent !== window;

  /* The widget font, from the admin's list only, so the link cannot load anything else. */
  var FONTS = ['Inter', 'Kumbh Sans', 'Roboto', 'Poppins', 'Open Sans', 'Lato', 'Montserrat'];
  if (L.t && L.t.font && L.t.font !== 'Inter' && FONTS.indexOf(L.t.font) >= 0) {
    var fl = document.createElement('link'); fl.rel = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=' + L.t.font.replace(/ /g, '+') + ':wght@400;500;600;700&display=swap';
    document.head.appendChild(fl);
  }

  function status(o) {
    if (!embedded) return;
    o.sbwLab = true; o.kind = 'pdp';
    parent.postMessage(o, location.origin);
  }

  /* Product art, drawn rather than fetched, so the sample page has no brand's images in it. */
  function art(label, hue, shape) {
    var h = hue || 140, bg = 'hsl(' + h + ',30%,93%)', fg = 'hsl(' + h + ',38%,34%)', lt = 'hsl(' + h + ',40%,82%)';
    var body = shape === 'jar'
      ? '<rect x="110" y="70" width="180" height="40" rx="10" fill="' + fg + '"/><rect x="95" y="105" width="210" height="220" rx="28" fill="' + lt + '"/><rect x="95" y="170" width="210" height="90" fill="#fff" opacity=".9"/>'
      : shape === 'bottle'
      ? '<rect x="170" y="50" width="60" height="50" rx="8" fill="' + fg + '"/><rect x="130" y="95" width="140" height="240" rx="40" fill="' + lt + '"/><rect x="130" y="180" width="140" height="80" fill="#fff" opacity=".9"/>'
      : '<path d="M110 80 h180 l20 250 h-220z" fill="' + lt + '"/><rect x="110" y="70" width="180" height="22" rx="4" fill="' + fg + '"/><rect x="100" y="170" width="200" height="90" fill="#fff" opacity=".9"/>';
    var words = String(label).split(' '), l1 = words.slice(0, 2).join(' '), l2 = words.slice(2, 4).join(' ');
    var esc = function (t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="' + bg + '"/>' + body +
      '<text x="200" y="210" text-anchor="middle" font-family="Inter,Arial" font-size="20" font-weight="700" fill="' + fg + '">' + esc(l1) + '</text>' +
      '<text x="200" y="236" text-anchor="middle" font-family="Inter,Arial" font-size="15" fill="' + fg + '">' + esc(l2) + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  var catalog = [
    ['c0', 'Plant Protein Vanilla', 1499, 30, 'jar'], ['c1', 'Electrolyte Hydration Mix', 649, 200, 'bag'],
    ['c2', 'Marine Collagen Peptides', 1799, 10, 'jar'], ['c3', 'Ashwagandha Calm Gummies', 549, 290, 'bottle'],
    ['c4', 'Daily Multivitamin', 799, 220, 'bottle'], ['c5', 'Steel Shaker Bottle', 399, 0, 'bottle'],
    ['c6', 'Overnight Oats Mix', 449, 40, 'bag'], ['c7', 'Ceremonial Matcha', 1199, 110, 'jar'],
    ['c8', 'Almond Butter Crunchy', 599, 25, 'jar'], ['c9', 'Magnesium Sleep Blend', 699, 260, 'bag']
  ].map(function (r) { return { id: r[0], title: r[1], price: r[2], image: art(r[1], r[3], r[4]) }; });

  var d = L.d || {};
  var off = function (k, dflt) { var v = +d[k]; return d[k] !== undefined && d[k] !== '' && isFinite(v) ? v : dflt; };
  var co = L.co || null;
  /* Widget settings (L.ws), the admin's own names in the lab: promo line, freebies, the free
     shipping line, one-time option, the "how it works" link, branding, component styles. */
  var WS = L.ws || {};
  var gifts = WS.freebies !== false;
  var esc = function (x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  /* The admin's promo line is plain text; its percentage is the bold part, as in the default. */
  var promo = WS.promo ? esc(WS.promo).replace(/(\d+\s*%(\s*off)?)/i, '<b>$1</b>') : null;
  var fr = function (list) { return gifts ? list : []; };

  function buildCfg(product, currency, pdp) {
    return {
      title: 'StackBack widget preview', merchant: 'Preview', currency: currency || '₹', locale: 'en-IN',
      tokens: Object.assign({ primary: '#2a431c', secondary: '#d7f5d1', accent: '#f5b400', tileText: '#282828', tile: '#fcfaf8', bg: '#ffffff', line: '#968a74' }, L.t || {}),
      product: product,
      plans: {
        frequencies: [
          { id: '2w', label: 'Every 2 Weeks', short: 'Every 2 weeks', off: off('2w', 5), free: fr([['j', 3]]) },
          { id: '1m', label: 'Every Month', short: 'Every month', off: off('1m', 10), free: fr([['j', 2], ['g', 6]]) },
          { id: '2m', label: 'Every 2 Months', short: 'Every 2 months', off: off('2m', 15), free: fr([['j', 2], ['r', 3]]), badge: WS.badgeText != null ? (WS.badgeText || undefined) : 'Best Value' }
        ],
        counts: [3, 6, 12],
        countOff: co || undefined,
        schedules: [{ f: '2w', n: 6 }, { f: '1m', n: 6 }, { f: '2m', n: 3 }],
        payModes: (function (pm) { pm = (pm || []).map(function (m) { return m === 'autopay' || m === 'payg' ? 'ppd' : m; }).filter(function (m, i, a) { return (m === 'prepaid' || m === 'ppd') && a.indexOf(m) === i; }); return pm.length ? pm : ['prepaid', 'ppd']; })(L.pm)
      },
      freebies: {
        j: { name: 'Steel Shaker Bottle', meta: '600 ml', image: catalog[5].image, value: 399 },
        g: { name: 'Travel Sachets', meta: 'Pack of 7', image: art('Travel Sachets', 30, 'bag'), value: 249 },
        r: { name: 'Measuring Scoop Set', meta: '3 sizes', image: art('Scoop Set', 200, 'bag'), value: 199 }
      },
      catalog: catalog,
      bundles: {
        'fixed-bundle': { combos: [
          { id: 'starter', name: 'Starter Kit', tag: 'BEST VALUE', items: ['pdp', 'c5', 'c1'], off: 20 },
          { id: 'daily', name: 'Daily Wellness Stack', tag: 'MOST LOVED', items: ['pdp', 'c4', 'c3', 'c9'], off: 25 },
          { id: 'fit', name: 'Fitness Pack', items: ['pdp', 'c0', 'c2'], off: 15 }], subscribeOff: 10 },
        byob: { collections: [
          { id: 'well', name: 'Wellness', items: ['pdp', 'c3', 'c4', 'c9', 'c2'] },
          { id: 'pantry', name: 'Pantry', items: ['c6', 'c7', 'c8', 'c0', 'c1'] }],
          tiers: [{ n: 3, off: 5 }, { n: 5, off: 10 }, { n: 8, off: 15 }], max: 10, start: { pdp: 1 }, subscribeOff: 10 },
        'bxgy-list': { buy: 3, get: 1, items: ['pdp', 'c1', 'c9'], free: ['c5'], off: 10 },
        'bxgy-grid': { buy: 3, get: 1, items: ['pdp', 'c1', 'c3', 'c4', 'c9', 'c7'], free: ['c5'], off: 10 },
        addon: {
          addons: [{ id: 'c2', options: [[['250 g', 1799], ['500 g', 3299]]] }, { id: 'c3', options: [[['30 gummies', 549], ['60 gummies', 999]]] },
            { id: 'c5' }, { id: 'c4' }, { id: 'c7' }, { id: 'c9' }],
          max: 3, tiers: { '1': 10, '2': 20, '3': 30 }, preselected: ['c2'],
          banner: ['Curated add-ons: <b>BUY MORE TOGETHER</b>', 'Add more, save more: <b>UP TO 30% OFF</b>'],
          title: 'Add Products & Save', subtitle: 'Add More Products', baseTag: 'Bestseller', cta: 'Add to Cart', freebies: fr([['j', 2]])
        }
      },
      tabs: [{ type: type, label: type, options: Object.assign(
        type === 'single-plan' ? { frequency: '1m', count: 6 }
        : type === 'multi-delivery' ? { frequency: '1m', counts: [3, 6, 12], freeShippingLine: true }
        : type === 'multi-frequency' ? { count: 6, freeShippingLine: true }
        : type === 'payg-only' ? { payMode: 'ppd' }
        : type === 'international-plan' ? { currency: '$', fx: 0.012, locale: 'en-US', shippingLine: 'Free international shipping on all deliveries',
            supplies: [{ f: '1m', n: 3, badge: 'BEST VALUE' }, { f: '2m', n: 3, badge: 'MOST LIKED' }] }
        : (type === 'fixed-bundle' || type === 'byob') ? { subscribe: true }
        : {}, L.pm && L.pm.length ? { payModes: L.pm } : {}, L.def ? { defaultMode: L.def } : {},
        WS.noOneTime ? { defaultMode: 'sub' } : {},
        WS.noShipLine ? { freeShippingLine: false } : {},
        promo ? { banner: [promo] } : {}) }],
      settings: WS,
      pdp: pdp
    };
  }

  /* ---------------------------------------------------------------- boot */
  function boot(cfg) {
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/widget-lab/sbw/widgets/' + type + '.css';
    document.head.appendChild(css);
    var files = ['/widget-lab/sbw/sbw-core.js', '/widget-lab/sbw/widgets/' + type + '.js'];
    (function next(i) {
      if (i >= files.length) {
        SBW.boot(cfg);
        var host = document.getElementById('sbw-host');
        if (window.ResizeObserver && host) new ResizeObserver(report).observe(host);
        document.addEventListener('click', function () { setTimeout(report, 60); });
        addEventListener('resize', report);
        addEventListener('load', report);
        setTimeout(report, 300); setTimeout(report, 1500);
        return;
      }
      var s = document.createElement('script'); s.src = files[i];
      s.onload = s.onerror = function () { next(i + 1); };
      document.body.appendChild(s);
    })(0);
  }

  /* How the widget sits on the page, for the lab's fit check. */
  function report() {
    if (!embedded) return;
    var host = document.getElementById('sbw-host'); if (!host) return;
    var w = host.querySelector('.sbw-w:not([hidden])') || host;
    var r = w.getBoundingClientRect();
    var col = (host.parentElement || document.body).getBoundingClientRect();
    var wide = 0;
    w.querySelectorAll('*').forEach(function (n) { var b = n.getBoundingClientRect(); if (b.width && b.right - col.right > wide) wide = b.right - col.right; });
    var buy = document.querySelector('.pp-atc') || document.querySelector('[data-sbw-buy]');
    var subscribed = !!(buy && buy.offsetParent === null);
    var cta = subscribed ? w.querySelector('.sbw-cta, [class*=cta]') : buy;
    var cr = cta ? cta.getBoundingClientRect() : null;
    parent.postMessage({ sbwLab: true, kind: 'fit', type: type, h: Math.round(r.height), top: Math.round(r.top + scrollY),
      ctaBottom: cr ? Math.round(cr.bottom + scrollY) : null, overflow: Math.round(wide), vw: innerWidth, vh: innerHeight, subscribed: subscribed }, location.origin);
  }

  /* ---------------------------------------------------------------- sample page */
  function sample() {
    var title = (L.p && L.p.title) || 'Daily Greens Superfood Powder';
    var price = +(L.p && L.p.price) || 899, cmp = +(L.p && L.p.compare) || 0;
    var variants = [
      { name: '250 g', price: price, compareAt: cmp || undefined, image: art(title, 140, 'jar') },
      { name: '500 g', price: Math.round(price * 1.8), compareAt: cmp ? Math.round(cmp * 1.8) : undefined, image: art(title, 150, 'jar') },
      { name: '1 kg', price: Math.round(price * 3.3), compareAt: cmp ? Math.round(cmp * 3.3) : undefined, image: art(title, 160, 'jar') }
    ];
    document.querySelectorAll('[data-f=title]').forEach(function (n) { n.textContent = title; });
    var v0 = variants[0];
    document.querySelector('[data-f=thumbs]').innerHTML = [v0.image, art('Nutrition facts', 40, 'bag'), art('How to use', 200, 'bottle'), catalog[5].image]
      .map(function (s) { return '<img alt="" src="' + s + '">'; }).join('');
    var fmt = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
    var setPrice = function (v) {
      document.querySelector('[data-f=price]').innerHTML = '<b>' + fmt(v.price) + '</b>' +
        (v.compareAt ? '<s>' + fmt(v.compareAt) + '</s><em>Save ' + Math.round(100 - v.price / v.compareAt * 100) + '%</em>' : '');
      document.querySelector('[data-f=hero]').src = v.image;
    };
    setPrice(v0);
    var vars = document.querySelector('[data-f=vars]');
    vars.innerHTML = variants.map(function (v, i) { return '<button type="button" class="pp-var' + (i ? '' : ' on') + '" data-v="' + v.name + '">' + v.name + '</button>'; }).join('');
    vars.addEventListener('click', function (e) {
      var b = e.target.closest('.pp-var'); if (!b) return;
      vars.querySelectorAll('.pp-var').forEach(function (x) { x.classList.toggle('on', x === b); });
      setPrice(variants.filter(function (v) { return v.name === b.dataset.v; })[0]);
    });
    if (embedded) { var tg = document.querySelector('.pp-tag'); if (tg) tg.remove(); }
    boot(buildCfg({ title: title, image: v0.image, variants: variants, selected: v0.name }, '₹', {
      anchor: L.pos === 'variants' ? '.pp-variants' : '.pp-buy',
      position: L.pos === 'below' || L.pos === 'variants' ? 'after' : 'before',
      hideOnSubscribe: ['.pp-buy', '.pp-sticky'],
      variantTiles: { selector: '.pp-var', attr: 'data-v' }
    }));
  }

  /* ---------------------------------------------------------------- merchant page */
  var SYMBOL = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', AED: 'AED ', SGD: 'S$', NZD: 'NZ$' };

  /* Everything that could run code goes, before any of it touches this document. */
  function sanitize(root) {
    root.querySelectorAll('script, iframe, frame, object, embed, applet, base, meta, noscript, portal, link:not([rel~="stylesheet"])')
      .forEach(function (n) { n.remove(); });
    root.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var n = a.name.toLowerCase();
        if (n.indexOf('on') === 0 || n === 'srcdoc' || n === 'formaction' ||
            (/^(href|src|action|xlink:href|data)$/.test(n) && /^\s*(javascript|vbscript|data:text\/html)/i.test(a.value))) el.removeAttribute(a.name);
      });
    });
  }

  /* A page saved as "complete" points at a local <name>_files/ folder that never arrives
     with the upload. Shopify keeps the original file names, so they map back to the store's
     own CDN: images under /cdn/shop/files/, theme stylesheets under /cdn/shop/t/<id>/assets/. */
  var SAVED = { origin: '', theme: '' };
  function fromSaved(v) {
    var m = v.match(/(?:^|\/)[^\/]*_files\/([^\/?#]+)$/);
    if (!m || !SAVED.origin) return null;
    var name = m[1];
    if (/\.css$/i.test(name)) return SAVED.theme ? SAVED.origin + '/cdn/shop/t/' + SAVED.theme + '/assets/' + name : null;
    if (/\.(jpe?g|png|webp|gif|svg|avif)$/i.test(name)) return SAVED.origin + '/cdn/shop/files/' + name;
    return null;
  }

  function absolutize(root, base) {
    var fix = function (v) {
      if (!v) return v;
      var saved = fromSaved(v); if (saved) return saved;
      if (v.indexOf('//') === 0) return 'https:' + v;
      if (!base || /^(https?:|data:|blob:|#)/i.test(v)) return v;
      try { return new URL(v, base).href; } catch (e) { return v; }
    };
    /* An inlined image (data:...;base64,xxx) has its own comma, so it is never split. */
    var fixSet = function (v) { if (/^\s*data:/i.test(v)) return v; return v.split(',').map(function (p) { var t = p.trim().split(/\s+/); t[0] = fix(t[0]); return t.join(' '); }).join(', '); };
    root.querySelectorAll('[src],[href],[srcset],[data-src],[data-srcset],[poster]').forEach(function (el) {
      ['src', 'href', 'poster'].forEach(function (a) { if (el.hasAttribute(a)) el.setAttribute(a, fix(el.getAttribute(a))); });
      if (el.hasAttribute('srcset')) el.setAttribute('srcset', fixSet(el.getAttribute('srcset')));
      /* Lazy images keep their real address in data-*, waiting for a script that is not here. */
      var ds = el.getAttribute('data-src'), dss = el.getAttribute('data-srcset');
      if (ds && (!el.getAttribute('src') || /^data:/.test(el.getAttribute('src')))) el.setAttribute('src', fix(ds));
      if (dss) el.setAttribute('srcset', fixSet(dss.replace(/\{width\}/g, '600')));
      if (/\{width\}/.test(el.getAttribute('src') || '')) el.setAttribute('src', el.getAttribute('src').replace(/\{width\}/g, '800'));
      if (el.classList && el.classList.contains('lazyload')) el.classList.add('lazyloaded');
    });
  }

  var abs = function (x) { x = x && (x.src || x); return x ? (String(x).indexOf('//') === 0 ? 'https:' + x : String(x)) : ''; };

  /* The page's own product. ShopifyAnalytics `meta` always describes the product the page is
     for, so it goes first; embedded product JSON can belong to a recommendation. */
  function productFromDoc(doc) {
    var og = function (p) { return (doc.querySelector('meta[property="' + p + '"]') || {}).content || ''; };
    /* The page's own heading; og:title is the browser-tab title ("Buy X | Store"). */
    var title = ((doc.querySelector('h1') || {}).textContent || '').trim() || og('og:title');
    var jsons = [];
    doc.querySelectorAll('script[type="application/json"], script[data-product-json], [id^="ProductJson"]').forEach(function (s) {
      try { var j = JSON.parse(s.textContent); var p = j && (j.variants ? j : j.product); if (p && p.variants && p.variants.length && p.variants[0].price != null) jsons.push(p); } catch (e) { /* not JSON */ }
    });
    var meta = doc.documentElement.innerHTML.match(/var meta = (\{"product":[\s\S]*?\});/);
    if (meta) {
      try {
        var m = JSON.parse(meta[1]).product;
        var twin = jsons.filter(function (p) { return p.id === m.id; })[0];
        var img = function (id) { var v = twin && twin.variants.filter(function (x) { return x.id === id; })[0]; return v && abs(v.featured_image); };
        return { title: (twin && twin.title) || title, image: (twin && abs(twin.featured_image)) || abs(og('og:image')),
          variants: m.variants.map(function (v) { return { name: v.public_title || 'Default', price: v.price / 100, image: img(v.id) }; }) };
      } catch (e) { /* fall through */ }
    }
    if (jsons.length) {
      var pick = jsons.filter(function (p) { return p.title && title && title.indexOf(p.title) >= 0; })[0] ||
        jsons.sort(function (a, b) { return b.variants.length - a.variants.length; })[0];
      /* Theme product JSON carries prices as integer paise or cents; a string is already in units. */
      var cents = typeof pick.variants[0].price === 'number';
      var money = function (v) { return v == null ? undefined : cents ? Number(v) / 100 : Number(v); };
      return { title: pick.title || title, image: abs(pick.featured_image || (pick.images || [])[0]),
        variants: pick.variants.map(function (v) { return { name: v.title || v.public_title || 'Default', price: money(v.price), compareAt: money(v.compare_at_price) || undefined, image: abs(v.featured_image) }; }) };
    }
    /* The price the page shows for the selected variant beats og:price, which is the
       store's lowest "from" price. */
    var num = function (el) { var m = el && (el.textContent || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : NaN; };
    var shown = num(doc.querySelector('.price__sale .price-item--sale, .price-item--sale, .product__price .money, .product-single__price, [class*="price"] .money'));
    var was = num(doc.querySelector('.price__sale .price-item--regular, .product__price s, [class*="price"] s'));
    var amt = og('product:price:amount') || og('og:price:amount');
    var price = isFinite(shown) ? shown : amt ? parseFloat(String(amt).replace(/,/g, '')) : NaN;
    if (!isFinite(price)) return null;
    var compareAt = isFinite(was) && was > price ? was : undefined;
    /* No product data on the page (SingleFile strips it with the scripts). The option buttons
       are still there, so every combination is a variant; only the selected one's price is
       known, so all of them carry it and the lab says so. */
    var groups = optionGroups(doc);
    var combos = groups.reduce(function (acc, g) {
      var out = []; acc.forEach(function (a) { g.values.forEach(function (v) { out.push(a.concat([v])); }); }); return out;
    }, [[]]).filter(function (c) { return c.length; });
    var checked = groups.map(function (g) { return g.checked; }).join(' / ');
    var variants = combos.length ? combos.map(function (c) { return { name: c.join(' / '), price: price, compareAt: compareAt }; }) : [{ name: 'Default', price: price, compareAt: compareAt }];
    variants.sort(function (a, b) { return (b.name === checked) - (a.name === checked); });
    return { title: title, image: abs(og('og:image')), variants: variants, partial: variants.length > 1 };
  }

  /* Option radios grouped by name, in page order: [{name, values, checked}]. */
  function optionGroups(root) {
    var by = {}, order = [];
    root.querySelectorAll('input[type="radio"][name]').forEach(function (r) {
      var n = r.getAttribute('name');
      if (!r.value) return;
      if (!by[n]) { by[n] = { name: n, values: [], checked: '' }; order.push(n); }
      if (by[n].values.indexOf(r.value) < 0) by[n].values.push(r.value);
      if (r.hasAttribute('checked')) by[n].checked = r.value;
    });
    return order.map(function (n) { var g = by[n]; if (!g.checked) g.checked = g.values[0]; return g; })
      .filter(function (g) { return g.values.length > 1 && g.values.length < 30; });
  }

  var BUY_TEXT = /^\s*(add to (cart|bag|basket)|buy (it )?now)\s*$/i;
  var NOT_MAIN = /recommend|related|upsell|cross-?sell|review|footer|header|announcement|collection|video|newsletter|faq|testimonial|blog|instagram|drawer|popup|quick/i;

  function buyButtons(root) {
    var out = Array.prototype.slice.call(root.querySelectorAll('[name="add"], form[action*="/cart/add"] button[type="submit"], form[action*="/cart/add"] input[type="submit"], button[form]'));
    root.querySelectorAll('button, a, [role="button"], input[type="button"], div, span').forEach(function (b) {
      if (out.indexOf(b) < 0 && b.children.length <= 2 && BUY_TEXT.test(b.textContent || b.value || '') && !out.some(function (o) { return o.contains(b) || b.contains(o); })) out.push(b);
    });
    return out;
  }

  /* The product section, found by what is in it rather than by the theme's form, because a
     custom-built product section often has no /cart/add form at all. */
  function pickSection(doc) {
    var secs = Array.prototype.slice.call(doc.querySelectorAll('.shopify-section, [id^="shopify-section"]'));
    var best = null, bestScore = -1;
    secs.forEach(function (sec) {
      var id = (sec.getAttribute('id') || '') + ' ' + (sec.getAttribute('class') || '');
      var sc = 0;
      if (NOT_MAIN.test(id)) sc -= 10;
      if (/__main\b|main-product|product[-_]?(template|details|info|page|main)/i.test(id)) sc += 4;
      if (sec.querySelector('h1')) sc += 5;
      if (buyButtons(sec).length) sc += 4;
      if (sec.querySelector('form[action*="/cart/add"]')) sc += 2;
      if (sec.querySelector('input[name="quantity"], [class*="quantity"]')) sc += 2;
      if (sec.querySelector('[class*="price"]')) sc += 1;
      if (sc > bestScore) { bestScore = sc; best = sec; }
    });
    if (best && bestScore >= 5) return best;
    var h1 = doc.querySelector('h1');
    if (!h1) return null;
    var el = h1;
    while (el.parentElement && el.parentElement.tagName !== 'BODY' && !(el.querySelector('img') && buyButtons(el).length)) el = el.parentElement;
    return el;
  }

  /* The block of buy controls around one element: climb while the parent holds nothing else a
     shopper picks (options, images). That is the qty + buttons row on nearly every theme. */
  function buyBlock(el, section) {
    while (el.parentElement && el.parentElement !== section &&
      !el.parentElement.querySelector('select, input[type="radio"], img, variant-radios, variant-selects, h1, [class*="variant"]')) el = el.parentElement;
    return el;
  }

  /* ---- Widget settings read from the merchant's page, by the stackback-color-tokens rules:
     Primary = the Add to cart fill, accent = the announcement bar, savings = the % off badge,
     text = the page's own dark and mid greys, border and radius = an unpicked option tile. */
  function hexOf(c) {
    var m = (c || '').match(/[\d.]+/g);
    if (!m || m.length < 3 || (m.length > 3 && +m[3] < 0.5)) return null;
    return '#' + m.slice(0, 3).map(function (x) { return ('0' + (Math.round(+x)).toString(16)).slice(-2); }).join('');
  }
  function lumOf(h) {
    return [1, 3, 5].map(function (i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function ratio(a, b) { var x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function tint(a, b, t) {
    return '#' + [1, 3, 5].map(function (i) { var p = parseInt(a.slice(i, i + 2), 16), q = parseInt(b.slice(i, i + 2), 16); return ('0' + Math.round(p + (q - p) * t).toString(16)).slice(-2); }).join('');
  }
  function fillOf(el) {
    for (; el && el.nodeType === 1; el = el.parentElement) { var c = hexOf(getComputedStyle(el).backgroundColor); if (c) return c; }
    return '#ffffff';
  }
  function shown(el) { return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; }
  function readBrand(wrap, doc, btn) {
    var t = {}, cs = getComputedStyle, out = { t: t };
    var bg = fillOf(wrap.querySelector('h1') || wrap);
    t.bg = bg; t.tile = bg;
    if (btn) {
      var b = cs(btn), f = hexOf(b.backgroundColor);
      if (f && f !== bg) { t.primary = f; t.onPrimary = hexOf(b.color) || '#ffffff'; }
      else t.primary = hexOf(b.borderTopColor) || hexOf(b.color);
    }
    /* Text: the most used dark colour is Primary text, the most used mid grey is Secondary. */
    var count = {};
    wrap.querySelectorAll('p, span, li, h2, h3, h4, label, div, a, s, del').forEach(function (e) {
      if (e.children.length || e.closest('.sbw') || (e.textContent || '').trim().length < 3 || !shown(e)) return;
      var c = hexOf(cs(e).color); if (c) count[c] = (count[c] || 0) + 1;
    });
    var byUse = Object.keys(count).sort(function (a, c) { return count[c] - count[a]; });
    t.tileText = byUse.filter(function (c) { return ratio(c, bg) >= 7; })[0] || hexOf(cs(wrap.querySelector('h1') || wrap).color);
    t.mute = byUse.filter(function (c) { var r = ratio(c, bg); return r >= 3.5 && r < 7 && c !== t.primary; })[0];
    /* Savings: a short "% off" or "save" label, its fill if it has one, else its text colour. */
    var sav = Array.prototype.filter.call(wrap.querySelectorAll('[class*="discount"], [class*="badge"], [class*="save"], [class*="saving"], [class*="sale"]'), function (e) {
      var x = (e.textContent || '').trim(); return x.length < 30 && /%|save/i.test(x) && !e.closest('.sbw') && shown(e);
    })[0];
    if (sav) { var sf = hexOf(cs(sav).backgroundColor); t.ok = sf && sf !== bg ? sf : hexOf(cs(sav).color); }
    /* Accent: the announcement bar, measured with the page's own styles, then taken away. */
    var barSrc = doc.querySelector('[class*="announcement"]');
    if (barSrc) {
      var bar = document.importNode(barSrc, true); sanitize(bar);
      bar.style.cssText += ';position:absolute;left:-9999px;top:0;width:1200px';
      document.body.appendChild(bar);
      var fills = [bar].concat(Array.prototype.slice.call(bar.querySelectorAll('*'))).map(function (e) { return hexOf(cs(e).backgroundColor); }).filter(Boolean);
      if (fills[0] && fills[0] !== bg) t.accent = fills[0];
      bar.remove();
    }
    if (!t.accent) t.accent = t.primary;
    /* Border and radius: an option the shopper has not picked. Radio labels first; themes that
       draw variants as plain cards (no radio) are read from the bordered variant/option tiles. */
    var bordered = function (l) { return l && shown(l) && parseFloat(cs(l).borderTopWidth) > 0 && hexOf(cs(l).borderTopColor); };
    var tiles = Array.prototype.map.call(wrap.querySelectorAll('input[type="radio"]:not(:checked)'), function (r) {
      return (r.id && wrap.querySelector('label[for="' + CSS.escape(r.id) + '"]')) || r.closest('label');
    }).filter(bordered);
    if (!tiles.length) tiles = Array.prototype.filter.call(wrap.querySelectorAll('[class*="variant"],[class*="option"],[class*="swatch"],[class*="pill"]'), function (e) {
      var w = e.offsetWidth, h = e.offsetHeight;
      return bordered(e) && w >= 50 && w <= 420 && h >= 28 && h <= 160 && (e.textContent || '').trim().length < 80 && !/(^|\s)(selected|active|is-active|checked)(\s|$)/.test(e.className);
    });
    /* The lightest stroke is the resting tile; dark ones are usually pills drawn as buttons. */
    var opt = tiles.sort(function (a, b) { return lumOf(hexOf(cs(b).borderTopColor)) - lumOf(hexOf(cs(a).borderTopColor)); })[0];
    if (opt) t.line = hexOf(cs(opt).borderTopColor);
    /* Radius: the option tile's, since the widget's plan cards sit among those tiles and read
       as the same kind of thing (Rosier: square Add to cart, 14px variant cards, widget 14).
       The buy button only when the page has no tile. Pills (half the height or more) cap at 24. */
    var rOf = function (n) { var r = parseFloat(cs(n).borderTopLeftRadius); return isNaN(r) ? null : Math.min(r, n.offsetHeight / 2); };
    var rad = opt ? rOf(opt) : (btn ? rOf(btn) : null);
    if (rad != null) t.radius = Math.min(24, Math.round(rad));
    if (!t.line) t.line = tint(bg, '#000000', 0.15);
    if (t.primary) t.secondary = tint(t.primary, bg, 0.9);
    if (t.ok) t.okBg = tint(t.ok, '#ffffff', 0.88);
    t.shadow = 'none'; t.outer = false;
    /* Font: the body font if it is one the admin offers. */
    var fam = cs(document.body).fontFamily || '';
    out.font = fam.split(',')[0].replace(/["']/g, '').trim();
    var hit = FONTS.filter(function (f) { return fam.toLowerCase().indexOf(f.toLowerCase()) >= 0; })[0];
    if (hit) t.font = hit;
    Object.keys(t).forEach(function (k) { if (t[k] == null || t[k] === '') delete t[k]; });
    return out;
  }

  function merchant(html, baseUrl, product, currency) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var sf = html.match(/Page saved with SingleFile\s+url:\s*(https?:\/\/\S+)/);
    var base = baseUrl || (sf && sf[1]) || (doc.querySelector('link[rel="canonical"]') || {}).href || (doc.querySelector('meta[property="og:url"]') || {}).content || '';
    if (!product) product = productFromDoc(doc);
    try { SAVED.origin = base ? new URL(base).origin : ''; } catch (e) { SAVED.origin = ''; }
    var tm = html.match(/Shopify\.theme\s*=\s*\{[^}]*"id"\s*:\s*(\d+)/) || html.match(/\/cdn\/shop\/t\/(\d+)\//);
    SAVED.theme = tm ? tm[1] : '';
    /* An image restored from a saved page may be an older product upload: try that path once. */
    document.addEventListener('error', function (e) {
      var img = e.target;
      if (!img || img.tagName !== 'IMG' || img.dataset.sbwTried) return;
      var src = img.getAttribute('src') || '';
      if (src.indexOf('/cdn/shop/files/') > 0) { img.dataset.sbwTried = '1'; img.src = src.replace('/cdn/shop/files/', '/cdn/shop/products/'); }
    }, true);
    if (!currency) { var cm = html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/); currency = cm && cm[1]; }

    var section = pickSection(doc);
    if (!section) return status({ ok: false, error: 'No product section was found on that page. Is it a product page?' });
    if (!product || !product.variants || !product.variants.length) return status({ ok: false, error: 'Found the product section, but not the product\'s prices. Try the product link instead.' });

    /* Their styles, ahead of ours so the widget's own rules win a tie. */
    var styles = Array.prototype.slice.call(doc.querySelectorAll('link[rel~="stylesheet"][href], style'));
    var tmp = doc.createElement('div'); styles.forEach(function (s) { tmp.appendChild(s.cloneNode(true)); });
    sanitize(tmp); absolutize(tmp, base);
    var first = document.getElementById('sbw-core-css');
    Array.prototype.slice.call(tmp.children).forEach(function (s) { document.head.insertBefore(document.importNode(s, true), first); });
    var mine = document.getElementById('pp-style'); if (mine) mine.remove();

    sanitize(section); absolutize(section, base);
    /* The store may already run a StackBack widget; two on one page is not a preview of either. */
    var live = section.querySelectorAll('[id*="stackback" i], [class*="stackback" i], [id*="sb-widget" i]');
    var liveCount = live.length;
    Array.prototype.forEach.call(live, function (n) { if (n.isConnected) n.remove(); });

    /* Mark where the widget goes and what it hides, on the copy, before it is moved in. */
    var qty = section.querySelector('input[name="quantity"], quantity-input, [class*="quantity"] input');
    var btns = buyButtons(section);
    var pay = Array.prototype.slice.call(section.querySelectorAll('.shopify-payment-button, [data-shopify="payment-button"], shopify-buy-it-now-button, shopify-accelerated-checkout'));
    var blocks = [];
    if (qty) blocks.push(buyBlock(qty, section));
    if (btns[0]) blocks.push(buyBlock(btns[0], section));
    blocks = blocks.filter(function (b, i) { return blocks.indexOf(b) === i && !blocks.some(function (o) { return o !== b && o.contains(b); }); });
    if (btns[0]) btns[0].setAttribute('data-sbw-buy', '');
    blocks.concat(btns, pay).forEach(function (n) { n.setAttribute('data-sbw-hide', ''); });
    blocks.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
    var before = blocks[0] || section.querySelector('h1') || section, after = blocks[blocks.length - 1] || before;
    var formFound = blocks.length > 0;
    /* A sticky buy bar goes as a whole, not just its button. Not the sticky info column,
       which also says "sticky" on many themes and holds the title. */
    btns.forEach(function (b) {
      var bar = b.parentElement && b.parentElement.closest('[class*="sticky"]');
      while (bar && bar.parentElement && /sticky/i.test(bar.parentElement.className || '') && !bar.parentElement.querySelector('h1')) bar = bar.parentElement;
      if (bar && !bar.querySelector('h1') && !bar.contains(before)) bar.setAttribute('data-sbw-hide', '');
    });
    var picker = section.querySelectorAll('variant-radios, variant-selects, variant-picker, fieldset.product-form__input, .product-form__input, [class*="variant-picker"], [class*="product-option"], select[name^="options"]');
    var target = before, pos = 'before';
    if (L.pos === 'below') { target = after; pos = 'after'; }
    else if (L.pos === 'variants' && picker.length) { target = picker[picker.length - 1]; pos = 'after'; }
    if (L.sel) { try { var custom = section.querySelector(L.sel); if (custom) { target = custom; pos = L.pos === 'below' ? 'after' : 'before'; } } catch (e) { /* bad selector */ } }
    target.setAttribute('data-sbw-anchor', '');

    document.documentElement.className = (doc.documentElement.className || '').replace(/\bno-js\b/, 'js') + ' js';
    document.body.className = doc.body.className || '';
    var wrap = document.createElement('main'); wrap.className = 'sbw-merchant';
    wrap.appendChild(document.importNode(section, true));
    var tag = document.querySelector('.pp-tag');
    document.body.innerHTML = '';
    document.body.appendChild(wrap);
    if (tag && !embedded) { tag.textContent = 'StackBack widget preview · not the live store'; document.body.appendChild(tag); }

    /* Script-free fixes: things themes reveal with JavaScript, and links that would leave. */
    var fixes = document.createElement('style');
    fixes.textContent = '.scroll-trigger,[data-aos],.animate--slide-in,.animate--fade-in,.reveal,.lazyload,.lazyloading{opacity:1!important;transform:none!important;visibility:visible!important;animation:none!important}' +
      '.sbw-merchant{display:block;max-width:100%;overflow-x:clip}.pp-tag{position:fixed;left:12px;bottom:12px;z-index:2147483000;background:#111;color:#fff;font:11.5px Inter,sans-serif;padding:6px 10px;border-radius:99px;opacity:.85}' +
      (L.css ? String(L.css).replace(/<\/?style/gi, '') : '');
    document.head.appendChild(fixes);
    document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
    document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href]'); if (a && !a.closest('.sbw')) e.preventDefault(); }, true);

    /* Whatever the shopper clicks to pick a size, named the way the variant is named, drives
       the widget's price: radio values, and short labels or buttons whose text is the name. */
    var names = product.variants.map(function (v) { return v.name; });
    wrap.querySelectorAll('input[type="radio"], label, button, li, span, div, a').forEach(function (el) {
      var v = [el.value, el.getAttribute('data-option1'), el.getAttribute('data-value'), el.getAttribute('data-variant-title'),
        el.children.length <= 1 ? (el.textContent || '').trim() : ''].filter(function (x) { return x && names.indexOf(x) >= 0; })[0];
      if (v && !el.closest('.sbw')) el.setAttribute('data-sbw-v', v);
    });

    /* With several option groups a variant is a combination ("Tea bags / 1 Month"), so a click
       on one option names the whole set that is now checked. Registered before the widget's
       own listener, so the name is in place when it reads it. */
    var groups = optionGroups(wrap);
    if (groups.length > 1) {
      wrap.addEventListener('click', function (e) {
        var r = e.target.closest && e.target.closest('input[type="radio"]');
        if (!r) return;
        var name = groups.map(function (g) {
          var c = wrap.querySelector('input[type="radio"][name="' + CSS.escape(g.name) + '"]:checked');
          return c ? c.value : g.checked;
        }).join(' / ');
        if (names.indexOf(name) >= 0) r.setAttribute('data-sbw-v', name);
      }, true);
    }

    var variants = product.variants.map(function (v) { return { name: v.name, price: v.price, compareAt: v.compareAt, image: v.image || product.image }; });
    var brand = null;
    try { brand = readBrand(wrap, doc, wrap.querySelector('[data-sbw-buy]')); } catch (e) { /* the preview works without it */ }
    status({ brand: brand && brand.t, font: brand && brand.font, ok: true, title: product.title, variants: variants.length, price: variants[0].price, currency: currency || 'INR', buy: formFound,
      partial: !!product.partial, live: liveCount, url: base ? base.split('?')[0] : '' });
    boot(buildCfg({ title: product.title, image: product.image || variants[0].image, variants: variants, selected: variants[0].name },
      SYMBOL[currency] || (currency ? currency + ' ' : '₹'), {
        anchor: '[data-sbw-anchor]', position: pos,
        hideOnSubscribe: ['[data-sbw-hide]', '[class*="sticky-atc"]', '[class*="sticky-add"]'],
        variantTiles: { selector: '[data-sbw-v]', attr: 'data-sbw-v' }
      }));
  }

  /* Same database the lab writes (lib/help/labstore.ts). */
  function readUpload(cb) {
    try {
      var r = indexedDB.open('sbw-lab', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onerror = function () { cb(null); };
      r.onsuccess = function () {
        try {
          var g = r.result.transaction('kv', 'readonly').objectStore('kv').get('upload');
          g.onsuccess = function () { cb(g.result || null); };
          g.onerror = function () { cb(null); };
        } catch (e) { cb(null); }
      };
    } catch (e) { cb(null); }
  }

  /* Shopify's /products/<handle>.js record, pasted in the lab: prices in minor units. */
  function fromRecord(p) {
    if (!p || !p.variants || !p.variants.length) return null;
    return { title: p.title || '', image: abs(p.featured_image),
      variants: p.variants.map(function (v) { return { name: v.title || 'Default', price: Number(v.price) / 100,
        compareAt: v.compare_at_price ? Number(v.compare_at_price) / 100 : undefined, image: abs(v.featured_image) }; }) };
  }

  /* ---------------------------------------------------------------- go */
  addEventListener('hashchange', function () { location.reload(); });
  if (L._bad) {
    document.body.innerHTML = '<div class="pp-err"><b>This preview link is damaged.</b><p>Open the Widget lab and copy the link again.</p></div>';
    return;
  }
  var src = L.src || {};
  if (src.u) {
    var key = 'sbw-lab-pdp:' + src.u, cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { /* storage blocked */ }
    var go = function (j) {
      if (!j || !j.ok) return status({ ok: false, error: (j && j.error) || 'Could not load that page.' });
      merchant(j.html, j.url, j.product, j.currency);
    };
    if (cached) go(cached);
    else fetch('/api/widget-lab/pdp?url=' + encodeURIComponent(src.u)).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) { try { sessionStorage.setItem(key, JSON.stringify(j)); } catch (e) { /* too big to cache */ } }
      go(j);
    }).catch(function () { status({ ok: false, error: 'Could not reach the page loader.' }); });
  } else if (src.up) {
    readUpload(function (u) {
      if (!u || !u.html) {
        if (!embedded) document.body.innerHTML = '<div class="pp-err"><b>This preview used an uploaded page.</b><p>Uploaded pages stay in the browser that uploaded them, so they cannot be opened from a link.</p></div>';
        return status({ ok: false, error: 'The uploaded page is no longer in this browser. Upload it again.' });
      }
      merchant(u.html, null, u.product ? fromRecord(u.product) : null, null);
    });
  } else {
    sample();
  }
})();
