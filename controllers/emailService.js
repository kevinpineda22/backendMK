const nodemailer = require('nodemailer');

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // Puedes cambiar a otro servicio como Outlook, Yahoo, etc.
  auth: {
    user: process.env.EMAIL_USER, // Ejemplo: gastosmerkahorro@gmail.com
    pass: process.env.EMAIL_PASS, // Contraseña o App Password de Gmail
  },
});

// Function to send email
const sendEmail = async ({ to, subject, text, html, postulacionId }) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to, // Puede ser string o array de correos
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