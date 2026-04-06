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

// Shared navbar avatar initializer — included on every page
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

  // Inject Admin link into sidebar for admin users
  if (u.isAdmin) {
    var nav = document.querySelector('#sidebar nav');
    if (nav && !nav.querySelector('a[href="/admin.html"]')) {
      var a = document.createElement('a');
      a.href = '/admin.html';
      a.innerHTML = '<span class="sidebar-icon">⚙️</span> Admin';
      nav.appendChild(a);
    }
  }
}());
