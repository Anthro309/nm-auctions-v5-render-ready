async function login() {
  const name = document.getElementById('name').value;
  const pin = document.getElementById('pin').value;

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

  alert("Welcome " + data.user.name);
}