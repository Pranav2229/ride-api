const pool = require("../../middleware/db.connection.js");
const jwt = require("jsonwebtoken");
const {
    checkSchema,
    body,
    validationResult
} = require("express-validator");
const { emitPaymentCompleted } = require("../../sockets/RideSocket/ride.socket.js");

const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createPaymentOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { rideId } = req.params;

        // 1. Load ride
        const { rows: [ride] } = await pool.query(
            `SELECT id, user_id, final_amount, payment_method, payment_status
       FROM rides WHERE id = $1`,
            [rideId]
        );

        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        if (ride.user_id !== userId) return res.status(403).json({ success: false, message: "Not your ride" });
        if (ride.payment_status === "PAID") {
            return res.status(400).json({ success: false, message: "Already paid" });
        }

        const amountPaise = Math.round(Number(ride.final_amount) * 100);

        // 2. Create Razorpay order
        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: `ride_${ride.id}_${Date.now()}`,
            notes: { ride_id: ride.id, user_id: userId },
        });

        // 3. Insert pending payment row — using YOUR column names
        const { rows: [payment] } = await pool.query(
            `INSERT INTO payments
         (ride_id, user_id, amount, currency,
          payment_gateway, payment_method,
          gateway_order_id, payment_status, updated_at)
       VALUES ($1, $2, $3, 'INR',
               'RAZORPAY', $4,
               $5, 'PENDING', NOW())
       RETURNING id`,
            [ride.id, userId, ride.final_amount, ride.payment_method, order.id]
        );

        return res.json({
            success: true,
            data: {
                payment_id: payment.id,
                razorpay_order_id: order.id,
                razorpay_key_id: process.env.RAZORPAY_KEY_ID,
                amount: amountPaise,
                currency: "INR",
            },
        });
    } catch (e) {
        console.error("createPaymentOrder error:", e);
        return res.status(500).json({ success: false, message: e.message });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { rideId } = req.params;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing payment fields" });
        }

        // 1. Verify HMAC signature
        const expected = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expected !== razorpay_signature) {
            await pool.query(
                `UPDATE payments
         SET payment_status='FAILED',
             failure_reason='SIGNATURE_MISMATCH',
             gateway_response=$1,
             updated_at=NOW()
         WHERE gateway_order_id=$2`,
                [JSON.stringify(req.body), razorpay_order_id]
            );
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        // 2. Atomic update
        const client = await pool.connect();
        let ride = null;                // ✅ hoisted so it's visible after the try

        try {
            await client.query("BEGIN");

            const { rows: [payment] } = await client.query(
                `UPDATE payments
         SET payment_status='CAPTURED',
             transaction_id=$1,
             gateway_payment_id=$1,
             gateway_signature=$2,
             gateway_response=$3,
             paid_at=NOW(),
             updated_at=NOW()
         WHERE gateway_order_id=$4 AND payment_status='PENDING'
         RETURNING id, ride_id`,
                [razorpay_payment_id, razorpay_signature, JSON.stringify(req.body), razorpay_order_id]
            );

            if (!payment) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "Payment already processed or not found",
                });
            }

            // ✅ RETURNING the ride fields we need for the socket emit
            const { rows: [r] } = await client.query(
                `UPDATE rides
         SET payment_status='PAID', payment_id=$1, updated_at=NOW()
         WHERE id=$2
         RETURNING id, user_id, driver_id, final_amount, payment_method`,
                [payment.id, payment.ride_id]
            );

            ride = r;

            await client.query("COMMIT");
        } catch (txErr) {
            await client.query("ROLLBACK").catch(() => { });
            throw txErr;
        } finally {
            client.release();
        }

        // 3. Notify both sides
        if (ride) {
            emitPaymentCompleted(
                ride.user_id,
                ride.driver_id,
                ride.id,
                Number(ride.final_amount),
                ride.payment_method
            );
        }

        return res.json({ success: true, message: "Payment verified" });
    } catch (e) {
        console.error("verifyPayment error:", e);
        return res.status(500).json({ success: false, message: e.message });
    }
};


const markPaymentFailed = async (req, res) => {
    const { razorpay_order_id, reason, note } = req.body;

    await pool.query(
        `UPDATE payments
     SET payment_status='FAILED',
         failure_reason=$1,
         failure_note=$2,
         updated_at=NOW()
     WHERE gateway_order_id=$3 AND payment_status='PENDING'`,
        [reason || "USER_CANCELLED", note || null, razorpay_order_id]
    );

    await pool.query(
        `UPDATE rides
     SET payment_failure_reason=$1, payment_failure_note=$2, updated_at=NOW()
     WHERE id=$3`,
        [reason || "USER_CANCELLED", note || null, req.params.rideId]
    );

    return res.json({ success: true });
};


const razorpayWebhook = async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    const body = req.rawBody || JSON.stringify(req.body);

    const expected = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest("hex");

    if (expected !== signature) return res.status(400).send("Invalid signature");

    const event = req.body.event;
    const payment = req.body.payload?.payment?.entity;

    if (event === "payment.captured" && payment?.order_id) {
        await pool.query(
            `UPDATE payments
       SET payment_status='CAPTURED',
           transaction_id=$1,
           gateway_payment_id=$1,
           gateway_response=$2,
           paid_at=NOW(),
           updated_at=NOW()
       WHERE gateway_order_id=$3 AND payment_status <> 'CAPTURED'`,
            [payment.id, JSON.stringify(req.body), payment.order_id]
        );
        // also flip the ride
        await pool.query(
            `UPDATE rides r
       SET payment_status='PAID', updated_at=NOW()
       FROM payments p
       WHERE p.gateway_order_id=$1 AND r.id = p.ride_id`,
            [payment.order_id]
        );
    }

    if (event === "payment.failed" && payment?.order_id) {
        await pool.query(
            `UPDATE payments
       SET payment_status='FAILED',
           failure_reason=$1,
           updated_at=NOW()
       WHERE gateway_order_id=$2 AND payment_status='PENDING'`,
            [payment.error_description || "FAILED", payment.order_id]
        );
    }

    return res.json({ received: true });
};

const getPaymentHistory = async (req, res) => {
    const userId = req.user.userId;
    const { rows } = await pool.query(
        `SELECT p.id, p.amount, p.currency, p.payment_method, p.payment_gateway,
            p.payment_status, p.transaction_id,
            p.created_at, p.paid_at,
            r.ride_unique_id, r.pickup_address, r.drop_address
     FROM payments p
     JOIN rides r ON r.id = p.ride_id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC
     LIMIT 100`,
        [userId]
    );
    return res.json({ success: true, data: rows });
};

const createWalletTopupOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { amount } = req.body;

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000) {
            return res.status(400).json({
                success: false,
                message: "Amount must be between 1 and 100000",
            });
        }

        const amountPaise = Math.round(numericAmount * 100);

        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: `wallet_${userId}_${Date.now()}`,
            notes: { user_id: userId, type: "wallet_topup" },
        });

        // Track the top-up as a payments row (ride_id = NULL)
        await pool.query(
            `INSERT INTO payments
         (ride_id, user_id, amount, currency,
          payment_gateway, payment_method,
          gateway_order_id, payment_status, updated_at)
       VALUES (NULL, $1, $2, 'INR',
               'RAZORPAY', 'WALLET_TOPUP',
               $3, 'PENDING', NOW())`,
            [userId, numericAmount, order.id]
        );

        return res.json({
            success: true,
            data: {
                razorpay_order_id: order.id,
                razorpay_key_id: process.env.RAZORPAY_KEY_ID,
                amount: amountPaise,
                currency: "INR",
            },
        });
    } catch (e) {
        console.error("createWalletTopupOrder error:", e);
        return res.status(500).json({ success: false, message: e.message });
    }
};

const verifyWalletTopup = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.userId;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing fields" });
        }

        // 1. Signature check
        const expected = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expected !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        await client.query("BEGIN");

        // 2. Lock payments row
        const { rows: [payment] } = await client.query(
            `UPDATE payments
       SET payment_status='CAPTURED',
           transaction_id=$1,
           gateway_payment_id=$1,
           gateway_signature=$2,
           paid_at=NOW(),
           updated_at=NOW()
       WHERE gateway_order_id=$3
         AND payment_method='WALLET_TOPUP'
         AND payment_status='PENDING'
       RETURNING id, amount`,
            [razorpay_payment_id, razorpay_signature, razorpay_order_id]
        );

        if (!payment) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "Already processed" });
        }

        const amount = Number(payment.amount);

        // 3. Lock user, update balance
        const { rows: [user] } = await client.query(
            `SELECT wallet_balance FROM public.users WHERE id = $1 FOR UPDATE`,
            [userId]
        );

        const currentBalance = Number(user?.wallet_balance || 0);
        const newBalance = currentBalance + amount;

        await client.query(
            `UPDATE public.users SET wallet_balance = $1 WHERE id = $2`,
            [newBalance, userId]
        );

        // 4. Insert wallet_transactions row
        await client.query(
            `INSERT INTO public.wallet_transactions
         (user_id, type, amount, description, created_at)
       VALUES ($1, 'CREDIT', $2, $3, CURRENT_TIMESTAMP)`,
            [userId, amount, `Wallet top-up via Razorpay #${razorpay_payment_id}`]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            data: { balance: newBalance, amount },
        });
    } catch (e) {
        await client.query("ROLLBACK").catch(() => { });
        console.error("verifyWalletTopup error:", e);
        return res.status(500).json({ success: false, message: e.message });
    } finally {
        client.release();
    }
};

module.exports = {
    createPaymentOrder,
    verifyPayment,
    markPaymentFailed,
    razorpayWebhook,
    getPaymentHistory,
    createWalletTopupOrder,
    verifyWalletTopup
};