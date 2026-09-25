// Runnable self-check for the invest-cart merge math (no DB/Razorpay needed).
// Run: node backend/scripts/checkInvestmentBatch.js
const assert = require('assert');
const { mergeInvestItems } = require('../utils/investmentBatch');

// Two different products, straightforward case.
{
    const merged = mergeInvestItems([
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
    ]);
    assert.strictEqual(merged.get('p1'), 2);
    assert.strictEqual(merged.get('p2'), 1);
    assert.strictEqual(merged.size, 2);
}

// Same product split across two cart lines merges into one quantity.
{
    const merged = mergeInvestItems([
        { productId: 'p1', quantity: 2 },
        { productId: 'p1', quantity: 3 },
    ]);
    assert.strictEqual(merged.get('p1'), 5);
    assert.strictEqual(merged.size, 1);
}

// Rejects non-positive / non-integer / missing quantities.
for (const bad of [
    [{ productId: 'p1', quantity: 0 }],
    [{ productId: 'p1', quantity: -1 }],
    [{ productId: 'p1', quantity: 1.5 }],
    [{ productId: 'p1' }],
    [{ quantity: 1 }],
]) {
    assert.throws(() => mergeInvestItems(bad));
}

console.log('checkInvestmentBatch: all assertions passed');
