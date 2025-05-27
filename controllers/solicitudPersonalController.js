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

    // Filtrar campos no definidos en la tabla
    const camposPermitidos = [
      "motivo",
      "reemplazo_nombre",
      "reemplazo_cargo",
      "sugerencia_persona",
      "sugerencia_nombre",
      "sugerencia_cargo",
      "cargo_solicitado",
      "sede",
      "salario",
      "fecha_solicitud",
      "fecha_ingreso",
      "tipo_contrato",
      "nivel_educativo",
      "horario",
      "bono_gasolina",
      "aux_movilidad",
      "responsabilidades",
      "requisitos",
      "solicitado_por",
      "aprobado_por"
    ];

    const solicitudFiltrada = Object.keys(solicitud)
      .filter(key => camposPermitidos.includes(key))
      .reduce((obj, key) => {
        obj[key] = solicitud[key];
        return obj;
      }, {});

    // Generar código único de requisición tipo REQ-001
    let intento = 1;
    let nuevoCodigo;

    while (intento < 10000) {
      const codigoPropuesto = `REQ-${String(intento).padStart(3, '0')}`;
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
        message: "No se pudieron generar más códigos de solicitud únicos.",
      });
    }

    solicitudFiltrada.codigo_requisicion = nuevoCodigo;

    // Validar campos requeridos
    const requiredFields = ["cargo_solicitado", "sede", "fecha_solicitud", "solicitado_por"];
    for (const field of requiredFields) {
      if (!solicitudFiltrada[field]) {
        return res.status(400).json({
          success: false,
          message: `El campo ${field} es obligatorio.`,
        });
      }
    }

    // Insertar en Supabase
    const { data, error: insertError } = await supabase
      .from("solicitudes_personal")
      .insert([solicitudFiltrada])
      .select();

    if (insertError) {
      return res.status(400).json({
        success: false,
        message: "Error al guardar la solicitud.",
        error: insertError.message,
      });
    }

    // Enviar notificación por correo
    const html = `
      <p><strong>📋 Nueva Solicitud de Personal</strong></p>
      <p><strong>Código:</strong> ${nuevoCodigo}</p>
      <p><strong>Cargo solicitado:</strong> ${solicitudFiltrada.cargo_solicitado}</p>
      <p><strong>Sede:</strong> ${solicitudFiltrada.sede}</p>
      <p><strong>Solicitado por:</strong> ${solicitudFiltrada.solicitado_por}</p>
      <p><strong>Fecha estimada de ingreso:</strong> ${solicitudFiltrada.fecha_ingreso || 'N/A'}</p>
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
      message: "Solicitud enviada correctamente.",
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