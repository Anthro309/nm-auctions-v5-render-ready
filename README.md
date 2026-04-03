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

---

### 📸 Photography Stage

- Items marked as photographed
- Stores:
  - Dimensions
  - Description
  - Notes
- Supports multi-part lots (1/2, 2/2, etc.)

---

### 📊 Daily Lot Report

At the end of each day:
- Generate a report of all photographed items
- Ordered by time photographed (NOT lot order)
- Designed for printing
- Used for auction upload workflow

---

### 🧠 Admin Features

- Add/remove employees
- View workflow metrics (future)
- Control permissions
- Prevent deletion after intake is finalized

---

## 🏗️ Tech Stack

- Node.js
- Express
- JSON file storage (users, items, reports)
- Vanilla JS frontend
- QR Code library

---

## 📁 Project Structure