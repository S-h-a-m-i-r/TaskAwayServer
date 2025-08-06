import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import emailConfig from '../config/email.js';
import User from '../models/User.js';

const transporter = nodemailer.createTransport(emailConfig);

export const verifyUserEmail = async (req, res) => {
  const { token, id } = req.query;

  const user = await User.findOne({
    _id: id
  });

  if (!user) {
    return res.status(400).send('Invalid or expired token');
  }

  user.isEmailVerified = true;
  await user.save();

  res.send('Email verified successfully!');
};

export const sendEmail = async (to, subject, templateName, templateData) => {
  try {
    // 1. Validate email configuration
    if (!process.env.SMTP_USER && !process.env.GMAIL_USER) {
      throw new Error(
        'Email configuration missing: SMTP_USER or GMAIL_USER not set'
      );
    }

    if (!process.env.SMTP_PASS && !process.env.GMAIL_APP_PASSWORD) {
      throw new Error(
        'Email configuration missing: SMTP_PASS or GMAIL_APP_PASSWORD not set'
      );
    }

    // 2. Load and compile template
    const templatePath = path.resolve('src/templates', `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Email template not found: ${templatePath}`);
    }

    const source = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(source);
    const html = compiledTemplate(templateData);

    // 3. Send email
    const mailOptions = {
      from:
        process.env.EMAIL_FROM ||
        process.env.SMTP_USER ||
        process.env.GMAIL_USER,
      to,
      subject,
      html
    };

    console.log('Attempting to send email to:', to);
    console.log('Email configuration:', {
      host: emailConfig.host,
      port: emailConfig.port,
      user: emailConfig.auth.user
    });

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    console.error('Full error:', error);
    // Don't throw error - just log it and continue
    // This prevents registration from failing due to email issues
    return { error: true, message: error.message };
  }
};
