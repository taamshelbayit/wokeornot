// utils/mailer.js
const nodemailer = require('nodemailer');

// Configure the email transporter (ensure environment variables are set)
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send a verification email to a new user.
 * @param {Object} user - The user object.
 */
const sendVerificationEmail = async (user) => {
  try {
    const verifyURL = `http://${process.env.DOMAIN}/auth/verify/${user.verifyToken}`;

    const mailOptions = {
      from: `"WokeOrNot" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Verify Your WokeOrNot Account',
      html: `
        <h2>Welcome to WokeOrNot, ${user.firstName}!</h2>
        <p>Please verify your email address to activate your account:</p>
        <p><a href="${verifyURL}" style="background-color:#28a745;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Verify My Email</a></p>
        <p>If the button doesn't work, copy and paste the following link into your browser:</p>
        <p>${verifyURL}</p>
        <p>Thank you!</p>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Error sending verification email:', err);
  }
};

/**
 * Send a password reset email.
 * @param {string} email - The recipient's email address.
 * @param {string} resetToken - The password reset token.
 */
const sendResetPasswordEmail = async (email, resetToken) => {
  try {
    const resetURL = `http://${process.env.DOMAIN}/auth/reset-password/${resetToken}`;

    const mailOptions = {
      from: `"WokeOrNot" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your WokeOrNot Password',
      html: `
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click the link below to reset it:</p>
        <p><a href="${resetURL}" style="background-color:#dc3545;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a></p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
        <p>Thank you!</p>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Error sending password reset email:', err);
  }
};

// Export functions
module.exports = { sendVerificationEmail, sendResetPasswordEmail };
