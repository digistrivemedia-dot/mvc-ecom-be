/**
 * fix-tile-units.js
 * 
 * Bulk updates all products in the "tiles" category that are missing the
 * `unit` field, setting unit='Sq.ft' and coverage=10.75 (default for
 * 600x1200mm tiles with 4 tiles/box).
 * 
 * Run with: node scripts/fix-tile-units.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../config/config.env') });

const Product = require('../models/productModel');
const Category = require('../models/categoryModel');

async function fixTileUnits() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find the tiles category
  const tilesCategory = await Category.findOne({ slug: 'tiles' });
  if (!tilesCategory) {
    console.error('Tiles category not found!');
    process.exit(1);
  }
  console.log(`Found tiles category: ${tilesCategory.name} (${tilesCategory._id})`);

  // Find all tile products missing unit
  const productsWithNoUnit = await Product.find({
    category: tilesCategory._id,
    $or: [{ unit: { $exists: false } }, { unit: null }, { unit: '' }]
  });

  console.log(`\nFound ${productsWithNoUnit.length} tile products missing unit field:`);
  productsWithNoUnit.forEach(p => console.log(`  - ${p.name}`));

  if (productsWithNoUnit.length === 0) {
    console.log('\nNo products to update.');
    process.exit(0);
  }

  // Bulk update: set unit='Sq.ft', tilesPerBox=4 (default for 600x1200mm)
  // NOTE: We do NOT set coverage automatically since it varies per product.
  // Admin should set coverage individually via the edit form.
  const result = await Product.updateMany(
    {
      category: tilesCategory._id,
      $or: [{ unit: { $exists: false } }, { unit: null }, { unit: '' }]
    },
    {
      $set: {
        unit: 'Sq.ft',
        tilesPerBox: 4,  // default for 600x1200mm: 4 tiles = 1 box
      }
    }
  );

  console.log(`\n✅ Updated ${result.modifiedCount} products:`);
  console.log(`   - unit set to 'Sq.ft'`);
  console.log(`   - tilesPerBox set to 4`);
  console.log(`\n⚠️  NOTE: 'coverage' (sq.ft per box) was NOT set automatically.`);
  console.log(`   Please update each product individually with the correct coverage.`);
  console.log(`   For 600x1200mm tiles (4/box): coverage ≈ 10.75 sq.ft`);
  console.log(`   For tiles with 8.5 coverage already set, they are correct.`);

  await mongoose.disconnect();
  console.log('\nDone. MongoDB disconnected.');
}

fixTileUnits().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
