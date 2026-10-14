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
    // product.investorPrice as of invest time. Rewritten downward (with the
    // difference refunded) if the vendor drops the price before this unit
    // sells — see utils/repriceInvestments.js. A price rise never touches it.
    amountInvested: {
        type: Number,
        required: true,
        min: [0, "Amount invested cannot be negative"]
    },
    // product.investorPayout as of invest time, repriced alongside
    // amountInvested on a price drop.
    expectedPayout: {
        type: Number,
        required: true,
        min: [0, "Expected payout cannot be negative"]
    },
    // Set when a price-drop refund was owed but the Razorpay call failed (or
    // there was no payment to refund against). The offsetting ledger row is
    // written regardless, so this flags money the platform still owes.
    refundFailed: {
        type: Boolean,
        default: false
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
