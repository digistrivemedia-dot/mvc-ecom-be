const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, "Please provide coupon code"],
        unique: true,
        uppercase: true,
        trim: true,
        minLength: [3, "Coupon code should have at least 3 characters"],
        maxLength: [20, "Coupon code cannot exceed 20 characters"]
    },
    description: {
        type: String,
        maxLength: [200, "Description cannot exceed 200 characters"]
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: [true, "Please specify discount type"],
        default: 'percentage'
    },
    discountValue: {
        type: Number,
        required: [true, "Please provide discount value"],
        min: [0, "Discount value cannot be negative"]
    },
    minPurchaseAmount: {
        type: Number,
        default: 0,
        min: [0, "Minimum purchase amount cannot be negative"]
    },
    maxDiscountAmount: {
        type: Number,
        // Only applicable for percentage discounts
        default: null
    },
    usageLimit: {
        type: Number,
        default: null, // null means unlimited
        min: [1, "Usage limit must be at least 1"]
    },
    usageCount: {
        type: Number,
        default: 0,
        min: [0, "Usage count cannot be negative"]
    },
    perUserLimit: {
        type: Number,
        default: 1, // Each user can use once by default
        min: [1, "Per user limit must be at least 1"]
    },
    expiryDate: {
        type: Date,
        required: [true, "Please provide expiry date"]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Track which users have used this coupon
    usedBy: [
        {
            user: {
                type: mongoose.Schema.ObjectId,
                ref: "User"
            },
            usedAt: {
                type: Date,
                default: Date.now
            },
            orderAmount: Number
        }
    ],
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
couponSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Method to check if coupon is valid
couponSchema.methods.isValid = function() {
    // Check if active
    if (!this.isActive) {
        return { valid: false, message: "This coupon is not active" };
    }

    // Check if expired
    if (new Date() > this.expiryDate) {
        return { valid: false, message: "This coupon has expired" };
    }

    // Check usage limit
    if (this.usageLimit && this.usageCount >= this.usageLimit) {
        return { valid: false, message: "This coupon has reached its usage limit" };
    }

    return { valid: true };
};

// Method to check if user can use this coupon
couponSchema.methods.canUserUse = function(userId) {
    const userUsageCount = this.usedBy.filter(
        usage => usage.user.toString() === userId.toString()
    ).length;

    if (userUsageCount >= this.perUserLimit) {
        return { canUse: false, message: "You have already used this coupon" };
    }

    return { canUse: true };
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function(orderAmount) {
    let discount = 0;

    if (this.discountType === 'percentage') {
        discount = (orderAmount * this.discountValue) / 100;

        // Apply max discount cap if specified
        if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
            discount = this.maxDiscountAmount;
        }
    } else if (this.discountType === 'fixed') {
        discount = this.discountValue;
    }

    // Discount cannot exceed order amount
    if (discount > orderAmount) {
        discount = orderAmount;
    }

    return Math.round(discount * 100) / 100; // Round to 2 decimal places
};

module.exports = mongoose.model('Coupon', couponSchema);
