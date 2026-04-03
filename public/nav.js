// Shared navbar avatar initializer — included on every page
(function () {
  var u = JSON.parse(localStorage.getItem('user') || 'null');
  if (!u) return;
  var el = document.getElementById('navAvatar');
  if (!el) return;
  if (u.photo) {
    var img = document.createElement('img');
    img.src = u.photo;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
    el.appendChild(img);
  } else {
    el.textContent = u.name[0].toUpperCase();
  }
}());
