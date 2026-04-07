<script>
const user = JSON.parse(localStorage.getItem('user') || 'null');

let consignerCode = null;
let consignerName = '';

const firstInput = document.getElementById('first');
const lastInput = document.getElementById('last');
const itemNameInput = document.getElementById('itemName');
const photoInput = document.getElementById('photoInput');
const preview = document.getElementById('preview');
const codeDisplay = document.getElementById('codeDisplay');
const itemsContainer = document.getElementById('items');

// =========================
// GLOBAL NAV (ALL PAGES)
// =========================
function goHome() {
  console.log("🏠 Going to dashboard");
  window.location.href = "/dashboard.html";
}

function logout() {
  console.log("🚪 Logging out");
  localStorage.removeItem("user");
  window.location.href = "/";
}

function toggleMenu() {
  alert("Menu coming soon");
}

// Make header clickable automatically
document.addEventListener("DOMContentLoaded", () => {
  const navCenter = document.querySelector(".nav-center");
  if (navCenter) {
    navCenter.onclick = goHome;
  }
});

// =========================
// CAMERA
// =========================
function openCamera() {
  console.log("📷 Opening camera");
  photoInput.click();
}

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  console.log("📸 File selected:", file);

  if (!file) {
    preview.style.display = 'none';
    preview.src = '';
    return;
  }

  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
});

// =========================
// START VISIT
// =========================
function startVisit() {
  const f = firstInput.value.trim().toUpperCase();
  const l = lastInput.value.trim().toUpperCase();

  if (!f || !l) {
    alert('Enter first and last name');
    return;
  }

  consignerCode = f.slice(0, 3) + l.slice(0, 3);
  consignerName = `${firstInput.value.trim()} ${lastInput.value.trim()}`;

  console.log("👤 Consigner started:", consignerCode);

  codeDisplay.innerText = `Consigner Code: ${consignerCode}`;
  loadItems();
}

// =========================
// ADD ITEM (FULL FIXED)
// =========================
async function addItem() {
  console.log("➕ Adding item...");

  if (!consignerCode) {
    alert("Start visit first");
    return;
  }

  const name = itemNameInput.value.trim();
  if (!name) {
    alert("Enter item name");
    return;
  }

  let photoPath = null;

  try {
    if (photoInput.files[0]) {
      console.log("📤 Uploading photo...");

      const form = new FormData();
      form.append("photo", photoInput.files[0]);

      const uploadRes = await fetch("/upload", {
        method: "POST",
        body: form
      });

      const uploadData = await uploadRes.json();
      console.log("📦 Upload response:", uploadData);

      if (uploadData.success && uploadData.path) {
        photoPath = uploadData.path;
      } else {
        alert("Photo upload failed");
        return;
      }
    }

    const itemsRes = await fetch("/items");
    const existingItems = await itemsRes.json();

    const nextNumber =
      existingItems.filter(i => i.code === consignerCode).length + 1;

    console.log("🔢 Next item number:", nextNumber);

    const createRes = await fetch("/items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        consigner: consignerName,
        code: consignerCode,
        number: nextNumber,
        photos: photoPath ? [photoPath] : [],
        employee: user?.name || "system"
      })
    });

    const created = await createRes.json();
    console.log("✅ Item created:", created);

    // RESET FORM
    itemNameInput.value = "";
    photoInput.value = "";
    preview.src = "";
    preview.style.display = "none";

    await loadItems();

  } catch (err) {
    console.error("❌ Add item error:", err);
    alert("Something broke while adding item");
  }
}

// =========================
// LOAD ITEMS (WITH IMAGE FIX)
// =========================
async function loadItems() {
  if (!consignerCode) return;

  console.log("📦 Loading items...");

  const res = await fetch('/items');
  const all = await res.json();

  const list = all.filter(i => i.code === consignerCode);

  itemsContainer.innerHTML = '';

  if (!list.length) {
    itemsContainer.innerHTML = `<div style="color:#888;">No items yet</div>`;
    return;
  }

  for (const item of list) {
    const card = document.createElement("div");
    card.className = "item-card";

    const qrId = "qr_" + item.id;

    const imgSrc =
      item.photos && item.photos[0]
        ? item.photos[0]
        : null;

    console.log("🖼 Image path:", imgSrc);

    card.innerHTML = `
      <canvas id="${qrId}" class="item-qr"></canvas>

      ${
        imgSrc
          ? `<img src="${imgSrc}" class="item-img">`
          : `<div class="item-img" style="display:flex;align-items:center;justify-content:center;">No Image</div>`
      }

      <div class="item-meta">
        <div class="item-code">${item.code}-${item.number}</div>
        <div class="item-name">${item.name}</div>
      </div>
    `;

    itemsContainer.appendChild(card);

    try {
      await QRCode.toCanvas(
        document.getElementById(qrId),
        `${item.code}-${item.number}`,
        { width: 74 }
      );
    } catch (err) {
      console.error("QR error:", err);
    }
  }
}

// =========================
// PRINT LABELS
// =========================
async function printLabelsOnly() {
  if (!consignerCode) {
    alert("Start visit first");
    return;
  }

  const res = await fetch('/items');
  const all = await res.json();
  const items = all.filter(i => i.code === consignerCode);

  console.log("🖨 Printing labels:", items);

  const win = window.open('', '', 'width=800,height=1000');

  win.document.write(`
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"><\/script>
    </head>
    <body>
      ${items.map(i => `
        <div style="margin-bottom:20px;">
          <canvas id="qr${i.id}"></canvas>
          <div>${i.name}</div>
        </div>
      `).join("")}

      <script>
        const items = ${JSON.stringify(items)};
        items.forEach(i => {
          QRCode.toCanvas(
            document.getElementById("qr" + i.id),
            i.code + "-" + i.number
          );
        });

        setTimeout(() => window.print(), 500);
      <\/script>
    </body>
    </html>
  `);

  win.document.close();
}

// =========================
// END VISIT
// =========================
async function endVisitAndPrint() {
  if (!consignerCode) {
    alert("Start visit first");
    return;
  }

  const res = await fetch('/items');
  const all = await res.json();
  const items = all.filter(i => i.code === consignerCode);

  await fetch('/intake', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: consignerCode,
      consigner: consignerName,
      items
    })
  });

  console.log("📄 Intake saved");

  printLabelsOnly();
}
</script>