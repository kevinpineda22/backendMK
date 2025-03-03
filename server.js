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

// Configuración de Multer para usar memoria
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 600 * 1024 }, // Limita el tamaño a 600KB
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
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    optionsSuccessStatus: 200,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Función para normalizar el nombre del archivo
function normalizeFileName(fileName) {
    return fileName
        .normalize("NFD")
        .replace(/[̀-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Endpoint de prueba para verificar el estado del servidor
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: '¡El backend está funcionando correctamente!',
    });
});

// Endpoint para obtener postulaciones (con filtro por numeroDocumento)
app.get('/api/postulaciones', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Postulaciones')
            .select('*');

        if (error) {
            console.error("Error al obtener datos de Supabase:", error.message);
            return res.status(500).json({ success: false, message: "Error al obtener datos", error: error.message });
        }

        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("Error inesperado:", err.message);
        res.status(500).json({ success: false, message: "Error inesperado", error: err.message });
    }
});

// Endpoint para descargar archivos desde Supabase
app.get('/api/descargar/*', async (req, res) => {
    const filePath = req.params[0];
    console.log('filePath recibido:', filePath);

    if (!filePath || !filePath.startsWith('hojas-vida/')) {
        return res.status(400).json({
            success: false,
            message: 'Ruta de archivo no válida o fuera del bucket permitido.',
        });
    }

    try {
        const { data, error } = await supabase.storage.from('hojas-vida').download(filePath);

        if (error) {
            console.error('Error al descargar el archivo desde Supabase:', error.message);
            return res.status(400).json({ success: false, message: 'No se pudo descargar el archivo.', error: error.message });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);

        const buffer = Buffer.from(await data.arrayBuffer());
        res.end(buffer);
    } catch (err) {
        console.error('Error interno durante la descarga:', err.message);
        res.status(500).json({ success: false, message: 'Error interno del servidor.', error: err.message });
    }
});

// Ruta POST para recibir datos del formulario (con validación de duplicados)
app.post('/enviar', upload.single('hojaVida'), async (req, res) => {
    try {
        const {
            fechaPostulacion, nombreApellido, nivelEducativo, cargo,
            telefono, genero, Departamento, Ciudad,
            zonaResidencia, barrio, fechaNacimiento, tipoDocumento,
            numeroDocumento, recomendado
        } = req.body;

        // ✅ Verificar si el documento ya existe en la base de datos
        const { data: existingPostulacion, error: searchError } = await supabase
            .from('Postulaciones')
            .select('*')
            .eq('numeroDocumento', numeroDocumento)
            .single();

        if (searchError && searchError.code !== 'PGRST116') {
            throw new Error('Error al verificar la existencia del documento.');
        }

        if (existingPostulacion) {
            return res.status(400).json({
                success: false,
                message: `El número de documento ${numeroDocumento} ya está registrado.`,
            });
        }

        const hojaVidaFile = req.file;

        if (!hojaVidaFile) {
            return res.status(400).json({ success: false, message: "La hoja de vida es obligatoria." });
        }

        // Verificar si ya existe una postulación con el mismo numeroDocumento
        const { data: existingData, error: checkError } = await supabase
            .from('Postulaciones')
            .select('id')
            .eq('numeroDocumento', numeroDocumento)
            .limit(1);

        if (checkError) {
            console.error("Error al verificar el documento:", checkError.message);
            return res.status(500).json({ success: false, message: "Error al verificar el documento.", error: checkError.message });
        }

        if (existingData.length > 0) {
            return res.status(400).json({ success: false, message: "El número de documento ya está registrado." });
        }

        // Si no hay duplicados, proceder con la subida del archivo
        const safeFileName = normalizeFileName(hojaVidaFile.originalname);
        const filePath = `hojas-vida/${Date.now()}-${safeFileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('hojas-vida')
            .upload(filePath, hojaVidaFile.buffer, { contentType: hojaVidaFile.mimetype });

        if (uploadError) {
            console.error("Error al subir el archivo a Supabase:", uploadError.message);
            return res.status(500).json({ success: false, message: "Error al subir el archivo.", error: uploadError.message });
        }

        const hojaVidaURL = `${process.env.SUPABASE_URL}/storage/v1/object/public/${uploadData.path}`;

        // Insertar los datos en la tabla Postulaciones
        const { data, error } = await supabase
            .from('Postulaciones')
            .insert([{
                fechaPostulacion, nombreApellido, nivelEducativo, cargo,
                telefono, genero, Departamento, Ciudad,
                zonaResidencia, barrio, fechaNacimiento, tipoDocumento,
                numeroDocumento, recomendado, hojaVida: hojaVidaURL
            }]);

        if (error) {
            console.error("Error al insertar datos en Supabase:", error.message);
            return res.status(500).json({ success: false, message: "Error al guardar los datos.", error: error.message });
        }

        res.status(200).json({ success: true, message: "Formulario enviado exitosamente", data });
    } catch (err) {
        console.error("Error inesperado:", err.message);
        res.status(500).json({ success: false, message: "Error al procesar el formulario", error: err.message });
    }
});

// Puerto del servidor
const PORT = process.env.PORT || 7777;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});