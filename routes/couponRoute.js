const express = require('express');
const {
    createCoupon,
    getAllCoupons,
    getActiveCoupons,
    getCoupon,
    validateCoupon,
    applyCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus
} = require('../controllers/couponController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.route('/active').get(getActiveCoupons);

// User routes (authenticated)
router.route('/validate').post(validateCoupon);
router.route('/apply').post(isAuthenticatedUser, applyCoupon);

// Admin routes
router.route('/admin/coupons')
    .get(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), getAllCoupons)
    .post(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), createCoupon);

router.route('/admin/coupon/:id')
    .get(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), getCoupon)
    .put(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), updateCoupon)
    .delete(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), deleteCoupon);

router.route('/admin/coupon/:id/toggle')
    .patch(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), toggleCouponStatus);

module.exports = router;
