const PlatformSettings = require('../models/platformSettingsModel');
const Product = require('../models/productModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
const { calculateGlobalPricing, resolveMarginPct } = require('../utils/pricingCalculator');
const { repriceInvestments } = require('../utils/repriceInvestments');

// Get the current global margin ---SUPERADMIN
exports.getPricingSettings = asyncErrorHandler(async (req, res, next) => {
    const settings = await PlatformSettings.getSingleton();

    res.status(200).json({
        success: true,
        settings,
    });
});

// Update the global margin and recalculate every priced product ---SUPERADMIN
//
// Customer-facing `price` never moves here — that's the vendor's listing
// price. What moves is everyone's cut of it: the vendor's net, what an
// investor pays, and what an investor is paid. Every priced product is
// recalculated, with no opt-out, because a product left on a stale margin
// would quietly pay its vendor the wrong amount (see productModel.js).
//
// Products with their own `marginPct` are recomputed against that override,
// so changing the global rate leaves their numbers untouched.
//
// A lower margin means unmatched investors are now over-invested, so they get
// refunded the difference — see utils/repriceInvestments.js.
exports.updatePricingSettings = asyncErrorHandler(async (req, res, next) => {
    const { marginPct } = req.body;

    if (marginPct === undefined || marginPct === null || Number.isNaN(Number(marginPct))) {
        return next(new ErrorHandler("Margin percentage is required", 400));
    }

    if (Number(marginPct) < 0) {
        return next(new ErrorHandler("Margin cannot be negative", 400));
    }

    const settings = await PlatformSettings.getSingleton();
    settings.marginPct = Number(marginPct);
    settings.updatedAt = Date.now();
    await settings.save();

    // ponytail: sequential, and each owed refund is a Razorpay round-trip, so a
    // large catalogue can push this request past a gateway/proxy timeout. It is
    // safe to just call again: a refund already applied leaves the investment at
    // the new price, so the next pass computes nothing owed and skips it. Move
    // to a background job if the catalogue grows enough for that to be annoying.
    const products = await Product.find({ price: { $gt: 0 } });

    let updatedCount = 0;
    let refundedCount = 0;

    let overriddenCount = 0;

    for (const product of products) {
        // Products carrying their own margin are still visited — they just
        // recompute to the same numbers, which is what keeps vendorPrice from
        // ever going stale (see the marginPct comment in productModel.js).
        if (product.marginPct != null) overriddenCount++;

        const derived = calculateGlobalPricing(product.price, {
            marginPct: resolveMarginPct(product, settings),
        });
        product.price = derived.price;
        product.vendorPrice = derived.vendorPrice;
        product.investorPrice = derived.investorPrice;
        product.investorPayout = derived.investorPayout;
        product.pricingStatus = 'priced';
        // listingStatus is deliberately NOT touched here. The previous version
        // flipped draft/pending_approval products to 'live', which meant
        // changing the margin silently published vendor listings nobody had
        // reviewed — directly against the approval flow the rest of the code
        // enforces (see productController's "never publishes automatically").
        // Repricing is not an approval decision.
        await product.save({ validateBeforeSave: false });
        updatedCount++;

        const refunds = await repriceInvestments(product);
        refundedCount += refunds.length;
    }

    res.status(200).json({
        success: true,
        message: `Margin saved. ${updatedCount} product(s) repriced`
            + (overriddenCount > 0
                ? ` (${overriddenCount} kept their own margin)` : '')
            + (refundedCount > 0 ? `, ${refundedCount} investment(s) refunded.` : '.'),
        settings,
        updatedCount,
        overriddenCount,
        refundedCount,
    });
});
