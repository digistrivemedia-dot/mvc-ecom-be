const express = require('express');
const { getTransactionsSummary } = require('../controllers/reportController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

router.route('/admin/transactions/summary').get(
    isAuthenticatedUser, authorizeRoles("superadmin"), getTransactionsSummary
);

module.exports = router;
