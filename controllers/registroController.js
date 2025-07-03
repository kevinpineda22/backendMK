import supabase from "../config/supabaseClient.js";
import multer from "multer";
import { getCurrentColombiaTimeISO } from "../utils/timeUtils.js"; // Asegúrate de que esta utilidad exista
import { sendEmail as sendEmailService } from "./emailService.js"; // Asegúrate de que este servicio de correo exista
import { handleError } from '../utils/errorHandler.js'; // Asegúrate de que este manejador de errores exista

// Configuración de Multer para documentos
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- Rutas Básicas ---

// Ruta raíz
export const getRoot = (req, res) => {
    res.status(200).json({
        success: true,
        message: "¡El backend está funcionando correctamente!",
    });
};

// --- Gestión de Postulaciones ---

// Obtener todas las postulaciones
export const getPostulaciones = async (req, res) => {
    try {
        const { numeroDocumento } = req.query;
        let query = supabase.from("Postulaciones").select("*");

        if (numeroDocumento) {
            query = query.eq("numeroDocumento", numeroDocumento);
        }

        const { data, error } = await query;

        if (error) {
            return handleError(res, "Error al obtener datos", error);
        }

        res.status(200).json({ success: true, data });
    } catch (err) {
        handleError(res, "Error inesperado", err);
    }
};

// Enviar formulario (MODIFICADO para incluir validaciones del Frontend y correo a GH)
export const enviarFormulario = async (req, res) => {
    try {
        const {
            fechaPostulacion, nombreApellido, empresaPostula, nivelEducativo,
            cargo, telefono, correo, genero, Ciudad, fechaNacimiento,
            tipoDocumento, numeroDocumento,
        } = req.body;

        // --- Validaciones de campos (Duplicadas desde el frontend para seguridad en el backend) ---
        const requiredFields = {
            nombreApellido: "Nombre y Apellido",
            empresaPostula: "Empresa a la que se postula",
            nivelEducativo: "Nivel Educativo",
            cargo: "Cargo",
            telefono: "Teléfono",
            correo: "Correo Electrónico",
            genero: "Género",
            Ciudad: "Ciudad",
            fechaNacimiento: "Fecha de Nacimiento",
            tipoDocumento: "Tipo de Documento",
            numeroDocumento: "Número de Documento",
        };

        const missingFields = Object.keys(requiredFields).filter(
            (key) => !req.body[key] || String(req.body[key]).trim() === ""
        );

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Faltan campos obligatorios: ${missingFields
                    .map((key) => requiredFields[key])
                    .join(", ")}.`,
            });
        }

        // Validaciones de formato (regex)
        if (!/^[A-Za-záéíóúÁÉÍÓÚüÜñÑ\s]{1,50}$/.test(nombreApellido)) {
            return res.status(400).json({ success: false, message: "El nombre y apellido solo puede contener letras y espacios (máx. 50 caracteres)." });
        }
        if (!/^\d{5,10}$/.test(numeroDocumento)) {
            return res.status(400).json({ success: false, message: "El número de documento debe tener entre 5 y 10 dígitos." });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            return res.status(400).json({ success: false, message: "El correo electrónico no es válido." });
        }
        if (!/^(3\d{9}|[1-9]\d{6,9})$/.test(telefono.replace(/\D/g, ""))) { // Ajuste de regex para 7-10 digitos, y 3xx para móviles
            return res.status(400).json({ success: false, message: "El número de teléfono no es válido (7-10 dígitos)." });
        }
        // Validación de edad (mayor de 18)
        const birthDate = new Date(fechaNacimiento);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        if (age < 18) {
            return res.status(400).json({ success: false, message: "Debes ser mayor de 18 años para postularte." });
        }

        // Verificar si el número de documento ya está registrado
        const { data: existingData, error: checkError } = await supabase
            .from("Postulaciones")
            .select("id")
            .eq("numeroDocumento", numeroDocumento)
            .limit(1);

        if (checkError) {
            return handleError(res, "Error al verificar el documento", checkError);
        }

        if (existingData.length > 0) {
            return res.status(400).json({
                success: false,
                message: `El número de documento ${numeroDocumento} ya está registrado.`,
            });
        }

        // Insertar los datos en la base de datos
        const { data, error } = await supabase
            .from("Postulaciones")
            .insert([
                {
                    fechaPostulacion, nombreApellido, empresaPostula, nivelEducativo,
                    cargo, telefono, correo, genero, Ciudad, fechaNacimiento,
                    tipoDocumento, numeroDocumento, check_BD: false, // check_BD por defecto false
                    estado: 'Postulado', // Estado inicial
                },
            ])
            .select(); // Asegura que retorna los datos insertados

        if (error) {
            return handleError(res, "Error al guardar los datos", error);
        }

        // --- LÓGICA DE ENVÍO DE CORREO A GESTIÓN HUMANA (ELIMINADO BOTÓN) ---
        const emailBodyForHR = `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; background-color: #f4f4f9; padding: 20px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #210d65; color: #fff; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="margin: 0; font-size: 20px;">Nuevo Postulante Registrado</h2>
                </div>
                <div style="padding: 20px; background-color: #fff; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; color: #333;">
                    Se ha registrado un nuevo postulante en el sistema con los siguientes datos:
                </p>
                <p style="font-size: 16px; color: #333;">
                    <strong>Nombre:</strong> ${nombreApellido}<br />
                    <strong>Documento:</strong> ${tipoDocumento} ${numeroDocumento}<br />
                    <strong>Empresa a la que postula:</strong> ${empresaPostula}<br />
                    <strong>Cargo deseado:</strong> ${cargo}<br />
                    <strong>Correo:</strong> ${correo}<br />
                    <strong>Teléfono:</strong> ${telefono}
                </p>
                <p style="font-size: 16px; color: #333;">
                    Por favor, accede al panel de administración para revisar la postulación.
                </p>
                </div>
                <p style="font-size: 12px; color: #666; text-align: center; margin-top: 20px;">
                MERKAHORRO - Todos los derechos reservados.
                </p>
            </div>
        `;
        
        await sendEmailService({
            to: ['johanmerkahorro777@gmail.com'], // Correo de prueba de Gestión Humana
            subject: `Nueva Postulación Recibida - ${nombreApellido}`,
            html: emailBodyForHR,
        });
        // --- FIN LÓGICA DE ENVÍO DE CORREO ---


        res.status(200).json({
            success: true,
            message: "Formulario enviado exitosamente",
            data: data[0],
        });
    } catch (err) {
        handleError(res, "Error al procesar el formulario", err);
    }
};

// Actualizar check_BD
export const updateCheckBD = async (req, res) => {
    try {
        const { id } = req.params;
        const { check_BD } = req.body;

        if (typeof check_BD !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "El campo check_BD debe ser un valor booleano.",
            });
        }

        const { data, error } = await supabase
            .from("Postulaciones")
            .update({ check_BD })
            .eq("id", parseInt(id))
            .select();

        if (error) {
            return handleError(res, "Error al actualizar check_BD", error);
        }

        res.status(200).json({
            success: true,
            message: "Campo check_BD actualizado correctamente.",
            data,
        });
    } catch (err) {
        handleError(res, "Error inesperado", err);
    }
};

// Actualizar observacion_BD
export const updateObservacionBD = async (req, res) => {
    try {
        const { id } = req.params;
        const { observacion_BD } = req.body;

        if (typeof observacion_BD !== "string") {
            return res.status(400).json({
                success: false,
                message: "El campo observacion_BD debe ser un valor de texto.",
            });
        }

        const { data, error } = await supabase
            .from("Postulaciones")
            .update({ observacion_BD })
            .eq("id", parseInt(id))
            .select();

        if (error) {
            return handleError(res, "Error al actualizar observacion_BD", error);
        }

        res.status(200).json({
            success: true,
            message: "Campo observacion_BD actualizado correctamente.",
            data,
        });
    } catch (err) {
        handleError(res, "Error inesperado", err);
    }
};

// Actualizar estado
export const updateEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, ejecutado_por = "Sistema", sede } = req.body; // 'sede' se añade por si es relevante en el historial

        if (!estado || typeof estado !== "string") {
            return res.status(400).json({
                success: false,
                message: "El campo 'estado' es obligatorio y debe ser texto.",
            });
        }

        const updateData = { estado };
        if (sede) updateData.sede = sede; // Actualizar sede si se proporciona

        const { data, error } = await supabase
            .from("Postulaciones")
            .update(updateData)
            .eq("id", parseInt(id))
            .select(); // Asegurarse de seleccionar para obtener el dato actualizado

        if (error) {
            return handleError(res, "Error al actualizar estado", error);
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Postulación no encontrada.",
            });
        }

        // Obtener nombre del responsable para el historial
        const { data: usuario } = await supabase
            .from("Login") // Asume que tienes una tabla Login con 'correo' y 'nombre'
            .select("nombre")
            .eq("correo", ejecutado_por)
            .maybeSingle();

        const nombreResponsable = usuario?.nombre || ejecutado_por;

        // Registrar en historial_postulacion
        const { error: historialError } = await supabase
            .from("historial_postulacion")
            .insert([
                {
                    postulacion_id: parseInt(id),
                    accion: estado,
                    ejecutado_por,
                    observacion: `Cambio de estado a '${estado}'${sede ? ` en sede '${sede}'` : ''} realizado por ${nombreResponsable}.`,
                    creado_en: getCurrentColombiaTimeISO(), // Usa la utilidad de fecha
                },
            ]);

        if (historialError) {
            console.error("Error al guardar en historial_postulacion:", historialError.message);
        }

        res.status(200).json({
            success: true,
            message: "Estado actualizado correctamente.",
            data: data[0],
        });
    } catch (err) {
        handleError(res, "Error inesperado al actualizar estado", err);
    }
};

// Obtener estadísticas de postulaciones
export const getStats = async (req, res) => {
    try {
        const { data, error } = await supabase.from("Postulaciones").select("*");

        if (error) {
            return handleError(res, "Error al obtener estadísticas", error);
        }

        // Los conteos ahora se devuelven como objetos simples, no arrays.
        const genderCounts = data.reduce((acc, curr) => {
            acc[curr.genero] = (acc[curr.genero] || 0) + 1;
            return acc;
        }, {});

        const educationCounts = data.reduce((acc, curr) => {
            acc[curr.nivelEducativo] = (acc[curr.nivelEducativo] || 0) + 1;
            return acc;
        }, {});

        const cityCounts = data.reduce((acc, curr) => {
            // Asumiendo que 'Ciudad' es la columna correcta para este conteo
            acc[curr.Ciudad] = (acc[curr.Ciudad] || 0) + 1; 
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            stats: { 
                genderCounts, 
                educationCounts, 
                cityCounts // Cambiado a cityCounts
            },
        });
    } catch (err) {
        handleError(res, "Error inesperado", err);
    }
};

// Obtener detalles con filtros (sin cambios)
export const getDetails = async (req, res) => {
    try {
        const { filterText } = req.query;
        let query = supabase.from("Postulaciones").select("*");

        if (filterText) {
            query = query.or(
                `nombreApellido.ilike.%${filterText}%,Ciudad.ilike.%${filterText}%` // Asumiendo 'Ciudad'
            );
        }

        const { data, error } = await query;

        if (error) {
            return handleError(res, "Error al obtener detalles", error);
        }

        res.status(200).json({ success: true, data });
    } catch (err) {
        handleError(res, "Error inesperado", err);
    }
};

// Descargar archivos (sin cambios)
export const descargarArchivo = async (req, res) => {
    const filePath = req.params[0];
    console.log("Solicitud de descarga recibida - filePath:", filePath);

    if (
        !filePath ||
        (!filePath.startsWith("hojas-vida/") && !filePath.startsWith("documentos/"))
    ) {
        console.error("Ruta de archivo no válida:", filePath);
        return res.status(400).json({
            success: false,
            message: "Ruta de archivo no válida. Debe comenzar con 'hojas-vida/' o 'documentos/'.",
        });
    }

    try {
        let bucket;
        let path;

        if (filePath.startsWith("hojas-vida/")) {
            bucket = "hojas-vida";
            // Normalizar la ruta para asegurar que no haya duplicados de "hojas-vida/"
            path = filePath.startsWith("hojas-vida/hojas-vida/")
                ? filePath.replace("hojas-vida/hojas-vida/", "")
                : filePath.replace("hojas-vida/", "");
        } else if (filePath.startsWith("documentos/")) {
            bucket = "documentos";
            path = filePath.replace("documentos/", "");
        } else if (filePath.startsWith("examenes/")) { // Añadido para los exámenes médicos si se guardan en una subcarpeta diferente
            bucket = "documentos"; // Asumiendo que el bucket es 'documentos'
            path = filePath; // La ruta ya incluye 'examenes/'
        }
        else {
            return res.status(400).json({
                success: false,
                message: "Ruta de archivo no válida. Debe comenzar con 'hojas-vida/', 'documentos/' o 'examenes/'.",
            });
        }


        console.log(`Intentando descargar - Bucket: ${bucket}, Path: ${path}`);

        const { data, error } = await supabase.storage.from(bucket).download(path);

        if (error) {
            console.error("Error al descargar desde Supabase:", error.message);
            // Mostrar 404 si el archivo no existe en el almacenamiento
            return res.status(404).json({
                success: false,
                message: "Archivo no encontrado en el bucket.",
                error: error.message,
            });
        }

        console.log("Archivo descargado exitosamente:", path);

        // Configurar encabezados de respuesta para descarga
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${path.split("/").pop()}"`
        );
        const buffer = Buffer.from(await data.arrayBuffer());
        res.end(buffer);
    } catch (err) {
        handleError(res, "Error interno en /api/descargar", err, 500);
    }
};

// Subir un solo documento (sin cambios)
export const subirDocumento = async (req, res) => {
    try {
        const { postulacion_id, tipo, categoria, beneficiarioId, subcarpeta } = req.body;
        const archivo = req.file;

        console.log("Datos recibidos en subirDocumento:", {
            postulacion_id, tipo, categoria, beneficiarioId, subcarpeta, archivo: archivo ? archivo.originalname : "No archivo",
        });

        if (!postulacion_id || !tipo || !archivo) {
            return res.status(400).json({ success: false, message: "Faltan campos requeridos: postulacion_id, tipo o archivo." });
        }

        const parsedPostulacionId = parseInt(postulacion_id);
        if (isNaN(parsedPostulacionId)) {
            return res.status(400).json({ success: false, message: "El postulacion_id debe ser un número entero válido." });
        }

        const { data: postulacion, error: postulacionError } = await supabase
            .from("Postulaciones")
            .select("id")
            .eq("id", parsedPostulacionId)
            .single();

        if (postulacionError || !postulacion) {
            return handleError(res, "El postulacion_id proporcionado no es válido o no existe", new Error(postulacionError?.message || "No encontrado"), 400);
        }

        const basePath = subcarpeta || "documentos";
        const filePath = `${basePath}/${parsedPostulacionId}_${tipo}_${Date.now()}_${archivo.originalname}`;
        console.log("Ruta construida para subir el archivo:", filePath);

        const { data: storageData, error: uploadError } = await supabase.storage
            .from("documentos")
            .upload(filePath, archivo.buffer, { contentType: archivo.mimetype });

        if (uploadError) {
            console.error("Error al subir el archivo a Supabase:", uploadError);
            return handleError(res, "Error al subir el archivo", uploadError);
        }

        const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/documentos/${filePath}`;
        console.log("URL pública generada:", publicUrl);

        const { error: insertError } = await supabase
            .from("documentos_postulante")
            .insert({ postulacion_id: parsedPostulacionId, tipo, categoria: categoria || "principal", url: publicUrl, beneficiarioid: beneficiarioId || null });

        if (insertError) {
            return handleError(res, "Error al guardar el documento en la base de datos", insertError);
        }

        res.status(200).json({ success: true, message: "Documento subido y registrado correctamente.", url: publicUrl });
    } catch (err) {
        handleError(res, "Error inesperado al procesar el documento", err);
    }
};

// Subir múltiples documentos (sin cambios)
export const subirDocumentosMultiples = async (req, res) => {
    try {
        const { postulacion_id, tipos, beneficiarioIds, categorias } = req.body;
        const archivos = req.files;

        if (!postulacion_id || !archivos || !tipos || !categorias) {
            return res.status(400).json({ success: false, message: "Faltan campos requeridos: postulacion_id, archivos, tipos o categorias." });
        }

        const parsedPostulacionId = parseInt(postulacion_id);
        if (isNaN(parsedPostulacionId)) {
            return res.status(400).json({ success: false, message: "El postulacion_id debe ser un número entero válido." });
        }

        const tiposArray = Array.isArray(tipos) ? tipos : [tipos];
        const beneficiarioIdsArray = Array.isArray(beneficiarioIds) ? beneficiarioIds : [beneficiarioIds];
        const categoriasArray = Array.isArray(categorias) ? categorias : [categorias];

        if (archivos.length !== tiposArray.length || archivos.length !== beneficiarioIdsArray.length || archivos.length !== categoriasArray.length) {
            return res.status(400).json({ success: false, message: "El número de archivos no coincide con el número de tipos, beneficiarioIds o categorias." });
        }

        const { data: postulacion, error: postulacionError } = await supabase
            .from("Postulaciones")
            .select("id")
            .eq("id", parsedPostulacionId)
            .single();

        if (postulacionError || !postulacion) {
            return handleError(res, "El postulacion_id proporcionado no es válido o no existe", new Error(postulacionError?.message || "No encontrado"), 400);
        }

        const mandatoryTypes = ["hoja_vida", "antecedentes_judiciales"]; // Tipos obligatorios para la postulación
        const { data: existingDocs, error: docsError } = await supabase
            .from("documentos_postulante")
            .select("tipo")
            .eq("postulacion_id", parsedPostulacionId);

        if (docsError) {
            return handleError(res, "Error al verificar documentos existentes", docsError);
        }

        const uploadedTypes = existingDocs.map((doc) => doc.tipo);
        const newTypes = tiposArray;
        const allTypes = [...new Set([...uploadedTypes, ...newTypes])];

        const missingMandatory = mandatoryTypes.filter((tipo) => !allTypes.includes(tipo));
        if (missingMandatory.length > 0) {
            return res.status(400).json({ success: false, message: `Faltan documentos obligatorios: ${missingMandatory.join(", ")}.` });
        }

        const uploadedDocuments = [];

        for (let i = 0; i < archivos.length; i++) {
            const archivo = archivos[i];
            const tipo = tiposArray[i];
            const beneficiarioId = beneficiarioIdsArray[i] === "" ? null : beneficiarioIdsArray[i];
            const categoria = categoriasArray[i] || "principal";

            // Se puede ajustar la subcarpeta aquí si se necesita una diferente para ciertos tipos
            const subfolder = 'documentos'; // Por defecto
            const filePath = `${subfolder}/${parsedPostulacionId}_${tipo}_${Date.now()}_${archivo.originalname}`;

            const { data: storageData, error: uploadError } = await supabase.storage
                .from("documentos") // Bucket 'documentos'
                .upload(filePath, archivo.buffer, { contentType: archivo.mimetype });

            if (uploadError) {
                return handleError(res, `Error al subir el archivo ${archivo.originalname}`, uploadError);
            }

            const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/documentos/${filePath}`;

            const { data: insertedDoc, error: insertError } = await supabase
                .from("documentos_postulante")
                .insert({ postulacion_id: parsedPostulacionId, tipo, categoria, url: publicUrl, beneficiarioid: beneficiarioId })
                .select()
                .single();

            if (insertError) {
                return handleError(res, `Error al guardar el documento ${archivo.originalname} en la base de datos`, insertError);
            }

            uploadedDocuments.push({ id: insertedDoc.id, tipo, url: publicUrl, beneficiarioid: beneficiarioId });
        }

        res.status(200).json({ success: true, message: `${uploadedDocuments.length} documento(s) subido(s) y registrado(s) correctamente.`, data: uploadedDocuments });
    } catch (err) {
        handleError(res, "Error inesperado al procesar los documentos", err);
    }
};

// Eliminar un documento (sin cambios)
export const eliminarDocumento = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: documento, error: fetchError } = await supabase
            .from("documentos_postulante")
            .select("url")
            .eq("id", parseInt(id))
            .single();

        if (fetchError || !documento) {
            return res.status(404).json({ success: false, message: "Documento no encontrado." });
        }

        // Extraer la ruta del archivo del URL público. Asegúrate de que esto sea robusto.
        const urlParts = documento.url.split("/documentos/");
        if (urlParts.length < 2) {
            return res.status(400).json({ success: false, message: "URL de documento inválida para extracción de ruta." });
        }
        const filePathInStorage = urlParts[1]; // Esto debería ser la ruta relativa dentro del bucket 'documentos'

        const { error: storageError } = await supabase.storage
            .from("documentos") // Asumimos el bucket 'documentos'
            .remove([filePathInStorage]);

        if (storageError) {
            return handleError(res, "Error al eliminar archivo del almacenamiento", storageError);
        }

        const { error: deleteError } = await supabase
            .from("documentos_postulante")
            .delete()
            .eq("id", parseInt(id));

        if (deleteError) {
            return handleError(res, "Error al eliminar el documento de la base de datos", deleteError);
        }

        res.status(200).json({ success: true, message: "Documento eliminado correctamente." });
    } catch (err) {
        handleError(res, "Error inesperado al eliminar el documento", err);
    }
};

// Exportar multer para usarlo en las rutas (sin cambios)
export { upload };

// Enviar correo usando emailService (sin cambios)
export const sendEmail = async (req, res) => {
    try {
        const { to, subject, message, html, postulacionId } = req.body;

        if (!to || !subject || (!message && !html)) {
            return res.status(400).json({ success: false, message: "Faltan parámetros requeridos: to, subject, y message/html." });
        }

        const result = await sendEmailService({
            to,
            subject,
            text: message,
            html: html,
            postulacionId,
        });

        res.status(200).json({ success: true, message: result.message });
    } catch (err) {
        handleError(res, "Error al enviar correo", err);
    }
};

// Registrar historial (sin cambios)
export const registrarHistorial = async (req, res) => {
    try {
        const { postulacion_id, accion, ejecutado_por, observacion } = req.body;

        if (!postulacion_id || !accion || !ejecutado_por) {
            return res.status(400).json({ success: false, message: "Faltan campos requeridos: postulacion_id, accion, ejecutado_por." });
        }

        const { data, error } = await supabase
            .from("historial_postulacion")
            .insert([
                {
                    postulacion_id,
                    accion,
                    ejecutado_por,
                    observacion,
                    creado_en: getCurrentColombiaTimeISO(),
                },
            ]);

        if (error) {
            return handleError(res, "Error al registrar historial.", error);
        }

        res.status(200).json({ success: true, message: "Historial registrado.", data });
    } catch (err) {
        handleError(res, "Error interno al registrar historial", err);
    }
};

// Actualizar código de requisición (sin cambios)
export const updateCodigoRequisicion = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo_requisicion } = req.body;

        const { data, error } = await supabase
            .from("Postulaciones")
            .update({ codigo_requisicion })
            .eq("id", parseInt(id))
            .select();

        if (error) throw error;

        res.status(200).json({ success: true, message: "Código de requisición actualizado.", data });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error al actualizar código de requisición.", error: err.message });
    }
};