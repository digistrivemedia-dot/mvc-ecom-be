const mongoose = require('mongoose');

// Singleton document — always exactly one row. Holds the global markup
// percentages superadmin sets once instead of pricing every product by hand.
// See MARKETPLACE_CONVERSION_PLAN.md for the formula:
//   price          = vendorPrice * (1 + customerMarkupPct/100)
//   investorPrice  = vendorPrice * (1 + investorMarkupPct/100)
//   investorPayout = investorPrice * (1 + investorReturnPct/100)
const platformSettingsSchema = new mongoose.Schema({
    customerMarkupPct: {
        type: Number,
        default: 0,
        min: [0, "Markup cannot be negative"],
    },
    investorMarkupPct: {
        type: Number,
        default: 0,
        min: [0, "Markup cannot be negative"],
    },
    investorReturnPct: {
        type: Number,
        default: 0,
        min: [0, "Return cannot be negative"],
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

platformSettingsSchema.statics.getSingleton = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
