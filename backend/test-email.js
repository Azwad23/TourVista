const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: process.env.SMTP_USER,
  subject: 'Test Email',
  text: 'If you receive this, SMTP is working!'
}).then(() => {
  console.log('✅ Email sent successfully!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Email failed:', err.message);
  process.exit(1);
});
