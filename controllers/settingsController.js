const PlatformSettings = require('../models/platformSettingsModel');
const Product = require('../models/productModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const { calculateGlobalPricing } = require('../utils/pricingCalculator');

// Get current global markup settings ---SUPERADMIN
exports.getPricingSettings = asyncErrorHandler(async (req, res, next) => {
    const settings = await PlatformSettings.getSingleton();

    res.status(200).json({
        success: true,
        settings,
    });
});

// Update global markup settings and recalculate every product that follows
// them ---SUPERADMIN. Products a superadmin has manually priced
// (useGlobalPricing: false) or explicitly rejected/paused are left alone —
// this only touches products still on auto-pricing.
exports.updatePricingSettings = asyncErrorHandler(async (req, res, next) => {
    const { customerMarkupPct, investorMarkupPct, investorReturnPct } = req.body;

    const settings = await PlatformSettings.getSingleton();
    if (customerMarkupPct !== undefined) settings.customerMarkupPct = customerMarkupPct;
    if (investorMarkupPct !== undefined) settings.investorMarkupPct = investorMarkupPct;
    if (investorReturnPct !== undefined) settings.investorReturnPct = investorReturnPct;
    settings.updatedAt = Date.now();
    await settings.save();

    // Recalculate every vendor-costed product still on auto-pricing.
    const products = await Product.find({
        useGlobalPricing: { $ne: false },
        vendorPrice: { $ne: null, $exists: true },
    });

    let updatedCount = 0;
    for (const product of products) {
        const { price, investorPrice, investorPayout } = calculateGlobalPricing(product.vendorPrice, settings);
        product.price = price;
        product.investorPrice = investorPrice;
        product.investorPayout = investorPayout;
        product.pricingStatus = 'priced';
        // Publish it if it's just sitting unreviewed — never override an
        // explicit reject/pause decision superadmin already made.
        if (product.listingStatus === 'draft' || product.listingStatus === 'pending_approval') {
            product.listingStatus = 'live';
        }
        await product.save({ validateBeforeSave: false });
        updatedCount++;
    }

    res.status(200).json({
        success: true,
        message: `Settings saved. ${updatedCount} product(s) repriced.`,
        settings,
        updatedCount,
    });
});
