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
      "otroMotivoTexto", // Añadimos este campo para incluirlo en el correo
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

      if (tieneMotivoPrincipal && !tieneOtroMotivo) {
        destinatarios = ["juanmerkahorro@gmail.com"];
      } else if (tieneOtroMotivo) {
        destinatarios = ["johanmerkahorro777@gmail.com"];
      } else if (tieneMotivoPrincipal && tieneOtroMotivo) {
        // Si se combinan ambos tipos, enviar a ambos para cubrir todos los casos
        destinatarios = ["juanmerkahorro@gmail.com", "johanmerkahorro777@gmail.com"];
      }
    }

    if (destinatarios.length > 0) {
      // Preparar el contenido del correo con diseño mejorado
      const motivosTexto = solicitudFiltrada.motivo
        ? solicitudFiltrada.motivo.join(", ")
        : "No especificado";
      const otroMotivoTexto =
        solicitudFiltrada.motivo.includes("Otro motivo") &&
        solicitudFiltrada.otroMotivoTexto
          ? ` - ${solicitudFiltrada.otroMotivoTexto}`
          : "";
      const sugerenciaTexto =
        solicitudFiltrada.sugerencia_persona === "si"
          ? `Sí - Nombre: ${solicitudFiltrada.sugerencia_nombre || "No especificado"}, Cargo: ${
              solicitudFiltrada.sugerencia_cargo || "No especificado"
            }`
          : "No";

      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background-color: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
            .header {
              background-color: #28a745;
              color: white;
              padding: 20px;
              text-align: center;
            }
            .content {
              padding: 20px;
              color: #333;
            }
            .content table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .content td {
              padding: 10px;
              border-bottom: 1px solid #eee;
            }
            .content td:first-child {
              font-weight: bold;
              width: 30%;
              color: #555;
            }
            .footer {
              text-align: center;
              padding: 10px;
              background-color: #f4f4f4;
              color: #777;
              font-size: 12px;
            }
            @media (max-width: 600px) {
              .container {
                margin: 10px;
              }
              .content td {
                display: block;
                width: 100%;
              }
              .content td:first-child {
                width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📋 Nueva Solicitud de Personal</h2>
            </div>
            <div class="content">
              <table>
                <tr><td>Código:</td><td>${nuevoCodigo}</td></tr>
                <tr><td>Cargo:</td><td>${solicitudFiltrada.cargo_solicitado}</td></tr>
                <tr><td>Sede:</td><td>${solicitudFiltrada.sede}</td></tr>
                <tr><td>Solicitado por:</td><td>${solicitudFiltrada.solicitado_por}</td></tr>
                <tr><td>Sugerencias:</td><td>${sugerenciaTexto}</td></tr>
                <tr><td>Fecha estimada de ingreso:</td><td>${solicitudFiltrada.fecha_ingreso || "N/A"}</td></tr>
                <tr><td>Motivo(s):</td><td>${motivosTexto}${otroMotivoTexto}</td></tr>
              </table>
            </div>
            <div class="footer">
              <p>© 2025 Merkahorro. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
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