const mongoose = require('mongoose');
const Blog = require('./models/blogModel');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config/config.env') });

const connectDatabase = require('./config/database');

const sampleBlogs = [
    {
        title: "Top 10 Tile Trends for Modern Homes in 2026",
        excerpt: "Discover the latest tile design trends that are transforming modern homes. From minimalist patterns to bold statements, explore what's hot this year.",
        content: `
            <h2>Introduction</h2>
            <p>The world of tile design is constantly evolving, and 2026 brings exciting new trends that blend aesthetics with functionality. Whether you're renovating your home or starting fresh, these trends will inspire your next project.</p>

            <h2>1. Large Format Tiles</h2>
            <p>Large format tiles continue to dominate the market. These oversized tiles create seamless looks with fewer grout lines, making spaces appear larger and more cohesive. Perfect for both floors and walls!</p>

            <h2>2. Natural Stone Look</h2>
            <p>Porcelain tiles mimicking natural stone are more popular than ever. They offer the beauty of marble, granite, or travertine without the maintenance headaches.</p>

            <h2>3. Terrazzo Revival</h2>
            <p>The retro terrazzo pattern is making a huge comeback with modern twists. Contemporary terrazzo tiles feature bold colors and larger chips for a fresh, updated look.</p>

            <h2>4. Geometric Patterns</h2>
            <p>Hexagons, chevrons, and arabesque shapes are trending. These geometric patterns add visual interest and personality to any space.</p>

            <h2>5. Matte Finishes</h2>
            <p>Glossy tiles are taking a backseat to sophisticated matte finishes. They're easier to maintain and provide a more contemporary, upscale look.</p>
        `,
        featuredImage: "https://images.unsplash.com/photo-1615875221248-3e9d5b90e593?w=800",
        author: "Priya Sharma",
        category: "Tile Trends",
        tags: ["trends", "design", "2026", "modern"],
        status: "published",
        publishedAt: new Date('2026-01-20')
    },
    {
        title: "Complete Guide to Bathroom Tile Installation",
        excerpt: "Everything you need to know about professional bathroom tile installation, from surface preparation to finishing touches.",
        content: `
            <h2>Planning Your Bathroom Tile Project</h2>
            <p>Proper planning is crucial for a successful bathroom tile installation. Start by measuring your space accurately and calculating the amount of tile needed, plus 10% extra for cuts and breakage.</p>

            <h2>Surface Preparation</h2>
            <p>The key to long-lasting tile installation is proper surface preparation. Your substrate must be clean, level, and dry before you begin.</p>

            <h3>Steps:</h3>
            <ul>
                <li>Remove old tiles or flooring completely</li>
                <li>Repair any damage to the subfloor</li>
                <li>Ensure the surface is level (within 1/8 inch per 10 feet)</li>
                <li>Install cement backer board for wet areas</li>
            </ul>

            <h2>Waterproofing</h2>
            <p>In bathrooms, waterproofing is essential! Apply a waterproof membrane to prevent moisture damage behind your tiles.</p>

            <h2>Layout and Installation</h2>
            <p>Start from the center of the room and work your way out. Use spacers to maintain consistent grout lines.</p>

            <h2>Grouting and Sealing</h2>
            <p>After tiles set for 24-48 hours, apply grout. Choose epoxy grout for wet areas - it's more water-resistant than regular grout.</p>
        `,
        featuredImage: "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=800",
        author: "Rajesh Kumar",
        category: "Installation Tips",
        tags: ["installation", "bathroom", "diy", "guide"],
        status: "published",
        publishedAt: new Date('2026-01-15')
    },
    {
        title: "Bathroom Tile Ideas for Small Spaces",
        excerpt: "Maximize your small bathroom with these clever tile design ideas and space-saving tips that create the illusion of more room.",
        content: `
            <h2>Using Light Colors</h2>
            <p>Light-colored tiles reflect more light and make small bathrooms feel more spacious. White, cream, light gray, and soft pastels are excellent choices.</p>

            <h2>Large Format Tiles</h2>
            <p>Contrary to popular belief, large tiles work great in small spaces. Fewer grout lines create a cleaner, more expansive look.</p>

            <h2>Vertical Patterns</h2>
            <p>Install rectangular tiles vertically to draw the eye upward and create the illusion of height. This is especially effective in shower areas.</p>

            <h2>Continuous Flooring</h2>
            <p>Use the same tiles on the floor and in the shower to create visual continuity. This makes the space feel larger and more cohesive.</p>

            <h2>Mirror and Glass Tiles</h2>
            <p>Reflective surfaces bounce light around the room. Consider glass mosaic tiles or mirrored accents to amplify this effect.</p>
        `,
        featuredImage: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800",
        author: "Anita Desai",
        category: "Design Ideas",
        tags: ["bathroom", "small-space", "design", "ideas"],
        status: "published",
        publishedAt: new Date('2026-01-25')
    },
    {
        title: "How to Maintain and Clean Your Tiles",
        excerpt: "Keep your tiles looking brand new with these simple maintenance tips. Learn the best cleaning products and techniques for different tile types.",
        content: `
            <h2>Daily Maintenance</h2>
            <p>Regular sweeping or vacuuming prevents dirt and grit from scratching your tile surface. For floors, use a soft-bristle broom or vacuum with a hard floor setting.</p>

            <h2>Weekly Cleaning</h2>
            <p>Mop your tile floors weekly with warm water and a pH-neutral cleaner. Avoid harsh chemicals that can damage grout or tile finish.</p>

            <h2>Grout Care</h2>
            <p>Grout is porous and prone to staining. Clean grout lines with a mixture of baking soda and water. For stubborn stains, use a grout-specific cleaner.</p>

            <h2>Sealing</h2>
            <p>Natural stone tiles and grout should be sealed regularly. Test if your tiles need resealing by placing a few drops of water on the surface - if it absorbs quickly, it's time to reseal.</p>

            <h2>Dealing with Stains</h2>
            <ul>
                <li><strong>Coffee/Tea:</strong> Hydrogen peroxide works well</li>
                <li><strong>Grease:</strong> Use a degreasing cleaner or dish soap</li>
                <li><strong>Mold/Mildew:</strong> White vinegar or commercial mold remover</li>
                <li><strong>Rust:</strong> Lemon juice or rust remover</li>
            </ul>
        `,
        featuredImage: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
        author: "Vikram Patel",
        category: "Maintenance Guide",
        tags: ["maintenance", "cleaning", "care", "tips"],
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
