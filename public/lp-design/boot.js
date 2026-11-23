/* Landing Page Lab: the settings ride in the link (#c= base64url JSON) and are read before the
   design bundle runs, which builds its colours and products once at load. A new hash reloads. */
(function () {
  var m = /#c=([A-Za-z0-9_-]+)/.exec(location.hash);
  var cfg = {};
  if (m) {
    try {
      var b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      var bin = atob(b), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      cfg = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { cfg = {}; }
  }
  window.__SB_LAB__ = cfg;
  /* Sections the lab switched off: tagged data-lab-sec at build time. */
  var hide = (cfg.hide || []).filter(function (k) { return /^[a-z]+$/.test(k); });
  /* Payment types switched off: every spelling the widgets use for each one. */
  var ALIAS = { upfront: ['upfront'], perDelivery: ['perDelivery', 'perdelivery'], payg: ['payg', 'payAsYouGo'] };
  if (cfg.pay && cfg.pay.length) {
    Object.keys(ALIAS).forEach(function (k) {
      if (cfg.pay.indexOf(k) < 0) ALIAS[k].forEach(function (a) { hide.push('__pay:' + a); });
    });
  }
  if (hide.length) {
    var st = document.createElement('style');
    st.textContent = hide.map(function (k) {
      return k.indexOf('__pay:') === 0 ? '[data-lab-pay="' + k.slice(6) + '"]' : '[data-lab-sec="' + k + '"]';
    }).join(',') + '{display:none!important}';
    document.head.appendChild(st);
  }
  addEventListener('hashchange', function () { location.reload(); });
})();
