// ── INJECT UI-REFRESH STYLESHEET ──
// Loaded here so every page that uses nav.js automatically gets the UI theme.
(function () {
  if (!document.querySelector('link[href="/ui-refresh.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/ui-refresh.css';
    document.head.appendChild(link);
  }
}());

// ── TOAST NOTIFICATION SYSTEM ──
(function () {
  var toastStyles = `
    #al-toast-container {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      width: max-content;
      max-width: calc(100vw - 32px);
    }
    .al-toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 13px 18px;
      border-radius: 14px;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
      color: white;
      max-width: calc(100vw - 32px);
      min-width: 200px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.14);
      pointer-events: auto;
      cursor: default;
      animation: alToastIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      will-change: transform, opacity;
    }
    .al-toast.removing {
      animation: alToastOut 0.22s ease forwards;
    }
    .al-toast.success { background: linear-gradient(135deg, #065f46, #047857); }
    .al-toast.error   { background: linear-gradient(135deg, #991b1b, #b91c1c); }
    .al-toast.info    { background: linear-gradient(135deg, #1e3a5f, #1e40af); }
    .al-toast.warn    { background: linear-gradient(135deg, #78350f, #92400e); }
    .al-toast-icon { font-size: 17px; flex-shrink: 0; }
    .al-toast-msg  { flex: 1; }
    @keyframes alToastIn {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)    scale(1); }
    }
    @keyframes alToastOut {
      from { opacity: 1; transform: translateY(0)    scale(1); }
      to   { opacity: 0; transform: translateY(8px)  scale(0.96); }
    }
  `;

  if (!document.getElementById('al-toast-styles')) {
    var s = document.createElement('style');
    s.id = 'al-toast-styles';
    s.textContent = toastStyles;
    document.head.appendChild(s);
  }

  function getContainer() {
    var c = document.getElementById('al-toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'al-toast-container'; document.body.appendChild(c); }
    return c;
  }

  var ICONS = { success: '✓', error: '✕', warn: '⚠', info: 'ℹ' };

  window.toast = function (message, type, duration) {
    type = type || 'info';
    duration = duration !== undefined ? duration : (type === 'error' ? 5000 : 3200);

    var container = getContainer();
    var el = document.createElement('div');
    el.className = 'al-toast ' + type;
    el.innerHTML = '<span class="al-toast-icon">' + (ICONS[type] || ICONS.info) + '</span><span class="al-toast-msg">' + String(message).replace(/</g, '&lt;') + '</span>';

    container.appendChild(el);

    function dismiss() {
      el.classList.add('removing');
      el.addEventListener('animationend', function () { if (el.parentNode) el.parentNode.removeChild(el); }, { once: true });
    }

    var timer = setTimeout(dismiss, duration);
    el.addEventListener('click', function () { clearTimeout(timer); dismiss(); });
    return dismiss;
  };
}());

// ── HELP TOOLTIP SYSTEM ──
(function () {
  var tip = null;

  function showTip(btn, text) {
    if (tip) { tip.remove(); tip = null; }
    tip = document.createElement('div');
    tip.className = 'help-tooltip';
    tip.textContent = text;
    document.body.appendChild(tip);

    var r = btn.getBoundingClientRect();
    var maxW = 280;
    var left = Math.min(r.left, window.innerWidth - maxW - 12);
    if (left < 12) left = 12;
    var top = r.bottom + 10;
    tip.style.cssText = 'left:' + left + 'px;top:' + top + 'px;max-width:' + maxW + 'px;';

    var h = tip.offsetHeight;
    if (top + h > window.innerHeight - 16) tip.style.top = (r.top - h - 10) + 'px';

    var arrowLeft = Math.min(Math.max(r.left + r.width / 2 - left - 6, 10), maxW - 22);
    tip.style.setProperty('--arrow-left', arrowLeft + 'px');

    setTimeout(function () {
      document.addEventListener('click', function dismiss() {
        if (tip) { tip.remove(); tip = null; }
        document.removeEventListener('click', dismiss);
      });
    }, 0);
  }

  window.showTip = showTip;
}());

// ── ROLE HELPERS ──
var ROLE_LABELS = { admin: 'Admin', intake: 'Intake', photo: 'Photography', fulfillment: 'Fulfillment', staff: 'Staff' };
var ROLE_COLORS = { admin: 'purple', intake: 'green', photo: 'blue', fulfillment: 'gold', staff: 'gray' };

function getRoleLabel(u) {
  if (!u) return 'Staff';
  return ROLE_LABELS[u.role] || (u.isAdmin ? 'Admin' : 'Staff');
}

function encStr(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlightActiveSidebarLink() {
  var links = document.querySelectorAll('#sidebar nav a');
  var currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  links.forEach(function (link) {
    var href = (link.getAttribute('href') || '').replace(/\/$/, '') || '/';
    link.classList.toggle('active', href === currentPath);
  });
}

// ── KEYBOARD / ESCAPE HANDLER ──
(function () {
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      var sidebar = document.getElementById('sidebar');
      var overlay = document.getElementById('overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('show');
      var dropdown = document.getElementById('navBellDropdown');
      if (dropdown) dropdown.classList.remove('open');
    }
  });
}());

// ── SHARED NAVBAR INIT ──
(function () {
  var u = JSON.parse(localStorage.getItem('user') || 'null');
  if (!u) return;

  // Populate nav avatar
  var el = document.getElementById('navAvatar');
  if (el) {
    if (u.photo) {
      var img = document.createElement('img');
      img.src = u.photo;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
      el.appendChild(img);
    } else {
      el.textContent = (u.name || '?')[0].toUpperCase();
    }
  }

  // Build sidebar user block
  var sidebarHeader = document.querySelector('.sidebar-header');
  if (sidebarHeader) {
    var roleLabel = getRoleLabel(u);
    var roleClass = ROLE_COLORS[u.role] || (u.isAdmin ? 'purple' : 'gray');
    sidebarHeader.innerHTML =
      '<div style="display:flex;align-items:center;gap:11px;margin-bottom:12px;">' +
        '<div style="width:40px;height:40px;min-width:40px;border-radius:11px;background:#1e3a5f;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:white;overflow:hidden;">' +
          (u.photo ? '<img src="' + encStr(u.photo) + '" style="width:100%;height:100%;object-fit:cover;" />' : (u.name || '?')[0].toUpperCase()) +
        '</div>' +
        '<div style="min-width:0;">' +
          '<div style="font-size:14px;font-weight:700;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + encStr(u.name) + '</div>' +
          '<span class="role-badge ' + roleClass + '" style="margin-top:3px;display:inline-flex;">' + roleLabel + '</span>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:0.07em;text-transform:uppercase;font-weight:600;">Studio Operations</div>';
  }

  // Inject admin-only sidebar links
  if (u.isAdmin) {
    var nav = document.querySelector('#sidebar nav');
    if (nav) {
      if (!nav.querySelector('a[href="/payouts.html"]')) {
        var payLink = document.createElement('a');
        payLink.href = '/payouts.html';
        payLink.innerHTML = '<span class="sidebar-icon">💳</span> Payouts';
        nav.appendChild(payLink);
      }
      if (!nav.querySelector('a[href="/admin.html"]')) {
        var a = document.createElement('a');
        a.href = '/admin.html';
        a.innerHTML = '<span class="sidebar-icon">⚙️</span> Admin';
        nav.appendChild(a);
      }
      if (!nav.querySelector('a[href="/analytics.html"]')) {
        var an = document.createElement('a');
        an.href = '/analytics.html';
        an.innerHTML = '<span class="sidebar-icon">📈</span> Analytics';
        nav.appendChild(an);
      }
      if (!nav.querySelector('a[href="/csv-import.html"]')) {
        var ci = document.createElement('a');
        ci.href = '/csv-import.html';
        ci.innerHTML = '<span class="sidebar-icon">📥</span> CSV Import';
        nav.appendChild(ci);
      }
      if (!nav.querySelector('a[href="/client-portal.html"]')) {
        var cp = document.createElement('a');
        cp.href = '/client-portal.html';
        cp.innerHTML = '<span class="sidebar-icon">🔗</span> Client Portal';
        nav.appendChild(cp);
      }
      if (!nav.querySelector('a[href="/delivery.html"]')) {
        var dp = document.createElement('a');
        dp.href = '/delivery.html';
        dp.innerHTML = '<span class="sidebar-icon">🚚</span> Delivery Portal';
        nav.appendChild(dp);
      }
    }
  }

  // Hide links non-admins shouldn't see
  if (!u.isAdmin) {
    var sidebarNav = document.querySelector('#sidebar nav');
    if (sidebarNav) {
      ['/photo-upload.html', '/reports.html', '/review-visit.html'].forEach(function (href) {
        var link = sidebarNav.querySelector('a[href="' + href + '"]');
        if (link) link.style.display = 'none';
      });
    }
  }

  highlightActiveSidebarLink();
  injectNotificationBell(u);
}());

// ── NOTIFICATION BELL ──
function injectNotificationBell(u) {
  var navbar = document.querySelector('.navbar');
  if (!navbar || !u) return;
  if (document.getElementById('navBell')) return;

  if (!document.getElementById('navbell-styles')) {
    var style = document.createElement('style');
    style.id = 'navbell-styles';
    style.textContent = `
      .nav-bell { position:relative; cursor:pointer; padding:0 6px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .nav-bell-icon { font-size:19px; line-height:1; opacity:0.7; transition:opacity 0.12s; }
      .nav-bell:hover .nav-bell-icon { opacity:1; }
      .nav-bell-badge { position:absolute; top:-1px; right:1px; background:#dc2626; color:white; font-size:9.5px; font-weight:800; min-width:15px; height:15px; border-radius:99px; display:none; align-items:center; justify-content:center; padding:0 3px; border:2px solid #0b1b2b; }
      .nav-bell-dropdown { position:fixed; top:68px; right:8px; width:300px; max-width:calc(100vw - 16px); max-height:400px; overflow-y:auto; background:white; border-radius:14px; box-shadow:0 8px 30px rgba(0,0,0,0.15); z-index:9999; display:none; border:1px solid #e5e7eb; }
      .nav-bell-dropdown.open { display:block; }
      .nav-bell-header { padding:13px 15px 9px; font-size:13px; font-weight:700; color:#111827; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; justify-content:space-between; }
      .nav-bell-item { padding:11px 15px; border-bottom:1px solid #f3f4f6; cursor:pointer; transition:background 0.1s; }
      .nav-bell-item:last-child { border-bottom:none; }
      .nav-bell-item:hover { background:#f8fafc; }
      .nav-bell-item-name { font-size:13px; font-weight:600; color:#111827; }
      .nav-bell-item-meta { font-size:11px; color:#6b7280; margin-top:2px; }
      .nav-bell-empty { padding:20px 15px; font-size:13px; color:#9ca3af; text-align:center; }
      .nav-bell-dismiss { font-size:11px; color:#9ca3af; cursor:pointer; font-weight:600; }
      .nav-bell-dismiss:hover { color:#dc2626; }
    `;
    document.head.appendChild(style);
  }

  var navRight = navbar.querySelector('.nav-right');
  var bell = document.createElement('div');
  bell.className = 'nav-bell';
  bell.id = 'navBell';
  bell.innerHTML = '<div class="nav-bell-icon">🔔</div><div class="nav-bell-badge" id="navBellBadge"></div>';
  if (navRight) navbar.insertBefore(bell, navRight);
  else navbar.appendChild(bell);

  var dropdown = document.createElement('div');
  dropdown.className = 'nav-bell-dropdown';
  dropdown.id = 'navBellDropdown';
  document.body.appendChild(dropdown);

  bell.addEventListener('click', function (e) { e.stopPropagation(); dropdown.classList.toggle('open'); });
  document.addEventListener('click', function () { dropdown.classList.remove('open'); });

  async function loadBellNotifications() {
    try {
      var res = await fetch('/notifications?employee=' + encodeURIComponent(u.name));
      var data = await res.json();
      var notifications = (data.notifications || []);
      var assigned = (data.assigned || []);
      var notifItemIds = new Set(notifications.map(function (n) { return String(n.itemId); }));
      var uniqueAssigned = assigned.filter(function (i) { return !notifItemIds.has(String(i.id)); });
      var total = notifications.length + uniqueAssigned.length;

      var badge = document.getElementById('navBellBadge');
      if (badge) { badge.style.display = total > 0 ? 'flex' : 'none'; badge.textContent = total > 9 ? '9+' : String(total); }

      var html = '<div class="nav-bell-header"><span>Notifications</span>';
      if (total > 0) html += '<span class="nav-bell-dismiss" onclick="dismissAllNotifs()">Clear all</span>';
      html += '</div>';

      if (!total) {
        html += '<div class="nav-bell-empty">No new notifications</div>';
      } else {
        notifications.forEach(function (n) {
          var isMissing = n.type === 'missing';
          html += '<div class="nav-bell-item" onclick="window.location.href=\'/item.html?id=' + encStr(n.itemId) + '\'">';
          if (isMissing) {
            html += '<div class="nav-bell-item-name" style="color:#dc2626;">🚨 ' + encStr(n.itemName || 'Item') + ' — Missing</div>';
            html += '<div class="nav-bell-item-meta">Flagged by ' + encStr(n.flaggedBy || '—') + ' · Lot ' + encStr(n.lotNumber || '—') + '</div>';
          } else {
            html += '<div class="nav-bell-item-name">📦 ' + encStr(n.itemName || 'Item assigned') + '</div>';
            html += '<div class="nav-bell-item-meta">Assigned by ' + encStr(n.assignedBy || '—') + ' · Lot ' + encStr(n.lotNumber || '—') + '</div>';
          }
          html += '</div>';
        });
        uniqueAssigned.forEach(function (i) {
          html += '<div class="nav-bell-item" onclick="window.location.href=\'/item.html?id=' + encStr(i.id) + '\'">';
          html += '<div class="nav-bell-item-name">👤 ' + encStr(i.name || 'Unnamed') + '</div>';
          html += '<div class="nav-bell-item-meta">Lot ' + encStr(i.lotNumber || '—') + ' · ' + encStr(i.stage || '—') + (i.assignedBy ? ' · by ' + encStr(i.assignedBy) : '') + '</div>';
          html += '</div>';
        });
      }
      dropdown.innerHTML = html;
    } catch (_) {}
  }

  window.dismissAllNotifs = async function () {
    try {
      await fetch('/notifications/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee: u.name }) });
      await loadBellNotifications();
      dropdown.classList.remove('open');
    } catch (_) {}
  };

  loadBellNotifications();
  setInterval(loadBellNotifications, 60000);
}

// ── SCROLL-TO-TOP BUTTON ──
(function () {
  var css = [
    '#al-scroll-top{position:fixed;bottom:28px;right:20px;width:42px;height:42px;border-radius:50%;',
    'background:#06111E;color:white;border:none;box-shadow:0 4px 16px rgba(0,0,0,0.3);cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;',
    'z-index:9990;opacity:0;transform:translateY(10px);',
    'transition:opacity 0.2s,transform 0.2s,background 0.15s;pointer-events:none;}',
    '#al-scroll-top.visible{opacity:1;transform:translateY(0);pointer-events:auto;}',
    '#al-scroll-top:hover{background:#0d2240;}',
    '@media(max-width:767px){#al-scroll-top{bottom:80px;right:14px;}}'
  ].join('');

  document.addEventListener('DOMContentLoaded', function () {
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    var btn = document.createElement('button');
    btn.id = 'al-scroll-top'; btn.setAttribute('aria-label', 'Scroll to top'); btn.textContent = '↑';
    document.body.appendChild(btn);
    window.addEventListener('scroll', function () { btn.classList.toggle('visible', window.scrollY > 300); }, { passive: true });
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  });
}());

// ── EXIT PAGE FADE ──
(function () {
  var s = document.createElement('style');
  s.textContent = '@keyframes alExitFade{to{opacity:0;}}body.al-exiting{animation:alExitFade 0.15s ease-out forwards;pointer-events:none;}';
  document.head.appendChild(s);

  document.addEventListener('click', function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest('a[href]');
    if (!link || link.target === '_blank') return;
    var href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto') || href.startsWith('tel')) return;
    try {
      var url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    } catch (_) { return; }
    e.preventDefault();
    document.body.classList.add('al-exiting');
    var dest = link.href;
    setTimeout(function () { window.location.href = dest; }, 150);
  }, true);
}());

// ── STAT COUNTER ANIMATION ──
(function () {
  function animateCount(el, text, duration) {
    var clean = text.replace(/,/g, '');
    var m = clean.match(/^([^0-9-]*)(-?[\d.]+)([^0-9.]*)$/);
    if (!m) return;
    var prefix = m[1], num = parseFloat(m[2]), suffix = m[3];
    if (isNaN(num) || num === 0) return;
    var start = performance.now();
    (function step(now) {
      var t = Math.min((now - start) / duration, 1);
      var ease = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + Math.round(num * ease).toLocaleString() + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = prefix + num.toLocaleString() + suffix;
    }(start));
  }

  var seen = new WeakSet();
  function scanStats() {
    document.querySelectorAll('.stat-number').forEach(function (el) {
      if (seen.has(el)) return;
      var t = el.textContent.trim();
      if (t && t !== '—' && /\d/.test(t) && !el.classList.contains('skeleton')) {
        seen.add(el);
        var captured = t;
        el.textContent = '0';
        setTimeout(function () { animateCount(el, captured, 900); }, 60);
      }
    });
  }

  var mo = new MutationObserver(scanStats);
  document.addEventListener('DOMContentLoaded', function () {
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    scanStats();
  });
}());

// ── CUSTOM CONFIRM MODAL ──
(function () {
  var s = document.createElement('style');
  s.textContent = [
    '.al-confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);',
    'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);',
    'z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;',
    'animation:alCfIn 0.18s ease both;}',
    '.al-confirm-box{background:white;border-radius:20px;padding:28px 28px 24px;',
    'max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);',
    'animation:alCfSlide 0.22s cubic-bezier(0.34,1.4,0.64,1) both;}',
    '.al-confirm-title{font-size:16px;font-weight:700;color:#111827;margin-bottom:10px;',
    'font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '.al-confirm-msg{font-size:14px;color:#374151;line-height:1.55;white-space:pre-line;',
    'font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '.al-confirm-actions{display:flex;gap:10px;margin-top:22px;justify-content:flex-end;}',
    '.al-confirm-cancel{padding:10px 20px;border-radius:10px;border:1px solid rgba(0,0,0,0.12);',
    'background:#f9fafb;color:#374151;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}',
    '.al-confirm-cancel:hover{background:#f3f4f6;}',
    '.al-confirm-ok{padding:10px 22px;border-radius:10px;',
    'background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;',
    'font-size:14px;font-weight:600;cursor:pointer;border:none;',
    'box-shadow:0 3px 10px rgba(220,38,38,0.3);font-family:inherit;}',
    '.al-confirm-ok.safe{background:linear-gradient(135deg,#3B5EEC,#2044CC);box-shadow:0 3px 10px rgba(44,82,224,0.3);}',
    '.al-confirm-ok:hover{opacity:0.9;transform:translateY(-1px);}',
    '@keyframes alCfIn{from{opacity:0;}to{opacity:1;}}',
    '@keyframes alCfSlide{from{opacity:0;transform:scale(0.95) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}'
  ].join('');
  document.head.appendChild(s);

  window.confirm2 = function (message, opts) {
    opts = opts || {};
    var safe = opts.safe || false;
    var title = opts.title || (safe ? 'Confirm' : 'Are you sure?');
    var confirmText = opts.confirmText || (safe ? 'Confirm' : 'Yes, continue');
    var cancelText = opts.cancelText || 'Cancel';

    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'al-confirm-overlay';
      overlay.innerHTML =
        '<div class="al-confirm-box">' +
          '<div class="al-confirm-title">' + encStr(title) + '</div>' +
          '<div class="al-confirm-msg">' + encStr(message) + '</div>' +
          '<div class="al-confirm-actions">' +
            '<button class="al-confirm-cancel">' + encStr(cancelText) + '</button>' +
            '<button class="al-confirm-ok' + (safe ? ' safe' : '') + '">' + encStr(confirmText) + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      function cleanup(result) {
        overlay.style.animation = 'alCfIn 0.15s ease reverse both';
        setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 150);
        resolve(result);
      }

      overlay.querySelector('.al-confirm-cancel').addEventListener('click', function () { cleanup(false); });
      overlay.querySelector('.al-confirm-ok').addEventListener('click', function () { cleanup(true); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) cleanup(false); });

      var keyHandler = function (e) {
        if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', keyHandler); }
        if (e.key === 'Enter') { cleanup(true); document.removeEventListener('keydown', keyHandler); }
      };
      document.addEventListener('keydown', keyHandler);
      setTimeout(function () { var ok = overlay.querySelector('.al-confirm-ok'); if (ok) ok.focus(); }, 50);
    });
  };
}());

// ── BUTTON LOADING HELPER ──
(function () {
  var s = document.createElement('style');
  s.textContent = [
    '.al-btn-loading{position:relative;color:transparent!important;pointer-events:none!important;}',
    '.al-btn-loading::after{content:"";position:absolute;width:16px;height:16px;',
    'top:50%;left:50%;margin:-8px 0 0 -8px;',
    'border:2.5px solid rgba(255,255,255,0.35);border-top-color:white;',
    'border-radius:50%;animation:alBtnSpin 0.7s linear infinite;}',
    '@keyframes alBtnSpin{to{transform:rotate(360deg);}}'
  ].join('');
  document.head.appendChild(s);

  window.setLoading = function (btn, loading) {
    if (!btn) return;
    if (loading) { btn.classList.add('al-btn-loading'); btn.disabled = true; }
    else { btn.classList.remove('al-btn-loading'); btn.disabled = false; }
  };

  window.withLoading = function (btn, asyncFn) {
    setLoading(btn, true);
    var p = asyncFn();
    if (p && typeof p.finally === 'function') p.finally(function () { setLoading(btn, false); });
    else setLoading(btn, false);
    return p;
  };
}());

// ── MOBILE BOTTOM TAB BAR ──
(function () {
  var TABS = [
    { href: '/dashboard.html', icon: '🏠', label: 'Home' },
    { href: '/items.html',     icon: '📦', label: 'Items' },
    { href: '/events.html',    icon: '📅', label: 'Events' },
    { href: '/scanner.html',   icon: '📷', label: 'Scan' }
  ];

  var css = [
    '#al-bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;',
    'background:#06111E;border-top:1px solid rgba(255,255,255,0.07);',
    'box-shadow:0 -4px 20px rgba(0,0,0,0.25);z-index:9980;',
    'padding-bottom:env(safe-area-inset-bottom,0px);}',
    '#al-bottom-nav-inner{display:flex;height:60px;}',
    '.al-tab-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'gap:2px;color:rgba(255,255,255,0.4);text-decoration:none;font-size:10px;font-weight:600;',
    'transition:color 0.12s;padding-top:4px;',
    'font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '.al-tab-item.active{color:#7da3f8;}',
    '.al-tab-item:hover{color:rgba(255,255,255,0.75);}',
    '.al-tab-icon{font-size:20px;line-height:1;}',
    '@media(max-width:767px){',
    '#al-bottom-nav{display:block;}',
    'body{padding-bottom:calc(60px + env(safe-area-inset-bottom,0px))!important;}',
    '#al-toast-container{bottom:calc(72px + env(safe-area-inset-bottom,0px))!important;}',
    '}',
    '@media(min-width:768px){#al-bottom-nav{display:none!important;}}'
  ].join('');

  document.addEventListener('DOMContentLoaded', function () {
    var u = JSON.parse(localStorage.getItem('user') || 'null');
    if (!u) return;

    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

    var nav = document.createElement('nav'); nav.id = 'al-bottom-nav';
    var inner = document.createElement('div'); inner.id = 'al-bottom-nav-inner';
    var cur = window.location.pathname;

    TABS.forEach(function (tab) {
      var isActive = cur === tab.href || (cur.startsWith(tab.href.replace('.html', '')) && tab.href !== '/dashboard.html');
      var a = document.createElement('a');
      a.href = tab.href;
      a.className = 'al-tab-item' + (isActive ? ' active' : '');
      a.innerHTML = '<span class="al-tab-icon">' + tab.icon + '</span><span>' + tab.label + '</span>';
      inner.appendChild(a);
    });

    nav.appendChild(inner);
    document.body.appendChild(nav);
  });
}());

// ── FIELD VALIDATION HELPER ──
(function () {
  var s = document.createElement('style');
  s.textContent = [
    '.field-invalid{border-color:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,0.12)!important;',
    'animation:alFieldShake 0.35s ease;}',
    '.field-error-msg{font-size:12px;color:#dc2626;margin-top:4px;font-weight:500;display:block;}',
    '@keyframes alFieldShake{0%,100%{transform:translateX(0);}20%{transform:translateX(-4px);}',
    '40%{transform:translateX(4px);}60%{transform:translateX(-3px);}80%{transform:translateX(3px);}}'
  ].join('');
  document.head.appendChild(s);

  window.markInvalid = function (el, msg) {
    el.classList.add('field-invalid');
    if (!el.parentNode.querySelector('.field-error-msg')) {
      var err = document.createElement('span');
      err.className = 'field-error-msg';
      err.textContent = msg || 'This field is required';
      el.parentNode.insertBefore(err, el.nextSibling);
    }
    el.addEventListener('input', function clear() {
      el.classList.remove('field-invalid');
      var e = el.parentNode ? el.parentNode.querySelector('.field-error-msg') : null;
      if (e) e.remove();
      el.removeEventListener('input', clear);
    });
  };

  window.validateFields = function (fields) {
    var valid = true;
    var firstInvalid = null;
    fields.forEach(function (f) {
      var el = typeof f === 'string' ? document.getElementById(f) : f;
      if (!el) return;
      if (!el.value || !el.value.trim()) {
        markInvalid(el, el.dataset.errorMsg || 'Required');
        if (!firstInvalid) firstInvalid = el;
        valid = false;
      }
    });
    if (firstInvalid) firstInvalid.focus();
    return valid;
  };
}());
