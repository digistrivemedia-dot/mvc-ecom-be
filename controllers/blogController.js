const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const Blog = require('../models/blogModel');
const ErrorHandler = require('../utils/errorHandler');
const cloudinary = require('cloudinary');

// Create New Blog - ADMIN
exports.createBlog = asyncErrorHandler(async (req, res, next) => {
    try {
        const { featuredImage } = req.body;

        // Upload featured image to Cloudinary if it's a base64 string
        if (featuredImage && featuredImage.startsWith('data:')) {
            const result = await cloudinary.v2.uploader.upload(featuredImage, {
                folder: "blogs",
            });

            req.body.featuredImage = result.secure_url;
        }

        const blog = await Blog.create(req.body);

        res.status(201).json({
            success: true,
            blog,
        });
    } catch (error) {
        // Handle duplicate slug error
        if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
            return next(new ErrorHandler('A blog with a similar title already exists. Please use a different title.', 400));
        }
        throw error;
    }
});

// Get All Blogs (Admin - includes drafts)
exports.getAllBlogsAdmin = asyncErrorHandler(async (req, res, next) => {
    const blogs = await Blog.find().sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: blogs.length,
        blogs,
    });
});

// Get All Published Blogs (Public)
exports.getAllBlogs = asyncErrorHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const category = req.query.category;
    const search = req.query.search;

    const query = { status: 'published' };

    if (category) {
        query.category = category;
    }

    if (search) {
        query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    const total = await Blog.countDocuments(query);

    const blogs = await Blog.find(query)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-content'); // Exclude full content for listing

    res.status(200).json({
        success: true,
        count: blogs.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        blogs,
    });
});

// Get Single Blog by Slug (Public)
exports.getBlogBySlug = asyncErrorHandler(async (req, res, next) => {
    const blog = await Blog.findOne({
        slug: req.params.slug,
        status: 'published'
    });

    if (!blog) {
        return next(new ErrorHandler('Blog Not Found', 404));
    }

    // Increment views
    blog.views += 1;
    await blog.save({ validateBeforeSave: false });

    res.status(200).json({
        success: true,
        blog,
    });
});

// Get Single Blog by ID (Admin)
exports.getBlogById = asyncErrorHandler(async (req, res, next) => {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
        return next(new ErrorHandler('Blog Not Found', 404));
    }

    res.status(200).json({
        success: true,
        blog,
    });
});

// Update Blog - ADMIN
exports.updateBlog = asyncErrorHandler(async (req, res, next) => {
    let blog = await Blog.findById(req.params.id);

    if (!blog) {
        return next(new ErrorHandler('Blog Not Found', 404));
    }

    const { featuredImage } = req.body;

    // Upload featured image to Cloudinary if it's a new base64 string
    if (featuredImage && featuredImage.startsWith('data:')) {
        const result = await cloudinary.v2.uploader.upload(featuredImage, {
            folder: "blogs",
        });

        req.body.featuredImage = result.secure_url;
    }

    blog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    res.status(200).json({
        success: true,
        blog,
    });
});

// Delete Blog - ADMIN
exports.deleteBlog = asyncErrorHandler(async (req, res, next) => {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
        return next(new ErrorHandler('Blog Not Found', 404));
    }

    await blog.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Blog deleted successfully',
    });
});

// Get Latest Blogs (Public - for home page)
exports.getLatestBlogs = asyncErrorHandler(async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 4;

    const blogs = await Blog.find({ status: 'published' })
        .sort({ publishedAt: -1 })
        .limit(limit)
        .select('-content');

    res.status(200).json({
        success: true,
        count: blogs.length,
        blogs,
    });
});

// Get Related Blogs (Public)
exports.getRelatedBlogs = asyncErrorHandler(async (req, res, next) => {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
        return next(new ErrorHandler('Blog Not Found', 404));
    }

    const relatedBlogs = await Blog.find({
        _id: { $ne: blog._id },
        status: 'published',
        $or: [
            { category: blog.category },
            { tags: { $in: blog.tags } }
        ]
    })
        .sort({ publishedAt: -1 })
        .limit(4)
        .select('-content');

    res.status(200).json({
        success: true,
        count: relatedBlogs.length,
        blogs: relatedBlogs,
    });
});

// Get Blog Categories with Count (Public)
exports.getBlogCategories = asyncErrorHandler(async (req, res, next) => {
    const categories = await Blog.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    res.status(200).json({
        success: true,
        categories,
    });
});
