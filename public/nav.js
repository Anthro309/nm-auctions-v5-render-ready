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
