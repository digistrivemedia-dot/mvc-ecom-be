const express = require('express');
const { getAllProducts, getProductDetails, getAdminProductDetails, updateProduct, deleteProduct, getProductReviews, deleteReview, createProductReview, createProduct, getAdminProducts, getProducts, updateProductPricing, updateListingStatus, getVendorProducts, getInvestorProducts } = require('../controllers/productController');
const { isAuthenticatedUser, authorizeRoles, requireApproved } = require('../middlewares/auth');

const router = express.Router();

router.route('/products').get(getAllProducts);
router.route('/products/all').get(getProducts);

router.route('/admin/products').get(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), getAdminProducts);
router.route('/admin/product/new').post(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), createProduct);

router.route('/admin/product/:id')
    .get(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), getAdminProductDetails)
    .put(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), updateProduct)
    .delete(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), deleteProduct);

// Pricing touches platform margins/investor payouts — superadmin only.
router.route('/admin/product/:id/pricing').put(isAuthenticatedUser, authorizeRoles("superadmin"), updateProductPricing);
// Approving/rejecting a listing doesn't touch pricing — admin can do this too.
router.route('/admin/product/:id/listing-status').put(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), updateListingStatus);

// Vendor's own product CRUD — same controllers as admin, gated separately;
// createProduct/updateProduct branch internally on req.user.role.
router.route('/vendor/products').get(isAuthenticatedUser, authorizeRoles("vendor"), getVendorProducts);
router.route('/vendor/product/new').post(isAuthenticatedUser, authorizeRoles("vendor"), requireApproved('vendorProfile'), createProduct);
router.route('/vendor/product/:id')
    .put(isAuthenticatedUser, authorizeRoles("vendor"), requireApproved('vendorProfile'), updateProduct)
    .delete(isAuthenticatedUser, authorizeRoles("vendor"), requireApproved('vendorProfile'), deleteProduct);

// Investor-facing: live products open for investment.
router.route('/investor/products').get(isAuthenticatedUser, authorizeRoles("investor"), getInvestorProducts);

router.route('/product/:id').get(getProductDetails);

router.route('/review').put(isAuthenticatedUser, createProductReview);

router.route('/admin/reviews')
    .get(getProductReviews)
    .delete(isAuthenticatedUser, deleteReview);

module.exports = router;