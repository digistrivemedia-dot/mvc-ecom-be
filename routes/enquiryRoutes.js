const express = require('express');
const router = express.Router();
const {
    createEnquiry,
    getAllEnquiries,
    getEnquiry,
    updateEnquiry,
    deleteEnquiry,
    getEnquiryStats
} = require('../controllers/enquiryController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// Public routes
router.post('/', createEnquiry);

// Admin routes - protected
router.get('/stats', isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), getEnquiryStats);
router.get('/', isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), getAllEnquiries);
router.get('/:id', isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), getEnquiry);
router.patch('/:id', isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), updateEnquiry);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('admin', 'superadmin'), deleteEnquiry);

module.exports = router;
