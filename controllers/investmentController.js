const crypto = require('crypto');
const Investment = require('../models/investmentModel');
const Transaction = require('../models/transactionModel');
const Product = require('../models/productModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
const { getRazorpayInstance } = require('../utils/razorpayInstance');
const { mergeInvestItems } = require('../utils/investmentBatch');

// Place a batch of investments ---INVESTOR
// One Razorpay payment funds `quantity` units across one or more products —
// each unit still gets its own Investment doc (per-unit FIFO model is
// unchanged, see MARKETPLACE_CONVERSION_PLAN.md). The signature is
// re-verified here (never trust the client's own claim that
// /payment/razorpay/verify already ran) and the payment id is checked
// against every past investment so the same payment can't be replayed.
exports.invest = asyncErrorHandler(async (req, res, next) => {

    const { items, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return next(new ErrorHandler("No items to invest in", 400));
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return next(new ErrorHandler("Missing payment details", 400));
    }

    // Merge duplicate product lines so per-product availability is checked once.
    let quantityByProduct;
    try {
        quantityByProduct = mergeInvestItems(items);
    } catch (err) {
        return next(new ErrorHandler("Invalid item in investment cart", 400));
    }

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(sign)
        .digest('hex');

    if (expectedSign !== razorpay_signature) {
        return next(new ErrorHandler("Payment verification failed! Invalid signature", 400));
    }

    const alreadyUsed = await Investment.findOne({ paymentId: razorpay_payment_id });
    if (alreadyUsed) {
        return next(new ErrorHandler("This payment has already been used for an investment", 400));
    }

    const razorpayInstance = getRazorpayInstance();
    const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);

    if (payment.status !== 'captured' && payment.status !== 'authorized') {
        return next(new ErrorHandler("Payment not successful", 400));
    }

    let expectedTotal = 0;
    const validatedLines = [];

    for (const [productId, quantity] of quantityByProduct) {
        const product = await Product.findById(productId);

        if (!product) {
            return next(new ErrorHandler("Product Not Found", 404));
        }

        if (product.listingStatus !== 'live') {
            return next(new ErrorHandler(`${product.name} is not open for investment`, 400));
        }

        if (product.investorPrice === null || product.investorPrice === undefined) {
            return next(new ErrorHandler(`${product.name} does not accept investment`, 400));
        }

        const investableUnits = product.investableUnits ?? product.stock;
        const existingCount = await Investment.countDocuments({ product: product._id });

        if (existingCount + quantity > investableUnits) {
            return next(new ErrorHandler(
                `Only ${Math.max(investableUnits - existingCount, 0)} unit(s) left to invest in for ${product.name}`,
                400
            ));
        }

        expectedTotal += product.investorPrice * quantity;
        validatedLines.push({ product, quantity });
    }

    const paidAmount = payment.amount / 100;
    if (paidAmount !== expectedTotal) {
        return next(new ErrorHandler("Payment amount does not match the investment total", 400));
    }

    const investments = [];
    for (const { product, quantity } of validatedLines) {
        for (let i = 0; i < quantity; i++) {
            const investment = await Investment.create({
                investor: req.user.id,
                product: product._id,
                amountInvested: product.investorPrice,
                expectedPayout: product.investorPayout,
                paymentId: razorpay_payment_id,
            });
            investments.push(investment);

            await Transaction.create({
                type: 'investor_investment',
                user: req.user.id,
                product: product._id,
                investment: investment._id,
                amount: product.investorPrice,
            });
        }
    }

    res.status(201).json({
        success: true,
        investments,
    });
});

// Get logged-in investor's own investments
exports.myInvestments = asyncErrorHandler(async (req, res, next) => {

    const investments = await Investment.find({ investor: req.user.id })
        .sort({ createdAt: -1 })
        .populate('product', 'name images price investorPrice investorPayout')
        .populate('matchedOrder', 'orderStatus createdAt');

    res.status(200).json({
        success: true,
        investments,
    });
});

// Aggregate this investor's earnings by transaction type
exports.myEarnings = asyncErrorHandler(async (req, res, next) => {

    const rows = await Transaction.aggregate([
        { $match: { user: req.user._id } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    const totals = {
        totalInvested: 0,
        totalPaidOut: 0,
    };

    for (const row of rows) {
        if (row._id === 'investor_investment') totals.totalInvested += row.total;
        if (row._id === 'investor_payout') totals.totalPaidOut += row.total;
        if (row._id === 'investor_reversal') totals.totalPaidOut += row.total; // negative, nets out
    }

    res.status(200).json({
        success: true,
        totals,
        transactions: rows,
    });
});
