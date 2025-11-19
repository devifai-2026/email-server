// utils/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: process.env.PORT_HOSTINGER,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Generic email sender
 */
exports.sendEmail = async ({ to, subject, text, html }) => {
  return transporter.sendMail({
    from: `"Reach Finder" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

/**
 * OTP Email
 */
exports.sendOTP = async (email, otp, type = "signup") => {
  let subject, text, html;

  const baseStyle = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #f5f7fa;
    padding: 20px;
  `;
  const cardStyle = `
    max-width: 480px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  `;
  const otpStyle = `
    display: inline-block;
    background-color: #4F46E5;
    color: #fff;
    padding: 12px 24px;
    font-size: 20px;
    font-weight: bold;
    letter-spacing: 2px;
    border-radius: 6px;
    margin: 16px 0;
  `;

  if (type === "signup") {
    subject = "🎉 Signup Verification OTP";
    text = `Welcome! Your OTP for completing signup is: ${otp}. It will expire in 5 minutes.`;
    html = `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          <h2 style="color:#4F46E5;">Welcome to Reach Finder 🎉</h2>
          <p>Your OTP for completing signup is:</p>
          <div style="${otpStyle}">${otp}</div>
          <p style="color:#6b7280;">This code will expire in 5 minutes.</p>
        </div>
      </div>
    `;
  } else if (type === "reset") {
    subject = "🔐 Password Reset OTP";
    text = `You requested to reset your password. Use this OTP: ${otp}. It will expire in 5 minutes.`;
    html = `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          <h2 style="color:#E11D48;">Password Reset Request</h2>
          <p>Use this OTP to reset your password:</p>
          <div style="${otpStyle}">${otp}</div>
          <p style="color:#6b7280;">This code will expire in 5 minutes. If this wasn't you, please ignore this email.</p>
        </div>
      </div>
    `;
  } else {
    subject = "Your OTP Code";
    text = `Your OTP is: ${otp}. It will expire in 5 minutes.`;
    html = `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          <h2 style="color:#4F46E5;">Your OTP Code</h2>
          <div style="${otpStyle}">${otp}</div>
          <p style="color:#6b7280;">This code will expire in 5 minutes.</p>
        </div>
      </div>
    `;
  }

  return exports.sendEmail({ to: email, subject, text, html });
};

/**
 * Subscription Expiring or Expired Emails
 */
exports.sendSubscriptionEmail = async (email, fullname, type = "expiring") => {
  let subject, text, html;

  const baseStyle = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #f5f7fa;
    padding: 20px;
  `;
  const cardStyle = `
    max-width: 480px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  `;

  if (type === "expiring") {
    subject = "⏳ Your subscription is ending soon – Don’t miss out!";
    text = `Hi ${fullname}, your subscription will expire in 2 days. Renew now to keep enjoying Reach Finder.`;
    html = `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          <h2 style="color:#F59E0B;">⏳ Subscription Ending Soon</h2>
          <p>Hi <b>${fullname}</b>,</p>
          <p>Your subscription is set to expire in <b>2 days</b>.</p>
          <p>Renew now to continue enjoying Reach Finder 🚀</p>
        </div>
      </div>
    `;
  } else if (type === "expired") {
    subject = "⚠️ Your subscription expired yesterday – Reactivate now!";
    text = `Hi ${fullname}, your subscription expired yesterday. Reactivate today to continue enjoying Reach Finder.`;
    html = `
      <div style="${baseStyle}">
        <div style="${cardStyle}">
          <h2 style="color:#DC2626;">⚠️ Subscription Expired</h2>
          <p>Hi <b>${fullname}</b>,</p>
          <p>Your subscription <b>expired yesterday</b>. We already miss you 😢</p>
          <p>Reactivate today to regain full access!</p>
        </div>
      </div>
    `;
  }

  return exports.sendEmail({ to: email, subject, text, html });
};

/**
 * ✅ Subscription Success Email
 */
/**
 * ✅ Subscription Success Email with Package Info
 */
exports.sendSubscriptionSuccessEmail = async (
  email,
  fullname,
  packageName,
  price,
  currency,
  status,
  paymentMethod,
  transactionId
) => {
  const subject = "🎉 Welcome Aboard – Subscription Activated!";
  const text = `Hi ${fullname}, your subscription to the ${packageName} plan has been successfully activated. Enjoy all the premium features of Reach Finder.`;

  const baseStyle = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #f5f7fa;
    padding: 20px;
  `;
  const cardStyle = `
    max-width: 500px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    text-align: center;
  `;
  const btnStyle = `
    display: inline-block;
    background-color: #16A34A;
    color: #ffffff;
    padding: 12px 24px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: bold;
    margin-top: 16px;
  `;
  const packageStyle = `
    display: inline-block;
    background-color: #DCFCE7;
    color: #166534;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: 600;
    margin-top: 12px;
  `;

  const html = `
  <div style="${baseStyle}">
    <div style="
      max-width: 650px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1f2937;
    ">

      <!-- HEADER -->
      <h1 style="color: #2563eb; text-align:center; margin-bottom: 8px;">Reach Finder</h1>
      <p style="text-align:center; color:#6b7280; margin-top:0;">Official Invoice & Payment Confirmation</p>

      <hr style="margin: 24px 0; border: 0; height: 1px; background-color: #e5e7eb;" />

      <!-- CUSTOMER INFO -->
      <h3 style="margin-bottom: 6px;">Billed To:</h3>
      <p style="margin:0; font-size:14px;">
        <b>${fullname}</b><br/>
        ${email}
      </p>

      <br/>

      <!-- INVOICE SUMMARY -->
      <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="padding: 10px; background:#f9fafb; font-weight:600;">Invoice Date</td>
          <td style="padding: 10px; text-align:right;">${new Date().toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 10px; background:#f9fafb; font-weight:600;">Payment Method</td>
          <td style="padding: 10px; text-align:right;">${paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding: 10px; background:#f9fafb; font-weight:600;">Transaction ID</td>
          <td style="padding: 10px; text-align:right;">${transactionId}</td>
        </tr>
        <tr>
          <td style="padding: 10px; background:#f9fafb; font-weight:600;">Status</td>
          <td style="padding: 10px; text-align:right; color:#16A34A; font-weight:bold;">${status}</td>
        </tr>
      </table>

      <br/>

      <!-- PLAN DETAILS -->
      <h3 style="margin-top: 30px;">Subscription Details</h3>
      <table style="width:100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background:#2563eb; color:white;">
            <th style="padding: 12px; text-align:left;">Plan</th>
            <th style="padding: 12px; text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background:#f3f4f6;">
            <td style="padding: 12px;">${packageName}</td>
            <td style="padding: 12px; text-align:right;">${price} ${currency}</td>
          </tr>
        </tbody>
      </table>

      <br/>

      <!-- TOTAL -->
      <table style="width:100%; margin-top: 18px;">
        <tr>
          <td style="font-size: 18px; font-weight:600;">Total Paid:</td>
          <td style="font-size: 18px; font-weight:700; text-align:right; color:#2563eb;">
            ${price} ${currency}
          </td>
        </tr>
      </table>

      <hr style="margin: 28px 0; border: 0; height: 1px; background-color: #e5e7eb;" />

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${process.env.CLIENT_URL || "#"}" 
          style="
            ${btnStyle};
            background-color:#2563eb;
            font-size:16px;
          ">
          Go to Dashboard 🚀
        </a>
      </div>



      <p style="text-align:center; color:#6b7280; margin-top:18px;">
        Thank you for your purchase! We're excited to have you with us.
      </p>
    </div>
  </div>
`;

  return exports.sendEmail({ to: email, subject, text, html });
};
