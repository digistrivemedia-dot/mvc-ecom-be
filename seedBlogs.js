const mongoose = require('mongoose');
const Blog = require('./models/blogModel');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config/config.env') });

const connectDatabase = require('./config/database');

const sampleBlogs = [
    {
        title: "Top 10 Shopping Trends for 2026",
        excerpt: "Discover the latest trends shaping how people shop online this year, from personalization to sustainable products.",
        content: `
            <h2>Introduction</h2>
            <p>Online shopping keeps evolving, and 2026 brings exciting new trends that blend convenience with value. Whether you're a first-time buyer or a regular shopper, these trends are worth knowing.</p>

            <h2>1. Personalized Recommendations</h2>
            <p>Marketplaces are getting better at surfacing products you'll actually love, based on your browsing and purchase history.</p>

            <h2>2. Sustainable & Ethical Products</h2>
            <p>More shoppers are prioritizing products from vendors with transparent sourcing and sustainable practices.</p>

            <h2>3. Fast, Flexible Delivery</h2>
            <p>Same-day and scheduled delivery windows are becoming the norm rather than the exception.</p>

            <h2>4. Community Reviews</h2>
            <p>Detailed reviews and photos from real buyers are increasingly influencing purchase decisions.</p>

            <h2>5. Support for Independent Sellers</h2>
            <p>Shoppers are actively seeking out marketplaces that support small and independent vendors.</p>
        `,
        featuredImage: "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800",
        author: "Priya Sharma",
        category: "Product Trends",
        tags: ["trends", "shopping", "2026"],
        status: "published",
        publishedAt: new Date('2026-01-20')
    },
    {
        title: "A Complete Guide to Getting Started as a Vendor",
        excerpt: "Everything you need to know about setting up your store on InveztIN, from listing your first product to getting paid.",
        content: `
            <h2>Planning Your Store</h2>
            <p>Before you list your first product, take time to plan your catalog, pricing, and photos — a little preparation goes a long way.</p>

            <h2>Setting Up Your Profile</h2>
            <p>Complete your vendor profile with accurate business details and payout information before submitting products for approval.</p>

            <h3>Steps:</h3>
            <ul>
                <li>Register as a vendor and complete your profile</li>
                <li>Wait for approval from our team</li>
                <li>Add clear photos and accurate descriptions for each product</li>
                <li>Set your cost price — final pricing is confirmed after review</li>
            </ul>

            <h2>Fulfilling Orders</h2>
            <p>Once your products go live, keep stock levels accurate and fulfill orders promptly to build trust with buyers.</p>

            <h2>Getting Paid</h2>
            <p>Track your earnings and payouts directly from your vendor dashboard.</p>
        `,
        featuredImage: "https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800",
        author: "Rajesh Kumar",
        category: "Installation Tips",
        tags: ["vendor", "guide", "getting-started"],
        status: "published",
        publishedAt: new Date('2026-01-15')
    },
    {
        title: "Smart Buying Tips for First-Time Online Shoppers",
        excerpt: "Practical tips to help you shop confidently online, from reading reviews to understanding return policies.",
        content: `
            <h2>Read Reviews Carefully</h2>
            <p>Look for detailed reviews with photos — they tell you far more than a star rating alone.</p>

            <h2>Compare Similar Listings</h2>
            <p>Take a moment to compare price, shipping time, and seller ratings across similar products before buying.</p>

            <h2>Understand the Return Policy</h2>
            <p>Every product page shows the applicable return window — check it before you buy, especially for larger purchases.</p>

            <h2>Use Your Wishlist</h2>
            <p>Save items you're considering to your wishlist so you can compare and decide later without losing track of them.</p>

            <h2>Track Your Orders</h2>
            <p>Keep an eye on your order status from your account dashboard so you always know where your package is.</p>
        `,
        featuredImage: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800",
        author: "Anita Desai",
        category: "Design Ideas",
        tags: ["shopping", "tips", "guide"],
        status: "published",
        publishedAt: new Date('2026-01-25')
    },
    {
        title: "How to Track and Manage Your Orders",
        excerpt: "A simple walkthrough of tracking your orders, requesting returns, and staying on top of your purchase history.",
        content: `
            <h2>Finding Your Orders</h2>
            <p>All your past and current orders are available from your account's Orders page, with live status updates.</p>

            <h2>Tracking Delivery</h2>
            <p>Once an order ships, you'll be able to see its current status right from the order details page.</p>

            <h2>Requesting a Return</h2>
            <p>If something isn't right, you can request a return directly from the order page within the eligible window.</p>

            <h2>Managing Your Wishlist</h2>
            <p>Move items between your cart and wishlist anytime — nothing is lost between sessions.</p>

            <h2>Getting Help</h2>
            <p>If you run into any issue with an order, contact our support team directly.</p>
        `,
        featuredImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800",
        author: "Vikram Patel",
        category: "Maintenance Guide",
        tags: ["orders", "tracking", "tips"],
        status: "published",
        publishedAt: new Date('2026-01-08')
    }
];

const seedBlogs = async () => {
    try {
        await connectDatabase();

        console.log('Deleting existing blogs...');
        await Blog.deleteMany({});

        console.log('Creating sample blogs...');
        for (const blogData of sampleBlogs) {
            await Blog.create(blogData);
        }

        console.log('✅ Successfully seeded blog database with sample data!');
        console.log(`Created ${sampleBlogs.length} blog posts`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding blogs:', error);
        process.exit(1);
    }
};

seedBlogs();
