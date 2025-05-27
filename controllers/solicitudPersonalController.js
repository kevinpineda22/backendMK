import supabase from "../config/supabaseClient.js";
import { sendEmail as sendEmailService } from "./emailService.js";
import { getCurrentColombiaTimeISO } from "../utils/timeUtils.js";

// Correos de quienes deben recibir la solicitud
const DESTINATARIOS = [
  "juanmerkahorro@gmail.com",
  "johanmerkahorro777@gmail.com"
];

export const enviarSolicitudPersonal = async (req, res) => {
  try {
    const solicitud = req.body;

    solicitud.created_at = getCurrentColombiaTimeISO();

    const { data, error } = await supabase
      .from("solicitudes_personal")
      .insert([solicitud])
      .select();

    if (error) {
      console.error("Error al insertar en Supabase:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error al guardar la solicitud.",
        error: error.message,
      });
    }

    const id = data[0]?.id;

    // Email HTML
    const html = `
      <p><strong>⚠ Nueva Solicitud de Personal Recibida</strong></p>
      <p><strong>Cargo:</strong> ${solicitud.cargo_solicitado}</p>
      <p><strong>Sede:</strong> ${solicitud.sede}</p>
      <p><strong>Fecha estimada de ingreso:</strong> ${solicitud.fecha_ingreso}</p>
      <p><strong>Solicitado por:</strong> ${solicitud.solicitado_por}</p>
      <p><strong>Fecha de solicitud:</strong> ${solicitud.fecha_solicitud}</p>
      <p>Consulta el detalle de esta solicitud en el sistema.</p>
    `;

    for (const to of DESTINATARIOS) {
      await sendEmailService({
        to,
        subject: "📩 Nueva Solicitud de Personal",
        html,
      });
    }

    res.status(200).json({
      success: true,
      message: "Solicitud enviada correctamente y notificada.",
      id_requisicion: id,
    });
  } catch (err) {
    console.error("Error general:", err);
    res.status(500).json({
      success: false,
      message: "Error inesperado al procesar la solicitud.",
      error: err.message,
    });
  }
};
