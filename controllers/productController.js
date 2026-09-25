const Product = require('../models/productModel');
const Investment = require('../models/investmentModel');
const PlatformSettings = require('../models/platformSettingsModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const SearchFeatures = require('../utils/searchFeatures');
const ErrorHandler = require('../utils/errorHandler');
const cloudinary = require('cloudinary');
const { calculateGlobalPricing } = require('../utils/pricingCalculator');

// Vendors may only mutate their own products; admin/superadmin bypass this check.
function isOwnerOrAdmin(req, product) {
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        return true;
    }
    return product.user && product.user.toString() === req.user.id.toString();
}

// Fields only superadmin is allowed to set (customer price, investor terms,
// pricing/listing status). Stripped from vendor-submitted create/update
// bodies so a vendor can't self-price or self-publish their own listing.
const SUPERADMIN_ONLY_FIELDS = [
    'price', 'cuttedPrice', 'investorPrice', 'investorPayout',
    'investableUnits', 'pricingStatus', 'listingStatus',
];

function stripSuperadminOnlyFields(body) {
    for (const field of SUPERADMIN_ONLY_FIELDS) {
        delete body[field];
    }
}

// Get All Products
exports.getAllProducts = asyncErrorHandler(async (req, res, next) => {

    // Use limit from query params, default to 12
    const resultPerPage = Number(req.query.limit) || 12;
    const productsCount = await Product.countDocuments({ listingStatus: 'live' });
    // console.log(req.query);

    const searchFeature = new SearchFeatures(Product.find({ listingStatus: 'live' }), req.query)
        .search()
        .filter();

    await searchFeature.filterByCategory();

    let products = await searchFeature.query.populate('category subcategory', 'name slug');
    let filteredProductsCount = products.length;

    searchFeature.pagination(resultPerPage);

    products = await searchFeature.query.clone().populate('category subcategory', 'name slug');

    res.status(200).json({
        success: true,
        products,
        productsCount,
        resultPerPage,
        filteredProductsCount,
    });
});

// Get All Products ---Product Sliders
exports.getProducts = asyncErrorHandler(async (req, res, next) => {
    const products = await Product.find({ listingStatus: 'live' }).sort({ createdAt: -1 }).populate('category subcategory', 'name slug');

    res.status(200).json({
        success: true,
        products,
    });
});

// Get Product Details
exports.getProductDetails = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id).populate('category subcategory', 'name slug');

    if (!product || product.listingStatus !== 'live') {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    res.status(200).json({
        success: true,
        product,
    });
});

// Get Single Product Details, any listingStatus ---ADMIN
// Same as getProductDetails but without the 'live' filter, since admin/
// superadmin needs to open drafts and pending-approval products (e.g. to
// price and publish them) that the public endpoint correctly hides.
exports.getAdminProductDetails = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id).populate('category subcategory', 'name slug');

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    res.status(200).json({
        success: true,
        product,
    });
});

// Get All Products ---ADMIN
exports.getAdminProducts = asyncErrorHandler(async (req, res, next) => {
    const products = await Product.find().sort({ createdAt: -1 }).populate('category subcategory', 'name slug');

    res.status(200).json({
        success: true,
        products,
    });
});

// Get logged-in vendor's own products (any listingStatus — draft, pending, live, rejected, paused)
exports.getVendorProducts = asyncErrorHandler(async (req, res, next) => {
    const searchFeature = new SearchFeatures(Product.find({ user: req.user.id }), req.query)
        .search()
        .filter();

    const products = await searchFeature.query
        .sort({ createdAt: -1 })
        .populate('category subcategory', 'name slug');

    res.status(200).json({
        success: true,
        products,
    });
});

// Get live products open for investment ---INVESTOR
exports.getInvestorProducts = asyncErrorHandler(async (req, res, next) => {
    const searchFeature = new SearchFeatures(
        Product.find({ listingStatus: 'live', investorPrice: { $ne: null } }),
        req.query
    ).search().filter();

    const products = await searchFeature.query
        .sort({ createdAt: -1 })
        .populate('category subcategory', 'name slug');

    // Attach remaining investable units (investableUnits minus units already
    // funded) so the frontend can cap the invest quantity stepper per product.
    const investedCounts = await Investment.aggregate([
        { $match: { product: { $in: products.map((p) => p._id) } } },
        { $group: { _id: '$product', count: { $sum: 1 } } },
    ]);
    const investedByProduct = new Map(investedCounts.map((row) => [String(row._id), row.count]));

    const productsWithAvailability = products.map((p) => {
        const investableUnits = p.investableUnits ?? p.stock;
        const investedUnits = investedByProduct.get(String(p._id)) || 0;
        return {
            ...p.toObject(),
            remainingInvestableUnits: Math.max(investableUnits - investedUnits, 0),
        };
    });

    res.status(200).json({
        success: true,
        products: productsWithAvailability,
    });
});

// Create Product ---ADMIN
exports.createProduct = asyncErrorHandler(async (req, res, next) => {

    let images = [];
    if (typeof req.body.images === "string") {
        images.push(req.body.images);
    } else {
        images = req.body.images;
    }

    const imagesLink = [];

    for (let i = 0; i < images.length; i++) {
        const result = await cloudinary.v2.uploader.upload(images[i], {
            folder: "products",
        });

        imagesLink.push({
            public_id: result.public_id,
            url: result.secure_url,
            isFeatured: i === 0 ? true : false, // First image is featured by default
        });
    }

    req.body.images = imagesLink;
    req.body.user = req.user.id;

    if (req.user.role === 'vendor') {
        // Vendor supplies vendorPrice + catalog info only. Customer/investor
        // pricing auto-computes from the global markup settings and the
        // listing publishes immediately — no manual per-product approval
        // step. Superadmin can still override any specific product's
        // pricing later via the pricing panel (see updateProductPricing).
        stripSuperadminOnlyFields(req.body);

        const vendorPrice = Number(req.body.vendorPrice) || 0;
        if (vendorPrice > 0) {
            const settings = await PlatformSettings.getSingleton();
            const { price, investorPrice, investorPayout } = calculateGlobalPricing(vendorPrice, settings);
            req.body.price = price;
            req.body.investorPrice = investorPrice;
            req.body.investorPayout = investorPayout;
        }
        req.body.pricingStatus = vendorPrice > 0 ? 'priced' : 'pending_pricing';
        req.body.listingStatus = vendorPrice > 0 ? 'live' : 'draft';
        req.body.useGlobalPricing = true;
    } else {
        // Admin/superadmin creating directly — publish immediately, same as
        // the existing single-vendor admin workflow.
        req.body.pricingStatus = 'priced';
        req.body.listingStatus = 'live';
    }

    if (req.body.specifications && Array.isArray(req.body.specifications)) {
        req.body.specifications = req.body.specifications.map(s =>
            typeof s === 'string' ? JSON.parse(s) : s
        );
    }

    // Handle care instructions
    if (req.body.careInstructions && Array.isArray(req.body.careInstructions)) {
        req.body.careInstructions = req.body.careInstructions.map(c =>
            typeof c === 'string' ? JSON.parse(c) : c
        );
    }

    // Handle tags (if it's a string, convert to array)
    if (req.body.tags && typeof req.body.tags === 'string') {
        req.body.tags = JSON.parse(req.body.tags);
    }

    // Handle variants with images
    if (req.body.variants && typeof req.body.variants === 'string') {
        const variants = JSON.parse(req.body.variants);

        // Process variant images
        const processedVariants = [];
        for (const variant of variants) {
            const variantData = { ...variant };

            // Upload variant images if they exist
            if (variant.images && Array.isArray(variant.images) && variant.images.length > 0) {
                const variantImagesLink = [];

                for (let i = 0; i < variant.images.length; i++) {
                    const result = await cloudinary.v2.uploader.upload(variant.images[i], {
                        folder: "products/variants",
                    });

                    variantImagesLink.push({
                        public_id: result.public_id,
                        url: result.secure_url,
                        isFeatured: i === (variant.featuredImageIndex || 0)
                    });
                }

                variantData.images = variantImagesLink;
                delete variantData.featuredImageIndex; // Remove this as we use isFeatured instead
            }

            processedVariants.push(variantData);
        }

        req.body.variants = processedVariants;
    }

    // Handle tiles-specific fields
    if (req.body.dimensions) {
        req.body.dimensions = JSON.parse(req.body.dimensions);
    }

    if (req.body.roomType && typeof req.body.roomType === 'string') {
        req.body.roomType = JSON.parse(req.body.roomType);
    }

    if (req.body.bulkPricing && typeof req.body.bulkPricing === 'string') {
        req.body.bulkPricing = JSON.parse(req.body.bulkPricing);
    }

    const product = await Product.create(req.body);

    res.status(201).json({
        success: true,
        product
    });
});

// Update Product ---ADMIN
exports.updateProduct = asyncErrorHandler(async (req, res, next) => {

    console.log('=== UPDATE PRODUCT DEBUG ===');
    console.log('Product ID:', req.params.id);
    console.log('Request Body Keys:', Object.keys(req.body));
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    let product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    if (!isOwnerOrAdmin(req, product)) {
        return next(new ErrorHandler("You are not allowed to update this product", 403));
    }

    if (req.user.role === 'vendor') {
        // Vendors can update their own catalog info/stock, never pricing or
        // publish status directly — those go through the dedicated
        // superadmin-only pricing/listing-status endpoints. If this product
        // is still on auto-pricing and the vendor changes their cost,
        // re-derive the customer/investor numbers from it so they stay
        // in sync with the global markup settings.
        stripSuperadminOnlyFields(req.body);

        const newVendorPrice = Number(req.body.vendorPrice);
        if (!Number.isNaN(newVendorPrice) && newVendorPrice > 0 && product.useGlobalPricing !== false) {
            const settings = await PlatformSettings.getSingleton();
            const { price, investorPrice, investorPayout } = calculateGlobalPricing(newVendorPrice, settings);
            req.body.price = price;
            req.body.investorPrice = investorPrice;
            req.body.investorPayout = investorPayout;
            req.body.pricingStatus = 'priced';
            if (product.listingStatus === 'draft' || product.listingStatus === 'pending_approval') {
                req.body.listingStatus = 'live';
            }
        }
    }

    if (req.body.images !== undefined) {
        let images = [];
        if (typeof req.body.images === "string") {
            images.push(req.body.images);
        } else if (Array.isArray(req.body.images)) {
            images = req.body.images;
        }

        if (images && images.length > 0) {
            // Keep existing images and append new ones
            const imagesLink = [...(product.images || [])];

            for (let i = 0; i < images.length; i++) {
                const result = await cloudinary.v2.uploader.upload(images[i], {
                    folder: "products",
                });

                imagesLink.push({
                    public_id: result.public_id,
                    url: result.secure_url,
                    isFeatured: false,
                });
            }
            req.body.images = imagesLink;
        }
    }

    // FIX: Handle featured image index update (when user changes featured image without uploading new ones)
    if (req.body.featuredImageIndex !== undefined && product.images && product.images.length > 0) {
        const featuredIndex = parseInt(req.body.featuredImageIndex);
        if (featuredIndex >= 0 && featuredIndex < product.images.length) {
            // Update all images to set only the selected one as featured
            product.images.forEach((img, index) => {
                img.isFeatured = index === featuredIndex;
            });
            // Mark the images field as modified so Mongoose saves it
            product.markModified('images');
            await product.save();
        }
        // Remove featuredImageIndex from req.body so it doesn't get saved as a field
        delete req.body.featuredImageIndex;
    }

    // Handle brand logo update
    if (req.body.logo && req.body.logo.length > 0) {
        // Delete old logo if exists
        if (product.brand && product.brand.logo && product.brand.logo.public_id) {
            await cloudinary.v2.uploader.destroy(product.brand.logo.public_id);
        }

        const result = await cloudinary.v2.uploader.upload(req.body.logo, {
            folder: "brands",
        });
        const brandLogo = {
            public_id: result.public_id,
            url: result.secure_url,
        };

        req.body.brand = {
            name: req.body.brandname,
            logo: brandLogo
        };
    } else if (req.body.brandname) {
        // Update brand name only if logo not provided
        req.body.brand = {
            name: req.body.brandname,
            logo: product.brand?.logo // Keep existing logo
        };
    }

    if (req.body.specifications && Array.isArray(req.body.specifications) && req.body.specifications.length > 0) {
        let specs = [];
        req.body.specifications.forEach((s) => {
            if (typeof s === 'string') {
                specs.push(JSON.parse(s));
            } else {
                specs.push(s);
            }
        });
        req.body.specifications = specs;
    }

    // Handle care instructions
    if (req.body.careInstructions && Array.isArray(req.body.careInstructions)) {
        req.body.careInstructions = req.body.careInstructions.map(c =>
            typeof c === 'string' ? JSON.parse(c) : c
        );
    }

    // Handle tiles-specific fields
    if (req.body.dimensions && typeof req.body.dimensions === 'string') {
        req.body.dimensions = JSON.parse(req.body.dimensions);
    }

    if (req.body.roomType && typeof req.body.roomType === 'string') {
        req.body.roomType = JSON.parse(req.body.roomType);
    }

    if (req.body.bulkPricing && typeof req.body.bulkPricing === 'string') {
        req.body.bulkPricing = JSON.parse(req.body.bulkPricing);
    }

    // Handle tags (if it's a string, convert to array)
    if (req.body.tags && typeof req.body.tags === 'string') {
        req.body.tags = JSON.parse(req.body.tags);
    }

    // Handle variants with images
    if (req.body.variants && typeof req.body.variants === 'string') {
        const variants = JSON.parse(req.body.variants);

        // Process variant images
        const processedVariants = [];
        for (const variant of variants) {
            const variantData = { ...variant };

            // Upload variant images if they exist and are base64 strings (new uploads)
            if (variant.images && Array.isArray(variant.images) && variant.images.length > 0) {
                const variantImagesLink = [];

                for (let i = 0; i < variant.images.length; i++) {
                    const image = variant.images[i];

                    // Check if this is a new base64 image upload or an existing URL
                    if (typeof image === 'string' && image.startsWith('data:')) {
                        // New image - upload to Cloudinary
                        const result = await cloudinary.v2.uploader.upload(image, {
                            folder: "products/variants",
                        });

                        variantImagesLink.push({
                            public_id: result.public_id,
                            url: result.secure_url,
                            isFeatured: i === (variant.featuredImageIndex || 0)
                        });
                    } else if (typeof image === 'string' && image.startsWith('http')) {
                        // Existing image URL - keep as is
                        // Find the existing image from the product to preserve public_id
                        const existingVariant = product.variants?.find(v =>
                            v.productId === variant.productId ||
                            (v.color === variant.color && v.size === variant.size)
                        );
                        const existingImage = existingVariant?.images?.find(img => img.url === image);

                        if (existingImage) {
                            variantImagesLink.push({
                                public_id: existingImage.public_id,
                                url: existingImage.url,
                                isFeatured: i === (variant.featuredImageIndex || 0)
                            });
                        }
                    }
                }

                variantData.images = variantImagesLink;
                delete variantData.featuredImageIndex; // Remove this as we use isFeatured instead
            }

            processedVariants.push(variantData);
        }

        req.body.variants = processedVariants;
    }

    // Don't overwrite the original creator/vendor on update.
    delete req.body.user;

    console.log('=== ABOUT TO UPDATE ===');
    console.log('Update Data:', JSON.stringify(req.body, null, 2));

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });

    console.log('=== UPDATED PRODUCT ===');
    console.log('Updated Product Name:', product.name);
    console.log('Updated Product Description:', product.description?.substring(0, 100));
    console.log('Updated Product Price:', product.price);

    res.status(201).json({
        success: true,
        product
    });
});

// Set customer/investor pricing ---SUPERADMIN
// The only place price, investorPrice, investorPayout, and investableUnits
// can be set — vendors never touch these (see stripSuperadminOnlyFields).
exports.updateProductPricing = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    // Resets this product back onto the global markup settings instead of
    // taking a manually-typed price — recomputes from vendorPrice right now.
    if (req.body.useGlobalPricing === true) {
        if (product.vendorPrice == null) {
            return next(new ErrorHandler("This product has no vendor cost to calculate from", 400));
        }
        const settings = await PlatformSettings.getSingleton();
        const derived = calculateGlobalPricing(product.vendorPrice, settings);
        product.price = derived.price;
        product.investorPrice = derived.investorPrice;
        product.investorPayout = derived.investorPayout;
        product.useGlobalPricing = true;
        product.pricingStatus = 'priced';
        await product.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            product,
        });
    }

    const { price, investorPrice, investorPayout, investableUnits } = req.body;

    if (price === undefined || price === null) {
        return next(new ErrorHandler("Customer price is required", 400));
    }

    product.price = price;
    product.investorPrice = investorPrice ?? null;
    product.investorPayout = investorPayout ?? null;
    if (investableUnits !== undefined) {
        product.investableUnits = investableUnits;
    }
    product.pricingStatus = 'priced';
    // Manually setting a price here means this product no longer follows
    // the global markup settings until superadmin resets it (above).
    product.useGlobalPricing = false;

    await product.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        product,
    });
});

// Approve/reject/pause a listing ---SUPERADMIN
// A listing can only go 'live' once superadmin has set pricing.
exports.updateListingStatus = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    const { listingStatus } = req.body;
    const validStatuses = ['draft', 'pending_approval', 'live', 'rejected', 'paused'];

    if (!validStatuses.includes(listingStatus)) {
        return next(new ErrorHandler("Invalid listing status", 400));
    }

    if (listingStatus === 'live' && product.pricingStatus !== 'priced') {
        return next(new ErrorHandler("Set customer pricing before publishing this listing", 400));
    }

    product.listingStatus = listingStatus;
    await product.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        message: `Listing status updated to ${listingStatus}`,
        product,
    });
});

// Delete Product ---ADMIN
exports.deleteProduct = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    if (!isOwnerOrAdmin(req, product)) {
        return next(new ErrorHandler("You are not allowed to delete this product", 403));
    }

    for (let i = 0; i < product.images.length; i++) {
        await cloudinary.v2.uploader.destroy(product.images[i].public_id);
    }

    await product.remove();

    res.status(201).json({
        success: true
    });
});

// Create OR Update Reviews
exports.createProductReview = asyncErrorHandler(async (req, res, next) => {

    const { rating, comment, productId } = req.body;

    const review = {
        user: req.user._id,
        name: req.user.name,
        rating: Number(rating),
        comment,
    }

    const product = await Product.findById(productId);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    const isReviewed = product.reviews.find(review => review.user.toString() === req.user._id.toString());

    if (isReviewed) {

        product.reviews.forEach((rev) => {
            if (rev.user.toString() === req.user._id.toString())
                (rev.rating = rating, rev.comment = comment);
        });
    } else {
        product.reviews.push(review);
        product.numOfReviews = product.reviews.length;
    }

    let avg = 0;

    product.reviews.forEach((rev) => {
        avg += rev.rating;
    });

    product.ratings = avg / product.reviews.length;

    await product.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true
    });
});

// Get All Reviews of Product
exports.getProductReviews = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.query.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    res.status(200).json({
        success: true,
        reviews: product.reviews
    });
});

// Delete Reveiws
exports.deleteReview = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.query.productId);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    const reviews = product.reviews.filter((rev) => rev._id.toString() !== req.query.id.toString());

    let avg = 0;

    reviews.forEach((rev) => {
        avg += rev.rating;
    });

    let ratings = 0;

    if (reviews.length === 0) {
        ratings = 0;
    } else {
        ratings = avg / reviews.length;
    }

    const numOfReviews = reviews.length;

    await Product.findByIdAndUpdate(req.query.productId, {
        reviews,
        ratings: Number(ratings),
        numOfReviews,
    }, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });

    res.status(200).json({
        success: true,
    });
});