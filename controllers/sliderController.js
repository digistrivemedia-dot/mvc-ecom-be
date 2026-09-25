const Slider = require('../models/sliderModel');
const asyncErrorHandler = require('../middlewares/asyncErrorHandler');
const ErrorHandler = require('../utils/errorHandler');
const cloudinary = require('cloudinary');

// Video upload validation constants
const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB in bytes
const MAX_VIDEO_DURATION = 30; // 30 seconds
const ALLOWED_VIDEO_FORMATS = ['mp4', 'webm', 'mov'];

// Get All Active Sliders (Public)
exports.getAllSliders = asyncErrorHandler(async (req, res, next) => {
    const sliders = await Slider.find({ isActive: true }).sort({ order: 1 });

    res.status(200).json({
        success: true,
        sliders,
    });
});

// Get All Sliders (Admin)
exports.getAdminSliders = asyncErrorHandler(async (req, res, next) => {
    const sliders = await Slider.find().sort({ order: 1 });

    res.status(200).json({
        success: true,
        sliders,
    });
});

// Get Slider Details
exports.getSliderDetails = asyncErrorHandler(async (req, res, next) => {
    const slider = await Slider.findById(req.params.id);

    if (!slider) {
        return next(new ErrorHandler('Slider Not Found', 404));
    }

    res.status(200).json({
        success: true,
        slider,
    });
});

// Create Slider (Admin)
exports.createSlider = asyncErrorHandler(async (req, res, next) => {
    const { title, subtitle, ctaText, ctaLink, mediaType, order, isActive } = req.body;

    // Validate required fields
    if (!title || !subtitle || !mediaType) {
        return next(new ErrorHandler('Please provide title, subtitle, and media type', 400));
    }

    if (!['image', 'video'].includes(mediaType)) {
        return next(new ErrorHandler('Media type must be either image or video', 400));
    }

    let uploadResult;
    const sliderData = {
        title,
        subtitle,
        ctaText: ctaText || 'Explore Collection',
        ctaLink: ctaLink || '/search',
        mediaType,
        order: order || 0,
        isActive: isActive !== undefined ? isActive : true,
    };

    try {
        if (mediaType === 'image') {
            // Handle image upload
            if (!req.body.image) {
                return next(new ErrorHandler('Please provide an image', 400));
            }

            uploadResult = await cloudinary.v2.uploader.upload(req.body.image, {
                folder: 'sliders',
                resource_type: 'image',
                transformation: [
                    { width: 1920, height: 800, crop: 'fill', gravity: 'center' },
                    { quality: 'auto:good' }
                ]
            });

            sliderData.image = {
                public_id: uploadResult.public_id,
                url: uploadResult.secure_url,
            };
        } else {
            // Handle video upload with validation
            if (!req.body.video) {
                return next(new ErrorHandler('Please provide a video', 400));
            }

            // Get video info first
            const videoData = req.body.video;

            // Check file size (base64 string length / 1.37 gives approximate size in bytes)
            const estimatedSize = (videoData.length * 3) / 4;
            if (estimatedSize > MAX_VIDEO_SIZE) {
                return next(new ErrorHandler(`Video size must be less than ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`, 400));
            }

            // Upload video with transformations
            uploadResult = await cloudinary.v2.uploader.upload(videoData, {
                folder: 'sliders',
                resource_type: 'video',
                transformation: [
                    {
                        width: 1920,
                        height: 800,
                        crop: 'fill',
                        gravity: 'center',
                        quality: 'auto:good'
                    }
                ]
            });

            // Check video duration
            if (uploadResult.duration && uploadResult.duration > MAX_VIDEO_DURATION) {
                // Delete uploaded video if it exceeds duration
                await cloudinary.v2.uploader.destroy(uploadResult.public_id, { resource_type: 'video' });
                return next(new ErrorHandler(`Video duration must be less than ${MAX_VIDEO_DURATION} seconds`, 400));
            }

            // Validate format
            const format = uploadResult.format || '';
            if (!ALLOWED_VIDEO_FORMATS.includes(format.toLowerCase())) {
                // Delete uploaded video if format is not allowed
                await cloudinary.v2.uploader.destroy(uploadResult.public_id, { resource_type: 'video' });
                return next(new ErrorHandler(`Video format must be one of: ${ALLOWED_VIDEO_FORMATS.join(', ')}`, 400));
            }

            sliderData.video = {
                public_id: uploadResult.public_id,
                url: uploadResult.secure_url,
                duration: uploadResult.duration || 0,
                format: uploadResult.format || '',
            };
        }

        const slider = await Slider.create(sliderData);

        res.status(201).json({
            success: true,
            slider,
        });
    } catch (error) {
        // Clean up uploaded file if slider creation fails
        if (uploadResult && uploadResult.public_id) {
            await cloudinary.v2.uploader.destroy(
                uploadResult.public_id,
                { resource_type: mediaType === 'video' ? 'video' : 'image' }
            );
        }
        throw error;
    }
});

// Update Slider (Admin)
exports.updateSlider = asyncErrorHandler(async (req, res, next) => {
    let slider = await Slider.findById(req.params.id);

    if (!slider) {
        return next(new ErrorHandler('Slider Not Found', 404));
    }

    const { title, subtitle, ctaText, ctaLink, order, isActive, image, video } = req.body;

    // Update basic fields
    if (title) slider.title = title;
    if (subtitle) slider.subtitle = subtitle;
    if (ctaText !== undefined) slider.ctaText = ctaText;
    if (ctaLink !== undefined) slider.ctaLink = ctaLink;
    if (order !== undefined) slider.order = order;
    if (isActive !== undefined) slider.isActive = isActive;

    let uploadResult;
    try {
        // Update image if provided
        if (image && slider.mediaType === 'image') {
            // Delete old image from cloudinary
            if (slider.image && slider.image.public_id) {
                await cloudinary.v2.uploader.destroy(slider.image.public_id);
            }

            // Upload new image
            uploadResult = await cloudinary.v2.uploader.upload(image, {
                folder: 'sliders',
                resource_type: 'image',
                transformation: [
                    { width: 1920, height: 800, crop: 'fill', gravity: 'center' },
                    { quality: 'auto:good' }
                ]
            });

            slider.image = {
                public_id: uploadResult.public_id,
                url: uploadResult.secure_url,
            };
        }

        // Update video if provided
        if (video && slider.mediaType === 'video') {
            // Delete old video from cloudinary
            if (slider.video && slider.video.public_id) {
                await cloudinary.v2.uploader.destroy(slider.video.public_id, { resource_type: 'video' });
            }

            // Check file size
            const estimatedSize = (video.length * 3) / 4;
            if (estimatedSize > MAX_VIDEO_SIZE) {
                return next(new ErrorHandler(`Video size must be less than ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`, 400));
            }

            // Upload new video
            uploadResult = await cloudinary.v2.uploader.upload(video, {
                folder: 'sliders',
                resource_type: 'video',
                transformation: [
                    {
                        width: 1920,
                        height: 800,
                        crop: 'fill',
                        gravity: 'center',
                        quality: 'auto:good'
                    }
                ]
            });

            // Check video duration
            if (uploadResult.duration && uploadResult.duration > MAX_VIDEO_DURATION) {
                await cloudinary.v2.uploader.destroy(uploadResult.public_id, { resource_type: 'video' });
                return next(new ErrorHandler(`Video duration must be less than ${MAX_VIDEO_DURATION} seconds`, 400));
            }

            // Validate format
            const format = uploadResult.format || '';
            if (!ALLOWED_VIDEO_FORMATS.includes(format.toLowerCase())) {
                await cloudinary.v2.uploader.destroy(uploadResult.public_id, { resource_type: 'video' });
                return next(new ErrorHandler(`Video format must be one of: ${ALLOWED_VIDEO_FORMATS.join(', ')}`, 400));
            }

            slider.video = {
                public_id: uploadResult.public_id,
                url: uploadResult.secure_url,
                duration: uploadResult.duration || 0,
                format: uploadResult.format || '',
            };
        }

        await slider.save();

        res.status(200).json({
            success: true,
            slider,
        });
    } catch (error) {
        // Clean up uploaded file if update fails
        if (uploadResult && uploadResult.public_id) {
            await cloudinary.v2.uploader.destroy(
                uploadResult.public_id,
                { resource_type: slider.mediaType === 'video' ? 'video' : 'image' }
            );
        }
        throw error;
    }
});

// Delete Slider (Admin)
exports.deleteSlider = asyncErrorHandler(async (req, res, next) => {
    const slider = await Slider.findById(req.params.id);

    if (!slider) {
        return next(new ErrorHandler('Slider Not Found', 404));
    }

    // Delete media from cloudinary
    if (slider.mediaType === 'image' && slider.image && slider.image.public_id) {
        await cloudinary.v2.uploader.destroy(slider.image.public_id);
    } else if (slider.mediaType === 'video' && slider.video && slider.video.public_id) {
        await cloudinary.v2.uploader.destroy(slider.video.public_id, { resource_type: 'video' });
    }

    await slider.deleteOne();

    res.status(200).json({
        success: true,
        message: 'Slider deleted successfully',
    });
});

// Update Slider Order (Admin)
exports.updateSliderOrder = asyncErrorHandler(async (req, res, next) => {
    const { sliders } = req.body; // Array of { id, order }

    if (!Array.isArray(sliders)) {
        return next(new ErrorHandler('Please provide an array of sliders', 400));
    }

    const updatePromises = sliders.map(({ id, order }) =>
        Slider.findByIdAndUpdate(id, { order }, { new: true })
    );

    await Promise.all(updatePromises);

    const updatedSliders = await Slider.find().sort({ order: 1 });

    res.status(200).json({
        success: true,
        sliders: updatedSliders,
    });
});
