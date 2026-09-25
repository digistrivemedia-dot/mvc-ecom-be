const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
    // Product Information
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product is required']
    },
    productName: {
        type: String,
        required: [true, 'Product name is required']
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1']
    },
    totalPrice: {
        type: Number,
        default: 0
    },

    // Customer Information
    customerName: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true
    },
    customerPhone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    customerCity: {
        type: String,
        required: [true, 'City is required'],
        trim: true
    },
    message: {
        type: String,
        trim: true
    },

    // Status Tracking
    status: {
        type: String,
        enum: ['pending', 'contacted', 'quoted', 'converted', 'rejected'],
        default: 'pending'
    },

    // Admin Notes
    adminNotes: {
        type: String,
        trim: true
    },

    // Timestamps
    contactedAt: {
        type: Date
    },
    quotedAt: {
        type: Date
    },
    convertedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for faster queries
enquirySchema.index({ status: 1, createdAt: -1 });
enquirySchema.index({ customerPhone: 1 });
enquirySchema.index({ product: 1 });

// Virtual for formatted date
enquirySchema.virtual('formattedDate').get(function () {
    return this.createdAt.toLocaleDateString('en-IN');
});

const Enquiry = mongoose.model('Enquiry', enquirySchema);

module.exports = Enquiry;
