const express = require('express');
const {
    createCategory,
    getAllCategories,
    getActiveCategories,
    getCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
    reorderCategories
} = require('../controllers/categoryController');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.route('/categories').get(getActiveCategories);
router.route('/category/:id').get(getCategory);

// Admin routes
router.route('/admin/categories')
    .get(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), getAllCategories)
    .post(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), createCategory);

router.route('/admin/category/:id')
    .get(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), getCategory)
    .put(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), updateCategory)
    .delete(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), deleteCategory);

router.route('/admin/category/:id/toggle')
    .patch(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), toggleCategoryStatus);

router.route('/admin/categories/reorder')
    .patch(isAuthenticatedUser, authorizeRoles("admin", "superadmin"), reorderCategories);

module.exports = router;
