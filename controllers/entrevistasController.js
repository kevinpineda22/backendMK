import supabase from '../config/supabaseClient.js';
import { handleError } from '../utils/errorHandler.js';
import { getCurrentColombiaTimeISO } from '../utils/timeUtils.js';
import { sendEmail as sendEmailService } from "./emailService.js";
import crypto from 'crypto';

// --- Funciones para Postulantes (Flujo de Agendamiento) ---

const checkPostulanteForInterview = async (req, res) => {
    try {
        const { numeroDocumento } = req.params;

        if (!numeroDocumento) {
            return res.status(400).json({ success: false, message: "Número de documento es obligatorio." });
        }

        const { data: postulacion, error } = await supabase
            .from('Postulaciones')
            .select('id, nombreApellido, correo, estado, numeroDocumento, cargo')
            .eq('numeroDocumento', numeroDocumento)
            .maybeSingle();

        if (error) {
            console.error("Error Supabase en checkPostulanteForInterview:", error);
            return handleError(res, "Error al verificar postulante en la base de datos", error);
        }

        if (!postulacion) {
            return res.status(404).json({ success: false, message: "Postulación no encontrada con este documento. Por favor, asegúrate de haber completado el formulario de postulación." });
        }

        const { data: existingReservationDetails, error: resError } = await supabase
            .from('reservas_entrevista')
            .select(`
                id,
                fich_entrevista,
                hora_reserva,
                dia_entrevista_id,
                dia_entrevista:dias_entrevista(id, fecha, cupos_totales, cupos_disponibles, estado),
                postulacion:Postulaciones(cargo)
            `)
            .eq('postulacion_id', postulacion.id)
            .single();

        if (resError) {
            if (resError.code === 'PGRST116') {
                // No rows found, significa que no tiene reserva existente, lo cual es OK.
            } else {
                console.error("Error Supabase al verificar reserva existente:", resError);
                return handleError(res, "Error al verificar reserva existente", resError);
            }
        }

        if (existingReservationDetails) {
            console.log("Existing reservation found. Sending to frontend:", {
                postulante: postulacion,
                reserva: existingReservationDetails
            });

            return res.status(200).json({
                success: true,
                message: `Ya tienes una entrevista agendada. Tu ficho de ingreso es: ${existingReservationDetails.fich_entrevista}. Revisa tu correo.`,
                status: 'has_reservation',
                data: {
                    postulante: postulacion,
                    reserva: existingReservationDetails
                }
            });
        }

        const allowedStates = ['Postulado', 'Entrevista', 'Preseleccionado'];
        if (!allowedStates.includes(postulacion.estado)) {
            return res.status(400).json({ success: false, message: `Tu postulación se encuentra en estado "${postulacion.estado}". Solo los postulantes en las primeras fases pueden agendar.` });
        }

        res.status(200).json({ success: true, message: "Postulante verificado.", data: postulacion, status: 'can_schedule' });
    } catch (err) {
        handleError(res, "Error inesperado al verificar postulante", err);
    }
};

const getAvailableInterviewDays = async (req, res) => {
    try {
        const currentColombiaDate = getCurrentColombiaTimeISO().split('T')[0];
        console.log("Fecha actual de Colombia para filtro GTE:", currentColombiaDate);

        const { data, error } = await supabase
            .from('dias_entrevista')
            .select('*')
            .gte('fecha', currentColombiaDate)
            .gt('cupos_disponibles', 0)
            .eq('estado', 'Activo')
            .order('fecha', { ascending: true });

        if (error) {
            console.error("Error Supabase al obtener días disponibles:", error);
            return handleError(res, "Error al obtener días de entrevista", error);
        }

        console.log("Días disponibles devueltos por la API:", data);

        res.status(200).json({ success: true, data: data || [] });

    } catch (err) {
        handleError(res, "Error inesperado al obtener días de entrevista", err);
    }
};

const reserveInterviewSlot = async (req, res) => {
    try {
        const { postulacion_id, dia_entrevista_id } = req.body;
        const hora_reserva = "7:00 AM - 11:00 AM";

        if (!postulacion_id || !dia_entrevista_id) {
            return res.status(400).json({ success: false, message: "Faltan datos obligatorios para la reserva." });
        }

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

        const fich_entrevista = crypto.randomBytes(4).toString('hex').toUpperCase();

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

        const { error: updateCuposError } = await supabase
            .from('dias_entrevista')
            .update({ cupos_disponibles: diaEntrevista.cupos_disponibles - 1 })
            .eq('id', dia_entrevista_id);

        if (updateCuposError) {
            console.error("Error Supabase al disminuir cupos, la reserva se creó pero el cupo no se restó:", updateCuposError);
        }

        const { data: postulacionActualizada, error: updatePostulacionError } = await supabase
            .from('Postulaciones')
            .update({ estado: 'Entrevista' })
            .eq('id', postulacion_id)
            .select('nombreApellido, correo, numeroDocumento, cargo')
            .single();

        if (updatePostulacionError) {
            console.error("Error Supabase al actualizar estado del postulante:", updatePostulacionError);
        }

        if (postulacionActualizada) {
            const emailContent = `
                <div style="font-family: Roboto, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="background-color: #3b82f6; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0; font-size: 24px;">Confirmación de Cita de Entrevista Merkahorro</h2>
                    </div>
                    <div style="padding: 24px; text-align: center;">
                        <p style="font-style: italic; font-size: 16px; color: #4b5563; margin-bottom: 24px;">
                            "La excelencia nunca es un accidente. Siempre es el resultado de la alta intención, el esfuerzo sincero y la ejecución inteligente." - Aristóteles
                        </p>
                        <p style="font-size: 16px;">Estimado/a <strong>${postulacionActualizada.nombreApellido}</strong>,</p>
                        <p style="font-size: 16px;">¡Gracias por tu interés en ser parte de nuestro equipo! Nos complace informarte que tu entrevista ha sido agendada con éxito.</p>
                        <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 6px; text-align: left;">
                            <h3 style="color: #1a1a1a; margin: 0 0 12px 0; font-size: 18px;">Detalles de tu Entrevista:</h3>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Cargo Postulado:</strong> ${postulacionActualizada.cargo}</p>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Fecha:</strong> ${new Date(diaEntrevista.fecha).toLocaleDateString('es-CO')}</p>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Hora:</strong> 7:00 AM - 11:00 AM</p>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Lugar:</strong> Calle 52 #52-27 Copacabana, Antioquia, Colombia (Cuarto piso)</p>
                            <p style="margin: 4px 0; font-size: 14px;"><strong>Ficho de Ingreso:</strong> <span style="font-size: 18px; font-weight: bold; color: #3b82f6;">${fich_entrevista}</span></p>
                        </div>
                        <p style="font-size: 14px; margin: 16px 0;">No necesitas traer nada en especial para tu entrevista.</p>
                        <p style="font-size: 14px; margin: 16px 0;">Por favor, llega unos minutos antes de tu hora programada. Presenta este correo y tu documento de identidad original en la entrada. ¡Te esperamos!</p>
                    </div>
                    <div style="background-color: #f3f4f6; padding: 12px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0;">Este es un mensaje automático, por favor no respondas a este correo.</p>
                        <p style="margin: 4px 0;">© 2025 Merkahorro. Todos los derechos reservados.</p>
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

const cancelInterviewReservation = async (req, res) => {
    try {
        const { id } = req.params;
        const { postulacion_id } = req.body;

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

// --- Funciones para Gestión Humana (RRHH) ---

const createInterviewDay = async (req, res) => {
    try {
        const { fecha, cupos_totales } = req.body;

        if (!fecha || !cupos_totales) {
            return res.status(400).json({ success: false, message: "Fecha y cupos totales son obligatorios para crear un día de entrevista." });
        }

        const { data: existingDay, error: existingDayError } = await supabase
            .from('dias_entrevista')
            .select('id')
            .eq('fecha', fecha)
            .maybeSingle();

        if (existingDayError && existingDayError.code !== 'PGRST116') {
            console.error("Error Supabase al verificar día existente:", existingDayError);
            return handleError(res, "Error al verificar día de entrevista existente", existingDayError);
        }

        if (existingDay) {
            return res.status(409).json({ success: false, message: `Ya existe un día de entrevista agendado para la fecha ${fecha}.` });
        }

        const { data, error } = await supabase
            .from('dias_entrevista')
            .insert([
                { fecha, cupos_totales, cupos_disponibles: cupos_totales, estado: 'Activo' }
            ])
            .select();

        if (error) {
            console.error("Error Supabase al crear día de entrevista:", error);
            return handleError(res, "Error al crear el día de entrevista", error);
        }

        res.status(201).json({ success: true, message: "Día de entrevista creado exitosamente.", data: data[0] });
    } catch (err) {
        handleError(res, "Error inesperado al crear día de entrevista", err);
    }
};

const getAllInterviewDaysAdmin = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('dias_entrevista')
            .select('*')
            .order('fecha', { ascending: true });

        if (error) {
            console.error("Error Supabase al obtener todos los días de entrevista (Admin):", error);
            return handleError(res, "Error al obtener los días de entrevista para administración", error);
        }

        res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
        handleError(res, "Error inesperado al obtener días de entrevista (Admin)", err);
    }
};

const getInterviewDayDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: dayDetails, error: dayError } = await supabase
            .from('dias_entrevista')
            .select(`
                id,
                fecha,
                cupos_totales,
                cupos_disponibles,
                estado,
                reservas_entrevista (
                    id,
                    fich_entrevista,
                    hora_reserva,
                    estado_asistencia,
                    postulacion:Postulaciones (nombreApellido, numeroDocumento, correo, cargo)
                )
            `)
            .eq('id', id)
            .single();

        if (dayError) {
            console.error("Error Supabase al obtener detalles del día de entrevista:", dayError);
            if (dayError.code === 'PGRST116') {
                return handleError(res, "Día de entrevista no encontrado.", dayError, 404);
            }
            return handleError(res, "Error al obtener detalles del día.", dayError, 500);
        }

        res.status(200).json({ success: true, data: dayDetails });
    } catch (err) {
        handleError(res, "Error inesperado al obtener detalles del día de entrevista", err);
    }
};

const deleteInterviewDay = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, message: "ID del día de entrevista es obligatorio para eliminar." });
        }

        const { data: reservationsToCancel, error: resFetchError } = await supabase
            .from('reservas_entrevista')
            .select('postulacion_id')
            .eq('dia_entrevista_id', id);

        if (resFetchError) {
            console.error("Error al obtener reservas para revertir estado de postulaciones:", resFetchError);
        }

        const { error: deleteDayError } = await supabase
            .from('dias_entrevista')
            .delete()
            .eq('id', id);

        if (deleteDayError) {
            console.error("Error Supabase al eliminar día de entrevista:", deleteDayError);
            return handleError(res, "Error al eliminar el día de entrevista", deleteDayError);
        }

        if (reservationsToCancel && reservationsToCancel.length > 0) {
            const postulacionIdsToUpdate = reservationsToCancel.map(res => res.postulacion_id);
            const { error: updatePostulacionesError } = await supabase
                .from('Postulaciones')
                .update({ estado: 'Postulado' })
                .in('id', postulacionIdsToUpdate);

            if (updatePostulacionesError) {
                console.error("Error al revertir estado de la postulación después de cancelar:", updatePostulacionesError);
            }
        }

        res.status(200).json({ success: true, message: "Día de entrevista y reservas asociadas eliminadas exitosamente." });
    } catch (err) {
        handleError(res, "Error inesperado al eliminar día de entrevista", err);
    }
};

const updateInterviewAttendanceStatus = async (req, res) => {
    try {
        const { reservaId } = req.params;
        const { estado_asistencia } = req.body;

        if (!reservaId || !estado_asistencia) {
            return res.status(400).json({ success: false, message: "ID de reserva y estado de asistencia son obligatorios." });
        }

        const allowedStatuses = ['Pendiente', 'Asistió', 'No Asistió'];
        if (!allowedStatuses.includes(estado_asistencia)) {
            return res.status(400).json({ success: false, message: "Estado de asistencia inválido." });
        }

        const { data, error } = await supabase
            .from('reservas_entrevista')
            .update({ estado_asistencia: estado_asistencia })
            .eq('id', reservaId)
            .select();

        if (error) {
            console.error("Error Supabase al actualizar estado de asistencia:", error);
            return handleError(res, "Error al actualizar el estado de asistencia de la entrevista", error);
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: "Reserva no encontrada." });
        }

        res.status(200).json({ success: true, message: "Estado de asistencia actualizado exitosamente.", data: data[0] });

    } catch (err) {
        handleError(res, "Error inesperado al actualizar estado de asistencia", err);
    }
};

const updateInterviewDayStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (!id || !estado) {
            return res.status(400).json({ success: false, message: "ID del día y el estado son obligatorios para actualizar." });
        }

        const allowedStates = ['Activo', 'Inactivo', 'Lleno', 'Finalizado'];
        if (!allowedStates.includes(estado)) {
            return res.status(400).json({ success: false, message: `Estado inválido: ${estado}. Los estados permitidos son ${allowedStates.join(', ')}.` });
        }

        const { data, error } = await supabase
            .from('dias_entrevista')
            .update({ estado: estado })
            .eq('id', id)
            .select();

        if (error) {
            console.error("Error Supabase al actualizar estado del día de entrevista:", error);
            return handleError(res, "Error al actualizar el estado del día de entrevista", error);
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, message: "Día de entrevista no encontrado." });
        }

        res.status(200).json({ success: true, message: "Estado del día de entrevista actualizado exitosamente.", data: data[0] });

    } catch (err) {
        handleError(res, "Error inesperado al actualizar estado del día de entrevista", err);
    }
};

export {
    checkPostulanteForInterview,
    getAvailableInterviewDays,
    reserveInterviewSlot,
    cancelInterviewReservation,
    createInterviewDay,
    getAllInterviewDaysAdmin,
    getInterviewDayDetails,
    deleteInterviewDay,
    updateInterviewAttendanceStatus,
    updateInterviewDayStatus,
};