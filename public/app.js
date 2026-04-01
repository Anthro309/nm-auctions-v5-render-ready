async function login() {
  const name = document.getElementById('name').value;
  const pin = document.getElementById('pin').value;

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin })
    });

    console.log("STATUS:", res.status);

    const data = await res.json();
    console.log("RESPONSE:", data);

    if (!data.success) {
      document.getElementById('error').innerText = "Invalid login";
      return;
    }

    alert("Welcome " + data.user.name);

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    document.getElementById('error').innerText = "Server error";
  }
}