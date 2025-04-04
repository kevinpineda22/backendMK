import express from 'express';
import multer from 'multer';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// Inicializar Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configuración de Multer
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 600 * 1024 }, // 600KB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF.'));
        }
    },
});

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    optionsSuccessStatus: 200,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Normalizar nombres de archivo
function normalizeFileName(fileName) {
    return fileName
        .normalize("NFD")
        .replace(/[̀-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Ruta raíz
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: '¡El backend está funcionando correctamente!',
    });
});

// Endpoint para obtener todas las postulaciones con todos los campos
app.get('/api/postulaciones', async (req, res) => {
    try {
        const { numeroDocumento } = req.query;
        let query = supabase.from('Postulaciones').select('*'); // Seleccionar todos los campos

        if (numeroDocumento) {
            query = query.eq('numeroDocumento', numeroDocumento); // Filtrar por numeroDocumento si se proporciona
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error al obtener datos:", error.message);
            return res.status(500).json({ success: false, message: "Error al obtener datos", error: error.message });
        }

        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("Error inesperado:", err.message);
        res.status(500).json({ success: false, message: "Error inesperado", error: err.message });
    }
});

// NUEVO: Endpoint para actualizar el campo check_BD en una postulación
app.patch('/api/postulaciones/:id/check', async (req, res) => {
    try {
        const { id } = req.params;
        const { check_BD } = req.body;

        // Validación: el campo check_BD debe ser un booleano
        if (typeof check_BD !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: "El campo check_BD debe ser un valor booleano.",
            });
        }

        const { data, error } = await supabase
            .from('Postulaciones')
            .update({ check_BD })
            .eq('id', id)
            .select();

        if (error) {
            console.error('Error al actualizar check_BD:', error.message);
            return res.status(500).json({
                success: false,
                message: "Error al actualizar el campo check_BD.",
                error: error.message,
            });
        }

        res.status(200).json({
            success: true,
            message: "Campo check_BD actualizado correctamente.",
            data,
        });
    } catch (err) {
        console.error('Error inesperado:', err.message);
        res.status(500).json({ success: false, message: "Error inesperado", error: err.message });
    }
});

// NUEVO: Endpoint para actualizar el campo observacion_BD en una postulación
app.patch('/api/postulaciones/:id/observacion', async (req, res) => {
    try {
        const { id } = req.params;
        const { observacion_BD } = req.body;

        // Validación: el campo observacion_BD debe ser una cadena
        if (typeof observacion_BD !== 'string') {
            return res.status(400).json({
                success: false,
                message: "El campo observacion_BD debe ser un valor de texto.",
            });
        }

        const { data, error } = await supabase
            .from('Postulaciones')
            .update({ observacion_BD })
            .eq('id', id)
            .select();

        if (error) {
            console.error('Error al actualizar observacion_BD:', error.message);
            return res.status(500).json({
                success: false,
                message: "Error al actualizar el campo observacion_BD.",
                error: error.message,
            });
        }

        res.status(200).json({
            success: true,
            message: "Campo observacion_BD actualizado correctamente.",
            data,
        });
    } catch (err) {
        console.error('Error inesperado:', err.message);
        res.status(500).json({ success: false, message: "Error inesperado", error: err.message });
    }
});

// Descargar archivos
app.get('/api/descargar/*', async (req, res) => {
    const filePath = req.params[0];
    console.log('filePath recibido:', filePath);

    if (!filePath || !filePath.startsWith('hojas-vida/')) {
        return res.status(400).json({
            success: false,
            message: 'Ruta de archivo no válida.',
        });
    }

    try {
        const { data, error } = await supabase.storage.from('hojas-vida').download(filePath);

        if (error) {
            console.error('Error al descargar:', error.message);
            return res.status(400).json({ success: false, message: 'No se pudo descargar el archivo.', error: error.message });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
        const buffer = Buffer.from(await data.arrayBuffer());
        res.end(buffer);
    } catch (err) {
        console.error('Error interno:', err.message);
        res.status(500).json({ success: false, message: 'Error interno del servidor.', error: err.message });
    }
});

// Enviar formulario
app.post('/enviar', upload.single('hojaVida'), async (req, res) => {
    try {
        const {
            fechaPostulacion, nombreApellido, nivelEducativo, cargo,
            telefono, genero, Departamento, Ciudad,
            zonaResidencia, barrio, fechaNacimiento, tipoDocumento,
            numeroDocumento, recomendado, observacion_BD // Agregar observacion_BD
        } = req.body;

        const hojaVidaFile = req.file;

        if (!hojaVidaFile) {
            return res.status(400).json({ success: false, message: "La hoja de vida es obligatoria." });
        }
        if (!numeroDocumento) {
            return res.status(400).json({ success: false, message: "El número de documento es obligatorio." });
        }

        const { data: existingData, error: checkError } = await supabase
            .from('Postulaciones')
            .select('id')
            .eq('numeroDocumento', numeroDocumento)
            .limit(1);

        if (checkError) {
            console.error("Error al verificar:", checkError.message);
            return res.status(500).json({ success: false, message: "Error al verificar el documento.", error: checkError.message });
        }

        if (existingData.length > 0) {
            return res.status(400).json({
                success: false,
                message: `El número de documento ${numeroDocumento} ya está registrado.`,
            });
        }

        const safeFileName = normalizeFileName(hojaVidaFile.originalname);
        const filePath = `hojas-vida/${Date.now()}-${safeFileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('hojas-vida')
            .upload(filePath, hojaVidaFile.buffer, { contentType: hojaVidaFile.mimetype });

        if (uploadError) {
            console.error("Error al subir:", uploadError.message);
            return res.status(500).json({ success: false, message: "Error al subir el archivo.", error: uploadError.message });
        }

        const hojaVidaURL = `${process.env.SUPABASE_URL}/storage/v1/object/public/${uploadData.path}`;

        // Se asigna el valor inicial de check_BD (false) al insertar la nueva postulación
        const { data, error } = await supabase
            .from('Postulaciones')
            .insert([{
                fechaPostulacion, nombreApellido, nivelEducativo, cargo,
                telefono, genero, Departamento, Ciudad,
                zonaResidencia, barrio, fechaNacimiento, tipoDocumento,
                numeroDocumento, recomendado, hojaVida: hojaVidaURL,
                check_BD: false,
                observacion_BD // Incluir observacion_BD en la inserción
            }])
            .select();

        if (error) {
            console.error("Error al insertar:", error.message);
            return res.status(500).json({ success: false, message: "Error al guardar los datos.", error: error.message });
        }

        res.status(200).json({ success: true, message: "Formulario enviado exitosamente", data });
    } catch (err) {
        console.error("Error inesperado:", err.message);
        res.status(500).json({ success: false, message: "Error al procesar el formulario", error: err.message });
    }
});

// Exportar para Vercel
export default app;

// Escuchar solo en desarrollo local
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 7777;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
}