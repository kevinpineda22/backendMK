import supabase from '../config/supabaseClient.js';
import { handleError } from '../utils/errorHandler.js'; // Asegúrate de que este archivo exista
import { getCurrentColombiaTimeISO } from '../utils/timeUtils.js'; // Asegúrate de que este archivo exista
import { sendEmail as sendEmailService } from "./emailService.js"; // Asegúrate de que este servicio exista y esté configurado
import crypto from 'crypto'; // Módulo nativo de Node.js para generar fichos aleatorios

// --- Funciones para Postulantes (Flujo de Agendamiento) ---

// 1. Verificar si la cédula ya existe en postulaciones y si el estado es adecuado para agendar
export const checkPostulanteForInterview = async (req, res) => {
  try {
    const { numeroDocumento } = req.params;

    if (!numeroDocumento) {
      return res.status(400).json({ success: false, message: "Número de documento es obligatorio." });
    }

    const { data: postulacion, error } = await supabase
      .from('Postulaciones')
      .select('id, nombreApellido, correo, estado, numeroDocumento')
      .eq('numeroDocumento', numeroDocumento)
      .maybeSingle(); // Usa maybeSingle para obtener 0 o 1 resultado sin lanzar error si no hay coincidencias

    if (error) {
        console.error("Error Supabase en checkPostulanteForInterview:", error);
        return handleError(res, "Error al verificar postulante en la base de datos", error);
    }

    if (!postulacion) {
      return res.status(404).json({ success: false, message: "Postulación no encontrada con este documento. Por favor, asegúrate de haber completado el formulario de postulación." });
    }

    // *** CAMBIO CRÍTICO AQUÍ ***
    // Si ya tiene una reserva, recupera TODOS los detalles de esa reserva,
    // incluyendo la información del día de la entrevista (JOIN con dias_entrevista).
    const { data: existingReservationDetails, error: resError } = await supabase
        .from('reservas_entrevista')
        .select(`
            id,
            fich_entrevista,
            hora_reserva,
            dia_entrevista_id,
            dia_entrevista:dias_entrevista(id, fecha, cupos_totales, cupos_disponibles, estado)
        `) // <-- CRÍTICO: Seleccionar el objeto completo dia_entrevista
        .eq('postulacion_id', postulacion.id)
        .single(); // Usamos single() porque esperamos UNA reserva si ya tiene una

    if (resError) {
        // Si hay un error al buscar la reserva, o no se encuentra (PGRST116),
        // significa que no tiene reserva, y es el flujo esperado para continuar.
        if (resError.code === 'PGRST116') { 
            // No rows found, significa que no tiene reserva existente, lo cual es OK.
            // La función seguirá para validar el estado y permitir agendar.
        } else {
            // Cualquier otro error es un problema real al buscar la reserva existente
            console.error("Error Supabase al verificar reserva existente:", resError);
            return handleError(res, "Error al verificar reserva existente", resError);
        }
    }
    
    // Si existingReservationDetails existe (es decir, SÍ encontró una reserva),
    // devolvemos esa información y bloqueamos un nuevo agendamiento.
    if (existingReservationDetails) {
        return res.status(400).json({ 
            success: false, 
            message: `Ya tienes una entrevista agendada. Tu ficho de ingreso es: ${existingReservationDetails.fich_entrevista}. Revisa tu correo.`,
            // *** DEVOLVER LOS DETALLES COMPLETOS DE LA RESERVA EXISTENTE ***
            data: {
                postulante: postulacion, // Incluir los datos del postulante original
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
    res.status(200).json({ success: true, message: "Postulante verificado.", data: postulacion });
  } catch (err) {
    handleError(res, "Error inesperado al verificar postulante", err);
  }
};

// 2. Obtener días de entrevista disponibles (Lee desde la tabla `dias_entrevista`)
export const getAvailableInterviewDays = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dias_entrevista')
      .select('*') // Selecciona todos los campos del día de entrevista
      .gte('fecha', getCurrentColombiaTimeISO().split('T')[0]) // Solo fechas futuras o de hoy
      .gt('cupos_disponibles', 0) // Que tengan cupos disponibles
      .eq('estado', 'Activo') // Que el día esté marcado como 'Activo' por RRHH
      .order('fecha', { ascending: true }); // Ordenar por fecha de forma ascendente

    if (error) {
        console.error("Error Supabase al obtener días disponibles:", error);
        return handleError(res, "Error al obtener días de entrevista", error);
    }
    
    // Devolver los datos reales de la base de datos
    res.status(200).json({ success: true, data: data || [] });

  } catch (err) {
    handleError(res, "Error inesperado al obtener días de entrevista", err);
  }
};

// 3. Reservar un espacio de entrevista
export const reserveInterviewSlot = async (req, res) => {
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
      .single(); // Esperamos un único día de entrevista

    if (diaError) {
        console.error("Error Supabase al verificar día de entrevista:", diaError);
        return handleError(res, "Día de entrevista no encontrado o inactivo.", diaError, 404);
    }
    if (!diaEntrevista || diaEntrevista.estado !== 'Activo' || diaEntrevista.cupos_disponibles <= 0) {
      return res.status(400).json({ success: false, message: "No hay cupos disponibles para este día o el día no está activo." });
    }

    // 2. Generar ficho único (8 caracteres hexadecimales)
    const fich_entrevista = crypto.randomBytes(4).toString('hex').toUpperCase(); 
    
    // 3. Registrar la reserva en la tabla `reservas_entrevista`
    const { data: reservaData, error: reservaError } = await supabase
      .from('reservas_entrevista')
      .insert([
        { 
          postulacion_id, 
          dia_entrevista_id, 
          hora_reserva, 
          fich_entrevista,
          creado_en: getCurrentColombiaTimeISO() // Guarda la fecha/hora de creación de la reserva
        }
      ])
      .select(); // Devolver el registro recién insertado

    if (reservaError) {
        // Manejar el caso de violación de unicidad (ej. ficho duplicado, aunque es muy raro)
        if (reservaError.code === '23505') { 
            return res.status(409).json({ success: false, message: "Conflicto en la reserva. Por favor, intenta de nuevo (ficho duplicado)." });
        }
        console.error("Error Supabase al registrar la reserva:", reservaError);
        return handleError(res, "Error al registrar la reserva", reservaError);
    }

    // 4. Disminuir cupos disponibles en la tabla `dias_entrevista`
    const { error: updateCuposError } = await supabase
      .from('dias_entrevista')
      .update({ cupos_disponibles: diaEntrevista.cupos_disponibles - 1 })
      .eq('id', dia_entrevista_id);

    if (updateCuposError) {
      console.error("Error Supabase al disminuir cupos, la reserva se creó pero el cupo no se restó:", updateCuposError);
      // Este es un error secundario, la reserva ya está hecha, pero el cupo no se reflejó. Debería ser monitoreado.
    }

    // 5. Actualizar el estado del postulante en la tabla `Postulaciones` a 'Entrevista'
    const { data: postulacionActualizada, error: updatePostulacionError } = await supabase
      .from('Postulaciones')
      .update({ estado: 'Entrevista' })
      .eq('id', postulacion_id)
      .select('nombreApellido, correo, numeroDocumento') // Seleccionar datos relevantes para el correo
      .single(); // Esperamos que se actualice un único registro

    if (updatePostulacionError) {
      console.error("Error Supabase al actualizar estado del postulante:", updatePostulacionError);
      // Si falla, la reserva se hizo, pero el estado del postulante no cambió.
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
        to: postulacionActualizada.correo, // Correo del postulante
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
export const cancelInterviewReservation = async (req, res) => { // Asegúrate de que este export esté aquí
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
        }
    } else {
        console.warn("Día de entrevista no encontrado al intentar liberar cupo después de cancelar.");
    }
    
    // 4. Opcional: Revertir el estado de la postulación a 'Postulado' o 'Preseleccionado'
    const { error: updatePostulacionError } = await supabase
      .from('Postulaciones')
      .update({ estado: 'Postulado' }) // O 'Preseleccionado', según tu flujo
      .eq('id', reservation.postulacion_id);

    if (updatePostulacionError) {
      console.error("Error al revertir estado de la postulación después de cancelar:", updatePostulacionError);
    }

    // Opcional: Enviar correo de confirmación de cancelación al postulante
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


// --- Funciones para Gestión Humana (RRHH) - (Serán desarrolladas en fases posteriores) ---
// ¡CRÍTICO: Asegúrate de que estas funciones también estén exportadas si se van a usar en registroRoutes.js!
export const manageInterviewDays = async (req, res) => { /* ... */ };
export const getAllInterviewDays = async (req, res) => { /* ... */ };
export const deleteInterviewDay = async (req, res) => { /* ... */ };
export const getInterviewReservations = async (req, res) => { /* ... */ };
export const updateInterviewReservationStatus = async (req, res) => { /* ... */ };

// --- EXPORTACIÓN FINAL DE TODAS LAS FUNCIONES ---
// Asegúrate de que todos los nombres de funciones que usas en registroRoutes.js
// estén listados aquí.
export {
    checkPostulanteForInterview,
    getAvailableInterviewDays,
    reserveInterviewSlot,
    cancelInterviewReservation,
    // Si vas a usar las de gestión de RRHH más adelante, deben estar aquí también:
    manageInterviewDays, 
    getAllInterviewDays,
    deleteInterviewDay,
    getInterviewReservations,
    updateInterviewReservationStatus
};