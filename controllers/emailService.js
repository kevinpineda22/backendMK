import nodemailer from 'nodemailer';
import dotenv from 'dotenv'; // Asegúrate de que dotenv esté cargado si usas variables de entorno aquí

dotenv.config(); // Cargar variables de entorno si no lo haces en server.js

// Configurar el transportador de Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.office365.com', // Por ejemplo, para Outlook/Office 365
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true para 465 (SSL/TLS), false para 587/25 (STARTTLS)
    auth: {
        user: process.env.EMAIL_USER, // Tu dirección de correo
        pass: process.env.EMAIL_PASS, // Tu contraseña de correo
    },
    // Opcional: Recomendaciones para Office365
    tls: {
      ciphers: 'TLSv1.2',
      // rejectUnauthorized: true // Descomentar en producción para mayor seguridad
    }
});

// Función para enviar correo
export const sendEmail = async ({ to, subject, text, html, postulacionId }) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER, // Remitente
            to: Array.isArray(to) ? to.join(', ') : to, // Acepta string o array de correos
            subject,
            text: text || '', // Texto plano, si no se proporciona HTML
            html: html || `<p>${text}</p>${postulacionId ? `<p>ID de Postulación: ${postulacionId}</p>` : ''}`, // Contenido HTML
        };

        // Verificar que las credenciales de correo estén definidas
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('Error de configuración: EMAIL_USER o EMAIL_PASS no están definidos en las variables de entorno.');
            throw new Error('Configuración de correo incompleta en el servidor.');
        }

        await transporter.sendMail(mailOptions);
        console.log(`Correo enviado a ${mailOptions.to} - Asunto: ${subject}`);
        return { success: true, message: 'Correo enviado exitosamente' };
    } catch (error) {
        console.error('Error al enviar correo (servicio):', error);
        throw new Error(`Error al enviar correo: ${error.message}`);
    }
};