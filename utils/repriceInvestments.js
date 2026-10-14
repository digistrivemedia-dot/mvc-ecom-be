const Investment = require('../models/investmentModel');
const Transaction = require('../models/transactionModel');
const { getRazorpayInstance } = require('./razorpayInstance');

// Razorpay won't move less than a rupee, and a sub-rupee drop is just the 2dp
// rounding residue. Below this we leave the investment on its old (slightly
// better) terms rather than flagging a failure the platform would have to
// chase — the ≤₹1 cost lands on the platform, never on the investor.
const MIN_REFUND = 1;

// Keeps unmatched investments honest when a product's price moves.
//
// A price DROP means the investor paid more than this unit is now worth, so
// the difference goes back to the card that funded it and the investment's
// terms are rewritten to the new price — the investor ends up exactly where a
// new investor buying today would be.
//
// A price RISE leaves existing investors completely alone: their agreed return
// is already intact, raising their payout for free would push the platform
// negative, and charging them the difference needs a card consent flow that
// doesn't exist. Whatever is left over stays with the platform.
//
// Matched investments are never touched — that unit has already sold and the
// money has already moved.
//
// See MARKETPLACE_CONVERSION_PLAN.md Phase 10. Call this after every change to
// a product's price, from whichever role made the change.
async function repriceInvestments(product) {
    if (product.investorPrice == null) return [];

    const investments = await Investment.find({ product: product._id, status: 'unmatched' });
    const refunds = [];

    for (const investment of investments) {
        const refund = Number((investment.amountInvested - product.investorPrice).toFixed(2));

        if (refund < MIN_REFUND) continue;

        let refundFailed = false;

        if (investment.paymentId) {
            try {
                await getRazorpayInstance().payments.refund(investment.paymentId, {
                    amount: Math.round(refund * 100),
                    notes: {
                        reason: 'product_price_drop',
                        investment: String(investment._id),
                    },
                });
            } catch (err) {
                // ponytail: flagged for manual retry — add a retry job only if
                // these failures turn out to be common. The ledger row below is
                // written either way, so money owed can never vanish silently.
                console.error(`Refund failed for investment ${investment._id}:`, err.message);
                refundFailed = true;
            }
        } else {
            // Pre-Razorpay investment with nothing to refund against.
            refundFailed = true;
        }

        investment.amountInvested = product.investorPrice;
        investment.expectedPayout = product.investorPayout;
        // Sticky: a later successful refund must not clear the flag on an
        // earlier one that failed, or the debt stops being visible.
        investment.refundFailed = investment.refundFailed || refundFailed;
        await investment.save();

        await Transaction.create({
            type: 'investor_refund',
            user: investment.investor,
            product: product._id,
            investment: investment._id,
            amount: -refund,
        });

        refunds.push({ investment: investment._id, amount: refund, refundFailed });
    }

    return refunds;
}

module.exports = { repriceInvestments, MIN_REFUND };
