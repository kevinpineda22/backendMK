import nodemailer from 'nodemailer';

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,        // STARTTLS
  secure: false,    // false = utiliza STARTTLS, true = SSL/TLS en el connect
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    // Recomendado por Office365 para evitar errores de certificados
    ciphers: 'TLSv1.2'
  }
});

// Function to send email
export const sendEmail = async ({ to, subject, text, html, postulacionId }) => {
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