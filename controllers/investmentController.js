const Investment = require('../models/investmentModel');
const Transaction = require('../models/transactionModel');
const Product = require('../models/productModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
const { getRazorpayInstance, verifyPaymentSignature } = require('../utils/razorpayInstance');
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

    // Re-verified here on purpose — never trust the client's claim that
    // /payment/razorpay/verify already ran. In mock mode this accepts a mock
    // payment id and nothing else (see utils/razorpayInstance.js).
    if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
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

    // Compare in paise, as integers. Investor prices are listingPrice/(1+margin)
    // and so are usually fractional, which means summing them across a cart
    // lands on values like 29.159999999999997 while the gateway reports a clean
    // 2916 paise. A float `!==` here rejects a perfectly correct payment that
    // the investor has already been charged for.
    if (Math.round(expectedTotal * 100) !== payment.amount) {
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

// Get logged-in investor's own investments, with the cash that actually moved
// on each one attached.
//
// `amountInvested` alone can't answer "what did this unit do for me": it's
// rewritten in place when a price drop refunds part of the capital (see
// utils/repriceInvestments.js), and a cancelled order reverses a payout that
// was already booked. Both of those live in the ledger, so the per-unit
// history is summed from there rather than inferred from the current snapshot.
exports.myInvestments = asyncErrorHandler(async (req, res, next) => {

    const investments = await Investment.find({ investor: req.user.id })
        .sort({ createdAt: -1 })
        .populate('product', 'name images price investorPrice investorPayout listingStatus')
        .populate('matchedOrder', 'orderStatus createdAt');

    const ledger = await Transaction.aggregate([
        {
            $match: {
                user: req.user._id,
                investment: { $ne: null },
                type: { $in: ['investor_refund', 'investor_payout', 'investor_reversal'] },
            },
        },
        { $group: { _id: { investment: '$investment', type: '$type' }, total: { $sum: '$amount' } } },
    ]);

    const byInvestment = new Map();
    for (const row of ledger) {
        const key = String(row._id.investment);
        const entry = byInvestment.get(key) || { refunded: 0, realisedPayout: 0 };
        if (row._id.type === 'investor_refund') {
            // Stored negative (money leaving the investor's invested balance).
            entry.refunded += -row.total;
        } else {
            // payout is positive, reversal is negative — they net out when an
            // order is cancelled, which is exactly what "realised" should mean.
            entry.realisedPayout += row.total;
        }
        byInvestment.set(key, entry);
    }

    const enriched = investments.map((investment) => {
        const history = byInvestment.get(String(investment._id)) || { refunded: 0, realisedPayout: 0 };
        return {
            ...investment.toObject(),
            // Capital handed back because the product's price dropped after
            // this unit was funded.
            refundedTotal: Number(history.refunded.toFixed(2)),
            // What this unit has actually paid out so far — 0 while unmatched,
            // and back to 0 if its order was later cancelled.
            realisedPayout: Number(history.realisedPayout.toFixed(2)),
        };
    });

    res.status(200).json({
        success: true,
        investments: enriched,
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
        if (row._id === 'investor_refund') totals.totalInvested += row.total;   // negative, nets out
        if (row._id === 'investor_payout') totals.totalPaidOut += row.total;
        if (row._id === 'investor_reversal') totals.totalPaidOut += row.total;  // negative, nets out
    }

    res.status(200).json({
        success: true,
        totals,
        transactions: rows,
    });
});
