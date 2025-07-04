import supabase from '../config/supabaseClient.js';
import { handleError } from '../utils/errorHandler.js';
import { getCurrentColombiaTimeISO } from '../utils/timeUtils.js';
import { sendEmail as sendEmailService } from "./emailService.js";
import crypto from 'crypto';

// --- Funciones para Postulantes (Flujo de Agendamiento) ---

export const checkPostulanteForInterview = async (req, res) => { /* ... sin cambios ... */ };
export const getAvailableInterviewDays = async (req, res) => { /* ... sin cambios ... */ };
export const reserveInterviewSlot = async (req, res) => { /* ... sin cambios ... */ };

// --- NUEVA FUNCIÓN: Cancelar Reserva de Entrevista ---
export const cancelInterviewReservation = async (req, res) => {
  try {
    const { id } = req.params; // ID de la reserva a cancelar
    const { postulacion_id } = req.body; // Postulacion_id para mayor seguridad o para revertir estado

    if (!id) {
      return res.status(400).json({ success: false, message: "ID de reserva es obligatorio para cancelar." });
    }

    // 1. Obtener los detalles de la reserva para liberar el cupo
    const { data: reservation, error: fetchError } = await supabase
      .from('reservas_entrevista')
      .select('dia_entrevista_id, postulacion_id')
      .eq('id', id)
      .single();

    if (fetchError || !reservation) {
      return handleError(res, "Reserva no encontrada.", fetchError || { message: "Reserva no encontrada" }, 404);
    }

    // Opcional: Si quieres una capa extra de seguridad, verifica que postulacion_id coincida
    if (postulacion_id && reservation.postulacion_id !== postulacion_id) {
        return res.status(403).json({ success: false, message: "No autorizado para cancelar esta reserva." });
    }

    // 2. Eliminar la reserva
    const { error: deleteError } = await supabase
      .from('reservas_entrevista')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return handleError(res, "Error al eliminar la reserva", deleteError);
    }

    // 3. Incrementar los cupos disponibles en el día de la entrevista
    const { data: diaEntrevista, error: diaFetchError } = await supabase
      .from('dias_entrevista')
      .select('cupos_disponibles')
      .eq('id', reservation.dia_entrevista_id)
      .single();
    
    if (!diaFetchError && diaEntrevista) {
        const { error: updateCuposError } = await supabase
            .from('dias_entrevista')
            .update({ cupos_disponibles: diaEntrevista.cupos_disponibles + 1 })
            .eq('id', reservation.dia_entrevista_id);

        if (updateCuposError) {
            console.error("Error al incrementar cupos después de cancelar reserva:", updateCuposError);
            // Este es un error secundario, la reserva ya está eliminada.
        }
    } else {
        console.warn("Día de entrevista no encontrado al intentar liberar cupo después de cancelar.");
    }
    
    // 4. Opcional: Revertir el estado de la postulación a 'Postulado' o 'Preseleccionado'
    // Esto es útil para que el postulante pueda agendar de nuevo.
    const { error: updatePostulacionError } = await supabase
      .from('Postulaciones')
      .update({ estado: 'Postulado' }) // O 'Preseleccionado', según tu flujo
      .eq('id', reservation.postulacion_id);

    if (updatePostulacionError) {
      console.error("Error al revertir estado de la postulación después de cancelar:", updatePostulacionError);
    }

    // Opcional: Enviar correo de confirmación de cancelación al postulante
    // Para esto, necesitarías recuperar el correo del postulante de la tabla Postulaciones.
    /*
    const { data: postulanteData, error: postulanteFetchError } = await supabase
      .from('Postulaciones')
      .select('nombreApellido, correo')
      .eq('id', reservation.postulacion_id)
      .single();

    if (!postulanteFetchError && postulanteData) {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <div style="background-color: #e53935; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">¡Tu Cita de Entrevista Merkahorro ha sido Cancelada!</h2>
            </div>
            <div style="padding: 30px;">
                <p>Estimado/a <strong>${postulanteData.nombreApellido}</strong>,</p>
                <p>Te informamos que tu cita de entrevista programada ha sido cancelada exitosamente.</p>
                <p>Tu cupo ha sido liberado. Si deseas, puedes volver a agendar una nueva entrevista en nuestro sistema.</p>
                <p style="margin-top: 20px;">Agradecemos tu aviso.</p>
            </div>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #777; border-radius: 0 0 8px 8px;">
                <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
                <p>© 2025 Merkahorro. Todos los derechos reservados.</p>
            </div>
        </div>
      `;
      await sendEmailService({
        to: postulanteData.correo,
        subject: `Confirmación de Cancelación de Entrevista Merkahorro`,
        html: emailContent,
      });
    }
    */

    res.status(200).json({ success: true, message: "Reserva cancelada exitosamente." });
  } catch (err) {
    handleError(res, "Error al cancelar la reserva de entrevista", err);
  }
};


// --- Funciones para Gestión Humana (RRHH) - (Sin cambios, placeholder) ---
export const manageInterviewDays = async (req, res) => { /* ... */ };
export const getAllInterviewDays = async (req, res) => { /* ... */ };
export const deleteInterviewDay = async (req, res) => { /* ... */ };
export const getInterviewReservations = async (req, res) => { /* ... */ };
export const updateInterviewReservationStatus = async (req, res) => { /* ... */ };