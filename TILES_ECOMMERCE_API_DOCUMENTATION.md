# Tiles E-Commerce - API & Screen Analysis

## 📌 Project Context

**Project Name:** Tiles E-Commerce Backend API
**Type:** Backend-Only REST API
**Tech Stack:** Node.js, Express.js, MongoDB, Mongoose
**Backend Base:** Cloned Flipkart MERN backend (frontend removed)
**Purpose:** Complete REST API backend for tiles e-commerce business
**Database:** MongoDB Atlas (`mongodb+srv://rohan:***@cluster0.ecwot4i.mongodb.net/flipkart`)

### Project Structure
```
tiles-ecommerce-backend/
├── server.js                 # Entry point
├── package.json             # Backend dependencies only
├── backend/
│   ├── app.js              # Express app configuration
│   ├── config/             # Database & environment config
│   ├── controllers/        # Business logic
│   ├── models/             # MongoDB schemas
│   ├── routes/             # API routes
│   ├── middlewares/        # Auth, error handling
│   └── utils/              # Helper functions
└── TILES_ECOMMERCE_API_DOCUMENTATION.md
```

### Project Goals
- Provide complete REST API for tiles e-commerce frontend (mobile/web)
- Reuse existing Flipkart backend APIs for standard e-commerce features
- Extend backend with tiles-specific functionality (dimensions, materials, room types)
- Build missing features: Wishlist, Coupons, Multiple Addresses, Blogs, Settings
- Support admin dashboard operations (products, orders, users, inventory, analytics)

---

## Executive Summary
This document maps all required screens for a tiles e-commerce application against existing APIs and identifies what needs to be built.

**Use this document to provide context to Claude Code when:**
- Building new API endpoints
- Developing frontend screens
- Understanding what already exists vs what needs to be built
- Planning feature implementation phases

---

## 📊 Complete API Inventory

### 1. USER APIs (Authentication & Profile)

| API Endpoint | Method | Auth Required | Purpose | Status |
|-------------|--------|---------------|---------|--------|
| `/api/v1/register` | POST | No | User registration | ✅ EXISTS |
| `/api/v1/login` | POST | No | User login | ✅ EXISTS |
| `/api/v1/logout` | GET | Yes | User logout | ✅ EXISTS |
| `/api/v1/me` | GET | Yes | Get user profile | ✅ EXISTS |
| `/api/v1/me/update` | PUT | Yes | Update profile | ✅ EXISTS |
| `/api/v1/password/update` | PUT | Yes | Change password | ✅ EXISTS |
| `/api/v1/password/forgot` | POST | No | Forgot password | ✅ EXISTS |
| `/api/v1/password/reset/:token` | PUT | No | Reset password | ✅ EXISTS |

### 2. PRODUCT APIs (Tiles Catalog)

| API Endpoint | Method | Auth Required | Purpose | Status |
|-------------|--------|---------------|---------|--------|
| `/api/v1/products` | GET | No | Get all products (with filters, search, pagination) | ✅ EXISTS |
| `/api/v1/products/all` | GET | No | Get all products (for sliders) | ✅ EXISTS |
| `/api/v1/product/:id` | GET | No | Get single product details | ✅ EXISTS |
| `/api/v1/review` | PUT | Yes | Create/update product review | ✅ EXISTS |
| `/api/v1/admin/reviews` | GET | No | Get product reviews | ✅ EXISTS |

### 3. ORDER APIs (Checkout & Orders)

| API Endpoint | Method | Auth Required | Purpose | Status |
|-------------|--------|---------------|---------|--------|
| `/api/v1/order/new` | POST | Yes | Create new order | ✅ EXISTS |
| `/api/v1/orders/me` | GET | Yes | Get logged-in user orders | ✅ EXISTS |
| `/api/v1/order/:id` | GET | Yes | Get single order details | ✅ EXISTS |

### 4. PAYMENT APIs

| API Endpoint | Method | Auth Required | Purpose | Status |
|-------------|--------|---------------|---------|--------|
| `/api/v1/payment/process` | POST | No | Process payment (Paytm) | ✅ EXISTS |
| `/api/v1/callback` | POST | No | Payment callback | ✅ EXISTS |
| `/api/v1/payment/status/:id` | GET | Yes | Get payment status | ✅ EXISTS |
| `/api/v1/stripeapikey` | GET | Yes | Get Stripe API key | ⚠️ COMMENTED (needs activation) |

### 5. ADMIN - Product Management

| API Endpoint | Method | Auth Required | Purpose | Status |
|-------------|--------|---------------|---------|--------|
| `/api/v1/admin/products` | GET | Admin | Get all products | ✅ EXISTS |
| `/api/v1/admin/product/new` | POST | Admin | Create product | ✅ EXISTS |
| `/api/v1/admin/product/:id` | PUT | Admin | Update product | ✅ EXISTS |
| `/api/v1/admin/product/:id` | DELETE | Admin | Delete product | ✅ EXISTS |
| `/api/v1/admin/reviews` | DELETE | Admin | Delete review | ✅ EXISTS |

### 6. ADMIN - Order Management

| API Endpoint | Method | Auth Required | Purpose | Status |
|-------------|--------|---------------|---------|--------|
| `/api/v1/admin/orders` | GET | Admin | Get all orders + total revenue | ✅ EXISTS |
| `/api/v1/admin/order/:id` | PUT | Admin | Update order status | ✅ EXISTS |
| `/api/v1/admin/order/:id` | DELETE | Admin | Delete order | ✅ EXISTS |

### 7. ADMIN - User Management

| API Endpoint | Method | Auth Required | Purpose | Status |
|-------------|--------|---------------|---------|--------|
| `/api/v1/admin/users` | GET | Admin | Get all users | ✅ EXISTS |
| `/api/v1/admin/user/:id` | GET | Admin | Get single user | ✅ EXISTS |
| `/api/v1/admin/user/:id` | PUT | Admin | Update user role | ✅ EXISTS |
| `/api/v1/admin/user/:id` | DELETE | Admin | Delete user | ✅ EXISTS |

---

## 🎨 USER SCREENS & API MAPPING

### USER SIDE - Required Screens

| Screen | Sub-Pages/Features | Required APIs | Status |
|--------|-------------------|---------------|--------|
| **1. Homepage** | Hero section, Featured tiles, Categories, Offers | `/api/v1/products/all`, `/api/v1/products` (by category) | ✅ READY |
| **2. Product Listing** | All tiles, Filters (category, price, rating, room type, material, size) | `/api/v1/products` | ✅ READY |
| **3. Product Detail** | Images, specs, reviews, related products | `/api/v1/product/:id`, `/api/v1/products` | ✅ READY |
| **4. Search** | Search by name, category, material | `/api/v1/products?keyword=` | ✅ READY |
| **5. Category Page** | Browse by room type (bathroom, kitchen, floor, wall) | `/api/v1/products?category=` | ✅ READY |
| **6. Cart** | Add/remove items, update quantity | Client-side (localStorage/Redux) | ✅ FRONTEND ONLY |
| **7. Wishlist** | Save favorite tiles | ❌ **MISSING API** | ❌ NEEDS BUILD |
| **8. Checkout** | Shipping address, order summary | `/api/v1/order/new` | ✅ READY |
| **9. Payment** | Stripe/Paytm integration | `/api/v1/payment/process`, `/api/v1/payment/status/:id` | ✅ READY |
| **10. My Orders** | Order history, track orders | `/api/v1/orders/me`, `/api/v1/order/:id` | ✅ READY |
| **11. Order Detail** | Order tracking, invoice | `/api/v1/order/:id` | ✅ READY |
| **12. User Profile** | View/edit profile, change password | `/api/v1/me`, `/api/v1/me/update`, `/api/v1/password/update` | ✅ READY |
| **13. Auth Pages** | Login, Register, Forgot Password, Reset Password | `/api/v1/login`, `/api/v1/register`, `/api/v1/password/forgot`, `/api/v1/password/reset/:token` | ✅ READY |
| **14. Reviews** | Write/edit review | `/api/v1/review` | ✅ READY |

---

## 🛠️ ADMIN SCREENS & API MAPPING

### ADMIN DASHBOARD - Required Screens

| Screen | Features | Required APIs | Status |
|--------|----------|---------------|--------|
| **1. Dashboard** | Total sales, orders count, users count, products count, revenue chart, recent orders | `/api/v1/admin/orders`, `/api/v1/admin/users`, `/api/v1/admin/products` | ⚠️ PARTIAL (needs analytics endpoint) |
| **2. Products Management** | List all products, add/edit/delete, search, filters | `/api/v1/admin/products`, `/api/v1/admin/product/new`, `/api/v1/admin/product/:id` (PUT/DELETE) | ✅ READY |
| **3. Orders Management** | List orders, filter by status, update order status, view details, delete | `/api/v1/admin/orders`, `/api/v1/admin/order/:id` (PUT/DELETE), `/api/v1/order/:id` | ✅ READY |
| **4. Users Management** | List users, view/edit/delete user, change role | `/api/v1/admin/users`, `/api/v1/admin/user/:id` (GET/PUT/DELETE) | ✅ READY |
| **5. Reviews Management** | List reviews, delete reviews | `/api/v1/admin/reviews` (GET/DELETE) | ✅ READY |
| **6. Inventory Management** | Stock tracking, low stock alerts, bulk update | `/api/v1/admin/products` (with stock info) | ⚠️ PARTIAL (exists but no bulk update) |
| **7. Coupons Management** | Create/edit/delete coupons, discount codes | ❌ **MISSING API** | ❌ NEEDS BUILD |
| **8. Settings** | Site settings, payment config, email config, shipping rates | ❌ **MISSING API** | ❌ NEEDS BUILD |
| **9. Blogs Management** | Create/edit/delete blog posts | ❌ **MISSING API** | ❌ NEEDS BUILD |

---

## ❌ MISSING APIs - NEEDS TO BE BUILT

### High Priority

| Feature | Required Endpoints | Database Schema Needed | Complexity |
|---------|-------------------|----------------------|------------|
| **Wishlist** | `POST /api/v1/wishlist/add`<br>`DELETE /api/v1/wishlist/remove/:id`<br>`GET /api/v1/wishlist` | Wishlist Model (user, product references) | 🟢 Easy |
| **Coupons/Discounts** | `POST /api/v1/admin/coupon/new`<br>`GET /api/v1/admin/coupons`<br>`PUT /api/v1/admin/coupon/:id`<br>`DELETE /api/v1/admin/coupon/:id`<br>`POST /api/v1/coupon/validate` | Coupon Model (code, discount%, expiry, usage limit) | 🟡 Medium |
| **Dashboard Analytics** | `GET /api/v1/admin/dashboard/stats` (aggregated sales, orders, users count by date range) | No new model (aggregate existing data) | 🟡 Medium |
| **Address Management** | `POST /api/v1/address/new`<br>`GET /api/v1/addresses`<br>`PUT /api/v1/address/:id`<br>`DELETE /api/v1/address/:id` | Address Model (or add to User model as array) | 🟢 Easy |

### Medium Priority

| Feature | Required Endpoints | Database Schema Needed | Complexity |
|---------|-------------------|----------------------|------------|
| **Blogs** | `POST /api/v1/admin/blog/new`<br>`GET /api/v1/blogs`<br>`GET /api/v1/blog/:id`<br>`PUT /api/v1/admin/blog/:id`<br>`DELETE /api/v1/admin/blog/:id` | Blog Model (title, content, image, author, date) | 🟡 Medium |
| **Settings** | `GET /api/v1/admin/settings`<br>`PUT /api/v1/admin/settings` | Settings Model (single document, site config) | 🟢 Easy |
| **Bulk Product Operations** | `PUT /api/v1/admin/products/bulk-update`<br>`DELETE /api/v1/admin/products/bulk-delete` | No new model (batch operations) | 🟡 Medium |
| **Notifications** | `GET /api/v1/notifications`<br>`PUT /api/v1/notification/:id/read` | Notification Model (user, message, read status) | 🟡 Medium |

### Low Priority (Nice to Have)

| Feature | Required Endpoints | Database Schema Needed | Complexity |
|---------|-------------------|----------------------|------------|
| **Product Compare** | `POST /api/v1/compare/add`<br>`GET /api/v1/compare` | Client-side or Compare Model | 🟢 Easy |
| **Sample Request** | `POST /api/v1/sample/request` | SampleRequest Model | 🟢 Easy |
| **Newsletter** | `POST /api/v1/newsletter/subscribe` | Newsletter Model | 🟢 Easy |
| **FAQ** | `GET /api/v1/faqs`<br>`POST /api/v1/admin/faq/new` | FAQ Model | 🟢 Easy |

---

## 📦 TILES-SPECIFIC CUSTOMIZATIONS NEEDED

### Product Model Enhancement

**Current Product Model includes:**
- ✅ name, description, price, images, category, stock, brand, ratings, reviews

**NEEDS TO ADD (for tiles):**
- ❌ **dimensions** (e.g., "12x12", "24x24") → Add field: `size: { length: Number, width: Number, unit: String }`
- ❌ **material** (ceramic, porcelain, marble, vitrified) → Add field: `material: String`
- ❌ **roomType** (bathroom, kitchen, floor, wall) → Add field: `roomType: [String]`
- ❌ **finish** (glossy, matte, textured) → Add field: `finish: String`
- ❌ **thickness** → Add field: `thickness: Number`
- ❌ **coverage** (sq ft per box) → Add field: `coverage: Number`
- ❌ **tilesPerBox** → Add field: `tilesPerBox: Number`
- ❌ **bulkPricing** (price breaks for large orders) → Add field: `bulkPricing: [{ minQty: Number, price: Number }]`

---

## 📋 IMPLEMENTATION SUMMARY

### ✅ What Already Works (No Build Required)
- User authentication & profile management
- Product catalog with search, filters, pagination
- Product reviews & ratings
- Order creation & tracking
- Payment integration (Stripe/Paytm)
- Admin product/order/user/review management
- Basic inventory (stock tracking)

### ⚠️ What Needs Updates (Minor Modifications)
- Product model enhancement for tiles-specific fields
- Dashboard analytics aggregation endpoint
- Stripe API key endpoint (currently commented)

### ❌ What Needs Full Build (New Features)
1. **Wishlist** (High Priority) - Full CRUD
2. **Coupons** (High Priority) - Full CRUD + validation
3. **Multiple Addresses** (High Priority) - Full CRUD
4. **Blogs** (Medium Priority) - Full CRUD
5. **Settings** (Medium Priority) - Admin configuration panel
6. **Bulk Operations** (Medium Priority) - Batch product updates

---

## 🎯 RECOMMENDED BUILD PHASES

### Phase 1 (MVP - Core Tiles E-Commerce)
1. Enhance Product Model for tiles-specific fields
2. Build Wishlist API
3. Build Multiple Addresses API
4. Build Dashboard Analytics endpoint
5. Frontend integration

### Phase 2 (Customer Engagement)
1. Build Coupons/Discounts API
2. Build Notifications API
3. Build Sample Request API
4. Build Newsletter API

### Phase 3 (Content & Admin Tools)
1. Build Blogs API
2. Build Settings API
3. Build Bulk Operations
4. Build FAQ API

---

## 📊 FINAL COUNT

| Category | Count |
|----------|-------|
| **Total User Screens** | 14 |
| **Total Admin Screens** | 9 |
| **Total Existing APIs** | 32 |
| **APIs Needing Build** | 20-25 (depending on features) |
| **High Priority Missing** | 4 features (Wishlist, Coupons, Addresses, Analytics) |
| **Medium Priority Missing** | 4 features (Blogs, Settings, Bulk Ops, Notifications) |
| **Low Priority Missing** | 4 features (Compare, Sample, Newsletter, FAQ) |

---

## 🚀 NEXT STEPS

1. ✅ Review and approve this document
2. Prioritize which missing features to build first
3. Start with Product Model enhancement for tiles
4. Build high-priority APIs (Wishlist, Coupons, Addresses)
5. Develop frontend screens using existing + new APIs
6. Test end-to-end user flows

**Would you like me to start building any of these missing APIs?**
