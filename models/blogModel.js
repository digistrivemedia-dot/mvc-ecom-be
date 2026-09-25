const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please enter blog title'],
        trim: true,
        maxLength: [200, 'Blog title cannot exceed 200 characters']
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true
    },
    excerpt: {
        type: String,
        required: [true, 'Please enter blog excerpt'],
        maxLength: [300, 'Excerpt cannot exceed 300 characters']
    },
    content: {
        type: String,
        required: [true, 'Please enter blog content']
    },
    featuredImage: {
        type: String,
        default: ''
    },
    author: {
        type: String,
        required: [true, 'Please enter author name'],
        default: 'Admin'
    },
    category: {
        type: String,
        required: [true, 'Please select a category'],
        enum: [
            'Tile Trends',
            'Installation Tips',
            'Design Ideas',
            'Maintenance Guide',
            'Product Reviews',
            'Industry News',
            'DIY Projects',
            'Case Studies'
        ]
    },
    tags: [{
        type: String,
        trim: true
    }],
    status: {
        type: String,
        required: true,
        enum: ['draft', 'published'],
        default: 'draft'
    },
    views: {
        type: Number,
        default: 0
    },
    publishedAt: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Create slug from title before validation
blogSchema.pre('validate', async function(next) {
    if (this.title && (!this.slug || this.isModified('title'))) {
        let baseSlug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Check if slug already exists
        let slug = baseSlug;
        let counter = 1;

        // Keep checking until we find a unique slug
        while (true) {
            const existingBlog = await mongoose.models.Blog.findOne({
                slug: slug,
                _id: { $ne: this._id } // Exclude current document if updating
            });

            if (!existingBlog) {
                break; // Slug is unique
            }

            // Add counter to make it unique
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        this.slug = slug;
    }
    next();
});

// Set publishedAt date when status changes to published
blogSchema.pre('save', function(next) {
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
        this.publishedAt = Date.now();
    }
    next();
});

// Index for better search performance
blogSchema.index({ title: 'text', excerpt: 'text', content: 'text' });
blogSchema.index({ slug: 1 });
blogSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
