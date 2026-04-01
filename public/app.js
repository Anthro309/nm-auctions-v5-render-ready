async function login() {
  const name = document.getElementById('name').value;
  const pin = document.getElementById('pin').value;

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin })
    });

    const data = await res.json();

    if (!data.success) {
      document.getElementById('error').innerText = "Invalid login";
      return;
    }

    // 💾 Save user
    localStorage.setItem('user', JSON.stringify(data.user));

    // 🚪 Go to dashboard
    window.location.href = "/dashboard.html";

  } catch (err) {
    console.error(err);
    document.getElementById('error').innerText = "Server error";
  }
}