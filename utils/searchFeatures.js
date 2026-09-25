class SearchFeatures {
    constructor(query, queryString) {
        this.query = query
        this.queryString = queryString
    }

    search() {
        const keyword = this.queryString.keyword ? {
            name: {
                $regex: this.queryString.keyword,
                $options: "i",
            }
        } : {};

        // console.log(keyword);

        this.query = this.query.find({ ...keyword });
        return this;
    }

    filter() {
        const queryCopy = { ...this.queryString }

        // fields to remove for category
        const removeFields = ["keyword", "page", "limit"];

        // console.log(queryCopy);
        removeFields.forEach(key => delete queryCopy[key]);
        // console.log(queryCopy);

        // price filter
        let queryString = JSON.stringify(queryCopy);
        queryString = queryString.replace(/\b(gt|gte|lt|lte)\b/g, key => `$${key}`);

        // console.log(JSON.parse(queryString));

        this.query = this.query.find(JSON.parse(queryString));
        return this;
    }

    async filterByCategory() {
        const Category = require('../models/categoryModel');
        const queryCopy = { ...this.queryString };

        if (queryCopy.category) {
            const category = await Category.findOne({ slug: queryCopy.category });
            if (category) {
                this.query = this.query.find({ category: category._id });
            }
        }

        if (queryCopy.subcategory) {
            const subcategory = await Category.findOne({ slug: queryCopy.subcategory });
            if (subcategory) {
                this.query = this.query.find({ subcategory: subcategory._id });
            }
        }

        return this;
    }

    pagination(resultPerPage) {
        const currentPage = Number(this.queryString.page) || 1;

        const skipProducts = resultPerPage * (currentPage - 1);

        this.query = this.query.limit(resultPerPage).skip(skipProducts);
        return this;
    }
};

module.exports = SearchFeatures;