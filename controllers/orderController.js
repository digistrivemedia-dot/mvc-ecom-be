const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const Investment = require('../models/investmentModel');
const Transaction = require('../models/transactionModel');
const ErrorHandler = require('../utils/errorHandler');
const sendEmail = require('../utils/sendEmail');
const { calculateUnitProfit } = require('../utils/pricingCalculator');
const { repriceInvestments } = require('../utils/repriceInvestments');

// type -> reversal type, for undoing a sale's settlement on cancellation.
// investor_investment is intentionally excluded: an investor's principal is
// never touched by an order cancellation, only re-pooled (see reverseSettlement).
const REVERSAL_TYPE = {
    vendor_earning: 'vendor_reversal',
    investor_payout: 'investor_reversal',
    superadmin_profit: 'superadmin_reversal',
};

// Marketplace settlement — matches each sold unit to the oldest unmatched
// investment for that product (FIFO) and writes the vendor/investor/
// superadmin ledger rows. Runs once per newly created order.
// See MARKETPLACE_CONVERSION_PLAN.md for the payout formula.
async function settleOrder(order) {
    for (const item of order.orderItems) {
        const product = await Product.findById(item.product);
        if (!product) continue;

        const vendorPrice = product.vendorPrice;
        const hasVendorEarning = vendorPrice != null && vendorPrice > 0;
        // Use the DB's current customer price, not the client-supplied
        // orderItems[i].price, so the ledger can't be gamed by a tampered
        // checkout payload.
        const customerPricePerUnit = product.price ?? item.price;

        const matchedIds = [];

        for (let i = 0; i < item.quantity; i++) {
            const matchedInvestment = await Investment.findOneAndUpdate(
                { product: product._id, status: 'unmatched' },
                { status: 'matched', matchedOrder: order._id, matchedAt: Date.now() },
                { sort: { createdAt: 1 }, new: true }
            );

            const txns = [];

            if (hasVendorEarning) {
                txns.push({
                    type: 'vendor_earning',
                    user: product.user,
                    product: product._id,
                    order: order._id,
                    amount: vendorPrice,
                });
            }

            if (matchedInvestment) {
                matchedIds.push(matchedInvestment._id);
                txns.push({
                    type: 'investor_payout',
                    user: matchedInvestment.investor,
                    product: product._id,
                    order: order._id,
                    investment: matchedInvestment._id,
                    amount: matchedInvestment.expectedPayout,
                });
                txns.push({
                    type: 'superadmin_profit',
                    product: product._id,
                    order: order._id,
                    investment: matchedInvestment._id,
                    amount: calculateUnitProfit({
                        customerPrice: customerPricePerUnit,
                        vendorPrice: hasVendorEarning ? vendorPrice : 0,
                        amountInvested: matchedInvestment.amountInvested,
                        expectedPayout: matchedInvestment.expectedPayout,
                    }),
                });
            } else {
                txns.push({
                    type: 'superadmin_profit',
                    product: product._id,
                    order: order._id,
                    amount: calculateUnitProfit({
                        customerPrice: customerPricePerUnit,
                        vendorPrice: hasVendorEarning ? vendorPrice : 0,
                    }),
                });
            }

            await Transaction.insertMany(txns);
        }

        if (matchedIds.length > 0) {
            item.matchedInvestments = matchedIds;
        }
    }

    await order.save({ validateBeforeSave: false });
}

// Undoes a cancelled order's settlement: reverses the vendor/investor/
// superadmin ledger rows with offsetting entries, and re-pools any matched
// investments so they're available for the next sale of that product.
async function reverseSettlement(order) {
    const originalTxns = await Transaction.find({
        order: order._id,
        type: { $in: Object.keys(REVERSAL_TYPE) },
    });

    if (originalTxns.length > 0) {
        const reversals = originalTxns.map(txn => ({
            type: REVERSAL_TYPE[txn.type],
            user: txn.user,
            product: txn.product,
            order: txn.order,
            investment: txn.investment,
            amount: -txn.amount,
        }));
        await Transaction.insertMany(reversals);
    }

    for (const item of order.orderItems) {
        if (item.matchedInvestments && item.matchedInvestments.length > 0) {
            await Investment.updateMany(
                { _id: { $in: item.matchedInvestments } },
                { status: 'unmatched', matchedOrder: null, matchedAt: null }
            );

            // These investments were frozen at whatever the price was when they
            // were made, and repriceInvestments deliberately skips matched ones.
            // Re-pooling them makes them live again, so they have to be brought
            // up to today's terms here — otherwise an investment made at 120 that
            // got matched, then cancelled after the vendor dropped to 90, would
            // sit unmatched owing its holder a 120 payout on a 90 product and the
            // platform would settle the next sale of it at a loss.
            const product = await Product.findById(item.product);
            if (product) await repriceInvestments(product);
        }
    }
}

// Create New Order
exports.newOrder = asyncErrorHandler(async (req, res, next) => {

    const {
        shippingInfo,
        orderItems,
        paymentInfo,
        totalPrice,
        couponCode,
    } = req.body;

    const orderExist = await Order.findOne({ paymentInfo });

    if (orderExist) {
        return next(new ErrorHandler("Order Already Placed", 400));
    }

    let couponData = null;
    let discountAmount = 0;

    // If coupon code is provided, apply it — customer orders only, investors
    // don't get order discounts (see couponController.js).
    if (couponCode) {
        if (req.user.role !== 'user') {
            return next(new ErrorHandler("Coupons are only applicable for customer orders", 403));
        }

        const Coupon = require('../models/couponModel');
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

        if (!coupon) {
            return next(new ErrorHandler("Invalid coupon code", 404));
        }

        // Check if coupon is valid
        const validityCheck = coupon.isValid();
        if (!validityCheck.valid) {
            return next(new ErrorHandler(validityCheck.message, 400));
        }

        // Check if user can use this coupon
        const userCheck = coupon.canUserUse(req.user._id);
        if (!userCheck.canUse) {
            return next(new ErrorHandler(userCheck.message, 400));
        }

        // Check minimum purchase amount
        if (totalPrice < coupon.minPurchaseAmount) {
            return next(
                new ErrorHandler(
                    `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required`,
                    400
                )
            );
        }

        // Calculate discount
        discountAmount = coupon.calculateDiscount(totalPrice);

        // Track usage
        coupon.usedBy.push({
            user: req.user._id,
            usedAt: new Date(),
            orderAmount: totalPrice
        });

        // Increment usage count
        coupon.usageCount += 1;
        await coupon.save();

        couponData = {
            couponUsed: coupon._id,
            couponCode: coupon.code,
            discountAmount: discountAmount
        };
    }

    // Reduce stock for each product in the order
    for (const item of orderItems) {
        await updateStock(item.product, item.quantity);
    }

    const order = await Order.create({
        shippingInfo,
        orderItems,
        paymentInfo,
        totalPrice,
        ...couponData,
        paidAt: Date.now(),
        user: req.user._id,
        orderStatus: "Confirmed", // Set to Confirmed after payment
        statusHistory: [{
            status: "Confirmed",
            timestamp: Date.now(),
            note: "Order placed and payment confirmed"
        }]
    });

    // Marketplace settlement — matches investor-funded units and writes
    // vendor/investor/superadmin ledger rows for this order.
    await settleOrder(order);

    await sendEmail({
        email: req.user.email,
        templateId: process.env.SENDGRID_ORDER_TEMPLATEID,
        data: {
            name: req.user.name,
            shippingInfo,
            orderItems,
            totalPrice,
            discountAmount,
            finalAmount: totalPrice - discountAmount,
            oid: order._id,
        }
    });

    res.status(201).json({
        success: true,
        order,
    });
});

// Get Single Order Details
exports.getSingleOrderDetails = asyncErrorHandler(async (req, res, next) => {

    const order = await Order.findById(req.params.id).populate("user", "name email _id");

    if (!order) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    res.status(200).json({
        success: true,
        order,
    });
});


// Get Logged In User Orders
exports.myOrders = asyncErrorHandler(async (req, res, next) => {

    const orders = await Order.find({ user: req.user._id }).populate("user", "name email _id");

    if (!orders) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    res.status(200).json({
        success: true,
        orders,
    });
});


// Get All Orders ---ADMIN
exports.getAllOrders = asyncErrorHandler(async (req, res, next) => {

    const orders = await Order.find().populate("user", "name email _id");

    if (!orders) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    let totalAmount = 0;
    orders.forEach((order) => {
        totalAmount += order.totalPrice;
    });

    res.status(200).json({
        success: true,
        orders,
        totalAmount,
    });
});

// Update Order Status ---ADMIN
exports.updateOrder = asyncErrorHandler(async (req, res, next) => {

    const order = await Order.findById(req.params.id);

    if (!order) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    const { status, note } = req.body;

    // Validate status
    const validStatuses = ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
        return next(new ErrorHandler("Invalid order status", 400));
    }

    // Prevent updating if already delivered
    if (order.orderStatus === "Delivered") {
        return next(new ErrorHandler("Cannot update status of delivered order", 400));
    }

    // Prevent updating if already cancelled
    if (order.orderStatus === "Cancelled") {
        return next(new ErrorHandler("Cannot update status of cancelled order", 400));
    }

    // Status flow validation (prevent going backward)
    const statusFlow = {
        "Pending": 0,
        "Confirmed": 1,
        "Processing": 2,
        "Packed": 3,
        "Shipped": 4,
        "Delivered": 5,
        "Cancelled": -1 // Can cancel at any stage
    };

    const currentStatusLevel = statusFlow[order.orderStatus];
    const newStatusLevel = statusFlow[status];

    // Allow cancellation at any stage
    if (status !== "Cancelled" && newStatusLevel < currentStatusLevel) {
        return next(new ErrorHandler(`Cannot change status from ${order.orderStatus} to ${status}`, 400));
    }

    // Restore stock when order is cancelled
    if (status === "Cancelled" && order.orderStatus !== "Cancelled") {
        for (const item of order.orderItems) {
            await restoreStock(item.product, item.quantity);
        }
        await reverseSettlement(order);
    }

    // Update timestamps based on status
    if (status === "Packed" && !order.packedAt) {
        order.packedAt = Date.now();
    }
    if (status === "Shipped" && !order.shippedAt) {
        order.shippedAt = Date.now();
    }
    if (status === "Delivered" && !order.deliveredAt) {
        order.deliveredAt = Date.now();
    }
    if (status === "Cancelled" && !order.cancelledAt) {
        order.cancelledAt = Date.now();
        if (note) {
            order.cancellationReason = note;
        }
    }

    // Add to status history
    order.statusHistory.push({
        status: status,
        timestamp: Date.now(),
        updatedBy: req.user._id,
        note: note || `Status updated to ${status}`
    });

    // Update order status
    order.orderStatus = status;

    await order.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        message: `Order status updated to ${status}`,
        order
    });
});

async function updateStock(id, quantity) {
    const product = await Product.findById(id);
    product.stock -= quantity;
    await product.save({ validateBeforeSave: false });
}

async function restoreStock(id, quantity) {
    const product = await Product.findById(id);
    product.stock += quantity;
    await product.save({ validateBeforeSave: false });
}

// Delete Order ---ADMIN
exports.deleteOrder = asyncErrorHandler(async (req, res, next) => {

    const order = await Order.findById(req.params.id);

    if (!order) {
        return next(new ErrorHandler("Order Not Found", 404));
    }

    await order.remove();

    res.status(200).json({
        success: true,
    });
});