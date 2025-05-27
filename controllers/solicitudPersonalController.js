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

        // Obtener el último código generado
        const { data: ultimas, error: fetchError } = await supabase
            .from("solicitudes_personal")
            .select("codigo_requisicion")
            .order("created_at", { ascending: false })
            .limit(1);

        if (fetchError) {
            return res.status(500).json({
                success: false,
                message: "Error consultando últimos códigos",
                error: fetchError.message,
            });
        }

        let nuevoCodigo = "REQ-001";
        if (ultimas.length > 0 && ultimas[0].codigo_requisicion) {
            const lastNum = parseInt(ultimas[0].codigo_requisicion.split("-")[1]) || 0;
            nuevoCodigo = `REQ-${String(lastNum + 1).padStart(3, "0")}`;
        }

        solicitud.created_at = getCurrentColombiaTimeISO();
        solicitud.codigo_requisicion = nuevoCodigo;

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
