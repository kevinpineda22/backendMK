import nodemailer from 'nodemailer';

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send email (ajustada para Express)
export const sendEmail = async (req, res, next) => {
  try {
    const { to, subject, text, html, postulacionId } = req.body;

    // Validar campos requeridos
    if (!to || !subject || !text) {
      return res.status(400).json({ error: 'Faltan campos requeridos: to, subject, text' });
    }

    // Validar formato del correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: 'El correo del destinatario no tiene un formato válido' });
    }

    // Validar que subject y text sean cadenas no vacías
    if (typeof subject !== 'string' || subject.trim() === '') {
      return res.status(400).json({ error: 'El asunto debe ser una cadena no vacía' });
    }
    if (typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'El texto del correo debe ser una cadena no vacía' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html: html || `<p>${text}</p>${postulacionId ? `<p>ID de Postulación: ${postulacionId}</p>` : ''}`,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true, message: 'Correo enviado exitosamente' });
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return res.status(500).json({ error: error.message });
  }
};