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
      if (!nav.querySelector('a[href="/client-portal.html"]')) {
        var cp = document.createElement('a');
        cp.href = '/client-portal.html';
        cp.innerHTML = '<span class="sidebar-icon">🔗</span> Client Portal';
        nav.appendChild(cp);
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
