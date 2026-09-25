// Shared formula for auto-computing customer/investor pricing from a
// vendor's cost price and the global markup settings. See
// MARKETPLACE_CONVERSION_PLAN.md — used by both product creation/update
// (when a product follows global pricing) and the settings bulk-recalculate.
function calculateGlobalPricing(vendorPrice, settings) {
    const price = Number((vendorPrice * (1 + settings.customerMarkupPct / 100)).toFixed(2));
    const investorPrice = Number((vendorPrice * (1 + settings.investorMarkupPct / 100)).toFixed(2));
    const investorPayout = Number((investorPrice * (1 + settings.investorReturnPct / 100)).toFixed(2));

    return { price, investorPrice, investorPayout };
}

module.exports = { calculateGlobalPricing };
