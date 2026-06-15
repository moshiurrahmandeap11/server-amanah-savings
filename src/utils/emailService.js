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

export const sendOtpEmail = async (email, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #059669; text-align: center;">Amanah Savings</h2>
      <p style="font-size: 16px; color: #333;">Assalamu Alaikum,</p>
      <p style="font-size: 16px; color: #333;">Your email verification code is:</p>
      <div style="text-align: center; padding: 20px; background: #f0fdf4; border-radius: 8px; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 8px;">${otp}</span>
      </div>
      <p style="font-size: 14px; color: #666;">This code will expire in 5 minutes.</p>
      <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">Amanah Savings — Islamic Savings Platform for Bangladesh</p>
    </div>
  `;
  return sendEmail({
    to: email,
    subject: "Your Amanah Savings Verification Code",
    html,
    text: `Your verification code is: ${otp}. This code will expire in 5 minutes.`,
  });
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
