const mongoose = require('mongoose');

// Singleton document — always exactly one row. Holds the single global margin
// percentage superadmin sets once instead of pricing every product by hand.
// See MARKETPLACE_CONVERSION_PLAN.md Phase 10 for the formula:
//   price          = listingPrice                        (customer pays this)
//   vendorPrice    = listingPrice / (1 + marginPct/100)   (vendor receives this)
//   investorPrice  = same as vendorPrice                  (investor pays this)
//   investorPayout = listingPrice                         (investor receives this)
const platformSettingsSchema = new mongoose.Schema({
    // Platform's cut, expressed as a markup on what the vendor nets — so at
    // 20% a ₹120 listing pays the vendor ₹100 and the platform ₹20, and an
    // investor funding that unit turns ₹100 into ₹120.
    marginPct: {
        type: Number,
        default: 0,
        min: [0, "Margin cannot be negative"],
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
