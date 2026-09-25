const mongoose = require('mongoose');
const User = require('../models/userModel');

const path = require('path');
// Load environment variables
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.join(__dirname, '../config/config.env') });
}

const updateUserRole = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected Successfully!\n');

        // Get email from command line arguments
        const email = process.argv[2];
        const newRole = process.argv[3] || 'admin';

        if (!email) {
            console.log('❌ Please provide an email address');
            console.log('\nUsage: node updateUserRole.js <email> [role]');
            console.log('Example: node updateUserRole.js myemail@example.com superadmin\n');
            process.exit(1);
        }

        // Find and update user
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`❌ User not found: ${email}\n`);
            process.exit(1);
        }

        const oldRole = user.role;
        user.role = newRole;
        await user.save();

        console.log('✅ User role updated successfully!\n');
        console.log('┌─────────────────────────────────────────────────────┐');
        console.log(`│ Email:    ${email.padEnd(40)} │`);
        console.log(`│ Old Role: ${oldRole.padEnd(40)} │`);
        console.log(`│ New Role: ${newRole.padEnd(40)} │`);
        console.log('└─────────────────────────────────────────────────────┘\n');
        console.log('⚠️  Please log out and log in again to get a new token with the updated role.\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

updateUserRole();
