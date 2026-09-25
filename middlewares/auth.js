const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const ErrorHandler = require('../utils/errorHandler');
const asyncErrorHandler = require('./asyncErrorHandler');

exports.isAuthenticatedUser = asyncErrorHandler(async (req, res, next) => {

    let token = req.cookies.token;

    // Check for Bearer token in Authorization header if no cookie
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new ErrorHandler("Please Login to Access", 401))
    }

    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decodedData.id);
    next();
});

exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {

        if (!roles.includes(req.user.role)) {
            return next(new ErrorHandler(`Role: ${req.user.role} is not allowed`, 403));
        }
        next();
    }
}

// Blocks vendor/investor actions (creating products, placing investments)
// until superadmin has approved their onboarding. profileKey is
// 'vendorProfile' or 'investorProfile'.
exports.requireApproved = (profileKey) => {
    return (req, res, next) => {

        const profile = req.user[profileKey];

        if (!profile || profile.approvalStatus !== 'approved') {
            return next(new ErrorHandler("Your account is pending superadmin approval", 403));
        }
        next();
    }
}