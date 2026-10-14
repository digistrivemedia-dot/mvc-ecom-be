const Transaction = require('../models/transactionModel');
const Order = require('../models/orderModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');

// Platform-wide financial summary ---SUPERADMIN
// Optional ?from=&to= (ISO dates) to filter by when the transaction happened.
exports.getTransactionsSummary = asyncErrorHandler(async (req, res, next) => {
    const { from, to } = req.query;

    const match = {};
    if (from || to) {
        match.createdAt = {};
        if (from) match.createdAt.$gte = new Date(from);
        if (to) match.createdAt.$lte = new Date(to);
    }

    const rows = await Transaction.aggregate([
        { $match: match },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    const totals = {
        vendorPayouts: 0,
        investorInvested: 0,
        investorPayouts: 0,
        superadminProfit: 0,
    };

    for (const row of rows) {
        switch (row._id) {
            case 'vendor_earning':
            case 'vendor_reversal':
                totals.vendorPayouts += row.total;
                break;
            case 'investor_investment':
            case 'investor_refund':
                totals.investorInvested += row.total;
                break;
            case 'investor_payout':
            case 'investor_reversal':
                totals.investorPayouts += row.total;
                break;
            case 'superadmin_profit':
            case 'superadmin_reversal':
                totals.superadminProfit += row.total;
                break;
        }
    }

    res.status(200).json({
        success: true,
        totals,
        breakdown: rows,
    });
});

const TRANSACTION_PAYMENT_META = {
    vendor_earning: { role: 'vendor', label: 'Vendor Earning' },
    vendor_reversal: { role: 'vendor', label: 'Vendor Reversal' },
    investor_investment: { role: 'investor', label: 'Investor Investment' },
    investor_refund: { role: 'investor', label: 'Investor Refund (price drop)' },
    investor_payout: { role: 'investor', label: 'Investor Payout' },
    investor_reversal: { role: 'investor', label: 'Investor Reversal' },
};

// Unified feed of every payment that has happened on the platform — customer
// order payments, vendor earnings/reversals, and investor investments/payouts.
// Superadmin-only. ---SUPERADMIN
exports.getAllPayments = asyncErrorHandler(async (req, res, next) => {
    const [orders, transactions] = await Promise.all([
        Order.find({})
            .select('user paymentInfo totalPrice paidAt orderStatus createdAt')
            .populate('user', 'name email')
            .sort({ createdAt: -1 }),
        Transaction.find({ type: { $in: Object.keys(TRANSACTION_PAYMENT_META) } })
            .select('type user product amount createdAt')
            .populate('user', 'name email')
            .populate('product', 'name')
            .sort({ createdAt: -1 }),
    ]);

    const customerPayments = orders.map((order) => ({
        id: `order_${order._id}`,
        role: 'customer',
        type: 'order_payment',
        label: 'Order Payment',
        userName: order.user?.name || 'Unknown',
        userEmail: order.user?.email || '',
        amount: order.totalPrice,
        reference: order.paymentInfo?.id || '',
        status: order.orderStatus,
        date: order.paidAt || order.createdAt,
    }));

    const transactionPayments = transactions.map((txn) => {
        const meta = TRANSACTION_PAYMENT_META[txn.type];
        return {
            id: `txn_${txn._id}`,
            role: meta.role,
            type: txn.type,
            label: meta.label,
            userName: txn.user?.name || 'Unknown',
            userEmail: txn.user?.email || '',
            amount: txn.amount,
            reference: txn.product?.name || '',
            status: null,
            date: txn.createdAt,
        };
    });

    const payments = [...customerPayments, ...transactionPayments]
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
        success: true,
        count: payments.length,
        payments,
    });
});
