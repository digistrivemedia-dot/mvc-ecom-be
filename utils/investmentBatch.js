// Merges duplicate product lines from an investor's cart into one quantity
// per product, so availability/total checks run once per product even if
// the client sent the same product twice.
function mergeInvestItems(items) {
    const quantityByProduct = new Map();
    for (const item of items) {
        const quantity = Number(item.quantity);
        if (!item.productId || !Number.isInteger(quantity) || quantity < 1) {
            throw new Error(`Invalid item in investment cart: ${JSON.stringify(item)}`);
        }
        quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) || 0) + quantity);
    }
    return quantityByProduct;
}

module.exports = { mergeInvestItems };
