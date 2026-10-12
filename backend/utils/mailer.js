
import nodemailer from "nodemailer";

export function isSmtpConfigured() {
    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
    );
}

export async function sendPasswordResetEmail({
    to,
    fullName,
    resetUrl,
}) {
    if (!isSmtpConfigured()) {
        return false;
    }

    const port = Number(process.env.SMTP_PORT) || 587;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    // Escape user-provided text before inserting it into HTML.
    const escapeHtml = (value) =>
        String(value).replace(/[&<>"']/g, (character) => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            };

            return entities[character];
        });

    const name = escapeHtml(fullName || "there");
    const safeResetUrl = escapeHtml(resetUrl);

    await transporter.sendMail({
        from:
            process.env.SMTP_FROM ||
            `"TN SEO" <${process.env.SMTP_USER}>`,
        to,
        subject: "Reset your TN SEO password",
        text: [
            `Hi ${fullName || "there"},`,
            "",
            "Someone requested a password reset for your TN SEO account.",
            "Use the link below to choose a new password. It expires in 30 minutes:",
            resetUrl,
            "",
            "If you didn't request this, you can safely ignore this email.",
        ].join("\n"),
        html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#10212b">
                <h2>Hi ${name},</h2>
                <p>Someone requested a password reset for your <strong>TN SEO</strong> account.</p>
                <p>
                    <a href="${safeResetUrl}"
                       style="display:inline-block;background:#15945d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">
                        Reset your password
                    </a>
                </p>
                <p style="color:#69757c;font-size:13px">
                    This link expires in 30 minutes. If you didn't request this, you can ignore this email.
                </p>
            </div>
        `,
    });

    return true;
}
