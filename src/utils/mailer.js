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
  const subject = "✨ Subscription Activated | Your Reach Finder Premium Access";
  const text = `Hi ${fullname}, your subscription to the ${packageName} plan has been successfully activated. Enjoy all the premium features of Reach Finder.`;

  // Add your ImageBB logo URL here
  const LOGO_URL = "https://i.ibb.co/Vcx4s1VH/logo.png"; // Replace with your actual ImageBB URL

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reach Finder | Subscription Confirmation</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @media only screen and (max-width: 640px) {
            .container {
                padding: 10px !important;
                margin: 20px auto !important;
            }
            .grid-2 {
                grid-template-columns: 1fr !important;
            }
            .logo-container {
                padding: 8px 16px !important;
            }
            .cta-button {
                padding: 14px 30px !important;
                font-size: 15px !important;
            }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">

  <!-- Email Container -->
  <div class="container" style="max-width: 640px; margin: 40px auto; padding: 20px;">
    
    <!-- Premium Card -->
    <div style="background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);">
      
      <!-- Gradient Header -->
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 40px 40px 32px; text-align: center; position: relative;">
        
        <!-- Decorative Elements -->
        <div style="position: absolute; top: 20px; right: 30px; width: 40px; height: 40px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
        <div style="position: absolute; bottom: 40px; left: 30px; width: 24px; height: 24px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
        
        <!-- Logo Section -->
        <div class="logo-container" style="margin-bottom: 32px;">
          <div style="display: inline-block; background: white; padding: 16px 28px; border-radius: 20px; box-shadow: 0 12px 32px rgba(0,0,0,0.15);">
            <!-- Logo Image from ImageBB -->
            <img src="${LOGO_URL}" 
                 alt="Reach Finder Logo" 
                 style="max-width: 180px; height: auto; display: block; margin: 0 auto;"
                 width="180"
                 height="auto">
            <div style="margin-top: 8px;">
            </div>
          </div>
        </div>
        
        <!-- Success Icon -->
        <div style="background: white; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 12px 32px rgba(0,0,0,0.15);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        
        <h2 style="color: white; margin: 0 0 8px; font-size: 28px; font-weight: 700;">
          Payment Confirmed!
        </h2>
        <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px; font-weight: 400;">
          Your premium subscription is now active
        </p>
      </div>

      <!-- Invoice Details -->
      <div style="padding: 40px;">
        
        <!-- Recipient Info -->
        <div style="display: flex; align-items: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #f3f4f6;">
          <div style="flex: 1;">
            <h3 style="margin: 0 0 8px; color: #1f2937; font-size: 18px; font-weight: 600;">
              Billed To
            </h3>
            <p style="margin: 0; color: #4b5563; font-size: 15px;">
              <strong>${fullname}</strong><br/>
              ${email}
            </p>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; background: #f0f9ff; color: #0369a1; padding: 8px 16px; border-radius: 12px; font-weight: 600; font-size: 14px;">
              Premium Member
            </div>
          </div>
        </div>

        <!-- Invoice Summary -->
        <div style="background: #f9fafb; border-radius: 16px; padding: 24px; margin-bottom: 32px;">
          <h3 style="margin: 0 0 20px; color: #1f2937; font-size: 18px; font-weight: 600;">
            Invoice Summary
          </h3>
          
          <div class="grid-2" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <div>
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; font-weight: 500; text-transform: uppercase;">
                Invoice Date
              </p>
              <p style="margin: 0; color: #1f2937; font-weight: 600;">
                ${new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            
            <div>
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; font-weight: 500; text-transform: uppercase;">
                Payment Method
              </p>
              <p style="margin: 0; color: #1f2937; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 24px; height: 24px; background: #f3f4f6; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                  💳
                </span>
                ${paymentMethod}
              </p>
            </div>
            
            <div>
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; font-weight: 500; text-transform: uppercase;">
                Transaction ID
              </p>
              <p style="margin: 0; color: #1f2937; font-weight: 600; font-family: monospace; font-size: 14px;">
                ${transactionId}
              </p>
            </div>
            
            <div>
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; font-weight: 500; text-transform: uppercase;">
                Status
              </p>
              <p style="margin: 0;">
                <span style="display: inline-flex; align-items: center; background: #d1fae5; color: #065f46; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 14px;">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right: 6px;">
                    <circle cx="8" cy="8" r="6" fill="#10b981"/>
                  </svg>
                  ${status}
                </span>
              </p>
            </div>
          </div>
        </div>

        <!-- Plan Details -->
        <div style="border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; margin-bottom: 32px;">
          <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 20px 24px; border-bottom: 1px solid #e5e7eb;">
            <h3 style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">
              Subscription Plan
            </h3>
          </div>
          
          <div style="padding: 24px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
              <div>
                <h4 style="margin: 0 0 8px; color: #1f2937; font-size: 20px; font-weight: 700;">
                  ${packageName}
                </h4>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  Full access to all premium features
                </p>
              </div>
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 24px; border-radius: 12px; text-align: center;">
                <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">
                  Total Amount
                </div>
                <div style="font-size: 28px; font-weight: 800;">
                  ${currency} ${price}
                </div>
              </div>
            </div>
            
            <!-- Features List -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 24px;">
              <h5 style="margin: 0 0 12px; color: #4b5563; font-size: 14px; font-weight: 600; text-transform: uppercase;">
                Included Features:
              </h5>
              <div class="grid-2" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #10b981;">✓</span>
                  <span style="color: #374151; font-size: 14px;">Unlimited Searches</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #10b981;">✓</span>
                  <span style="color: #374151; font-size: 14px;">Advanced Filters</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #10b981;">✓</span>
                  <span style="color: #374151; font-size: 14px;">Priority Support</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #10b981;">✓</span>
                  <span style="color: #374151; font-size: 14px;">Export Data</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Total Section -->
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 40px;">
          <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 500;">
            FINAL AMOUNT PAID
          </p>
          <p style="margin: 0; color: #92400e; font-size: 40px; font-weight: 800; letter-spacing: -1px;">
            ${currency} ${price}
          </p>
          <p style="margin: 12px 0 0; color: #92400e; opacity: 0.8; font-size: 14px;">
            Thank you for your trust in our service
          </p>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${process.env.CLIENT_URL || '#'}" 
            class="cta-button"
            style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;">
            🚀 Access Your Dashboard
          </a>
          <p style="margin: 16px 0 0; color: #6b7280; font-size: 14px;">
            Your premium features are ready to use
          </p>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 32px; text-align: center;">
          <div style="margin-bottom: 20px;">
            <img src="${LOGO_URL}" 
                 alt="Reach Finder Logo" 
                 style="max-width: 120px; height: auto; opacity: 0.8;"
                 width="120"
                 height="auto">
          </div>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 14px;">
            Need help? <a href="mailto:support@reachfinder.com" style="color: #2563eb; text-decoration: none; font-weight: 600;">Contact Support</a>
          </p>
          <div style="color: #9ca3af; font-size: 13px; line-height: 1.6;">
            <p style="margin: 0;">
              This is an automated receipt for your records.<br/>
              © ${new Date().getFullYear()} Reach Finder. All rights reserved.
            </p>
          </div>
        </div>

      </div>
    </div>

    <!-- Watermark -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">
        Premium Subscription Receipt • Reach Finder
      </p>
    </div>
  </div>

</body>
</html>
  `;

  return exports.sendEmail({ to: email, subject, text, html });
};