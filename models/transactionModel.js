const mongoose = require('mongoose');

// Append-only ledger — one row per money movement. Every dashboard (vendor
// income, investor earnings, superadmin reports) is just an aggregate query
// over this collection. Rows are never mutated or deleted; cancellations
// insert offsetting *_reversal rows instead (see orderController.js), so
// this table is always a true audit trail.
const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: [
            'investor_investment',  // investor places capital on a product unit
            'investor_refund',      // part of an investment repaid after a price drop
            'vendor_earning',       // vendor paid their cost on a unit sold
            'investor_payout',      // investor paid out on their matched unit selling
            'superadmin_profit',    // platform's margin on a unit sold
            'vendor_reversal',      // offsets vendor_earning on cancellation
            'investor_reversal',    // offsets investor_payout on cancellation
            'superadmin_reversal',  // offsets superadmin_profit on cancellation
        ],
        required: true
    },
    // Whose balance this row affects. Null for superadmin_profit/reversal
    // rows, which belong to the platform rather than a specific user.
    user: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        default: null
    },
    product: {
        type: mongoose.Schema.ObjectId,
        ref: "Product",
        required: true
    },
    order: {
        type: mongoose.Schema.ObjectId,
        ref: "Order",
        default: null
    },
    investment: {
        type: mongoose.Schema.ObjectId,
        ref: "Investment",
        default: null
    },
    // Positive = credit, negative = reversal.
    amount: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

transactionSchema.index({ user: 1, type: 1, createdAt: -1 });
transactionSchema.index({ order: 1, product: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
