// emailService.js
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Función para enviar correos con Resend
export const sendEmail = async ({ to, subject, text, html, postulacionId }) => {
  try {
    const contenidoHTML =
      html ||
      `<p>${text}</p>${
        postulacionId ? `<p><strong>ID de Postulación:</strong> ${postulacionId}</p>` : ''
      }`;

    const data = await resend.emails.send({
      from: 'onboarding@resend.dev', // Usa un dominio verificado en Resend
      to,
      subject,
      html: contenidoHTML,
    });

    return { success: true, message: 'Correo enviado exitosamente', data };
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    throw new Error(`Error al enviar correo: ${error.message}`);
  }
};
