const emailjs = require("@emailjs/nodejs");

/**
 * Send OTP email to the user.
 * @param {string} toEmail - recipient email address
 * @param {string} toName - recipient name
 * @param {string} otpCode - the OTP to send
 * @param {string} purpose - "login" | "registration" (for template personalization)
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
const sendOtpEmail = async ({ toEmail, toName, otpCode, purpose = "registration" }) => {
    // Guard: skip silently if email is missing (e.g., phone-only account)
    if (!toEmail || !String(toEmail).trim()) {
        console.log("⚠️ No email provided — skipping OTP email");
        return { sent: false, error: "NO_EMAIL" };
    }

    try {
        const templateParams = {
            // These keys must match the {{variables}} in your EmailJS template
            to_email: toEmail.trim(),
            to_name: toName || "User",
            otp_code: String(otpCode),
            purpose,              // "registration" | "login"
            app_name: "BuddyRide",
            otp_expiry_minutes: 10,
        };

        const response = await emailjs.send(
            process.env.EMAILJS_SERVICE_ID,
            process.env.EMAILJS_TEMPLATE_ID,
            templateParams,
            {
                publicKey: process.env.EMAILJS_PUBLIC_KEY,
                privateKey: process.env.EMAILJS_PRIVATE_KEY,
            }
        );

        console.log(`✅ OTP email sent to ${toEmail} (${response.status} ${response.text})`);
        return { sent: true };
    } catch (err) {
        // Don't throw — registration should still succeed even if email fails
        console.error("❌ OTP email failed:", {
            message: err?.message,
            status: err?.status,
            text: err?.text,
        });
        return { sent: false, error: err?.text || err?.message || "SEND_FAILED" };
    }
};

module.exports = { sendOtpEmail };