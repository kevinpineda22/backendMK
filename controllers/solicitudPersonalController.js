import supabase from "../config/supabaseClient.js";
import { sendEmail as sendEmailService } from "./emailService.js";
import { getCurrentColombiaTimeISO } from "../utils/timeUtils.js";

const DESTINATARIOS = [
  "juanmerkahorro@gmail.com",
  "johanmerkahorro777@gmail.com",
];

export const enviarSolicitudPersonal = async (req, res) => {
  try {
    const solicitud = req.body;
    console.log("Datos recibidos:", solicitud); // Depuración

    // Campos permitidos según el esquema de Supabase
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
      "aprobado_por",
    ];
    const solicitudFiltrada = Object.keys(solicitud)
      .filter((key) => camposPermitidos.includes(key))
      .reduce((obj, key) => {
        obj[key] = solicitud[key];
        return obj;
      }, {});

    // Validar campos requeridos (NOT NULL)
    const requiredFields = [
      "cargo_solicitado",
      "sede",
      "fecha_solicitud",
      "solicitado_por",
    ];
    for (const field of requiredFields) {
      if (!solicitudFiltrada[field] || solicitudFiltrada[field] === "") {
        return res.status(400).json({
          success: false,
          message: `El campo ${field} es obligatorio.`,
        });
      }
    }

    // Validar formato de salario
    if (solicitudFiltrada.salario && isNaN(Number(solicitudFiltrada.salario))) {
      return res.status(400).json({
        success: false,
        message: "El salario debe ser un valor numérico.",
      });
    }

    // Validar sugerencia_persona
    if (
      solicitudFiltrada.sugerencia_persona &&
      !["si", "no"].includes(solicitudFiltrada.sugerencia_persona)
    ) {
      return res.status(400).json({
        success: false,
        message: "El campo sugerencia_persona debe ser 'si' o 'no'.",
      });
    }

    solicitudFiltrada.created_at = getCurrentColombiaTimeISO();

    // Generar código único (REQ-XXX)
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

    solicitudFiltrada.codigo_requisicion = nuevoCodigo;

    // Insertar en Supabase
    const { data, error: insertError } = await supabase
      .from("solicitudes_personal")
      .insert([solicitudFiltrada])
      .select();

    if (insertError) {
      console.error("Error de Supabase:", insertError);
      return res.status(400).json({
        success: false,
        message: "Error al guardar la solicitud.",
        error: insertError.message,
      });
    }

    // Determinar destinatarios según el motivo
    const motivosPrincipales = [
      "Renuncia",
      "Terminación del Contrato",
      "Vacaciones",
      "Incapacidad",
      "Cargo Nuevo",
    ];
    let destinatarios = [];

    if (solicitudFiltrada.motivo && solicitudFiltrada.motivo.length > 0) {
      const tieneMotivoPrincipal = solicitudFiltrada.motivo.some((m) =>
        motivosPrincipales.includes(m)
      );
      const tieneOtroMotivo = solicitudFiltrada.motivo.includes("Otro motivo");

      if (tieneMotivoPrincipal || tieneOtroMotivo) {
        destinatarios = ["juanmerkahorro@gmail.com"];
      }
    }

    if (destinatarios.length > 0) {
      // Enviar notificación por correo
      const html = `
        <p><strong>📋 Nueva Solicitud de Personal</strong></p>
        <p><strong>Código:</strong> ${nuevoCodigo}</p>
        <p><strong>Cargo:</strong> ${solicitudFiltrada.cargo_solicitado}</p>
        <p><strong>Sede:</strong> ${solicitudFiltrada.sede}</p>
        <p><strong>Solicitado por:</strong> ${solicitudFiltrada.solicitado_por}</p>
        <p><strong>Promoción interna:</strong> ${solicitudFiltrada.sugerencia_persona || "No especificado"}</p>
        <p><strong>Fecha estimada de ingreso:</strong> ${solicitudFiltrada.fecha_ingreso || "N/A"}</p>
        <p><strong>Motivo(s):</strong> ${solicitudFiltrada.motivo.join(", ")}</p>
      `;

      for (const to of destinatarios) {
        await sendEmailService({
          to,
          subject: "📩 Nueva Solicitud de Personal",
          html,
        });
      }
    }

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