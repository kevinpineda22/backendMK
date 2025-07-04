import supabase from '../config/supabaseClient.js';
import { handleError } from '../utils/errorHandler.js'; 
import { getCurrentColombiaTimeISO } from '../utils/timeUtils.js'; 
import { sendEmail as sendEmailService } from "./emailService.js"; 
import crypto from 'crypto'; 

// --- Funciones para Postulantes (Flujo de Agendamiento) ---

// 1. Verificar si la cédula ya existe en postulaciones y si el estado es adecuado para agendar
const checkPostulanteForInterview = async (req, res) => {
  try {
    const { numeroDocumento } = req.params;

    if (!numeroDocumento) {
      return res.status(400).json({ success: false, message: "Número de documento es obligatorio." });
    }

    const { data: postulacion, error } = await supabase
      .from('Postulaciones')
      .select('id, nombreApellido, correo, estado, numeroDocumento')
      .eq('numeroDocumento', numeroDocumento)
      .maybeSingle();

    if (error) {
        console.error("Error Supabase en checkPostulanteForInterview:", error);
        return handleError(res, "Error al verificar postulante en la base de datos", error);
    }

    if (!postulacion) {
      return res.status(404).json({ success: false, message: "Postulación no encontrada con este documento. Por favor, asegúrate de haber completado el formulario de postulación." });
    }

    // *** CAMBIO CRÍTICO AQUÍ ***
    // Si ya tiene una reserva, recuperar TODOS los detalles de esa reserva.
    const { data: existingReservationDetails, error: resError } = await supabase
        .from('reservas_entrevista')
        .select(`
            id,
            fich_entrevista,
            hora_reserva,
            dia_entrevista_id,
            dia_entrevista:dias_entrevista(id, fecha, cupos_totales, cupos_disponibles, estado)
        `)
        .eq('postulacion_id', postulacion.id)
        .single(); // Esperamos un único registro, si existe

    if (resError) {
        if (resError.code === 'PGRST116') { 
            // No rows found, significa que no tiene reserva existente, lo cual es OK.
            // La función seguirá para validar el estado y permitir agendar.
        } else {
            console.error("Error Supabase al verificar reserva existente:", resError);
            return handleError(res, "Error al verificar reserva existente", resError);
        }
    }
    
    // Si existingReservationDetails existe (es decir, SÍ encontró una reserva),
    // devolvemos esa información y permitimos la visualización/cancelación.
    if (existingReservationDetails) {
        return res.status(200).json({ 
            success: true, 
            message: `Ya tienes una entrevista agendada. Tu ficho de ingreso es: ${existingReservationDetails.fich_entrevista}. Revisa tu correo.`,
            status: 'has_reservation', // Indicador para el frontend
            data: {
                postulante: postulacion, // Datos del postulante
                reserva: existingReservationDetails // Detalles completos de la reserva
            }
        });
    }

    // Si no tiene reserva existente, ahora validamos si puede agendar una nueva.
    const allowedStates = ['Postulado', 'Entrevista', 'Preseleccionado'];
    if (!allowedStates.includes(postulacion.estado)) {
        return res.status(400).json({ success: false, message: `Tu postulación se encuentra en estado "${postulacion.estado}". Solo los postulantes en las primeras fases pueden agendar.` });
    }

    // Si todo es válido y NO tiene reserva, devolver los datos del postulante para que agende
    res.status(200).json({ success: true, message: "Postulante verificado.", data: postulacion, status: 'can_schedule' }); // Indicador para el frontend
  } catch (err) {
    handleError(res, "Error inesperado al verificar postulante", err);
  }
};

// 2. Obtener días de entrevista disponibles (Lee desde la tabla `dias_entrevista`)
const getAvailableInterviewDays = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dias_entrevista')
      .select('*') 
      .gte('fecha', getCurrentColombiaTimeISO().split('T')[0]) 
      .gt('cupos_disponibles', 0) 
      .eq('estado', 'Activo') 
      .order('fecha', { ascending: true }); 

    if (error) {
        console.error("Error Supabase al obtener días disponibles:", error);
        return handleError(res, "Error al obtener días de entrevista", error);
    }
    
    res.status(200).json({ success: true, data: data || [] });

  } catch (err) {
    handleError(res, "Error inesperado al obtener días de entrevista", err);
  }
};

// 3. Reservar un espacio de entrevista
const reserveInterviewSlot = async (req, res) => {
  try {
    const { postulacion_id, dia_entrevista_id, hora_reserva } = req.body;

    if (!postulacion_id || !dia_entrevista_id || !hora_reserva) {
      return res.status(400).json({ success: false, message: "Faltan datos obligatorios para la reserva." });
    }

    // 1. Verificar cupos disponibles y el estado del día (CONSULTA REAL)
    const { data: diaEntrevista, error: diaError } = await supabase
      .from('dias_entrevista')
      .select('cupos_disponibles, estado, fecha')
      .eq('id', dia_entrevista_id)
      .single(); 

    if (diaError) {
        console.error("Error Supabase al verificar día de entrevista:", diaError);
        return handleError(res, "Día de entrevista no encontrado o inactivo.", diaError, 404);
    }
    if (!diaEntrevista || diaEntrevista.estado !== 'Activo' || diaEntrevista.cupos_disponibles <= 0) {
      return res.status(400).json({ success: false, message: "No hay cupos disponibles para este día o el día no está activo." });
    }

    // 2. Generar ficho único
    const fich_entrevista = crypto.randomBytes(4).toString('hex').toUpperCase(); 
    
    // 3. Registrar la reserva
    const { data: reservaData, error: reservaError } = await supabase
      .from('reservas_entrevista')
      .insert([
        { 
          postulacion_id, 
          dia_entrevista_id, 
          hora_reserva, 
          fich_entrevista,
          creado_en: getCurrentColombiaTimeISO()
        }
      ])
      .select(); 

    if (reservaError) {
        if (reservaError.code === '23505') { 
            return res.status(409).json({ success: false, message: "Conflicto en la reserva. Por favor, intenta de nuevo (ficho duplicado)." });
        }
        console.error("Error Supabase al registrar la reserva:", reservaError);
        return handleError(res, "Error al registrar la reserva", reservaError);
    }

    // 4. Disminuir cupos disponibles
    const { error: updateCuposError } = await supabase
      .from('dias_entrevista')
      .update({ cupos_disponibles: diaEntrevista.cupos_disponibles - 1 })
      .eq('id', dia_entrevista_id);

    if (updateCuposError) {
      console.error("Error Supabase al disminuir cupos, la reserva se creó pero el cupo no se restó:", updateCuposError);
    }

    // 5. Actualizar el estado del postulante a "Entrevista"
    const { data: postulacionActualizada, error: updatePostulacionError } = await supabase
      .from('Postulaciones')
      .update({ estado: 'Entrevista' })
      .eq('id', postulacion_id)
      .select('nombreApellido, correo, numeroDocumento') 
      .single();

    if (updatePostulacionError) {
      console.error("Error Supabase al actualizar estado del postulante:", updatePostulacionError);
    }

    // 6. Enviar correo al postulante con la confirmación de la cita
    if (postulacionActualizada) {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <div style="background-color: #210d65; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">¡Tu Cita de Entrevista Merkahorro está Confirmada!</h2>
            </div>
            <div style="padding: 30px;">
                <p>Estimado/a <strong>${postulacionActualizada.nombreApellido}</strong>,</p>
                <p>¡Gracias por tu interés en ser parte de nuestro equipo! Nos complace informarte que tu entrevista ha sido agendada con éxito.</p>
                
                <div style="background-color: #f8f9fa; border-left: 4px solid #89dc00; padding: 15px; margin: 20px 0; border-radius: 6px;">
                    <h3 style="color: #210d65; margin-top: 0; font-size: 18px;">Detalles de tu Entrevista:</h3>
                    <p style="margin: 5px 0;"><strong>Fecha:</strong> ${new Date(diaEntrevista.fecha).toLocaleDateString('es-CO')}</p>
                    <p style="margin: 5px 0;"><strong>Hora:</strong> ${hora_reserva}</p>
                    <p style="margin: 5px 0;"><strong>Lugar:</strong> Calle 52 #52-27 Copacabana, Antioquia, Colombia</p>
                    <p style="margin: 5px 0;"><strong>Ficho de Ingreso:</strong> <span style="font-size: 20px; font-weight: bold; color: #89dc00;">${fich_entrevista}</span></p>
                </div>

                <p style="margin-top: 20px;">No necesitas traer nada en especial para tu entrevista.</p>
                <p style="margin-top: 20px;">Por favor, llega unos minutos antes de tu hora programada. Presenta este correo y tu documento de identidad original en la entrada. ¡Te esperamos!</p>
            </div>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #777; border-radius: 0 0 8px 8px;">
                <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
                <p>© 2025 Merkahorro. Todos los derechos reservados.</p>
            </div>
        </div>
      `;

      await sendEmailService({
        to: postulacionActualizada.correo,
        subject: `Confirmación de Cita de Entrevista Merkahorro - Ficho: ${fich_entrevista}`,
        html: emailContent,
      });
    }

    res.status(201).json({ 
      success: true, 
      message: "Espacio de entrevista reservado exitosamente.", 
      data: reservaData[0], 
      fich_entrevista 
    });

  } catch (err) {
    handleError(res, "Error al reservar espacio de entrevista", err);
  }
};

// --- NUEVA FUNCIÓN: Cancelar Reserva de Entrevista ---
const cancelInterviewReservation = async (req, res) => {
  try {
    const { id } = req.params; // ID de la reserva a cancelar
    const { postulacion_id } = req.body; // Postulacion_id para mayor seguridad o para revertir estado

    if (!id) {
      return res.status(400).json({ success: false, message: "ID de reserva es obligatorio para cancelar." });
    }

    const { data: reservation, error: fetchError } = await supabase
      .from('reservas_entrevista')
      .select('dia_entrevista_id, postulacion_id')
      .eq('id', id)
      .single();

    if (fetchError || !reservation) {
      return handleError(res, "Reserva no encontrada.", fetchError || { message: "Reserva no encontrada" }, 404);
    }

    if (postulacion_id && reservation.postulacion_id !== postulacion_id) {
        return res.status(403).json({ success: false, message: "No autorizado para cancelar esta reserva." });
    }

    const { error: deleteError } = await supabase
      .from('reservas_entrevista')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return handleError(res, "Error al eliminar la reserva", deleteError);
    }

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
        }
    } else {
        console.warn("Día de entrevista no encontrado al intentar liberar cupo después de cancelar.");
    }
    
    const { error: updatePostulacionError } = await supabase
      .from('Postulaciones')
      .update({ estado: 'Postulado' }) 
      .eq('id', reservation.postulacion_id);

    if (updatePostulacionError) {
      console.error("Error al revertir estado de la postulación después de cancelar:", updatePostulacionError);
    }

    res.status(200).json({ success: true, message: "Reserva cancelada exitosamente." });
  } catch (err) {
    handleError(res, "Error al cancelar la reserva de entrevista", err);
  }
};


// --- Funciones para Gestión Humana (RRHH) - (Serán desarrolladas en fases posteriores) ---
// NOTA: Estas funciones están definidas sin 'export' individual.
const manageInterviewDays = async (req, res) => {
    res.status(501).json({ success: false, message: "Funcionalidad manageInterviewDays no implementada." });
};

const getAllInterviewDays = async (req, res) => {
    res.status(501).json({ success: false, message: "Funcionalidad getAllInterviewDays no implementada." });
};

const deleteInterviewDay = async (req, res) => {
    res.status(501).json({ success: false, message: "Funcionalidad deleteInterviewDay no implementada." });
};

const getInterviewReservations = async (req, res) => {
    res.status(501).json({ success: false, message: "Funcionalidad getInterviewReservations no implementada." });
};

const updateInterviewReservationStatus = async (req, res) => {
    res.status(501).json({ success: false, message: "Funcionalidad updateInterviewReservationStatus no implementada." });
};

// --- EXPORTACIÓN FINAL DE TODAS LAS FUNCIONES ---
// Asegúrate de que los nombres de las funciones aquí coincidan EXACTAMENTE
// con cómo están definidas arriba y cómo las importas en registroRoutes.js
export {
    checkPostulanteForInterview,
    getAvailableInterviewDays,
    reserveInterviewSlot,
    cancelInterviewReservation,
    // Asegúrate de que estas funciones también estén aquí si las vas a usar en registroRoutes.js
    manageInterviewDays, 
    getAllInterviewDays,
    deleteInterviewDay,
    getInterviewReservations,
    updateInterviewReservationStatus
};