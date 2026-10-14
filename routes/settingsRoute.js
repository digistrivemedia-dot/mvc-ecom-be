const express = require('express');
const { getPricingSettings, updatePricingSettings } = require('../controllers/settingsController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

// Vendor read access was added for a "you receive ₹X" readout on the vendor
// product form; that readout was removed, so the permission is back to
// admin/superadmin only rather than left widened for nothing.
router.route('/admin/pricing-settings')
    .get(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), getPricingSettings)
    .put(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), updatePricingSettings);

module.exports = router;
