/**
 * backfillMarketplaceFields.js
 *
 * Phase 3 (product pricing/listing model) added `pricingStatus` and
 * `listingStatus` to Product, and the public product endpoints now only
 * return `listingStatus: 'live'`. Every product that existed before this
 * change has neither field stored, so Mongoose reads them back as the new
 * schema defaults ('pending_pricing' / 'draft') — which would make the
 * entire pre-existing catalog disappear from the storefront.
 *
 * This one-time script marks all pre-existing products as already priced
 * and live, since they were created through the single-admin flow and
 * already have a customer-facing `price` set.
 *
 * Run with: node scripts/backfillMarketplaceFields.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../config/config.env') });

const Product = require('../models/productModel');

async function backfillMarketplaceFields() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await Product.updateMany(
    { listingStatus: { $exists: false } },
    {
      $set: {
        pricingStatus: 'priced',
        listingStatus: 'live',
      }
    }
  );

  console.log(`\n✅ Updated ${result.modifiedCount} pre-existing products:`);
  console.log(`   - pricingStatus set to 'priced'`);
  console.log(`   - listingStatus set to 'live'`);

  await mongoose.disconnect();
  console.log('\nDone. MongoDB disconnected.');
}

backfillMarketplaceFields().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
