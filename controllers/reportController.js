const Transaction = require('../models/transactionModel');
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
