const mongoose = require('mongoose');

const connectDatabase = () => {
    // Reuse existing connection in serverless environments
    if (mongoose.connections[0].readyState) {
        return;
    }

    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("Mongoose Connected"))
        .catch((err) => console.error("DB connection error:", err.message));
}

module.exports = connectDatabase;