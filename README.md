# Tiles E-Commerce Backend API

Complete REST API backend for tiles e-commerce platform built with Node.js, Express, and MongoDB.

## 🖥️ Tech Stack

![nodejs](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)&nbsp;
![expressjs](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)&nbsp;
![mongodb](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)&nbsp;
![jwt](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=white)&nbsp;

**Cloud Storage:** [Cloudinary](https://cloudinary.com/) (Optional)
**Payment Gateway:** Stripe/Paytm (Optional)
**Mail Service:** [Sendgrid](https://sendgrid.com/) (Optional)

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account
- npm or yarn

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment variables**
Edit `backend/config/config.env`:
```env
PORT=4000
MONGO_URI=mongodb+srv://rohan:<password>@cluster0.ecwot4i.mongodb.net/flipkart
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
COOKIE_EXPIRE=5
NODE_ENV=development
```

3. **Start the server**
```bash
# Production mode
npm start

# Development mode (with nodemon - requires nodemon installation)
npm run dev
```

4. **Test the API**
```bash
curl http://localhost:4000/
```

Server will be running at: `http://localhost:4000`

---

## 📚 API Documentation

See **[TILES_ECOMMERCE_API_DOCUMENTATION.md](./TILES_ECOMMERCE_API_DOCUMENTATION.md)** for complete API reference and feature mapping.

### Base URL
```
http://localhost:4000/api/v1
```

### Quick API Reference

#### Authentication
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /logout` - Logout user
- `POST /password/forgot` - Forgot password
- `PUT /password/reset/:token` - Reset password

#### Products
- `GET /products` - Get all products (with search, filters, pagination)
- `GET /product/:id` - Get product details
- `PUT /review` - Add/update product review

#### Orders
- `POST /order/new` - Create new order
- `GET /orders/me` - Get my orders
- `GET /order/:id` - Get order details

#### Admin - Products
- `GET /admin/products` - Get all products
- `POST /admin/product/new` - Create product
- `PUT /admin/product/:id` - Update product
- `DELETE /admin/product/:id` - Delete product

#### Admin - Orders
- `GET /admin/orders` - Get all orders
- `PUT /admin/order/:id` - Update order status
- `DELETE /admin/order/:id` - Delete order

#### Admin - Users
- `GET /admin/users` - Get all users
- `GET /admin/user/:id` - Get single user
- `PUT /admin/user/:id` - Update user role
- `DELETE /admin/user/:id` - Delete user

---

## 📁 Project Structure

```
tiles-ecommerce-backend/
├── server.js                 # Entry point
├── package.json             # Backend dependencies
├── backend/
│   ├── app.js              # Express app configuration
│   ├── config/
│   │   ├── config.env      # Environment variables
│   │   └── database.js     # MongoDB connection
│   ├── controllers/        # Business logic
│   │   ├── userController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   └── paymentController.js
│   ├── models/             # MongoDB schemas
│   │   ├── userModel.js
│   │   ├── productModel.js
│   │   ├── orderModel.js
│   │   └── paymentModel.js
│   ├── routes/             # API routes
│   │   ├── userRoute.js
│   │   ├── productRoute.js
│   │   ├── orderRoute.js
│   │   └── paymentRoute.js
│   ├── middlewares/        # Custom middleware
│   │   ├── auth.js         # JWT authentication
│   │   ├── error.js        # Error handler
│   │   └── asyncErrorHandler.js
│   └── utils/              # Helper functions
│       ├── sendToken.js
│       ├── sendEmail.js
│       └── searchFeatures.js
└── TILES_ECOMMERCE_API_DOCUMENTATION.md
```

---

## 🚀 Features

### ✅ Implemented Features

**User Account Management**
- 🚪 User registration and login with JWT authentication
- 🔐 Update profile information and password
- 📧 Password reset via email (with SendGrid)
- 👤 User profile management

**Product Management**
- 📦 Full product CRUD operations
- 🔍 Search products by name
- 🎛️ Filter by category, price range, ratings
- 📄 Pagination (12 products per page)
- ⭐ Product reviews and ratings
- 📸 Image upload via Cloudinary

**Order Management**
- 🛒 Create orders with shipping information
- 📊 View order history
- 🔍 Track order status
- ✉️ Order confirmation emails
- 📦 Auto-decrease stock on shipment

**Admin Dashboard**
- 📈 Dashboard with total orders, revenue, users
- 📝 Product management (add/update/delete)
- 👥 User management (view/update role/delete)
- 📜 Review management (view/delete)
- 📊 Order management (update status/delete)
- 💰 Revenue tracking

**Payment Integration**
- 💳 Stripe payment gateway (optional)
- 💰 Paytm payment gateway (optional)
- ✅ Payment status tracking

---

### 🚧 Coming Soon (Planned Features)

- ❤️ **Wishlist API** - Add/remove products to favorites
- 🎟️ **Coupons & Discounts** - Promo codes and discount management
- 📍 **Multiple Addresses** - Save and manage delivery addresses
- 📝 **Blogs Management** - Create and manage blog posts
- 📊 **Advanced Analytics** - Dashboard statistics and charts
- 🏠 **Tiles-Specific Features:**
  - Dimensions (12x12, 24x24, etc.)
  - Material types (ceramic, porcelain, marble)
  - Room types (bathroom, kitchen, floor, wall)
  - Finish types (glossy, matte, textured)
  - Bulk pricing for large orders
  - Coverage calculator

---

## 🔐 Authentication

API uses **JWT (JSON Web Token)** stored in **HTTP-only cookies** for authentication.

**Protected routes require:**
- Valid JWT token in cookie
- Appropriate user role (admin/user) for admin routes

**Sample Login Request:**
```bash
curl -X POST http://localhost:4000/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

---

## 📦 Database Models

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  gender: String,
  avatar: { public_id, url },
  role: String (default: "user"),
  createdAt: Date
}
```

### Product Model
```javascript
{
  name: String,
  description: String,
  price: Number,
  cuttedPrice: Number,
  images: [{ public_id, url }],
  brand: { name, logo: { public_id, url }},
  category: String,
  stock: Number,
  warranty: Number,
  ratings: Number,
  numOfReviews: Number,
  reviews: [{ user, name, rating, comment }],
  specifications: [{ title, description }],
  highlights: [String],
  user: ObjectId (ref: User),
  createdAt: Date
}
```

### Order Model
```javascript
{
  shippingInfo: { address, city, state, country, pincode, phoneNo },
  orderItems: [{ name, price, quantity, image, product }],
  user: ObjectId (ref: User),
  paymentInfo: { id, status },
  paidAt: Date,
  totalPrice: Number,
  orderStatus: String (default: "Processing"),
  deliveredAt: Date,
  shippedAt: Date,
  createdAt: Date
}
```

---

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 4000) |
| `MONGO_URI` | MongoDB connection string | **Yes** |
| `JWT_SECRET` | Secret for JWT signing | **Yes** |
| `JWT_EXPIRE` | JWT expiry time | No (default: 7d) |
| `COOKIE_EXPIRE` | Cookie expiry in days | No (default: 5) |
| `NODE_ENV` | Environment mode | No (development/production) |
| `CLOUDINARY_NAME` | Cloudinary cloud name | Optional |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Optional |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Optional |
| `STRIPE_API_KEY` | Stripe API key | Optional |
| `STRIPE_SECRET_KEY` | Stripe secret key | Optional |
| `SENDGRID_API_KEY` | SendGrid API key | Optional |
| `SENDGRID_MAIL` | SendGrid sender email | Optional |
| `PAYTM_MID` | Paytm Merchant ID | Optional |
| `PAYTM_MERCHANT_KEY` | Paytm Merchant Key | Optional |

---

## 🔧 Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
```

---

## 🧪 Testing the API

You can test the API using tools like:
- [Postman](https://www.postman.com/)
- [Insomnia](https://insomnia.rest/)
- curl commands
- Thunder Client (VS Code extension)

---

## 🐛 Known Issues / Limitations

- Email functionality requires SMTP/SendGrid configuration
- Cloudinary credentials needed for image uploads
- Payment gateway requires configuration for production use
- Frontend removed - this is backend-only API

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

ISC

---

## 👤 Author

**Rohan**

---

## 📞 Support

For detailed API documentation, feature mapping, and implementation guide:
📖 **[TILES_ECOMMERCE_API_DOCUMENTATION.md](../TILES_ECOMMERCE_API_DOCUMENTATION.md)**

---

## 🗺️ Development Roadmap & Phase Tracking

### Phase 1: Foundation & Core Integration (Week 1-2) ⚡
**Status:** 🟡 In Progress | **Time Estimate:** 2-3 weeks

#### 1.1 Environment Setup & Configuration (2 days)
- [x] Set up MongoDB connection (✅ Working)
- [x] Set up Cloudinary credentials (✅ Configured)
- [x] Configure environment variables (✅ Done)
- [ ] Create admin seeder script (first admin user)
- [ ] Test all environment connections

#### 1.2 Product Model Enhancement (2-3 days)
- [ ] Add tiles-specific fields to productModel.js
  - [ ] dimensions (length, width, unit)
  - [ ] material (ceramic, porcelain, marble, etc.)
  - [ ] roomType (bathroom, kitchen, floor, wall, outdoor)
  - [ ] finish (glossy, matte, textured, polished, anti-skid)
  - [ ] thickness, coverage, tilesPerBox, weight
  - [ ] color (for filtering)
  - [ ] waterAbsorption, slipResistance
  - [ ] bulkPricing array
- [ ] Update productController to handle new fields
- [ ] Update product routes
- [ ] Test with Postman

#### 1.3 Authentication Integration (2-3 days)
- [x] Backend auth APIs working (✅ Login, Register, Logout)
- [x] Fixed avatar upload (now optional) (✅ Done)
- [ ] Connect frontend auth pages to backend APIs
- [ ] Set up JWT token storage (cookies/localStorage)
- [ ] Add auth middleware to frontend API calls
- [ ] Test complete login/register/logout flow

#### 1.4 Build Wishlist API (2-3 days)
- [ ] Create wishlistModel.js
- [ ] Create wishlistController.js
  - [ ] POST /api/v1/wishlist/add
  - [ ] DELETE /api/v1/wishlist/remove/:id
  - [ ] GET /api/v1/wishlist
- [ ] Create wishlistRoute.js
- [ ] Integrate with frontend wishlist page
- [ ] Test all wishlist operations

#### 1.5 Frontend-Backend Integration (3-4 days)
- [ ] Set up frontend .env.local with API URL
- [ ] Connect product listing page
- [ ] Connect product detail page
- [ ] Connect search functionality
- [ ] Connect category pages
- [ ] Test all user flows end-to-end

---

### Phase 2: Admin Dashboard & Product Management (Week 3-4)
**Status:** ⚪ Pending | **Time Estimate:** 1.5-2 weeks

#### 2.1 Admin Authentication & Seeder (1 day)
- [ ] Admin role verification middleware
- [ ] Admin seeder script (create first admin)
- [ ] Admin login flow testing
- [ ] Admin dashboard access control

#### 2.2 Product Image Upload - Cloudinary (2-3 days)
- [x] Cloudinary configured in backend (✅ Done)
- [ ] Integrate Cloudinary upload in product controller
- [ ] Connect frontend product form to upload API
- [ ] Handle multiple images upload
- [ ] Handle variant images
- [ ] Test image upload/delete/update

#### 2.3 Dashboard Analytics API (2 days)
- [ ] Create analytics endpoint `/api/v1/admin/dashboard/stats`
- [ ] Aggregate sales data
- [ ] Aggregate orders count
- [ ] Aggregate users count
- [ ] Aggregate revenue by date range
- [ ] Connect to frontend dashboard

#### 2.4 Admin Product/Order/User Management (3-4 days)
- [x] Backend APIs exist (✅ Products, Orders, Users CRUD)
- [ ] Connect products management page
- [ ] Connect orders management page
- [ ] Connect customers page
- [ ] Test all CRUD operations
- [ ] Test bulk operations

---

### Phase 3: Additional Features (Week 5-6)
**Status:** ⚪ Pending | **Time Estimate:** 1.5-2 weeks

#### 3.1 Multiple Addresses API (2-3 days)
- [ ] Create addressModel or extend User model
- [ ] CRUD operations for addresses
  - [ ] POST /api/v1/address/new
  - [ ] GET /api/v1/addresses
  - [ ] PUT /api/v1/address/:id
  - [ ] DELETE /api/v1/address/:id
- [ ] Integrate with checkout flow
- [ ] Test address management

#### 3.2 Coupons/Discounts API (3-4 days)
- [ ] Create couponModel
- [ ] Create coupon CRUD APIs
  - [ ] POST /api/v1/admin/coupon/new
  - [ ] GET /api/v1/admin/coupons
  - [ ] PUT /api/v1/admin/coupon/:id
  - [ ] DELETE /api/v1/admin/coupon/:id
- [ ] Create coupon validation API
  - [ ] POST /api/v1/coupon/validate
- [ ] Integrate with frontend coupons page
- [ ] Apply coupons at checkout
- [ ] Test coupon logic

#### 3.3 Order Management Enhancement (2 days)
- [x] Update order status API exists (✅ Done)
- [ ] Order tracking frontend
- [ ] Email notifications (optional - SendGrid)
- [ ] Order status history
- [ ] Test order flow

---

### Phase 4: Content & Polish (Week 7)
**Status:** ⚪ Pending | **Time Estimate:** 1 week

#### 4.1 Blogs API (2-3 days)
- [ ] Create blogModel
- [ ] Create blog CRUD APIs
  - [ ] POST /api/v1/admin/blog/new
  - [ ] GET /api/v1/blogs
  - [ ] GET /api/v1/blog/:id
  - [ ] PUT /api/v1/admin/blog/:id
  - [ ] DELETE /api/v1/admin/blog/:id
- [ ] Integrate with frontend blogs page
- [ ] Test blog operations

#### 4.2 Settings API (1-2 days)
- [ ] Create settingsModel
- [ ] Create settings CRUD APIs
  - [ ] GET /api/v1/admin/settings
  - [ ] PUT /api/v1/admin/settings
- [ ] Integrate with frontend settings page
- [ ] Test settings management

#### 4.3 Testing & Bug Fixes (2-3 days)
- [ ] End-to-end testing all features
- [ ] Fix bugs and edge cases
- [ ] Performance optimization
- [ ] Security audit
- [ ] Code cleanup

---

### Phase 5: Deployment (Week 8)
**Status:** ⚪ Pending | **Time Estimate:** 3-5 days

#### 5.1 Backend Deployment (1-2 days)
- [ ] Deploy to Vercel serverless functions
- [ ] Configure production environment variables
- [ ] Test production API endpoints
- [ ] Set up CORS for frontend
- [ ] Configure MongoDB Atlas for production

#### 5.2 Frontend Deployment (1 day)
- [ ] Deploy to Vercel
- [ ] Configure production environment variables
- [ ] Connect to production backend
- [ ] Test production frontend

#### 5.3 Final Testing & Launch (1-2 days)
- [ ] Test all features in production
- [ ] Fix any deployment issues
- [ ] Performance monitoring setup
- [ ] Launch! 🚀

---

## ⏱️ Overall Progress

| Phase | Status | Tasks Completed | Total Tasks | Progress |
|-------|--------|-----------------|-------------|----------|
| **Phase 1** | 🟡 In Progress | 4 | 25 | 16% |
| **Phase 2** | ⚪ Pending | 1 | 15 | 7% |
| **Phase 3** | ⚪ Pending | 1 | 15 | 7% |
| **Phase 4** | ⚪ Pending | 0 | 10 | 0% |
| **Phase 5** | ⚪ Pending | 0 | 10 | 0% |
| **TOTAL** | 🟡 In Progress | **6** | **75** | **8%** |

**Estimated Completion:** 6-8 weeks (full-time) | 8-10 weeks (part-time)

**Last Updated:** 2026-01-29

---

## 📝 Recent Changes

### 2026-01-29
- [x] Fixed user registration - avatar upload now optional
- [x] Fixed user profile update - avatar handling improved
- [x] Created Postman collection for API testing
- [x] Created Postman testing guide
- [x] Added development roadmap with phase tracking
- [x] Updated README with comprehensive documentation

### 2026-01-28
- [x] Updated Product Model documentation with tiles-specific fields
- [x] Created comprehensive API documentation
- [x] Set up Cloudinary configuration
- [x] Configured MongoDB connection

---

## 🙏 Credits

Backend base cloned from [Flipkart MERN](https://github.com/jigar-sable) project and customized for tiles e-commerce.
