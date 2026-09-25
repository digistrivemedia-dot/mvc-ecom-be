const express = require('express');
const { getVendorStats, getVendorOrders, getVendorTransactions } = require('../controllers/vendorController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

router.route('/vendor/stats').get(isAuthenticatedUser, authorizeRoles("vendor"), getVendorStats);
router.route('/vendor/orders').get(isAuthenticatedUser, authorizeRoles("vendor"), getVendorOrders);
router.route('/vendor/transactions').get(isAuthenticatedUser, authorizeRoles("vendor"), getVendorTransactions);

module.exports = router;
