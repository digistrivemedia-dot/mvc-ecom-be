const Coupon = require('../models/couponModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');

// Create Coupon - Admin only
exports.createCoupon = asyncErrorHandler(async (req, res, next) => {
    const {
        code,
        description,
        discountType,
        discountValue,
        minPurchaseAmount,
        maxDiscountAmount,
        usageLimit,
        perUserLimit,
        expiryDate,
        isActive
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue || !expiryDate) {
        return next(new ErrorHandler("Please provide all required fields", 400));
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
        return next(new ErrorHandler("Coupon code already exists", 400));
    }

    // Validate discount value based on type
    if (discountType === 'percentage' && discountValue > 100) {
        return next(new ErrorHandler("Percentage discount cannot exceed 100%", 400));
    }

    // Create coupon
    const coupon = await Coupon.create({
        code: code.toUpperCase(),
        description,
        discountType,
        discountValue,
        minPurchaseAmount: minPurchaseAmount || 0,
        maxDiscountAmount: maxDiscountAmount || null,
        usageLimit: usageLimit || null,
        perUserLimit: perUserLimit || 1,
        expiryDate: new Date(expiryDate),
        isActive: isActive !== undefined ? isActive : true,
        createdBy: req.user.id
    });

    res.status(201).json({
        success: true,
        coupon,
        message: "Coupon created successfully"
    });
});

// Get All Coupons - Admin only
exports.getAllCoupons = asyncErrorHandler(async (req, res, next) => {
    const coupons = await Coupon.find()
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: coupons.length,
        coupons
    });
});

// Get Active Coupons - All users
exports.getActiveCoupons = asyncErrorHandler(async (req, res, next) => {
    const coupons = await Coupon.find({
        isActive: true,
        expiryDate: { $gt: new Date() }
    })
        .select('-usedBy -createdBy')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: coupons.length,
        coupons
    });
});

// Get Single Coupon - Admin only
exports.getCoupon = asyncErrorHandler(async (req, res, next) => {
    const coupon = await Coupon.findById(req.params.id)
        .populate('createdBy', 'name email');

    if (!coupon) {
        return next(new ErrorHandler("Coupon not found", 404));
    }

    res.status(200).json({
        success: true,
        coupon
    });
});

// Validate Coupon - All users
exports.validateCoupon = asyncErrorHandler(async (req, res, next) => {
    const { code, orderAmount } = req.body;

    if (!code || !orderAmount) {
        return next(new ErrorHandler("Please provide coupon code and order amount", 400));
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
        return next(new ErrorHandler("Invalid coupon code", 404));
    }

    // Check if coupon is valid
    const validityCheck = coupon.isValid();
    if (!validityCheck.valid) {
        return next(new ErrorHandler(validityCheck.message, 400));
    }

    // Check minimum purchase amount
    if (orderAmount < coupon.minPurchaseAmount) {
        return next(
            new ErrorHandler(
                `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required`,
                400
            )
        );
    }

    // Check if user can use this coupon (only for authenticated users)
    if (req.user) {
        const userCheck = coupon.canUserUse(req.user.id);
        if (!userCheck.canUse) {
            return next(new ErrorHandler(userCheck.message, 400));
        }
    }

    // Calculate discount
    const discount = coupon.calculateDiscount(orderAmount);

    res.status(200).json({
        success: true,
        valid: true,
        coupon: {
            code: coupon.code,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discount,
            finalAmount: orderAmount - discount
        }
    });
});

// Apply Coupon - Track usage
exports.applyCoupon = asyncErrorHandler(async (req, res, next) => {
    const { code, orderAmount } = req.body;

    if (!code || !orderAmount) {
        return next(new ErrorHandler("Please provide coupon code and order amount", 400));
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
        return next(new ErrorHandler("Invalid coupon code", 404));
    }

    // Check if coupon is valid
    const validityCheck = coupon.isValid();
    if (!validityCheck.valid) {
        return next(new ErrorHandler(validityCheck.message, 400));
    }

    // Check minimum purchase amount
    if (orderAmount < coupon.minPurchaseAmount) {
        return next(
            new ErrorHandler(
                `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required`,
                400
            )
        );
    }

    // Check if user can use this coupon (only for authenticated users)
    if (req.user) {
        const userCheck = coupon.canUserUse(req.user.id);
        if (!userCheck.canUse) {
            return next(new ErrorHandler(userCheck.message, 400));
        }
    }

    // NOTE: Usage count is NOT incremented here
    // It's tracked when the actual order is created in orderController.newOrder()

    // Calculate discount
    const discount = coupon.calculateDiscount(orderAmount);

    res.status(200).json({
        success: true,
        applied: true,
        coupon: {
            code: coupon.code,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discount,
            finalAmount: orderAmount - discount
        }
    });
});

// Update Coupon - Admin only
exports.updateCoupon = asyncErrorHandler(async (req, res, next) => {
    let coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new ErrorHandler("Coupon not found", 404));
    }

    // Don't allow updating code if coupon has been used
    if (req.body.code && coupon.usageCount > 0) {
        return next(
            new ErrorHandler("Cannot update code for a coupon that has been used", 400)
        );
    }

    // Validate discount value if being updated
    if (req.body.discountType === 'percentage' && req.body.discountValue > 100) {
        return next(new ErrorHandler("Percentage discount cannot exceed 100%", 400));
    }

    coupon = await Coupon.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    res.status(200).json({
        success: true,
        coupon,
        message: "Coupon updated successfully"
    });
});

// Delete Coupon - Admin only
exports.deleteCoupon = asyncErrorHandler(async (req, res, next) => {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new ErrorHandler("Coupon not found", 404));
    }

    await coupon.deleteOne();

    res.status(200).json({
        success: true,
        message: "Coupon deleted successfully"
    });
});

// Toggle Coupon Active Status - Admin only
exports.toggleCouponStatus = asyncErrorHandler(async (req, res, next) => {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new ErrorHandler("Coupon not found", 404));
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
        success: true,
        coupon,
        message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`
    });
});
