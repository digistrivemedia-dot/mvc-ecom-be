const Enquiry = require('../models/enquiryModel');
const Product = require('../models/productModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');

// @desc    Create new enquiry
// @route   POST /api/v1/enquiries
// @access  Public
exports.createEnquiry = asyncErrorHandler(async (req, res, next) => {
    const { productId, productName, quantity, totalPrice, customerName, customerPhone, customerCity, message } = req.body;

    // Validate required fields
    if (!productId || !productName || !quantity || !customerName || !customerPhone || !customerCity) {
        return next(new ErrorHandler('Please provide all required fields', 400));
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
        return next(new ErrorHandler('Product not found', 404));
    }

    // Create enquiry
    const enquiry = await Enquiry.create({
        product: productId,
        productName,
        quantity,
        totalPrice: totalPrice || 0,
        customerName,
        customerPhone,
        customerCity,
        message: message || ''
    });

    // Populate product details
    await enquiry.populate('product', 'name price images category');

    res.status(201).json({
        success: true,
        message: 'Enquiry submitted successfully',
        data: {
            enquiry
        }
    });
});

// @desc    Get all enquiries (Admin)
// @route   GET /api/v1/enquiries
// @access  Private/Admin
exports.getAllEnquiries = asyncErrorHandler(async (req, res, next) => {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) {
        query.status = status;
    }

    const skip = (page - 1) * limit;

    const enquiries = await Enquiry.find(query)
        .populate('product', 'name price images category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Enquiry.countDocuments(query);

    res.status(200).json({
        success: true,
        count: enquiries.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: {
            enquiries
        }
    });
});

// @desc    Get single enquiry (Admin)
// @route   GET /api/v1/enquiries/:id
// @access  Private/Admin
exports.getEnquiry = asyncErrorHandler(async (req, res, next) => {
    const enquiry = await Enquiry.findById(req.params.id)
        .populate('product', 'name price images category description');

    if (!enquiry) {
        return next(new ErrorHandler('Enquiry not found', 404));
    }

    res.status(200).json({
        success: true,
        data: {
            enquiry
        }
    });
});

// @desc    Update enquiry status (Admin)
// @route   PATCH /api/v1/enquiries/:id
// @access  Private/Admin
exports.updateEnquiry = asyncErrorHandler(async (req, res, next) => {
    const { status, adminNotes } = req.body;

    const updateData = {};
    if (status) {
        updateData.status = status;

        // Update timestamp based on status
        if (status === 'contacted') updateData.contactedAt = Date.now();
        if (status === 'quoted') updateData.quotedAt = Date.now();
        if (status === 'converted') updateData.convertedAt = Date.now();
    }
    if (adminNotes !== undefined) {
        updateData.adminNotes = adminNotes;
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
    ).populate('product', 'name price images category');

    if (!enquiry) {
        return next(new ErrorHandler('Enquiry not found', 404));
    }

    res.status(200).json({
        success: true,
        message: 'Enquiry updated successfully',
        data: {
            enquiry
        }
    });
});

// @desc    Delete enquiry (Admin)
// @route   DELETE /api/v1/enquiries/:id
// @access  Private/Admin
exports.deleteEnquiry = asyncErrorHandler(async (req, res, next) => {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);

    if (!enquiry) {
        return next(new ErrorHandler('Enquiry not found', 404));
    }

    res.status(200).json({
        success: true,
        message: 'Enquiry deleted successfully',
        data: null
    });
});

// @desc    Get enquiry statistics (Admin)
// @route   GET /api/v1/enquiries/stats
// @access  Private/Admin
exports.getEnquiryStats = asyncErrorHandler(async (req, res, next) => {
    const stats = await Enquiry.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const total = await Enquiry.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Enquiry.countDocuments({ createdAt: { $gte: today } });

    res.status(200).json({
        success: true,
        data: {
            total,
            todayCount,
            byStatus: stats
        }
    });
});
