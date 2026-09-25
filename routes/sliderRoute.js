const express = require('express');
const {
    getAllSliders,
    getAdminSliders,
    getSliderDetails,
    createSlider,
    updateSlider,
    deleteSlider,
    updateSliderOrder
} = require('../controllers/sliderController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.route('/sliders').get(getAllSliders);

// Admin routes
router.route('/admin/sliders').get(isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), getAdminSliders);
router.route('/admin/slider/new').post(isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), createSlider);
router.route('/admin/slider/:id')
    .get(isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), getSliderDetails)
    .put(isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), updateSlider)
    .delete(isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), deleteSlider);
router.route('/admin/sliders/order').put(isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), updateSliderOrder);

module.exports = router;
