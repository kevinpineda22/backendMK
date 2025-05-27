import supabase from "../config/supabaseClient.js";
import { sendEmail as sendEmailService } from "./emailService.js";
import { getCurrentColombiaTimeISO } from "../utils/timeUtils.js";

const DESTINATARIOS = [
  "juanmerkahorro@gmail.com",
  "johanmerkahorro777@gmail.com"
];

export const enviarSolicitudPersonal = async (req, res) => {
  try {
    const solicitud = req.body;
    solicitud.created_at = getCurrentColombiaTimeISO();

    // Generar código único de requisición tipo REQ-001
    let intento = 1;
    let nuevoCodigo;

    while (intento < 10000) {
      const codigoPropuesto = `REQ-${String(intento).padStart(3, "0")}`;
      const { data: existe } = await supabase
        .from("solicitudes_personal")
        .select("id")
        .eq("codigo_requisicion", codigoPropuesto)
        .maybeSingle();

      if (!existe) {
        nuevoCodigo = codigoPropuesto;
        break;
      }

      intento++;
    }

    if (!nuevoCodigo) {
      return res.status(500).json({
        success: false,
        message: "No se pudo generar un código único de requisición.",
      });
    }

    solicitud.codigo_requisicion = nuevoCodigo;

    // Insertar en Supabase
    const { data, error: insertError } = await supabase
      .from("solicitudes_personal")
      .insert([solicitud])
      .select();

    if (insertError) {
      return res.status(500).json({
        success: false,
        message: "Error al guardar la solicitud.",
        error: insertError.message,
      });
    }

    // Enviar notificación por correo
    const html = `
      <p><strong>📋 Nueva Solicitud de Personal</strong></p>
      <p><strong>Código:</strong> ${nuevoCodigo}</p>
      <p><strong>Cargo:</strong> ${solicitud.cargo_solicitado}</p>
      <p><strong>Sede:</strong> ${solicitud.sede}</p>
      <p><strong>Solicitado por:</strong> ${solicitud.solicitado_por}</p>
      <p><strong>Fecha estimada de ingreso:</strong> ${solicitud.fecha_ingreso}</p>
    `;

    for (const to of DESTINATARIOS) {
      await sendEmailService({
        to,
        subject: "📩 Nueva Solicitud de Personal",
        html,
      });
    }

    // Respuesta final
    res.status(200).json({
      success: true,
      message: "Solicitud enviada correctamente y notificada.",
      codigo_requisicion: nuevoCodigo,
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

export const obtenerSolicitudesPersonal = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("solicitudes_personal")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Error al obtener las solicitudes.",
        error: error.message,
      });
    }

    res.status(200).json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    console.error("Error general:", err);
    res.status(500).json({
      success: false,
      message: "Error inesperado al obtener las solicitudes.",
      error: err.message,
    });
  }
};