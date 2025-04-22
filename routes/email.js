import sgMail from '@sendgrid/mail';

// Configurar SendGrid con la clave API
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async (req, res) => {
  try {
    const { to, subject, message, postulacionId } = req.body;

    // Validar parámetros
    if (!to || !subject || !message) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    // Configurar el correo
    const msg = {
      to, // Array: ['juanmerkahorro@gmail.com', 'johanmerkahorro777@gmail.com']
      from: 'gastosmerkahorro@gmail.com', // Cambia por tu correo verificado en SendGrid
      subject,
      text: message,
      html: `<p>${message}</p><p>ID de Postulación: ${postulacionId}</p>`,
    };

    // Enviar el correo
    await sgMail.send(msg);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error al enviar correo:', error);
    res.status(500).json({ error: error.message });
  }
};