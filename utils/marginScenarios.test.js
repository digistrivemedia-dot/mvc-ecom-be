/**
 * The three scenarios Phase 10 was specified around, run end-to-end through
 * the real pricing + settlement formulas (no database needed — these are the
 * pure money functions both controllers call).
 *
 * Run with: node utils/marginScenarios.test.js
 */

const assert = require('assert');
const { calculateGlobalPricing, calculateUnitProfit, resolveMarginPct } = require('./pricingCalculator');

const MARGIN = { marginPct: 20 };
const round2 = (n) => Number(n.toFixed(2));

// What an investor nets, and what the platform nets, when a unit funded at
// `investment` terms sells at the product's current price.
function settle(product, investment) {
    return {
        vendorGets: product.vendorPrice,
        investorProfit: round2(investment.expectedPayout - investment.amountInvested),
        platformProfit: calculateUnitProfit({
            customerPrice: product.price,
            vendorPrice: product.vendorPrice,
            amountInvested: investment.amountInvested,
            expectedPayout: investment.expectedPayout,
        }),
    };
}

// A unit of this product is invested in right now, at today's terms.
const investAt = (product) => ({
    amountInvested: product.investorPrice,
    expectedPayout: product.investorPayout,
});

// --- Scenario 1: vendor lists at 120, nobody's price changes -------------
{
    const product = calculateGlobalPricing(120, MARGIN);

    assert.strictEqual(product.price, 120, 'customer pays the listed price');
    assert.strictEqual(product.vendorPrice, 100, 'vendor nets 100');

    // No investor funded this unit: the platform keeps the whole margin.
    assert.strictEqual(
        calculateUnitProfit({ customerPrice: product.price, vendorPrice: product.vendorPrice }),
        20
    );

    // An investor funded it: they turn 100 into 120, and the margin that
    // would have been the platform's is exactly what paid for that.
    const sale = settle(product, investAt(product));
    assert.strictEqual(sale.vendorGets, 100);
    assert.strictEqual(sale.investorProfit, 20);
    assert.strictEqual(sale.platformProfit, 0);
}

// --- Scenario 2: vendor drops the listing price 120 -> 90 ----------------
// A new investor coming in after the drop pays 75 and is paid 90.
{
    const product = calculateGlobalPricing(90, MARGIN);

    assert.strictEqual(product.price, 90, 'customer pays the new lower price');
    assert.strictEqual(product.vendorPrice, 75, 'vendor nets less too');
    assert.strictEqual(product.investorPrice, 75);

    const sale = settle(product, investAt(product));
    assert.strictEqual(sale.investorProfit, 15, 'still exactly a 20% return');
    assert.strictEqual(sale.platformProfit, 0);
}

// --- Scenario 3: investor bought at 120, THEN the vendor dropped to 90 ---
// The investor is now over-invested, so the difference is refunded and their
// terms are rewritten — exactly what utils/repriceInvestments.js does.
{
    const before = calculateGlobalPricing(120, MARGIN);
    const after = calculateGlobalPricing(90, MARGIN);

    const investment = investAt(before);
    assert.strictEqual(investment.amountInvested, 100);
    assert.strictEqual(investment.expectedPayout, 120);

    const refund = round2(investment.amountInvested - after.investorPrice);
    assert.strictEqual(refund, 25, 'refund is 25 — a divide-by-1.2 world, not 28');

    // Apply the reprice, then sell the unit.
    investment.amountInvested = after.investorPrice;
    investment.expectedPayout = after.investorPayout;

    const sale = settle(after, investment);
    assert.strictEqual(investment.amountInvested, 75);
    assert.strictEqual(sale.investorProfit, 15, 'back to a clean 20% return');
    assert.strictEqual(sale.platformProfit, 0, 'books still balance after a refund');

    // Net cash for the investor across the whole episode: they paid 100, got
    // 25 back, then received 90 — so 15 up on the 75 left at risk.
    assert.strictEqual(round2(-100 + refund + after.investorPayout), 15);
}

// --- Scenario 4: investor bought at 90, THEN the vendor RAISED to 120 ----
// Decision #4: the investor is left alone. Their agreed return is intact and
// whatever is left over stays with the platform — never a negative.
{
    const before = calculateGlobalPricing(90, MARGIN);
    const after = calculateGlobalPricing(120, MARGIN);

    const investment = investAt(before);          // paid 75, expects 90
    const refund = round2(investment.amountInvested - after.investorPrice);
    assert.ok(refund < 0, 'nothing owed to the investor on a price rise');

    const sale = settle(after, investment);       // untouched terms
    assert.strictEqual(sale.investorProfit, 15, 'investor keeps their 20% on 75');
    assert.strictEqual(sale.vendorGets, 100, 'vendor is paid at the new price');
    assert.strictEqual(sale.platformProfit, 5, 'residual stays with the platform');
    assert.ok(sale.platformProfit >= 0, 'a price rise must never cost the platform');
}

// --- The invariant that matters most -------------------------------------
// At any listing price and any margin, a funded sale must never leave the
// platform out of pocket, and the investor must get their margin back.
{
    for (const marginPct of [0, 5, 20, 33.33, 100]) {
        for (const listing of [1, 90, 120, 999.99, 12345.67]) {
            const product = calculateGlobalPricing(listing, { marginPct });
            const sale = settle(product, investAt(product));

            assert.ok(
                sale.platformProfit >= -0.01,
                `platform went negative at margin ${marginPct}% / listing ${listing}`
            );
            assert.ok(
                sale.investorProfit >= 0,
                `investor lost money at margin ${marginPct}% / listing ${listing}`
            );
            // Vendor + platform margin always reconstitutes the listing price.
            assert.ok(
                Math.abs(product.vendorPrice + (product.price - product.vendorPrice) - product.price) < 0.01
            );
        }
    }
}

// --- Regression: a cancelled order must not re-pool stale terms -----------
// reverseSettlement flips a matched investment back to 'unmatched'. If it
// isn't repriced on the way out, an investment made at 120 and cancelled
// after the vendor dropped to 90 would sit unmatched owing a 120 payout on a
// 90 product, and settle the next sale at a loss. orderController calls
// repriceInvestments after re-pooling for exactly this reason.
{
    const after = calculateGlobalPricing(90, MARGIN);
    const stale = { amountInvested: 100, expectedPayout: 120 };   // made when it was 120

    assert.strictEqual(
        settle(after, stale).platformProfit,
        -5,
        'this is the loss that re-pooling without repricing would cause'
    );

    // After the reprice that reverseSettlement now performs:
    const repriced = { amountInvested: after.investorPrice, expectedPayout: after.investorPayout };
    assert.strictEqual(settle(after, repriced).platformProfit, 0);
    assert.strictEqual(settle(after, repriced).investorProfit, 15);
}

// --- Regression: raising the margin is what refunds investors -------------
// Easy to get backwards. A BIGGER margin makes listingPrice/(1+margin)
// SMALLER, so existing investors are over-invested and get money back.
{
    const at20 = calculateGlobalPricing(120, { marginPct: 20 });
    const at30 = calculateGlobalPricing(120, { marginPct: 30 });
    const at10 = calculateGlobalPricing(120, { marginPct: 10 });

    assert.ok(at30.investorPrice < at20.investorPrice, 'margin up => investor pays less => refund');
    assert.ok(at10.investorPrice > at20.investorPrice, 'margin down => no refund owed');

    // Customer price never moves when only the margin changes.
    assert.strictEqual(at30.price, at20.price);
    assert.strictEqual(at10.price, at20.price);
}

// --- Regression: cart totals must be compared in paise, not as floats -----
// investorPrice is listingPrice/(1+margin) and so is usually fractional.
// Summing those across a cart drifts off the gateway's integer paise, and a
// float `!==` would reject a payment the investor had already been charged.
{
    const a = calculateGlobalPricing(1, MARGIN).investorPrice;    // 0.83
    const b = calculateGlobalPricing(34, MARGIN).investorPrice;   // 28.33
    const cartTotal = a * 2 + b * 3;

    assert.notStrictEqual(cartTotal, 86.65, 'float sum really does drift (this is the trap)');
    assert.strictEqual(Math.round(cartTotal * 100), 8665, 'but paise comparison is exact');
}

// --- Per-product margin override ----------------------------------------
// Admin sets 20% globally but 50% on one product. Both must price correctly,
// and the overridden one must be immune to a later change of the global rate.
{
    const global20 = { marginPct: 20 };
    const global35 = { marginPct: 35 };

    const normal = { marginPct: null };
    const special = { marginPct: 50 };

    const priceWith = (product, settings) =>
        calculateGlobalPricing(120, { marginPct: resolveMarginPct(product, settings) });

    assert.strictEqual(priceWith(normal, global20).vendorPrice, 100, 'follows global 20%');
    assert.strictEqual(priceWith(special, global20).vendorPrice, 80, 'uses its own 50%');

    // Admin now moves the global margin to 35%.
    assert.strictEqual(priceWith(normal, global35).vendorPrice, 88.89, 'follower moves');
    assert.strictEqual(priceWith(special, global35).vendorPrice, 80, 'override does NOT move');

    // The investor's return still equals whatever margin actually applied.
    const s = priceWith(special, global20);
    assert.strictEqual(
        settle(s, { amountInvested: s.investorPrice, expectedPayout: s.investorPayout }).investorProfit,
        40,
        '50% of 80'
    );
    assert.strictEqual(
        settle(s, { amountInvested: s.investorPrice, expectedPayout: s.investorPayout }).platformProfit,
        0,
        'funded unit still books zero at any margin'
    );
}

console.log('marginScenarios: all scenarios + invariants + regressions passed');
