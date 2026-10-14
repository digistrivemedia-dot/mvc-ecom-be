const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
const Order = require('../models/orderModel');
const {
    getRazorpayInstance,
    isPaymentsMocked,
    mockPaymentIdFor,
    verifyPaymentSignature,
} = require('../utils/razorpayInstance');

// Create Razorpay Order
// This is called BEFORE user makes payment
// It creates a payment order in Razorpay system
exports.createRazorpayOrder = asyncErrorHandler(async (req, res, next) => {
    const {
        amount, // Amount in rupees
        currency = 'INR',
        receipt,
        notes = {}
    } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
        return next(new ErrorHandler('Please provide a valid amount', 400));
    }

    // Razorpay accepts amount in paise (1 Rupee = 100 paise)
    const amountInPaise = Math.round(amount * 100);

    try {
        const razorpayInstance = getRazorpayInstance();

        // Create order in Razorpay
        const options = {
            amount: amountInPaise,
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            notes: {
                ...notes,
                user_id: req.user.id,
            },
            payment_capture: 1, // Auto capture payment
        };

        const razorpayOrder = await razorpayInstance.orders.create(options);

        res.status(200).json({
            success: true,
            order: razorpayOrder,
            key_id: process.env.RAZORPAY_KEY_ID, // Send key to frontend
            // In mock mode the client skips the Razorpay modal entirely and
            // echoes this proof straight back, so the rest of the flow
            // (verify → settle) runs exactly as it does with a real payment.
            ...(isPaymentsMocked()
                ? {
                    mock: true,
                    mockPayment: {
                        razorpay_order_id: razorpayOrder.id,
                        razorpay_payment_id: mockPaymentIdFor(amountInPaise),
                        razorpay_signature: 'mock_signature',
                    },
                }
                : {}),
        });
    } catch (error) {
        console.error('Razorpay Order Creation Error:', error);
        return next(new ErrorHandler('Failed to create payment order', 500));
    }
});

// Verify Razorpay Payment
// This is called AFTER user completes payment
// It verifies the payment signature to ensure it's legitimate
exports.verifyRazorpayPayment = asyncErrorHandler(async (req, res, next) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return next(new ErrorHandler('Missing payment details', 400));
    }

    try {
        const razorpayInstance = getRazorpayInstance();

        if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
            return next(new ErrorHandler('Payment verification failed! Invalid signature', 400));
        }

        // Fetch payment details from Razorpay
        const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);

        // Check payment status
        if (payment.status !== 'captured' && payment.status !== 'authorized') {
            return next(new ErrorHandler('Payment not successful', 400));
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            payment: {
                id: razorpay_payment_id,
                order_id: razorpay_order_id,
                status: payment.status,
                method: payment.method,
                amount: payment.amount / 100, // Convert paise to rupees
                email: payment.email,
                contact: payment.contact,
            },
        });
    } catch (error) {
        console.error('Payment Verification Error:', error);
        return next(new ErrorHandler('Payment verification failed', 500));
    }
});

// Get Razorpay Payment Details
// This can be used to check payment status
exports.getRazorpayPaymentDetails = asyncErrorHandler(async (req, res, next) => {
    const { payment_id } = req.params;

    if (!payment_id) {
        return next(new ErrorHandler('Payment ID is required', 400));
    }

    try {
        const razorpayInstance = getRazorpayInstance();
        const payment = await razorpayInstance.payments.fetch(payment_id);

        res.status(200).json({
            success: true,
            payment: {
                id: payment.id,
                order_id: payment.order_id,
                status: payment.status,
                method: payment.method,
                amount: payment.amount / 100,
                currency: payment.currency,
                email: payment.email,
                contact: payment.contact,
                created_at: payment.created_at,
            },
        });
    } catch (error) {
        console.error('Error fetching payment details:', error);
        return next(new ErrorHandler('Failed to fetch payment details', 500));
    }
});

// Handle Razorpay Refund
// This is for handling failed/cancelled orders
exports.createRefund = asyncErrorHandler(async (req, res, next) => {
    const { payment_id, amount, reason } = req.body;

    if (!payment_id) {
        return next(new ErrorHandler('Payment ID is required', 400));
    }

    try {
        const razorpayInstance = getRazorpayInstance();

        const refundOptions = {
            payment_id,
            ...(amount && { amount: Math.round(amount * 100) }), // Amount in paise
            notes: {
                reason: reason || 'Customer request',
                refunded_by: req.user.id,
            },
        };

        const refund = await razorpayInstance.payments.refund(payment_id, refundOptions);

        res.status(200).json({
            success: true,
            message: 'Refund initiated successfully',
            refund: {
                id: refund.id,
                payment_id: refund.payment_id,
                amount: refund.amount / 100,
                status: refund.status,
            },
        });
    } catch (error) {
        console.error('Refund Error:', error);
        return next(new ErrorHandler('Failed to process refund', 500));
    }
});
