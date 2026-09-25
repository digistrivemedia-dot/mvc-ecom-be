/**
 * Migration Script: Update Category Index
 * 
 * This script:
 * 1. Drops the old unique index on 'slug'
 * 2. Creates a new compound unique index on 'slug' and 'parent'
 * 
 * This allows the same subcategory name to exist under different parent categories
 * For example: "Floor Tiles" can exist under both "Ceramic" and "Porcelain"
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/config.env') });

const runMigration = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('categories');

        // Get existing indexes
        const indexes = await collection.indexes();
        console.log('\n📋 Current indexes:', indexes.map(i => i.name));

        // Drop the old unique index on 'slug' if it exists
        try {
            await collection.dropIndex('slug_1');
            console.log('✅ Dropped old unique index on "slug"');
        } catch (error) {
            if (error.code === 27) {
                console.log('ℹ️  Index "slug_1" does not exist, skipping drop');
            } else {
                throw error;
            }
        }

        // Create the new compound unique index
        await collection.createIndex(
            { slug: 1, parent: 1 },
            { unique: true, name: 'slug_parent_unique' }
        );
        console.log('✅ Created compound unique index on "slug" and "parent"');

        // Verify new indexes
        const newIndexes = await collection.indexes();
        console.log('\n📋 Updated indexes:', newIndexes.map(i => i.name));

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📌 You can now create subcategories with the same name under different parent categories.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
};

runMigration();
