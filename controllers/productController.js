const Product = require('../models/productModel');
const Investment = require('../models/investmentModel');
const Order = require('../models/orderModel');
const PlatformSettings = require('../models/platformSettingsModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const SearchFeatures = require('../utils/searchFeatures');
const ErrorHandler = require('../utils/errorHandler');
const cloudinary = require('cloudinary');
const { calculateGlobalPricing, resolveMarginPct } = require('../utils/pricingCalculator');
const { repriceInvestments } = require('../utils/repriceInvestments');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// How much sales history the investor liquidity analytics look back over, and
// how much of it counts as "recent" for the headline velocity figure.
const SALES_WINDOW_WEEKS = 12;
const RECENT_WEEKS = 4;

// Vendors may only mutate their own products; admin/superadmin bypass this check.
function isOwnerOrAdmin(req, product) {
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        return true;
    }
    return product.user && product.user.toString() === req.user.id.toString();
}

// Fields a vendor may not set on their own listing. Note `price` is NOT here:
// since Phase 10 the vendor names their own listing price and everything else
// (their net, the investor's terms) is derived from it — those derived fields
// are what's off-limits, along with the publish/pricing status.
const SUPERADMIN_ONLY_FIELDS = [
    'cuttedPrice', 'vendorPrice', 'investorPrice', 'investorPayout',
    'investableUnits', 'pricingStatus', 'listingStatus', 'marginPct',
];

function stripSuperadminOnlyFields(body) {
    for (const field of SUPERADMIN_ONLY_FIELDS) {
        delete body[field];
    }
}

// Replaces a submitted listing price with the full derived price set, so the
// calculator is the only thing that can ever write vendorPrice/investorPrice/
// investorPayout. Returns false if no usable price was submitted (a vendor
// saving a draft before naming one). Call AFTER stripSuperadminOnlyFields.
//
// `product` is the existing doc on an update, so a product carrying its own
// margin override keeps being priced at that margin rather than silently
// reverting to the global one the next time anyone edits it.
async function applyListingPrice(body, product = null) {
    const listingPrice = Number(body.price);
    delete body.price;

    if (Number.isNaN(listingPrice) || listingPrice <= 0) return false;

    const settings = await PlatformSettings.getSingleton();
    // An override arriving in this request wins over the stored one.
    const effective = {
        marginPct: resolveMarginPct(
            { marginPct: body.marginPct ?? product?.marginPct ?? null },
            settings
        ),
    };
    Object.assign(body, calculateGlobalPricing(listingPrice, effective));
    return true;
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

    const productIds = products.map((p) => p._id);

    // Every product returns exactly marginPct, so return rate can't tell two
    // listings apart any more (see MARKETPLACE_CONVERSION_PLAN.md Phase 10).
    // What actually differs is HOW LONG an investor's capital is tied up, which
    // is a function of two things: how fast the product sells, and how many
    // unmatched investments are queued ahead of theirs under FIFO. Both come
    // from here so the investor UI can turn a flat 20% into an annualised
    // figure and a wait estimate.
    const [investmentStats, salesByWeek] = await Promise.all([
        Investment.aggregate([
            { $match: { product: { $in: productIds } } },
            {
                $group: {
                    _id: '$product',
                    count: { $sum: 1 },
                    // FIFO queue depth: units funded but not yet sold. A new
                    // investment sits behind all of these.
                    unmatched: {
                        $sum: { $cond: [{ $eq: ['$status', 'unmatched'] }, 1, 0] },
                    },
                    matched: {
                        $sum: { $cond: [{ $eq: ['$status', 'matched'] }, 1, 0] },
                    },
                    // Summed wait of everything that HAS sold, for a real
                    // observed average rather than a modelled one.
                    matchedMs: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'matched'] }, { $ne: ['$matchedAt', null] }] },
                                { $subtract: ['$matchedAt', '$createdAt'] },
                                0,
                            ],
                        },
                    },
                },
            },
        ]),
        Order.aggregate([
            {
                $match: {
                    orderStatus: { $ne: 'Cancelled' },
                    createdAt: { $gte: new Date(Date.now() - SALES_WINDOW_WEEKS * WEEK_MS) },
                },
            },
            { $unwind: '$orderItems' },
            { $match: { 'orderItems.product': { $in: productIds } } },
            {
                // Bucket by whole weeks back from now. Done with arithmetic
                // rather than $dateTrunc so it works on older MongoDB too.
                $addFields: {
                    weeksAgo: {
                        $floor: {
                            $divide: [{ $subtract: [new Date(), '$createdAt'] }, WEEK_MS],
                        },
                    },
                },
            },
            {
                $group: {
                    _id: { product: '$orderItems.product', weeksAgo: '$weeksAgo' },
                    units: { $sum: '$orderItems.quantity' },
                },
            },
        ]),
    ]);

    const statsByProduct = new Map(investmentStats.map((row) => [String(row._id), row]));

    // product id -> number[SALES_WINDOW_WEEKS], oldest week first so the
    // sparkline reads left-to-right like every other time axis.
    const weeklyByProduct = new Map();
    for (const row of salesByWeek) {
        const key = String(row._id.product);
        const weeksAgo = Number(row._id.weeksAgo);
        if (weeksAgo < 0 || weeksAgo >= SALES_WINDOW_WEEKS) continue;
        if (!weeklyByProduct.has(key)) {
            weeklyByProduct.set(key, new Array(SALES_WINDOW_WEEKS).fill(0));
        }
        weeklyByProduct.get(key)[SALES_WINDOW_WEEKS - 1 - weeksAgo] += row.units;
    }

    const productsWithAvailability = products.map((p) => {
        const investableUnits = p.investableUnits ?? p.stock;
        const stats = statsByProduct.get(String(p._id));
        const investedUnits = stats?.count || 0;
        const weekly = weeklyByProduct.get(String(p._id)) || new Array(SALES_WINDOW_WEEKS).fill(0);
        const soldInWindow = weekly.reduce((sum, n) => sum + n, 0);

        return {
            ...p.toObject(),
            // --- Liquidity analytics (investor decision support) ---
            salesByWeek: weekly,
            unitsSoldRecent: weekly.slice(-RECENT_WEEKS).reduce((sum, n) => sum + n, 0),
            unitsSoldWindow: soldInWindow,
            salesWindowWeeks: SALES_WINDOW_WEEKS,
            recentWeeks: RECENT_WEEKS,
            // Units funded but unsold — a new investment queues behind these.
            queueAhead: stats?.unmatched || 0,
            unitsMatched: stats?.matched || 0,
            // Observed average days from investment to sale, null when nothing
            // has sold yet (the UI must say "no history" rather than imply 0).
            avgDaysToMatch: stats?.matched
                ? Number((stats.matchedMs / stats.matched / DAY_MS).toFixed(1))
                : null,
            // Resolved (never null) so the investor UI can show funding
            // progress and sort by "most invested" without re-deriving it.
            investableUnits,
            investedUnits,
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
        // Vendor supplies the listing price + catalog info. Their own net and
        // the investor's terms derive from it via the global margin; the
        // listing stays pending until admin/superadmin approves it, so it
        // never publishes automatically.
        stripSuperadminOnlyFields(req.body);

        const hasPrice = await applyListingPrice(req.body);
        req.body.pricingStatus = hasPrice ? 'priced' : 'pending_pricing';
        req.body.listingStatus = hasPrice ? 'pending_approval' : 'draft';
    } else {
        // Admin/superadmin creating directly — publish immediately, same as
        // the existing single-vendor admin workflow. Still derived, so the
        // vendor/investor split is right even on an admin-created product.
        await applyListingPrice(req.body);
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

    // Tracks whether this update moved the price, so unmatched investments can
    // be repriced/refunded after the product is saved (see the end of this
    // handler). Captured before the save because that's the only point the old
    // price is still readable.
    const priceBeforeUpdate = product.price;

    if (req.user.role === 'vendor') {
        // Vendors own their listing price and catalog info, never the derived
        // vendor/investor numbers or the publish status. Re-deriving on every
        // price change is mandatory, not optional — a stale vendorPrice would
        // pay them the wrong amount on the next sale.
        stripSuperadminOnlyFields(req.body);

        if (await applyListingPrice(req.body, product)) {
            req.body.pricingStatus = 'priced';
            // Still awaiting first approval, or vendor is resubmitting after a
            // rejection — send it back into the approval queue rather than
            // publishing it directly. Never touches an already-live/paused listing.
            if (['draft', 'pending_approval', 'rejected'].includes(product.listingStatus)) {
                req.body.listingStatus = 'pending_approval';
                req.body.rejectionNote = null;
            }
        }
    } else {
        // Admin/superadmin editing a product's price through the normal edit
        // form rather than the pricing panel — derive just the same.
        if (req.body.price !== undefined) {
            await applyListingPrice(req.body, product);
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

    // The price moved, so anyone holding an unfunded unit of this product at
    // the old price is now over-invested — refund them the difference.
    let refunds = [];
    if (product.price !== priceBeforeUpdate) {
        refunds = await repriceInvestments(product);
    }

    res.status(201).json({
        success: true,
        product,
        refunds,
    });
});

// Override a product's listing price, margin, and investable units ---SUPERADMIN
//
// Two settable numbers: the listing price, and optionally a margin that
// applies to this product alone instead of the global one. The vendor's net
// and the investor's terms are always derived from those two (see
// utils/pricingCalculator.js) and are never typed in, which is why this does
// not take investorPrice/investorPayout.
exports.updateProductPricing = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    const { price, investableUnits, marginPct } = req.body;

    if (price === undefined || price === null || Number(price) <= 0) {
        return next(new ErrorHandler("Customer price is required", 400));
    }

    // marginPct is tri-state: a number sets a per-product override, explicit
    // null clears it back to the global margin, and omitting the key leaves
    // whatever is already stored alone.
    if (marginPct !== undefined) {
        if (marginPct === null || marginPct === '') {
            product.marginPct = null;
        } else if (Number.isNaN(Number(marginPct)) || Number(marginPct) < 0) {
            return next(new ErrorHandler("Margin must be a positive number", 400));
        } else {
            product.marginPct = Number(marginPct);
        }
    }

    const priceBeforeUpdate = product.price;

    const settings = await PlatformSettings.getSingleton();
    const derived = calculateGlobalPricing(Number(price), {
        marginPct: resolveMarginPct(product, settings),
    });
    product.price = derived.price;
    product.vendorPrice = derived.vendorPrice;
    product.investorPrice = derived.investorPrice;
    product.investorPayout = derived.investorPayout;

    // Tri-state, same as marginPct: a number caps investable units, explicit
    // null (or an empty field) clears the cap so it follows stock again, and
    // omitting the key leaves the stored value alone.
    if (investableUnits !== undefined) {
        product.investableUnits =
            investableUnits === null || investableUnits === '' ? null : Number(investableUnits);
    }
    product.pricingStatus = 'priced';

    await product.save({ validateBeforeSave: false });

    // Dropping the price means unmatched investors overpaid — refund them.
    const refunds = product.price !== priceBeforeUpdate
        ? await repriceInvestments(product)
        : [];

    res.status(200).json({
        success: true,
        product,
        refunds,
        effectiveMarginPct: resolveMarginPct(product, settings),
    });
});

// Approve/reject/pause a listing ---SUPERADMIN
// A listing can only go 'live' once superadmin has set pricing.
exports.updateListingStatus = asyncErrorHandler(async (req, res, next) => {

    const product = await Product.findById(req.params.id);

    if (!product) {
        return next(new ErrorHandler("Product Not Found", 404));
    }

    const { listingStatus, rejectionNote } = req.body;
    const validStatuses = ['draft', 'pending_approval', 'live', 'rejected', 'paused'];

    if (!validStatuses.includes(listingStatus)) {
        return next(new ErrorHandler("Invalid listing status", 400));
    }

    if (listingStatus === 'live' && product.pricingStatus !== 'priced') {
        return next(new ErrorHandler("Set customer pricing before publishing this listing", 400));
    }

    product.listingStatus = listingStatus;
    // Rejection note only makes sense attached to a rejection — clear it the
    // moment the status moves anywhere else so it can't linger stale.
    product.rejectionNote = listingStatus === 'rejected' ? (rejectionNote || null) : null;
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