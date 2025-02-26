// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const crypto = require('crypto');
const { sendVerificationEmail, sendResetPasswordEmail } = require('../utils/mailer');
const { ensureAuthenticated } = require('../utils/auth');

// 📌 RESEND VERIFICATION EMAIL
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.flash('error_msg', 'No account found with that email.');
      return res.redirect('/auth/login');
    }

    if (user.isVerified) {
      req.flash('error_msg', 'Your email is already verified.');
      return res.redirect('/auth/login');
    }

    await sendVerificationEmail(user);
    req.flash('success_msg', 'Verification email resent.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error resending verification email.');
    res.redirect('/auth/login');
  }
});

// 📌 PASSWORD RESET - REQUEST LINK
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.flash('error_msg', 'No account found with that email.');
      return res.redirect('/auth/forgot-password');
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();
    await sendResetPasswordEmail(user.email, resetToken);

    req.flash('success_msg', 'Password reset link sent to your email.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error processing password reset request.');
    res.redirect('/auth/forgot-password');
  }
});

// 📌 PASSWORD RESET - NEW PASSWORD FORM
router.get('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error_msg', 'Invalid or expired reset token.');
      return res.redirect('/auth/forgot-password');
    }

    res.render('reset-password', { token: req.params.token });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error accessing reset page.');
    res.redirect('/auth/forgot-password');
  }
});

// 📌 PASSWORD RESET - SET NEW PASSWORD
router.post('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error_msg', 'Invalid or expired reset token.');
      return res.redirect('/auth/forgot-password');
    }

    const { password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match.');
      return res.redirect(`/auth/reset-password/${req.params.token}`);
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
    req.flash('success_msg', 'Password updated successfully. You can now log in.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error resetting password.');
    res.redirect('/auth/forgot-password');
  }
});

module.exports = router;
