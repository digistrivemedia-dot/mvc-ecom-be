/**
 * migrateToMarginPricing.js
 *
 * Phase 10 inverted the pricing model: the margin is now carved OUT OF the
 * vendor's listing price instead of being added ON TOP OF a vendor cost, and
 * the three global percentages collapsed into one `marginPct`.
 *
 * Products in the database were priced the old way (`vendorPrice` = the
 * vendor's cost, `price` = cost + markup). This script keeps every
 * customer-facing `price` exactly as it is and re-derives the rest from it:
 *
 *     vendorPrice = investorPrice = price / (1 + marginPct/100)
 *     investorPayout = price
 *
 * Note this is LOSSLESS for vendors when `marginPct` equals the old
 * `customerMarkupPct`, because price/(1+pct) is then exactly the cost they
 * were already being paid — which is why that's the default margin below.
 *
 * Unmatched investments bought under the old formula are repriced to the new
 * terms, and anyone now over-invested is refunded the difference to their
 * card (real Razorpay refunds — run with --dry-run first).
 *
 * Run with: node scripts/migrateToMarginPricing.js [--dry-run] [--margin=20]
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../config/config.env') });

const Product = require('../models/productModel');
const Investment = require('../models/investmentModel');
const PlatformSettings = require('../models/platformSettingsModel');
const { calculateGlobalPricing } = require('../utils/pricingCalculator');
const { repriceInvestments, MIN_REFUND } = require('../utils/repriceInvestments');

const dryRun = process.argv.includes('--dry-run');
const marginArg = process.argv.find((a) => a.startsWith('--margin='));

async function migrate() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to MongoDB${dryRun ? '  (DRY RUN — nothing will be written)' : ''}\n`);

    // The old three percentages are gone from the schema, so read the raw doc
    // to recover customerMarkupPct as the lossless default margin.
    const rawSettings = await mongoose.connection.collection('platformsettings').findOne({});
    const marginPct = marginArg
        ? Number(marginArg.split('=')[1])
        : (rawSettings?.customerMarkupPct ?? 0);

    if (Number.isNaN(marginPct) || marginPct < 0) {
        throw new Error(`Invalid margin: ${marginPct}`);
    }

    console.log(`Margin: ${marginPct}%  ${marginArg ? '(from --margin)' : '(carried over from old customerMarkupPct)'}`);
    if (rawSettings) {
        console.log(`Old settings were: customer ${rawSettings.customerMarkupPct}%, `
            + `investor ${rawSettings.investorMarkupPct}%, return ${rawSettings.investorReturnPct}%\n`);
    }

    const settings = { marginPct };

    const products = await Product.find({ price: { $gt: 0 } });
    console.log(`${products.length} priced product(s) to re-derive:\n`);

    let refundTotal = 0;
    let refundCount = 0;

    for (const product of products) {
        const derived = calculateGlobalPricing(product.price, settings);
        const vendorDelta = derived.vendorPrice - (product.vendorPrice ?? 0);

        console.log(`  ${product.name?.slice(0, 40).padEnd(40)} `
            + `price ${product.price} | vendor ${product.vendorPrice ?? '—'} → ${derived.vendorPrice}`
            + `${Math.abs(vendorDelta) > 0.01 ? `  (vendor net changes by ${vendorDelta.toFixed(2)})` : ''}`);

        const unmatched = await Investment.find({ product: product._id, status: 'unmatched' });
        for (const inv of unmatched) {
            const refund = Number((inv.amountInvested - derived.investorPrice).toFixed(2));
            if (refund >= MIN_REFUND) {
                console.log(`      investment ${inv._id}: paid ${inv.amountInvested} `
                    + `→ ${derived.investorPrice}, refund ${refund}`);
                refundTotal += refund;
                refundCount++;
            }
        }

        if (dryRun) continue;

        Object.assign(product, derived);
        product.pricingStatus = 'priced';
        await product.save({ validateBeforeSave: false });

        await repriceInvestments(product);
    }

    if (!dryRun) {
        const stored = await PlatformSettings.getSingleton();
        stored.marginPct = marginPct;
        stored.updatedAt = Date.now();
        await stored.save();

        // Drop the three dead percentage fields so nothing reads them by accident.
        await mongoose.connection.collection('platformsettings').updateMany({}, {
            $unset: { customerMarkupPct: '', investorMarkupPct: '', investorReturnPct: '' },
        });
        await mongoose.connection.collection('products').updateMany({}, {
            $unset: { useGlobalPricing: '' },
        });
    }

    console.log(`\n${dryRun ? 'WOULD refund' : 'Refunded'} ${refundCount} investment(s), `
        + `₹${refundTotal.toFixed(2)} total`);
    console.log(dryRun
        ? '\nDry run complete — nothing written. Re-run without --dry-run to apply.'
        : `\n✅ Migration complete. marginPct set to ${marginPct}%.`);

    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
