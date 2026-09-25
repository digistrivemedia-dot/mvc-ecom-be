const express = require('express');
const { getPricingSettings, updatePricingSettings } = require('../controllers/settingsController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

router.route('/admin/pricing-settings')
    .get(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), getPricingSettings)
    .put(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), updatePricingSettings);

module.exports = router;
