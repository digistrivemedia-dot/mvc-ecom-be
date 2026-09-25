const mongoose = require('mongoose');

// One investment funds exactly one physical unit of a product's stock
// (per-unit FIFO model — see MARKETPLACE_CONVERSION_PLAN.md). `status`
// tracks whether this unit has been matched to a customer sale yet.
const investmentSchema = new mongoose.Schema({
    investor: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true
    },
    product: {
        type: mongoose.Schema.ObjectId,
        ref: "Product",
        required: true
    },
    // Snapshot of product.investorPrice at invest time — the ledger stays
    // correct even if superadmin changes the product's pricing later.
    amountInvested: {
        type: Number,
        required: true,
        min: [0, "Amount invested cannot be negative"]
    },
    // Snapshot of product.investorPayout at invest time.
    expectedPayout: {
        type: Number,
        required: true,
        min: [0, "Expected payout cannot be negative"]
    },
    status: {
        type: String,
        enum: ['unmatched', 'matched'],
        default: 'unmatched'
    },
    matchedOrder: {
        type: mongoose.Schema.ObjectId,
        ref: "Order",
        default: null
    },
    matchedAt: {
        type: Date,
        default: null
    },
    // Razorpay payment id that funded this investment. One payment now backs
    // one Investment doc per unit purchased (batch invest), so this is no
    // longer unique — the controller checks for reuse via a query instead.
    paymentId: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// FIFO lookups: "oldest unmatched investment for this product".
investmentSchema.index({ product: 1, status: 1, createdAt: 1 });
investmentSchema.index({ paymentId: 1 }, { sparse: true });

module.exports = mongoose.model("Investment", investmentSchema);
