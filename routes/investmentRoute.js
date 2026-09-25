const express = require('express');
const { invest, myInvestments, myEarnings } = require('../controllers/investmentController');
const { isAuthenticatedUser, authorizeRoles, requireApproved } = require('../middlewares/auth');

const router = express.Router();

router.route('/investor/invest').post(
    isAuthenticatedUser, authorizeRoles("investor"), requireApproved('investorProfile'), invest
);
router.route('/investor/investments/me').get(
    isAuthenticatedUser, authorizeRoles("investor"), myInvestments
);
router.route('/investor/earnings').get(
    isAuthenticatedUser, authorizeRoles("investor"), myEarnings
);

module.exports = router;
