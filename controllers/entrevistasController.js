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
        // Log detallado del error de Supabase para depuración
        console.error("Error Supabase en checkPostulanteForInterview:", error);
        return handleError(res, "Error al verificar postulante en la base de datos", error);
    }

    if (!postulacion) {
      // Si no se encuentra la postulación
      return res.status(404).json({ success: false, message: "Postulación no encontrada con este documento. Por favor, asegúrate de haber completado el formulario de postulación." });
    }

    // Verificar si ya tiene una reserva activa para evitar múltiples reservas para la misma postulación
    const { data: existingReservation, error: resError } = await supabase
        .from('reservas_entrevista')
        .select('id, fich_entrevista')
        .eq('postulacion_id', postulacion.id)
        .limit(1); // Solo necesitamos saber si existe al menos una

    if (resError) {
        console.error("Error Supabase al verificar reserva existente:", resError);
        return handleError(res, "Error al verificar reserva existente", resError);
    }
    if (existingReservation && existingReservation.length > 0) {
        // Si ya tiene una reserva, informarle al usuario su ficho
        return res.status(400).json({ success: false, message: `Ya tienes una entrevista agendada. Tu ficho de ingreso es: ${existingReservation[0].fich_entrevista}. Revisa tu correo.` });
    }

    // Solo permitir agendar si el estado es 'Postulado', 'Entrevista' (si se revierte el estado), o 'Preseleccionado'
    const allowedStates = ['Postulado', 'Entrevista', 'Preseleccionado'];
    if (!allowedStates.includes(postulacion.estado)) {
        return res.status(400).json({ success: false, message: `Tu postulación se encuentra en estado "${postulacion.estado}". Solo los postulantes en las primeras fases pueden agendar.` });
    }

    // Si todo es válido, devolver los datos del postulante
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

// --- Funciones para Gestión Humana (RRHH) - (Serán desarrolladas en fases posteriores) ---

// Crear o Actualizar Días de Entrevista (para RRHH)
export const manageInterviewDays = async (req, res) => {
    // Estas funciones no están implementadas en esta fase
    res.status(501).json({ success: false, message: "Funcionalidad manageInterviewDays no implementada." });
};

// Obtener todos los días de entrevista (para RRHH)
export const getAllInterviewDays = async (req, res) => {
    res.status(501).json({ success: false, message: "Funcionalidad getAllInterviewDays no implementada." });
};

// Eliminar un día de entrevista (para RRHH)
export const deleteInterviewDay = async (req, res) => {
    res.status(501).json({ success: false, message: "Funcionalidad deleteInterviewDay no implementada." });
};

// Obtener reservas de entrevista (para RRHH)
export const getInterviewReservations = async (req, res) => {
    res.status(501).json({ success: false, message: "Funcionalidad getInterviewReservations no implementada." });
};

// Actualizar estado de una reserva (confirmada, asistió) (para RRHH)
export const updateInterviewReservationStatus = async (req, res) => {
    res.status(501).json({ success: false, message: "Funcionalidad updateInterviewReservationStatus no implementada." });
};