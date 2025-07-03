import supabase from '../config/supabaseClient.js';
import { handleError } from '../utils/errorHandler.js'; // Asumimos un errorHandler centralizado
import { getCurrentColombiaTimeISO } from '../utils/timeUtils.js'; // Utilidad para fechas
import { sendEmail as sendEmailService } from "./emailService.js"; // Para enviar el correo de confirmación
import crypto from 'crypto'; // Para generar fichos aleatorios

// --- Funciones para Postulantes (Agendamiento) ---

// 1. Verificar si la cédula ya existe en postulaciones y si el estado es Preseleccionado o Entrevista
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
      .maybeSingle(); // Usar maybeSingle para no lanzar error si no se encuentra

    if (error) return handleError(res, "Error al verificar postulante", error);

    if (!postulacion) {
      return res.status(404).json({ success: false, message: "Postulación no encontrada con este documento. Por favor, asegúrate de haber completado el formulario de postulación." });
    }

    // Verificar si ya tiene una reserva activa para evitar múltiples reservas para la misma postulación
    const { data: existingReservation, error: resError } = await supabase
        .from('reservas_entrevista')
        .select('id, fich_entrevista')
        .eq('postulacion_id', postulacion.id)
        .limit(1);

    if (resError) throw resError;
    if (existingReservation && existingReservation.length > 0) {
        return res.status(400).json({ success: false, message: `Ya tienes una entrevista agendada. Tu ficho de ingreso es: ${existingReservation[0].fich_entrevista}. Revisa tu correo.` });
    }

    // Solo permitir agendar si el estado es 'Postulado' o 'Entrevista' (si se revierte el estado)
    // Se asume que solo los postulantes con un estado inicial pueden agendar.
    // Puedes ajustar los estados permitidos según tu flujo de RRHH.
    if (!['Postulado', 'Entrevista', 'Preseleccionado'].includes(postulacion.estado)) {
        return res.status(400).json({ success: false, message: `Tu postulación se encuentra en estado "${postulacion.estado}". Solo los postulantes en las primeras fases pueden agendar.` });
    }

    res.status(200).json({ success: true, message: "Postulante verificado.", data: postulacion });
  } catch (err) {
    handleError(res, "Error inesperado al verificar postulante", err);
  }
};

// 2. Obtener días de entrevista disponibles para el postulante
// Por ahora, devuelve algunos días ficticios con cupos, ya que la gestión de RRHH no está hecha.
export const getAvailableInterviewDays = async (req, res) => {
  try {
    // Por ahora, simularemos días disponibles.
    // En la Fase 3, esto consultará la tabla `dias_entrevista`.

    // Generar días ficticios futuros (ej. los próximos 5 días hábiles)
    const availableDays = [];
    let today = new Date(getCurrentColombiaTimeISO().split('T')[0]); // Fecha de hoy en Colombia
    today.setHours(0, 0, 0, 0); // Asegurarse de que sea el inicio del día

    for (let i = 0; i < 7; i++) { // Revisar los próximos 7 días
        const currentDay = new Date(today);
        currentDay.setDate(today.getDate() + i);

        // Si es sábado o domingo, no se considera día de entrevista por ahora
        if (currentDay.getDay() === 0 || currentDay.getDay() === 6) { // 0 = Domingo, 6 = Sábado
            continue;
        }

        // Simular que algunos días tienen cupos y otros no
        const randomCupos = Math.floor(Math.random() * 15) + 5; // Entre 5 y 19 cupos
        availableDays.push({
            id: i + 1, // ID ficticio
            fecha: currentDay.toISOString().split('T')[0], // Formato YYYY-MM-DD
            cupos_totales: 30,
            cupos_disponibles: randomCupos,
            estado: 'Activo'
        });

        if (availableDays.length >= 5) break; // Limitar a los próximos 5 días hábiles con cupos
    }
    
    // Si ya tienes la tabla `dias_entrevista` y está poblada, puedes descomentar esto
    /*
    const { data, error } = await supabase
      .from('dias_entrevista')
      .select('*')
      .gte('fecha', getCurrentColombiaTimeISO().split('T')[0]) // Solo fechas futuras o de hoy
      .gt('cupos_disponibles', 0) // Que tengan cupos disponibles
      .eq('estado', 'Activo') // Que el día esté activo
      .order('fecha', { ascending: true });

    if (error) return handleError(res, "Error al obtener días de entrevista", error);
    
    res.status(200).json({ success: true, data: data || [] });
    */

    res.status(200).json({ success: true, data: availableDays });

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

    // 1. Verificar cupos disponibles y el estado del día (REAL para la tabla)
    const { data: diaEntrevista, error: diaError } = await supabase
      .from('dias_entrevista')
      .select('cupos_disponibles, estado, fecha')
      .eq('id', dia_entrevista_id)
      .single();

    if (diaError || !diaEntrevista) {
      return handleError(res, "Día de entrevista no encontrado o inactivo.", diaError || { message: "Día no encontrado" }, 404);
    }
    if (diaEntrevista.estado !== 'Activo' || diaEntrevista.cupos_disponibles <= 0) {
      return res.status(400).json({ success: false, message: "No hay cupos disponibles para este día o el día no está activo." });
    }

    // 2. Generar ficho único (Ej: ABC1234F)
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
      .select(); // Devolver el registro insertado

    if (reservaError) {
        // Manejar duplicados de ficho, aunque es muy poco probable
        if (reservaError.code === '23505') { // Código de error para unique violation
            return res.status(409).json({ success: false, message: "Conflicto en la reserva. Intenta de nuevo (ficho duplicado)." });
        }
        return handleError(res, "Error al registrar la reserva", reservaError);
    }

    // 4. Disminuir cupos disponibles
    const { error: updateCuposError } = await supabase
      .from('dias_entrevista')
      .update({ cupos_disponibles: diaEntrevista.cupos_disponibles - 1 })
      .eq('id', dia_entrevista_id);

    if (updateCuposError) {
      console.error("Error al disminuir cupos, la reserva se creó pero el cupo no se restó:", updateCuposError);
      // Esto debería ser monitoreado, pero no bloquea la respuesta al usuario si la reserva fue exitosa.
    }

    // 5. Actualizar el estado del postulante a "Entrevista" (o mantener si ya estaba)
    const { data: postulacionActualizada, error: updatePostulacionError } = await supabase
      .from('Postulaciones')
      .update({ estado: 'Entrevista' })
      .eq('id', postulacion_id)
      .select('nombreApellido, correo, numeroDocumento') // Seleccionar datos relevantes para el correo
      .single();

    if (updatePostulacionError) {
      console.error("Error al actualizar estado del postulante:", updatePostulacionError);
      // Si falla, la reserva se hizo, pero el estado del postulante no cambió. Monitorear.
    }

    // 6. Enviar correo al postulante con la confirmación (Fase 4)
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
                    <p style="margin: 5px 0;"><strong>Lugar:</strong> Calle 50 No. 46-36 Edificio Furatena piso 14, Medellín - Colombia</p>
                    <p style="margin: 5px 0;"><strong>Ficho de Ingreso:</strong> <span style="font-size: 20px; font-weight: bold; color: #89dc00;">${fich_entrevista}</span></p>
                </div>

                <p><strong>¿Qué debes traer?</strong></p>
                <ul style="list-style-type: disc; margin: 0; padding-left: 20px;">
                    <li>Documento de identidad original.</li>
                    <li>Muestra coprológica.</li>
                    <li>Uñas desmaquilladas (si aplica).</li>
                </ul>

                <p style="margin-top: 20px;">Por favor, llega unos minutos antes de tu hora programada. Presenta este correo y tu documento de identidad en la entrada. ¡Te esperamos!</p>
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
      data: reservaData[0], // Datos de la reserva creada
      fich_entrevista // Ficho para mostrar en el frontend
    });

  } catch (err) {
    handleError(res, "Error al reservar espacio de entrevista", err);
  }
};

// --- Funciones para Gestión Humana (RRHH) - Se desarrollarán más adelante ---

// Crear o Actualizar Días de Entrevista
export const manageInterviewDays = async (req, res) => { /* ... */ };
// Obtener todos los días de entrevista (para RRHH)
export const getAllInterviewDays = async (req, res) => { /* ... */ };
// Eliminar un día de entrevista
export const deleteInterviewDay = async (req, res) => { /* ... */ };
// Obtener reservas de entrevista (para RRHH)
export const getInterviewReservations = async (req, res) => { /* ... */ };
// Actualizar estado de una reserva (confirmada, asistió)
export const updateInterviewReservationStatus = async (req, res) => { /* ... */ };