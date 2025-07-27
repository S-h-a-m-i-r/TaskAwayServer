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
  // 2. Load and compile template
  const templatePath = path.resolve('src/templates', `${templateName}.hbs`);
  const source = fs.readFileSync(templatePath, 'utf8');
  const compiledTemplate = handlebars.compile(source);
  const html = compiledTemplate(templateData);

  // 3. Send email
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
    to,
    subject,
    html
  };
  const info = await transporter.sendMail(mailOptions);
  return info;
};
