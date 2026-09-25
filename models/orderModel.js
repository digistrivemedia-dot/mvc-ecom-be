const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    shippingInfo: {
        address: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true
        },
        pincode: {
            type: Number,
            required: true
        },
        phoneNo: {
            type: Number,
            required: true
        },
    },
    orderItems: [
        {
            name: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            image: {
                type: String,
                required: true
            },
            product: {
                type: mongoose.Schema.ObjectId,
                ref: "Product",
                required: true
            },
            // Investments matched to this line item's units at settlement
            // time (one per unit funded, FIFO — see MARKETPLACE_CONVERSION_PLAN.md).
            // Used by cancellation to re-pool exactly these investments.
            matchedInvestments: [{
                type: mongoose.Schema.ObjectId,
                ref: "Investment"
            }],
        },
    ],
    user: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: true
    },
    paymentInfo: {
        id: {
            type: String,
            required: true
        },
        status: {
            type: String,
            required: true
        },
    },
    paidAt: {
        type: Date,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0
    },
    // Coupon information
    couponUsed: {
        type: mongoose.Schema.ObjectId,
        ref: "Coupon",
        default: null
    },
    couponCode: {
        type: String,
        default: null
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    orderStatus: {
        type: String,
        required: true,
        enum: [
            "Pending",
            "Confirmed",
            "Processing",
            "Packed",
            "Shipped",
            "Delivered",
            "Cancelled"
        ],
        default: "Confirmed", // Default to Confirmed after payment
    },
    statusHistory: [
        {
            status: {
                type: String,
                enum: ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Delivered", "Cancelled"]
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            updatedBy: {
                type: mongoose.Schema.ObjectId,
                ref: "User"
            },
            note: String
        }
    ],
    packedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
});

module.exports = mongoose.model("Order", orderSchema);