# Ideal Next Features for NM Auctions (Workflow + Inventory Only)

> Scope note: this roadmap excludes auction-site integrations and post-sale functionality.

## 1) Real authentication sessions (JWT/cookie) + route protection
**Why:** Current workflows rely heavily on client-reported identity. Session-backed auth would secure admin actions, audit trails, and employee accountability.

## 2) Role-based permissions matrix
**Why:** Define explicit rights for admin, intake, photography, and fulfillment. Prevent accidental destructive actions and reduce training burden.

## 3) Barcode/QR bulk intake mode
**Why:** Let staff scan many pieces rapidly, then backfill details in queue form. This reduces bottlenecks at drop-off.

## 4) Photo quality gate with auto-checks
**Why:** Detect blur, low light, missing angles, and background clutter before accepting an item photo. Improves listing quality and sell-through.

## 5) Required-photo-angle checklist by category
**Why:** Furniture, jewelry, and electronics need different angle sets. Enforced checklists reduce incomplete listings.

## 6) Auction event packing/pick-list workflow
**Why:** Generate pick lists by location and event. Mark packed/loaded status to reduce day-of-event mistakes.

## 7) Automated consigner intake notifications
**Why:** Send intake confirmations and pickup/drop-off readiness updates only for internal workflow coordination.

## 8) Internal handoff and exception queue
**Why:** Centralize blocked items (missing at drop-off, repair-needed, unclear ownership) for fast resolution.

## 9) Saved views + advanced filters
**Why:** Teams can save common filter sets (e.g., "Needs Repair + Photograph stage") for faster daily execution.

## 10) Data backup/version snapshots
**Why:** Automatic daily backups and restore points are essential while using file-based storage.

## 11) Duplicate/related item clustering
**Why:** Group matching sets and near-duplicates from AI tags/photos to prevent split listings and improve lot strategy.

## 12) KPI dashboard by stage SLA
**Why:** Track average time in each stage, stuck items, and employee throughput trends to improve operations.

---

## Suggested implementation order (high impact first)
1. Auth sessions + RBAC
2. Internal handoff + exception queue
3. Backup/version snapshots
4. Photo quality gate + angle checklist
5. Event pick-list workflow
6. Consigner intake notifications
7. Saved views / SLA dashboards
