// config/nodemailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,       // your Gmail address
    pass: process.env.EMAIL_PASS        // your Gmail App Password
  }
});

module.exports = transporter;
