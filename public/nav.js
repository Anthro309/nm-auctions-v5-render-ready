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

    // Flip above if too close to bottom
    var h = tip.offsetHeight;
    if (top + h > window.innerHeight - 16) {
      tip.style.top = (r.top - h - 10) + 'px';
    }

    // Arrow offset relative to button center
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

// Shared navbar initializer — included on every page
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

  // Highlight active sidebar link based on current page
  var links = document.querySelectorAll('#sidebar nav a');
  var currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  links.forEach(function(link) {
    var href = link.getAttribute('href').replace(/\/$/, '') || '/';
    if (href === currentPath) link.classList.add('active');
  });

  // Inject Admin + Client Portal links into sidebar for admin users
  if (u.isAdmin) {
    var nav = document.querySelector('#sidebar nav');
    if (nav) {
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

  // Hide admin-only sidebar links for regular employees
  if (!u.isAdmin) {
    var sidebarNav = document.querySelector('#sidebar nav');
    if (sidebarNav) {
      var photoLink = sidebarNav.querySelector('a[href="/photo-upload.html"]');
      if (photoLink) photoLink.style.display = 'none';
      var reportsLink = sidebarNav.querySelector('a[href="/reports.html"]');
      if (reportsLink) reportsLink.style.display = 'none';
      var reviewLink = sidebarNav.querySelector('a[href="/review-visit.html"]');
      if (reviewLink) reviewLink.style.display = 'none';
    }
  }

  // ── NOTIFICATION BELL ──
  injectNotificationBell(u);
}());

function injectNotificationBell(u) {
  var navbar = document.querySelector('.navbar');
  if (!navbar || !u) return;

  // Inject CSS for bell
  if (!document.getElementById('navbell-styles')) {
    var style = document.createElement('style');
    style.id = 'navbell-styles';
    style.textContent = `
      .nav-bell { position:relative; cursor:pointer; padding:0 6px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .nav-bell-icon { font-size:20px; line-height:1; }
      .nav-bell-badge { position:absolute; top:-2px; right:0px; background:#dc2626; color:white; font-size:10px; font-weight:800; min-width:16px; height:16px; border-radius:99px; display:flex; align-items:center; justify-content:center; padding:0 4px; border:2px solid #0b1b2b; display:none; }
      .nav-bell-dropdown { position:fixed; top:64px; right:8px; width:300px; max-height:400px; overflow-y:auto; background:white; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.18); z-index:9999; display:none; padding:0; }
      .nav-bell-dropdown.open { display:block; }
      .nav-bell-header { padding:14px 16px 10px; font-size:13px; font-weight:800; color:#111827; border-bottom:1px solid #f3f4f6; display:flex; align-items:center; justify-content:space-between; }
      .nav-bell-item { padding:12px 16px; border-bottom:1px solid #f3f4f6; cursor:pointer; }
      .nav-bell-item:last-child { border-bottom:none; }
      .nav-bell-item:hover { background:#f8fafc; }
      .nav-bell-item-name { font-size:13px; font-weight:700; color:#111827; }
      .nav-bell-item-meta { font-size:11px; color:#6b7280; margin-top:2px; }
      .nav-bell-empty { padding:20px 16px; font-size:13px; color:#9ca3af; text-align:center; }
      .nav-bell-dismiss { font-size:11px; color:#6b7280; cursor:pointer; font-weight:600; }
      .nav-bell-dismiss:hover { color:#dc2626; }
    `;
    document.head.appendChild(style);
  }

  // Create bell element and insert before nav-right
  var navRight = navbar.querySelector('.nav-right');
  var bell = document.createElement('div');
  bell.className = 'nav-bell';
  bell.id = 'navBell';
  bell.innerHTML = '<div class="nav-bell-icon">🔔</div><div class="nav-bell-badge" id="navBellBadge"></div>';
  if (navRight) navbar.insertBefore(bell, navRight);
  else navbar.appendChild(bell);

  // Dropdown
  var dropdown = document.createElement('div');
  dropdown.className = 'nav-bell-dropdown';
  dropdown.id = 'navBellDropdown';
  document.body.appendChild(dropdown);

  bell.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', function() {
    dropdown.classList.remove('open');
  });

  // Load and display notifications
  async function loadBellNotifications() {
    try {
      var res = await fetch('/notifications?employee=' + encodeURIComponent(u.name));
      var data = await res.json();
      var notifications = (data.notifications || []);
      var assigned = (data.assigned || []);

      // Deduplicate: hide assigned items that already have an explicit notification
      var notifItemIds = new Set(notifications.map(function(n) { return String(n.itemId); }));
      var uniqueAssigned = assigned.filter(function(i) { return !notifItemIds.has(String(i.id)); });

      var total = notifications.length + uniqueAssigned.length;

      var badge = document.getElementById('navBellBadge');
      if (badge) {
        badge.style.display = total > 0 ? 'flex' : 'none';
        badge.textContent = total > 9 ? '9+' : String(total);
      }

      var html = '<div class="nav-bell-header"><span>Notifications</span>';
      if (total > 0) html += '<span class="nav-bell-dismiss" onclick="dismissAllNotifs()">Dismiss all</span>';
      html += '</div>';

      if (!total) {
        html += '<div class="nav-bell-empty">No new notifications</div>';
      } else {
        // Explicit notifications first
        notifications.forEach(function(n) {
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
        // Assigned items not already shown above
        uniqueAssigned.forEach(function(i) {
          html += '<div class="nav-bell-item" onclick="window.location.href=\'/item.html?id=' + encStr(i.id) + '\'">';
          html += '<div class="nav-bell-item-name">👤 ' + encStr(i.name || 'Unnamed') + '</div>';
          html += '<div class="nav-bell-item-meta">Lot ' + encStr(i.lotNumber || '—') + ' · ' + encStr(i.stage || '—') + (i.assignedBy ? ' · by ' + encStr(i.assignedBy) : '') + '</div>';
          html += '</div>';
        });
      }

      dropdown.innerHTML = html;
    } catch (err) { /* silent */ }
  }

  window.dismissAllNotifs = async function() {
    try {
      await fetch('/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee: u.name })
      });
      await loadBellNotifications();
      dropdown.classList.remove('open');
    } catch {}
  };

  function encStr(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Load on init + poll every 60s
  loadBellNotifications();
  setInterval(loadBellNotifications, 60000);
}
