const express = require('express');
const router = express.Router();
const { isAuthenticatedUser } = require('../middlewares/auth');
const {
    createRazorpayOrder,
    verifyRazorpayPayment,
    getRazorpayPaymentDetails,
    createRefund,
} = require('../controllers/razorpayController');

// Create Razorpay Order (Before Payment)
router.route('/payment/razorpay/order').post(isAuthenticatedUser, createRazorpayOrder);

// Verify Razorpay Payment (After Payment)
router.route('/payment/razorpay/verify').post(isAuthenticatedUser, verifyRazorpayPayment);

// Get Payment Details
router.route('/payment/razorpay/:payment_id').get(isAuthenticatedUser, getRazorpayPaymentDetails);

// Create Refund
router.route('/payment/razorpay/refund').post(isAuthenticatedUser, createRefund);

module.exports = router;
