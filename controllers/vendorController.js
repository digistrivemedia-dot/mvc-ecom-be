const Product = require('../models/productModel');
const Order = require('../models/orderModel');
const Transaction = require('../models/transactionModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');

// Overview stats for the vendor dashboard.
exports.getVendorStats = asyncErrorHandler(async (req, res, next) => {
    const vendorId = req.user._id;

    const products = await Product.find({ user: vendorId });
    const productCount = products.length;
    const liveCount = products.filter(p => p.listingStatus === 'live').length;
    const pendingApprovalCount = products.filter(p => ['draft', 'pending_approval'].includes(p.listingStatus)).length;

    const rows = await Transaction.aggregate([
        { $match: { user: vendorId, type: { $in: ['vendor_earning', 'vendor_reversal'] } } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    let lifetimeIncome = 0;
    let earnedCount = 0;
    let reversedCount = 0;
    for (const row of rows) {
        lifetimeIncome += row.total;
        if (row._id === 'vendor_earning') earnedCount = row.count;
        if (row._id === 'vendor_reversal') reversedCount = row.count;
    }

    res.status(200).json({
        success: true,
        stats: {
            productCount,
            liveCount,
            pendingApprovalCount,
            unitsSold: earnedCount - reversedCount,
            lifetimeIncome,
        }
    });
});

// Orders containing at least one of this vendor's products. Each order's
// items are filtered down to just this vendor's own line items, so a
// mixed-cart order never leaks another vendor's items.
exports.getVendorOrders = asyncErrorHandler(async (req, res, next) => {
    const vendorId = req.user._id;

    const vendorProducts = await Product.find({ user: vendorId }).select('_id');
    const productIds = vendorProducts.map(p => p._id);

    const orders = await Order.find({ 'orderItems.product': { $in: productIds } })
        .populate('user', 'name email')
        .sort({ createdAt: -1 });

    const vendorOrders = orders.map(order => ({
        _id: order._id,
        user: order.user,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt,
        shippingInfo: order.shippingInfo,
        items: order.orderItems.filter(item =>
            productIds.some(id => id.equals(item.product))
        ),
    }));

    res.status(200).json({
        success: true,
        orders: vendorOrders,
    });
});

// This vendor's earning/reversal ledger rows.
exports.getVendorTransactions = asyncErrorHandler(async (req, res, next) => {
    const transactions = await Transaction.find({
        user: req.user._id,
        type: { $in: ['vendor_earning', 'vendor_reversal'] }
    })
        .populate('product', 'name images')
        .populate('order', 'orderStatus createdAt')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        transactions,
    });
});
