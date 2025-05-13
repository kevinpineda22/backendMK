const nodemailer = require('nodemailer');

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use another service like Outlook, Yahoo, etc.
  auth: {
    user: process.env.EMAIL_USER, // Your email address (e.g., gastosmerkahorro@gmail.com)
    pass: process.env.EMAIL_PASS, // Your email password or app-specific password
  },
});

// Function to send email
const sendEmail = async ({ to, subject, text, html, postulacionId }) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to, // Can be a string or array of emails
      subject,
      text,
      html: html || `<p>${text}</p>${postulacionId ? `<p>ID de Postulación: ${postulacionId}</p>` : ''}`,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Correo enviado exitosamente' };
  } catch (error) {
    console.error('Error al enviar correo:', error);
    throw new Error(`Error al enviar correo: ${error.message}`);
  }
};

module.exports = { sendEmail };