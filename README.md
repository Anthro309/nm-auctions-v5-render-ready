# NM Auctions V5

Internal inventory and workflow management system for NM Auctions.

This system is designed for a fast-moving auction floor environment where items move through multiple stages from drop-off to customer pickup.

Built for tablets first, with a clean desktop fallback.

---

## 🚀 Features

### 🔐 Employee Login
- Name + 4-digit PIN
- Role-based access (admin / user)
- Default PIN: `1234` (should be changed on first login)

---

### 📦 Item Workflow Tracking

Items move through defined stages:

1. Drop Off  
2. Back of House  
3. Review & Cleaning  
4. Photograph  
5. Prepare for Pickup  
6. Picked Up  

Each movement:
- Logs time and date
- Tracks responsible employee
- Can require confirmation before advancing

---

### 🏷️ QR Code System

- Each item is assigned a unique QR code
- QR scanning allows:
  - Quick lookup
  - Fast stage updates
  - Viewing all items for a consigner

---

### 🧾 Consigner Labeling

Consigner codes are generated using:
- First 3 letters of first name
- First 3 letters of last name

Example: