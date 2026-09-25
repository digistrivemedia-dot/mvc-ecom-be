# 🧪 Postman API Testing Guide

Complete guide for testing the Tiles E-Commerce Backend APIs using Postman.

---

## 📥 Setup Instructions

### 1. Start the Backend Server
```bash
cd backend
npm install
npm start
```

Server should start at: `http://localhost:4000`

### 2. Import Postman Collection

**Option A: Import File**
1. Open Postman
2. Click **Import** button (top left)
3. Select `Tiles_Ecommerce_API.postman_collection.json`
4. Click **Import**

**Option B: Import via Raw Text**
1. Copy the entire content of `Tiles_Ecommerce_API.postman_collection.json`
2. In Postman, click **Import** → **Raw text**
3. Paste and import

### 3. Create Postman Environment (Optional but Recommended)

1. Click on **Environments** (left sidebar)
2. Click **+** to create new environment
3. Name it: `Tiles Ecommerce Local`
4. Add variables:
   - `base_url` = `http://localhost:4000`
   - `auth_token` = (leave empty, will be auto-filled)
5. Save and **Select** this environment from dropdown (top right)

---

## 🧪 Testing Flow (Step-by-Step)

### Phase 1: User Authentication ✅

#### Test 1: Register New User
```
POST {{base_url}}/api/v1/register

Body:
{
    "name": "Test User",
    "email": "test@example.com",
    "gender": "male",
    "password": "test12345678"
}
```

**Expected Response:**
```json
{
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
        "_id": "...",
        "name": "Test User",
        "email": "test@example.com",
        "role": "user"
    }
}
```

✅ **Auto-saves token to environment variable `auth_token`**

---

#### Test 2: Login User
```
POST {{base_url}}/api/v1/login

Body:
{
    "email": "test@example.com",
    "password": "test12345678"
}
```

**Expected Response:** Same as register (returns token)

---

#### Test 3: Get User Profile
```
GET {{base_url}}/api/v1/me
Authorization: Bearer {{auth_token}}
```

**Expected Response:**
```json
{
    "success": true,
    "user": {
        "_id": "...",
        "name": "Test User",
        "email": "test@example.com",
        "role": "user",
        "createdAt": "..."
    }
}
```

---

### Phase 2: Product APIs (Public) ✅

#### Test 4: Get All Products
```
GET {{base_url}}/api/v1/products
```

**With Filters:**
```
GET {{base_url}}/api/v1/products?keyword=marble&category=floor&price[gte]=1000&price[lte]=5000&ratings[gte]=4
```

**Expected Response:**
```json
{
    "success": true,
    "products": [...],
    "productsCount": 10,
    "resultPerPage": 8,
    "filteredProductsCount": 5
}
```

---

#### Test 5: Get Single Product
```
GET {{base_url}}/api/v1/product/:id
```

Replace `:id` with actual product ID from previous response.

---

### Phase 3: Admin - Create First Admin User 🔐

**Important:** By default, all new users have `role: "user"`. To test admin APIs, you need to manually create an admin user in MongoDB.

#### Option 1: Using MongoDB Compass/Atlas
1. Connect to your MongoDB database
2. Open `users` collection
3. Find your user document
4. Update `role` field from `"user"` to `"admin"`
5. Save

#### Option 2: Using MongoDB Shell
```javascript
use flipkart
db.users.updateOne(
  { email: "test@example.com" },
  { $set: { role: "admin" } }
)
```

#### Option 3: Create Admin Seeder Script (Recommended - I can build this!)
I'll create a script: `backend/scripts/createAdmin.js`

---

### Phase 4: Admin - Product Management 🛠️

After setting user role to "admin", login again to get new token with admin privileges.

#### Test 6: Create Product (Admin)
```
POST {{base_url}}/api/v1/admin/product/new
Authorization: Bearer {{auth_token}}

Body:
{
    "name": "Premium Marble Tiles",
    "description": "High-quality marble look tiles",
    "highlights": ["Premium quality", "Scratch resistant"],
    "specifications": [
        {
            "title": "Size",
            "description": "24x24 inches"
        },
        {
            "title": "Material",
            "description": "Porcelain"
        }
    ],
    "price": 1500,
    "cuttedPrice": 2000,
    "images": [
        {
            "public_id": "sample_id",
            "url": "https://via.placeholder.com/500"
        }
    ],
    "brand": {
        "name": "TileMaster",
        "logo": {
            "public_id": "logo_id",
            "url": "https://via.placeholder.com/150"
        }
    },
    "category": "floor",
    "stock": 100,
    "warranty": 10
}
```

**Expected Response:**
```json
{
    "success": true,
    "product": {
        "_id": "...",
        "name": "Premium Marble Tiles",
        "price": 1500,
        ...
    }
}
```

**Save the product `_id` for next tests!**

---

#### Test 7: Get All Products (Admin)
```
GET {{base_url}}/api/v1/admin/products
Authorization: Bearer {{auth_token}}
```

Returns all products without pagination.

---

#### Test 8: Update Product (Admin)
```
PUT {{base_url}}/api/v1/admin/product/:id
Authorization: Bearer {{auth_token}}

Body:
{
    "price": 1800,
    "stock": 80
}
```

---

#### Test 9: Delete Product (Admin)
```
DELETE {{base_url}}/api/v1/admin/product/:id
Authorization: Bearer {{auth_token}}
```

---

### Phase 5: Orders 📦

#### Test 10: Create Order
```
POST {{base_url}}/api/v1/order/new
Authorization: Bearer {{auth_token}}

Body:
{
    "shippingInfo": {
        "address": "123 Main Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "pincode": 400001,
        "phoneNo": 9876543210
    },
    "orderItems": [
        {
            "name": "Premium Marble Tiles",
            "price": 1500,
            "quantity": 10,
            "image": "https://via.placeholder.com/150",
            "product": "product_id_here"
        }
    ],
    "paymentInfo": {
        "id": "payment_123",
        "status": "succeeded"
    },
    "itemsPrice": 15000,
    "taxPrice": 2700,
    "shippingPrice": 500,
    "totalPrice": 18200
}
```

**Save order `_id` for next tests!**

---

#### Test 11: Get My Orders
```
GET {{base_url}}/api/v1/orders/me
Authorization: Bearer {{auth_token}}
```

---

#### Test 12: Get Single Order
```
GET {{base_url}}/api/v1/order/:id
Authorization: Bearer {{auth_token}}
```

---

### Phase 6: Admin - Order Management 📊

#### Test 13: Get All Orders (Admin)
```
GET {{base_url}}/api/v1/admin/orders
Authorization: Bearer {{auth_token}}
```

Returns all orders + total revenue calculation.

---

#### Test 14: Update Order Status (Admin)
```
PUT {{base_url}}/api/v1/admin/order/:id
Authorization: Bearer {{auth_token}}

Body:
{
    "status": "Shipped"
}
```

**Status options:**
- `"Processing"`
- `"Shipped"`
- `"Delivered"`

---

### Phase 7: Reviews ⭐

#### Test 15: Create/Update Review
```
PUT {{base_url}}/api/v1/review
Authorization: Bearer {{auth_token}}

Body:
{
    "productId": "product_id_here",
    "rating": 5,
    "comment": "Excellent tiles! Great quality."
}
```

---

#### Test 16: Get Product Reviews
```
GET {{base_url}}/api/v1/admin/reviews?productId=product_id_here
```

No auth required.

---

### Phase 8: Admin - User Management 👥

#### Test 17: Get All Users (Admin)
```
GET {{base_url}}/api/v1/admin/users
Authorization: Bearer {{auth_token}}
```

---

#### Test 18: Update User Role (Admin)
```
PUT {{base_url}}/api/v1/admin/user/:id
Authorization: Bearer {{auth_token}}

Body:
{
    "role": "admin"
}
```

---

## 📝 Important Notes

### Authentication
- **JWT Token** is stored in cookies AND returned in response
- Postman collection auto-saves token to `{{auth_token}}` variable
- Token expires in 7 days (configured in JWT_EXPIRE)
- All protected routes need `Authorization: Bearer {{auth_token}}`

### Admin Access
- Admin routes require `role: "admin"` in user document
- Create admin user manually in database OR use seeder script
- Admin can manage products, orders, users, reviews

### Cart Management
**Note:** The backend does NOT have cart APIs. Cart is managed client-side (localStorage/Redux) in frontend.

**Cart flow:**
1. User adds products to cart (frontend localStorage)
2. User proceeds to checkout
3. Frontend sends order creation request with cart items
4. Backend creates order

### Payment Integration
- Payment APIs exist but are **skipped for MVP**
- To test orders, use dummy payment info:
  ```json
  "paymentInfo": {
      "id": "test_payment_123",
      "status": "succeeded"
  }
  ```

---

## 🐛 Common Issues & Solutions

### Issue 1: "User is not authenticated"
**Solution:** Make sure you're logged in and token is set. Check `{{auth_token}}` variable.

### Issue 2: "User is not authorized"
**Solution:** You're trying to access admin route with regular user. Update user role to "admin" in database.

### Issue 3: "Product not found"
**Solution:** Create a product first using admin create product API, then use that product ID.

### Issue 4: "Cast to ObjectId failed"
**Solution:** You're using invalid MongoDB ObjectId. Use valid 24-character hex string.

### Issue 5: "Token is not valid"
**Solution:** Token expired or invalid. Login again to get new token.

---

## ✅ Testing Checklist

### Basic Flow
- [ ] API Health Check works
- [ ] User registration works
- [ ] User login works and returns token
- [ ] Get user profile works with token
- [ ] Get all products works (no auth)
- [ ] Get single product works

### Admin Flow
- [ ] Create admin user in database
- [ ] Login as admin
- [ ] Create new product
- [ ] Get all products (admin)
- [ ] Update product
- [ ] Delete product
- [ ] Get all users
- [ ] Update user role

### Order Flow
- [ ] Create order with valid product
- [ ] Get my orders
- [ ] Get single order details
- [ ] Admin can see all orders
- [ ] Admin can update order status

### Review Flow
- [ ] User can create review
- [ ] Get product reviews
- [ ] Admin can delete review

---

## 🚀 Next Steps

After confirming all APIs work:
1. ✅ APIs are working correctly
2. 🔨 Create admin seeder script for easy admin creation
3. 🔨 Update Product Model with tiles-specific fields
4. 🔨 Build Wishlist API
5. 🔨 Integrate frontend with backend

---

## 📞 Need Help?

If any API fails:
1. Check backend server console for errors
2. Check MongoDB connection is working
3. Verify environment variables in `backend/config/config.env`
4. Check if request body matches expected format
5. Verify authentication token is valid

**Happy Testing! 🎉**
