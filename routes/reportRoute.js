const express = require('express');
const { getTransactionsSummary, getAllPayments } = require('../controllers/reportController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

router.route('/admin/transactions/summary').get(
    isAuthenticatedUser, authorizeRoles("superadmin"), getTransactionsSummary
);

router.route('/admin/payments').get(
    isAuthenticatedUser, authorizeRoles("superadmin"), getAllPayments
);

module.exports = router;
