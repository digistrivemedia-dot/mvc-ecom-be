const mongoose = require('mongoose');

const sliderSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Slider title is required'],
        trim: true,
    },
    subtitle: {
        type: String,
        required: [true, 'Slider subtitle is required'],
        trim: true,
    },
    ctaText: {
        type: String,
        default: 'Explore Collection',
        trim: true,
    },
    ctaLink: {
        type: String,
        default: '/search',
        trim: true,
    },
    mediaType: {
        type: String,
        enum: ['image', 'video'],
        required: [true, 'Media type is required'],
    },
    // For images
    image: {
        public_id: {
            type: String,
        },
        url: {
            type: String,
        },
    },
    // For videos
    video: {
        public_id: {
            type: String,
        },
        url: {
            type: String,
        },
        duration: {
            type: Number, // in seconds
        },
        format: {
            type: String,
        },
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    order: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for sorting by order
sliderSchema.index({ order: 1 });

module.exports = mongoose.model('Slider', sliderSchema);
