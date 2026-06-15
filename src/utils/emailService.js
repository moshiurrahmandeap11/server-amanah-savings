import nodemailer from "nodemailer";

let transporter = null;

export const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  return transporter;
};

export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `"Amanah Savings" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Send email error:", error);
    return { success: false, error: error.message };
  }
};

// utils/emailService.js এ যোগ করুন
export const sendOtpEmail = async (email, otp, type = "email_verification") => {
  try {
    let subject = "";
    let html = "";

    if (type === "password_reset") {
      subject = "Password Reset OTP - Amanah Savings";
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset OTP</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 500px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669, #10b981); padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; }
            .otp-code { font-size: 32px; font-weight: bold; color: #059669; text-align: center; padding: 20px; background: white; border-radius: 10px; margin: 20px 0; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
            .warning { background: #fef3c7; padding: 12px; border-radius: 8px; margin-top: 20px; font-size: 12px; color: #92400e; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset your password for your Amanah Savings account.</p>
              <p>Use the following OTP to reset your password:</p>
              <div class="otp-code">${otp}</div>
              <p>This OTP is valid for <strong>10 minutes</strong>.</p>
              <p>If you didn't request this, please ignore this email or contact support.</p>
              <div class="warning">
                ⚠️ Never share this OTP with anyone. Our team will never ask for your OTP.
              </div>
            </div>
            <div class="footer">
              <p>&copy; 2026 Amanah Savings. All rights reserved.</p>
              <p>Secure Islamic Savings Platform for Bangladesh</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = "Email Verification OTP - Amanah Savings";
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Verify Your Email</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .container { max-width: 500px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669, #10b981); padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #059669; text-align: center; padding: 20px; background: white; border-radius: 10px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verify Your Email</h1>
            </div>
            <div class="content">
              <p>Welcome to Amanah Savings!</p>
              <p>Use this OTP to verify your email address:</p>
              <div class="otp-code">${otp}</div>
              <p>This OTP is valid for 5 minutes.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const transporter = getTransporter();
    
    await transporter.sendMail({
      from: `"Amanah Savings" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: html,
    });

    return { success: true };
  } catch (error) {
    console.error("Email sending error:", error);
    return { success: false, error: error.message };
  }
};

export const sendNotificationEmail = async (email, title, message) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #059669; text-align: center;">Amanah Savings</h2>
      <p style="font-size: 16px; color: #333;">Assalamu Alaikum,</p>
      <h3 style="color: #059669;">${title}</h3>
      <p style="font-size: 16px; color: #333;">${message}</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">Amanah Savings — Islamic Savings Platform for Bangladesh</p>
    </div>
  `;
  return sendEmail({ to: email, subject: title, html, text: message });
};

export const sendTicketReplyEmail = async (email, ticketId, replyMessage) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #059669; text-align: center;">Amanah Savings</h2>
      <p style="font-size: 16px; color: #333;">Assalamu Alaikum,</p>
      <p style="font-size: 16px; color: #333;">Your support ticket <strong>${ticketId}</strong> has received a new reply:</p>
      <div style="padding: 15px; background: #f0fdf4; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
        <p style="font-size: 14px; color: #333; margin: 0;">${replyMessage}</p>
      </div>
      <p style="font-size: 14px; color: #666;">You can view the full conversation in your dashboard.</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">Amanah Savings — Islamic Savings Platform for Bangladesh</p>
    </div>
  `;
  return sendEmail({
    to: email,
    subject: `New Reply to Your Support Ticket ${ticketId}`,
    html,
    text: `Your support ticket ${ticketId} has a new reply: ${replyMessage}`,
  });
};
