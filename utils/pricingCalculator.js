// Shared formula for deriving every price on a product from the one number
// the vendor types (their listing price) and the one global margin %.
// See MARKETPLACE_CONVERSION_PLAN.md Phase 10.
//
// The margin is carved OUT OF the listing price, not added on top of a cost:
//
//   f              = 1 + marginPct/100
//   price          = P        customer pays exactly what the vendor listed
//   vendorPrice    = P / f    what the vendor receives
//   investorPrice  = P / f    what an investor pays (same as the vendor's net)
//   investorPayout = P        what the investor receives when their unit sells
//
// So an investor's return is always exactly marginPct, and the platform keeps
// the margin only on units no investor funded — on a funded unit the money in
// (customer P + investor P/f) exactly equals the money out (vendor P/f +
// investor P), which is the point: the margin is the price of the investor's
// capital.
const round2 = (n) => Number(n.toFixed(2));

// Which margin applies to a product: its own override if superadmin set one,
// otherwise the global one. Null/undefined means "follow global" — note that
// `?? ` is deliberate rather than `||`, so an explicit 0% override is honoured
// instead of silently falling back to the global rate.
function resolveMarginPct(product, settings) {
    return product?.marginPct ?? settings.marginPct;
}

// `settings` only needs a `marginPct` — pass the global settings doc, or
// `{ marginPct: resolveMarginPct(product, settings) }` to price one product
// against its own override.
function calculateGlobalPricing(listingPrice, settings) {
    const price = round2(listingPrice);
    const vendorNet = round2(listingPrice / (1 + settings.marginPct / 100));

    return {
        price,
        vendorPrice: vendorNet,
        investorPrice: vendorNet,
        investorPayout: price,
    };
}

// The platform's cut of one sold unit. Lives here next to the pricing it has
// to agree with, and is used by orderController's settlement.
//
// Everything the platform holds minus everything it owes: it received the
// customer's payment plus (earlier) the investor's capital, and it owes the
// vendor their net plus the investor their payout. On an investor-funded unit
// priced by calculateGlobalPricing this is exactly 0 — the margin went to the
// investor as their return. On an unfunded unit it's the full margin.
function calculateUnitProfit({ customerPrice, vendorPrice, amountInvested = 0, expectedPayout = 0 }) {
    return round2(customerPrice + amountInvested - vendorPrice - expectedPayout);
}

module.exports = { calculateGlobalPricing, calculateUnitProfit, resolveMarginPct };

// Self-check for the worked examples in MARKETPLACE_CONVERSION_PLAN.md.
// Run with: node utils/pricingCalculator.js
if (require.main === module) {
    const assert = require('assert');
    const settings = { marginPct: 20 };

    const at120 = calculateGlobalPricing(120, settings);
    assert.deepStrictEqual(at120, { price: 120, vendorPrice: 100, investorPrice: 100, investorPayout: 120 });

    const at90 = calculateGlobalPricing(90, settings);
    assert.deepStrictEqual(at90, { price: 90, vendorPrice: 75, investorPrice: 75, investorPayout: 90 });

    // The investor's return is the margin % at any listing price, to within
    // the one-paisa rounding residue (at ₹1 that residue is 0.48% of a tiny
    // number — real, unavoidable at 2dp, and absorbed by the platform).
    for (const p of [120, 90, 1, 3333.33]) {
        const q = calculateGlobalPricing(p, settings);
        assert.ok(Math.abs(q.investorPrice - p / 1.2) <= 0.01, `off at listing price ${p}`);
        assert.strictEqual(q.investorPayout, round2(p));
    }

    // Platform earns nothing on a funded unit, the full margin on an unfunded one.
    const funded = at120.price + at120.investorPrice - at120.vendorPrice - at120.investorPayout;
    assert.strictEqual(funded, 0);
    assert.strictEqual(at120.price - at120.vendorPrice, 20);

    // A price drop refunds the investor the difference between the old and new
    // investor price — 120 -> 90 gives back 25, not 28.
    assert.strictEqual(round2(at120.investorPrice - at90.investorPrice), 25);

    // Margin 0 is legal and degenerate: nobody takes a cut.
    assert.deepStrictEqual(
        calculateGlobalPricing(100, { marginPct: 0 }),
        { price: 100, vendorPrice: 100, investorPrice: 100, investorPayout: 100 }
    );

    // A per-product override wins over the global margin; null follows it.
    assert.strictEqual(resolveMarginPct({ marginPct: 35 }, settings), 35);
    assert.strictEqual(resolveMarginPct({ marginPct: null }, settings), 20);
    assert.strictEqual(resolveMarginPct({}, settings), 20);
    assert.strictEqual(resolveMarginPct(null, settings), 20);
    // An explicit 0% override must NOT fall through to the global rate.
    assert.strictEqual(resolveMarginPct({ marginPct: 0 }, settings), 0);

    // Two products, same listing price, different margins.
    const overridden = calculateGlobalPricing(120, { marginPct: resolveMarginPct({ marginPct: 50 }, settings) });
    assert.deepStrictEqual(overridden, { price: 120, vendorPrice: 80, investorPrice: 80, investorPayout: 120 });
    assert.strictEqual(at120.vendorPrice, 100, 'the global-margin product is unaffected');

    console.log('pricingCalculator: all checks passed');
}
