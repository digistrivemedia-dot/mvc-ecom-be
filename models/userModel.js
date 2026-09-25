const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please Enter Your Name"],
    },
    email: {
        type: String,
        required: [true, "Please Enter Your Email"],
        unique: true,
        validate: [validator.isEmail, "Please Enter a Valid Email"],
    },
    gender: {
        type: String,
        required: [true, "Please Enter Gender"],
        enum: ['male', 'female', 'other']
    },
    password: {
        type: String,
        required: [true, "Please Enter Your Password"],
        minLength: [8, "Password should have atleast 8 chars"],
        select: false,
    },
    avatar: {
        public_id: {
            type: String,
        },
        url: {
            type: String,
        }
    },

    // Role-based access control
    role: {
        type: String,
        enum: ['user', 'vendor', 'investor', 'admin', 'superadmin'],
        default: "user",
    },

    // Vendor onboarding + payout details (only relevant when role === 'vendor')
    vendorProfile: {
        businessName: String,
        gstNumber: String,
        payoutDetails: {
            accountName: String,
            accountNumber: String,
            ifsc: String,
            upiId: String,
        },
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
    },

    // Investor onboarding + payout details (only relevant when role === 'investor')
    investorProfile: {
        payoutDetails: {
            accountName: String,
            accountNumber: String,
            ifsc: String,
            upiId: String,
        },
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
    },

    // Cart - stores product references with quantity and variant info
    cart: [
        {
            product: {
                type: mongoose.Schema.ObjectId,
                ref: "Product",
                required: true
            },
            name: String,
            price: Number,
            quantity: {
                type: Number,
                required: true,
                default: 1,
                min: [1, "Quantity cannot be less than 1"]
            },
            image: String,
            // For variant selection (color, size, etc.)
            variant: {
                color: String,
                size: String,
            },
            addedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],

    // Wishlist - stores product references
    wishlist: [
        {
            product: {
                type: mongoose.Schema.ObjectId,
                ref: "Product",
                required: true
            },
            addedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],

    // Multiple addresses for delivery
    addresses: [
        {
            name: {
                type: String,
                required: true
            },
            phoneNo: {
                type: Number,
                required: true,
                minLength: [10, "Phone Number should have 10 digits"]
            },
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
                required: true,
                default: "India"
            },
            pincode: {
                type: Number,
                required: true,
                minLength: [6, "Pincode should have 6 digits"]
            },
            addressType: {
                type: String,
                enum: ['home', 'work', 'other'],
                default: 'home'
            },
            isDefault: {
                type: Boolean,
                default: false
            }
        }
    ],

    // Recently viewed products
    recentlyViewed: [
        {
            product: {
                type: mongoose.Schema.ObjectId,
                ref: "Product"
            },
            viewedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],

    createdAt: {
        type: Date,
        default: Date.now,
    },

    resetPasswordToken: String,
    resetPasswordExpire: Date,
});

userSchema.pre("save", async function (next) {

    if (!this.isModified("password")) {
        next();
    }

    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.getJWTToken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
}

userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
}

userSchema.methods.getResetPasswordToken = async function () {

    // generate token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // generate hash token and add to db
    this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    return resetToken;
}

module.exports = mongoose.model('User', userSchema);