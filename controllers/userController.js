const User = require('../models/userModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const sendToken = require('../utils/sendToken');
const ErrorHandler = require('../utils/errorHandler');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const cloudinary = require('cloudinary');

// Register User
exports.registerUser = asyncErrorHandler(async (req, res, next) => {

    const { name, email, gender, password, avatar, role, vendorProfile, investorProfile } = req.body;

    // Prepare user data
    const userData = {
        name,
        email,
        gender,
        password,
    };

    // Self-service signup can only ever pick 'vendor' or 'investor' (never
    // 'admin'/'superadmin') and always starts unapproved regardless of what
    // the client sends for approvalStatus.
    if (role === 'vendor') {
        userData.role = 'vendor';
        userData.vendorProfile = {
            businessName: vendorProfile?.businessName,
            gstNumber: vendorProfile?.gstNumber,
            payoutDetails: vendorProfile?.payoutDetails,
            approvalStatus: 'pending',
        };
    } else if (role === 'investor') {
        userData.role = 'investor';
        userData.investorProfile = {
            payoutDetails: investorProfile?.payoutDetails,
            approvalStatus: 'pending',
        };
    }

    // Only upload avatar if provided
    if (avatar) {
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
            crop: "scale",
        });

        userData.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
        };
    }

    const user = await User.create(userData);

    sendToken(user, 201, res);
});

// Login User
exports.loginUser = asyncErrorHandler(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new ErrorHandler("Please Enter Email And Password", 400));
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
        return next(new ErrorHandler("Invalid Email or Password", 401));
    }

    const isPasswordMatched = await user.comparePassword(password);

    if (!isPasswordMatched) {
        return next(new ErrorHandler("Invalid Email or Password", 401));
    }

    sendToken(user, 201, res);
});

// Logout User
exports.logoutUser = asyncErrorHandler(async (req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
    });

    res.status(200).json({
        success: true,
        message: "Logged Out",
    });
});

// Get User Details
exports.getUserDetails = asyncErrorHandler(async (req, res, next) => {

    const user = await User.findById(req.user.id);

    res.status(200).json({
        success: true,
        user,
    });
});

// Forgot Password
exports.forgotPassword = asyncErrorHandler(async (req, res, next) => {

    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return next(new ErrorHandler("User Not Found", 404));
    }

    const resetToken = await user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // const resetPasswordUrl = `${req.protocol}://${req.get("host")}/password/reset/${resetToken}`;
    const resetPasswordUrl = `https://${req.get("host")}/password/reset/${resetToken}`;

    // const message = `Your password reset token is : \n\n ${resetPasswordUrl}`;

    try {
        await sendEmail({
            email: user.email,
            templateId: process.env.SENDGRID_RESET_TEMPLATEID,
            data: {
                reset_url: resetPasswordUrl
            }
        });

        res.status(200).json({
            success: true,
            message: `Email sent to ${user.email} successfully`,
        });

    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({ validateBeforeSave: false });
        return next(new ErrorHandler(error.message, 500))
    }
});

// Reset Password
exports.resetPassword = asyncErrorHandler(async (req, res, next) => {

    // create hash token
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        return next(new ErrorHandler("Invalid reset password token", 404));
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    sendToken(user, 200, res);
});

// Update Password
exports.updatePassword = asyncErrorHandler(async (req, res, next) => {

    const user = await User.findById(req.user.id).select("+password");

    const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

    if (!isPasswordMatched) {
        return next(new ErrorHandler("Old Password is Invalid", 400));
    }

    user.password = req.body.newPassword;
    await user.save();
    sendToken(user, 201, res);
});

// Update User Profile
exports.updateProfile = asyncErrorHandler(async (req, res, next) => {

    const newUserData = {
        name: req.body.name,
        email: req.body.email,
    }

    // Only update avatar if provided
    if (req.body.avatar && req.body.avatar !== "") {
        const user = await User.findById(req.user.id);

        // Delete old avatar if exists
        if (user.avatar && user.avatar.public_id) {
            await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        }

        // Upload new avatar
        const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
            folder: "avatars",
            width: 150,
            crop: "scale",
        });

        newUserData.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
        }
    }

    await User.findByIdAndUpdate(req.user.id, newUserData, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });

    res.status(200).json({
        success: true,
    });
});

// ADMIN DASHBOARD

// Get All Users --ADMIN
exports.getAllUsers = asyncErrorHandler(async (req, res, next) => {

    const users = await User.aggregate([
        {
            $lookup: {
                from: "orders",
                localField: "_id",
                foreignField: "user",
                as: "userOrders"
            }
        },
        {
            $addFields: {
                totalOrders: { $size: "$userOrders" },
                totalSpent: { $sum: "$userOrders.totalPrice" },
                phone: { $ifNull: [ { $arrayElemAt: ["$addresses.phoneNo", 0] }, "N/A" ] }
            }
        },
        {
            $project: {
                // Exclude fields to keep the payload clean
                userOrders: 0,
                cart: 0,
                wishlist: 0,
                recentlyViewed: 0,
                __v: 0,
                resetPasswordToken: 0,
                resetPasswordExpire: 0
            }
        }
    ]);

    res.status(200).json({
        success: true,
        users,
    });
});

// Get Single User Details --ADMIN
exports.getSingleUser = asyncErrorHandler(async (req, res, next) => {

    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorHandler(`User doesn't exist with id: ${req.params.id}`, 404));
    }

    res.status(200).json({
        success: true,
        user,
    });
});

// Update User Role --ADMIN
exports.updateUserRole = asyncErrorHandler(async (req, res, next) => {

    const newUserData = {
        name: req.body.name,
        email: req.body.email,
        gender: req.body.gender,
        role: req.body.role,
    }

    await User.findByIdAndUpdate(req.params.id, newUserData, {
        new: true,
        runValidators: true,
        useFindAndModify: false,
    });

    res.status(200).json({
        success: true,
    });
});

// Approve/Reject Vendor or Investor Onboarding --SUPERADMIN
exports.approveUserProfile = asyncErrorHandler(async (req, res, next) => {

    const { approvalStatus } = req.body;

    if (!['approved', 'rejected'].includes(approvalStatus)) {
        return next(new ErrorHandler("approvalStatus must be 'approved' or 'rejected'", 400));
    }

    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorHandler(`User doesn't exist with id: ${req.params.id}`, 404));
    }

    const profileKey = user.role === 'vendor' ? 'vendorProfile'
        : user.role === 'investor' ? 'investorProfile'
        : null;

    if (!profileKey) {
        return next(new ErrorHandler("User is not a vendor or investor", 400));
    }

    user[profileKey].approvalStatus = approvalStatus;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        message: `${user.role} ${approvalStatus}`,
        user,
    });
});

// Delete Role --ADMIN
exports.deleteUser = asyncErrorHandler(async (req, res, next) => {

    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorHandler(`User doesn't exist with id: ${req.params.id}`, 404));
    }

    await user.remove();

    res.status(200).json({
        success: true
    });
});
// ADDRESS MANAGEMENT

// Add New Address
exports.addAddress = asyncErrorHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }

    const { name, phoneNo, address, city, state, country, pincode, addressType, isDefault } = req.body;

    // If this is set as default, unset all other defaults
    if (isDefault) {
        user.addresses.forEach(addr => {
            addr.isDefault = false;
        });
    }

    // If this is the first address, make it default
    const makeDefault = user.addresses.length === 0 || isDefault;

    user.addresses.push({
        name,
        phoneNo,
        address,
        city,
        state,
        country: country || "India",
        pincode,
        addressType: addressType || "home",
        isDefault: makeDefault
    });

    await user.save();

    res.status(201).json({
        success: true,
        message: "Address added successfully",
        addresses: user.addresses
    });
});

// Update Address
exports.updateAddress = asyncErrorHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }

    const addressIndex = user.addresses.findIndex(
        addr => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
        return next(new ErrorHandler("Address not found", 404));
    }

    const { name, phoneNo, address, city, state, country, pincode, addressType, isDefault } = req.body;

    // If this is set as default, unset all other defaults
    if (isDefault) {
        user.addresses.forEach(addr => {
            addr.isDefault = false;
        });
    }

    // Update the address
    user.addresses[addressIndex] = {
        ...user.addresses[addressIndex],
        name,
        phoneNo,
        address,
        city,
        state,
        country: country || "India",
        pincode,
        addressType: addressType || "home",
        isDefault: isDefault || user.addresses[addressIndex].isDefault
    };

    await user.save();

    res.status(200).json({
        success: true,
        message: "Address updated successfully",
        addresses: user.addresses
    });
});

// Delete Address
exports.deleteAddress = asyncErrorHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }

    const addressIndex = user.addresses.findIndex(
        addr => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
        return next(new ErrorHandler("Address not found", 404));
    }

    const wasDefault = user.addresses[addressIndex].isDefault;

    // Remove the address
    user.addresses.splice(addressIndex, 1);

    // If deleted address was default and there are other addresses, make the first one default
    if (wasDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
        success: true,
        message: "Address deleted successfully",
        addresses: user.addresses
    });
});

// Set Default Address
exports.setDefaultAddress = asyncErrorHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return next(new ErrorHandler("User not found", 404));
    }

    const addressIndex = user.addresses.findIndex(
        addr => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
        return next(new ErrorHandler("Address not found", 404));
    }

    // Unset all defaults
    user.addresses.forEach(addr => {
        addr.isDefault = false;
    });

    // Set the selected address as default
    user.addresses[addressIndex].isDefault = true;

    await user.save();

    res.status(200).json({
        success: true,
        message: "Default address updated successfully",
        addresses: user.addresses
    });
});
