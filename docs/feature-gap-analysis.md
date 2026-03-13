# Feature Gap Analysis — POS App vs. Market
> Last updated: 2026-03-13 (revised after Polish Sprint + Auto Reorder implementation)

## Benchmark: Major POS Platforms
Square, Shopify POS, Toast, Lightspeed, Clover

---

## ✅ Implemented

| Feature | Notes |
|---|---|
| Multi-outlet inventory + transfers | WarehouseItem, StockTransfer, StockAdjustment, StockOpname |
| Purchase orders | Full lifecycle: draft → ordered → partial → received |
| Auto reorder / PO suggestions | Per-outlet deficit view, convert to draft PO in one click |
| Item → supplier link | `preferred_supplier_id` on items, shown in item detail + edit |
| Audit log | 16 event types, admin-only page with date/category/user filters |
| Role-based permissions | Role-level + user-level overrides, per-module (view/write/delete) |
| Reports (7 types) | Sales, Stock, ABC, Cashflow, Peak Hours, Branch Comparison, P&L |
| Excel export | All 7 report types |
| Promotions / discounts | Applied at POS terminal |
| Return handling | ReturnHeader + ReturnItem, void support |
| Dashboard KPIs | Revenue sparkline, top products today, stock alerts, recent transactions |
| Item detail page | Stock by outlet, recent sales history, preferred supplier |
| Customer model + basic CRUD | `Customer` linked to `SaleHeader`, list page exists |
| Supplier management | Full CRUD |
| Tags on items | Color-coded, filterable in item list |
| Flash messages (global) | Auto-dismiss toast on every authenticated page |
| Button loading spinner | `loading` prop on Button component |
| Per-branch revenue cards | Admin dashboard shows sales per outlet |

---

## 🔴 High Priority Gaps
> Used by all top POS platforms — expected by users

| Feature | Why It Matters | Complexity | Notes |
|---|---|---|---|
| **Customer purchase history** | Full profile, retention insights | Low | Model + SaleHeader link exists — just needs Show page |
| **Shift / cash drawer management** | Cashier accountability, daily reconciliation | Medium | Nothing built yet |
| **Expense tracking** | True P&L = revenue - COGS - expenses | Low | Nothing built yet |
| **Loyalty / points system** | Drives repeat business | Medium | Needs customer history page first |
| **Offline POS mode** | Sales continue when internet drops | High | Service workers + IndexedDB |

---

## 🟡 Medium Priority Gaps
> Differentiators that increase competitive value

| Feature | Notes | Complexity |
|---|---|---|
| **Staff scheduling / roster** | Shift assignment, clock-in/out | Medium |
| **Customer segmentation** | Filter by spend tier, last visit, frequency | Medium |
| **Delivery platform integration** | GrabFood, GoFood API hooks | High |
| **E-commerce stock sync** | Tokopedia / Shopee inventory sync | High |
| **Kitchen Display System (KDS)** | F&B only — order routing to kitchen screens | Medium |
| **Table management** | F&B only — floor plan, table status | Medium |

---

## 🟢 Low Priority / Nice-to-have

| Feature | Notes |
|---|---|
| Multi-tenant SaaS | Planned (A2 milestone) |
| Accounting export (Xero/QuickBooks) | CSV/Excel export covers most SME needs |
| Hardware: cash drawer open signal | Receipt printer already integrated |
| Fingerprint / PIN login at terminal | Device-level concern |
| Social selling (Instagram/Facebook) | Out of scope for retail focus |

---

## Recommended Build Order

```
A1 — Next Batch (feature parity):
  1. Customer purchase history  ← easiest win, model + FK already exist
  2. Expense tracking           ← completes P&L picture, low effort
  3. Shift / cash management    ← cashier trust layer
  4. Loyalty points             ← after customer profile is solid

A2 — SaaS + Growth:
  5. Multi-tenant SaaS
  6. Offline POS mode
  7. Staff scheduling
  8. KDS (if targeting F&B clients)
  9. Delivery platform integration
```

---

## Key Observations from Market Research

1. **Multi-location** is table stakes — all major systems handle it centrally
2. **Real-time inventory sync** across outlets is a must-have
3. **Unified customer data** across locations is a differentiator
4. **Integration ecosystem** (accounting, delivery, e-commerce) drives stickiness
5. **Analytics** are increasingly comparative — location vs. location, period vs. period
6. **Offline resilience** is expected — Square queues payments offline automatically
7. **Loyalty** is bundled by default in Clover, Square, Shopify POS
8. **Staff management** (scheduling, payroll hooks, roles) is standard across all platforms
