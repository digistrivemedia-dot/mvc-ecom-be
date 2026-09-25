const Razorpay = require('razorpay');

// Shared lazy Razorpay client, used by both the customer checkout flow
// (razorpayController.js) and the investor funding flow (investmentController.js).
const getRazorpayInstance = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to config.env');
    }

    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
};

module.exports = { getRazorpayInstance };
