const crypto = require('crypto');
const Razorpay = require('razorpay');

/**
 * Razorpay access, with a mock mode for testing.
 *
 * Set PAYMENTS_MOCK=true in config.env to bypass Razorpay entirely: no real
 * charges, no real refunds, no credentials needed. Set it to false (or remove
 * it) to go straight back to the live gateway — nothing else has to change,
 * because the mock exposes the same `orders.create` / `payments.fetch` /
 * `payments.refund` surface the real client does.
 *
 *   PAYMENTS_MOCK=true   → fake payments, flow runs end to end
 *   PAYMENTS_MOCK=false  → real Razorpay (the default)
 *
 * The mock is deliberately stateless: the amount is encoded into the mock
 * payment id, so `payments.fetch` can report the correct amount without a
 * store, and a server restart mid-test doesn't break an in-flight payment.
 * That matters because investmentController re-checks the paid amount against
 * the cart total before writing any Investment rows.
 */

const MOCK_PAYMENT_RE = /^mock_pay_(\d+)_/;

function isPaymentsMocked() {
    return String(process.env.PAYMENTS_MOCK).toLowerCase() === 'true';
}

function mockPaymentIdFor(amountInPaise) {
    return `mock_pay_${amountInPaise}_${crypto.randomBytes(6).toString('hex')}`;
}

function createMockInstance() {
    return {
        orders: {
            create: async ({ amount, currency = 'INR', receipt, notes }) => ({
                id: `mock_order_${amount}_${crypto.randomBytes(6).toString('hex')}`,
                entity: 'order',
                amount,
                amount_paid: 0,
                amount_due: amount,
                currency,
                receipt,
                notes,
                status: 'created',
                created_at: Math.floor(Date.now() / 1000),
            }),
        },
        payments: {
            fetch: async (paymentId) => {
                const match = MOCK_PAYMENT_RE.exec(paymentId || '');
                if (!match) {
                    throw new Error(`Not a mock payment id: ${paymentId}`);
                }
                return {
                    id: paymentId,
                    entity: 'payment',
                    // Parsed back out of the id — see the note above.
                    amount: Number(match[1]),
                    currency: 'INR',
                    status: 'captured',
                    method: 'mock',
                    email: 'mock@example.com',
                    contact: '+910000000000',
                    created_at: Math.floor(Date.now() / 1000),
                };
            },
            refund: async (paymentId, { amount, notes } = {}) => {
                console.log(
                    `[PAYMENTS_MOCK] Pretend refund of ₹${(amount / 100).toFixed(2)} on ${paymentId}`,
                    notes || ''
                );
                return {
                    id: `mock_rfnd_${crypto.randomBytes(6).toString('hex')}`,
                    entity: 'refund',
                    payment_id: paymentId,
                    amount,
                    currency: 'INR',
                    status: 'processed',
                    created_at: Math.floor(Date.now() / 1000),
                };
            },
        },
    };
}

const getRazorpayInstance = () => {
    if (isPaymentsMocked()) {
        return createMockInstance();
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to config.env');
    }

    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
};

/**
 * The one place a Razorpay checkout signature is validated. In mock mode a
 * mock payment id is accepted and nothing else is — so a real request can
 * never slip through unverified just because the flag got left on.
 */
function verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    if (isPaymentsMocked()) {
        return MOCK_PAYMENT_RE.test(razorpay_payment_id || '');
    }

    const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    return expected === razorpay_signature;
}

module.exports = {
    getRazorpayInstance,
    isPaymentsMocked,
    mockPaymentIdFor,
    verifyPaymentSignature,
};
