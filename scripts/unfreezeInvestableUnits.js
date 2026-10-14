/**
 * unfreezeInvestableUnits.js
 *
 * `investableUnits` used to be frozen to the stock count by a pre-save hook
 * when a product was created, and never moved again. That broke as soon as a
 * vendor restocked: a product created with 3 units kept a cap of 3 after stock
 * went to 10, so once 3 units were funded it reported 0 remaining and vanished
 * from the investor listing while still showing for customers.
 *
 * The field is now nullable — null means "follow stock" (`investableUnits ??
 * stock`). This unsets the frozen values so existing products pick that up.
 *
 * It only touches products whose cap was clearly auto-assigned rather than
 * chosen: by default it skips any product where the cap is LOWER than stock
 * AND differs from stock, since that could be a deliberate superadmin cap.
 * Pass --all to clear every cap regardless.
 *
 * Run with: node scripts/unfreezeInvestableUnits.js [--dry-run] [--all]
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../config/config.env') });

const Product = require('../models/productModel');
const Investment = require('../models/investmentModel');

const dryRun = process.argv.includes('--dry-run');
const clearAll = process.argv.includes('--all');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected${dryRun ? '  (DRY RUN — nothing will be written)' : ''}\n`);

    const products = await Product.find({ investableUnits: { $ne: null } });
    console.log(`${products.length} product(s) carry an explicit cap:\n`);

    const toClear = [];

    for (const product of products) {
        const invested = await Investment.countDocuments({ product: product._id });
        const cap = product.investableUnits;
        const beforeRemaining = Math.max(cap - invested, 0);
        const afterRemaining = Math.max(product.stock - invested, 0);

        // A cap equal to stock is almost certainly the old auto-assigned value.
        // A cap below stock might be a deliberate limit, so leave it unless --all.
        const looksAutomatic = cap === product.stock;
        const willClear = clearAll || looksAutomatic || cap < product.stock;

        console.log(
            `  ${String(product.name).slice(0, 40).padEnd(40)} ` +
            `stock ${String(product.stock).padStart(4)} | cap ${String(cap).padStart(4)} | ` +
            `invested ${String(invested).padStart(3)} | remaining ${beforeRemaining} → ${afterRemaining}` +
            `${willClear ? '' : '   (skipped — looks deliberate)'}`
        );

        if (willClear) toClear.push(product._id);
    }

    if (!dryRun && toClear.length > 0) {
        await Product.updateMany({ _id: { $in: toClear } }, { $set: { investableUnits: null } });
    }

    console.log(
        `\n${dryRun ? 'WOULD clear' : 'Cleared'} the cap on ${toClear.length} product(s) — ` +
        `they now follow stock.`
    );
    if (dryRun) console.log('Re-run without --dry-run to apply.');

    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
