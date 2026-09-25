const mongoose = require('mongoose');
const Category = require('../models/categoryModel');

const path = require('path');
// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../config/config.env') });

const categories = [
  {
    name: "Tiles",
    description: "All types of tiles for floor, wall, bathroom, and kitchen",
    subcategories: [
      "Simple",
      "Full Body",
      "Heavy",
      "Anti-Skid",
      "Wood",
      "Motif",
      "60×30",
      "Kajaria",
      "Imported"
    ]
  },
  {
    name: "Sanitary & CP Fittings",
    description: "Complete range of sanitary ware and CP fittings",
    subcategories: [
      "CP Fittings - Grohe",
      "CP Fittings - American Standard",
      "CP Fittings - Jaquar ESSCO",
      "CP Fittings - CERA",
      "CP Fittings - Hindware",
      "CP Fittings - Parryware",
      "CP Fittings - Bell",
      "CP Fittings - Simpolo",
      "Sanitary Ware - Jaquar",
      "Sanitary Ware - Parryware",
      "Sanitary Ware - ESSCO",
      "Sanitary Ware - CERA",
      "Sanitary Ware - Glocera"
    ]
  },
  {
    name: "Chimney",
    description: "Kitchen chimneys from top brands",
    subcategories: [
      "KAFF",
      "FABER",
      "Elica",
      "Crompton",
      "Hindware"
    ]
  },
  {
    name: "Hob & Gas Stove",
    description: "Gas hobs and stoves for your kitchen",
    subcategories: [
      "Prestige",
      "Faber",
      "Pigeon",
      "Glen",
      "Butterfly",
      "Kaff",
      "Sunflame"
    ]
  },
  {
    name: "Adhesive & Cement",
    description: "Tile adhesives and cement products",
    subcategories: [
      "ACC",
      "Birla Super",
      "Ultratech",
      "Maha",
      "Roff",
      "Myk",
      "Asian Paints",
      "Dr. Fixit"
    ]
  },
  {
    name: "Plumbing",
    description: "Plumbing pipes, fittings and accessories",
    subcategories: [
      "Ashirvad",
      "Astral",
      "Finolex",
      "Supreme",
      "Aladdin",
      "Vectus",
      "Sintex"
    ]
  },
  {
    name: "Pumps & Motors",
    description: "Water pumps and motors",
    subcategories: [
      "Kirloskar",
      "Texmo",
      "KSB",
      "Crompton"
    ]
  },
  {
    name: "Accessories",
    description: "Bathroom and kitchen accessories",
    subcategories: [
      "Bathroom Accessories",
      "Kitchen Accessories"
    ]
  },
  {
    name: "Sink",
    description: "Kitchen and bathroom sinks",
    subcategories: [
      "Franke",
      "Futuro",
      "Carysil",
      "Imported"
    ]
  },
  {
    name: "SPA & Wellness",
    description: "Spa and wellness products",
    subcategories: [
      "Shower Partition",
      "Bath Tubs"
    ]
  },
  {
    name: "Locker",
    description: "Home and office lockers",
    subcategories: [
      "Godrej"
    ]
  },
  {
    name: "Geysers",
    description: "Water heaters and geysers",
    subcategories: [
      "A-One",
      "ESSCO",
      "V-Guard",
      "Crompton"
    ]
  }
];

const seedCategories = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing categories
    const existingCount = await Category.countDocuments();
    console.log(`📊 Found ${existingCount} existing categories`);

    const deleteChoice = process.argv[2];
    if (deleteChoice === '--clear') {
      await Category.deleteMany({});
      console.log('🗑️  Cleared all existing categories');
    } else if (existingCount > 0) {
      console.log('⚠️  Categories already exist. Use --clear flag to delete existing categories first');
      console.log('   Example: node scripts/seedCategories.js --clear');
      process.exit(0);
    }

    let order = 0;

    // Create categories with subcategories
    for (const categoryData of categories) {
      // Create parent category
      const parent = await Category.create({
        name: categoryData.name,
        description: categoryData.description,
        parent: null,
        level: 0,
        order: order++,
        isActive: true
      });

      console.log(`✅ Created parent category: ${parent.name}`);

      // Create subcategories
      let subOrder = 0;
      for (const subName of categoryData.subcategories) {
        // Generate unique slug by combining parent slug with subcategory name
        const parentSlug = parent.slug;
        const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const uniqueSlug = `${parentSlug}-${subSlug}`;

        const subcategory = await Category.create({
          name: subName,
          slug: uniqueSlug,
          parent: parent._id,
          level: 1,
          order: subOrder++,
          isActive: true
        });

        console.log(`  ✅ Created subcategory: ${subcategory.name} (${uniqueSlug})`);
      }
    }

    const finalCount = await Category.countDocuments();
    const parentCount = await Category.countDocuments({ parent: null });
    const childCount = await Category.countDocuments({ parent: { $ne: null } });

    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Total categories: ${finalCount}`);
    console.log(`   - Parent categories: ${parentCount}`);
    console.log(`   - Subcategories: ${childCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  }
};

seedCategories();
