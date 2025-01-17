import express from 'express';
import multer from 'multer';
import cors from 'cors';
import bodyParser from 'body-parser';
import pkg from 'pg';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();

// Inicializar Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configuración de Multer para solo usar memoria
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

// Conexión a la base de datos
const { Pool } = pkg;
const pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
});

pool
    .connect()
    .then((client) => {
        console.log("Conexión a PostgreSQL exitosa");
        client.release();
    })
    .catch((err) => {
        console.error("Error de conexión a PostgreSQL: ", err.message);
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

// Endpoint para obtener todas las postulaciones
app.get('/api/postulaciones', async (req, res) => {
    try {
        const query = 'SELECT * FROM "Postulaciones"';
        const { rows } = await pool.query(query);
        res.status(200).json({ success: true, data: rows });
    } catch (err) {
        console.error("Error al obtener datos de la base de datos: ", err.message);
        res.status(500).json({ success: false, message: "Error al obtener datos", error: err.message });
    }
});

// Endpoint para descargar archivos desde Supabase
app.get('/api/descargar/*', async (req, res) => {
    const filePath = req.params[0]; // Captura todo después de "/api/descargar/"
    console.log('filePath recibido:', filePath);

    if (!filePath || !filePath.startsWith('hojas-vida/')) {
        return res.status(400).json({
            success: false,
            message: 'Ruta de archivo no válida o fuera del bucket permitido.',
        });
    }

    try {
        // Descargar el archivo desde Supabase
        const { data, error } = await supabase.storage.from('hojas-vida').download(filePath);

        if (error) {
            console.error('Error al descargar el archivo desde Supabase:', error.message);
            return res.status(400).json({
                success: false,
                message: 'No se pudo descargar el archivo.',
                error: error.message,
            });
        }

        console.log('Archivo descargado desde Supabase:', filePath);

        // Configurar encabezados HTTP para la descarga
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filePath.split('/').pop()}"`
        );

        // Enviar el archivo como un `Buffer`
        const buffer = Buffer.from(await data.arrayBuffer());
        res.end(buffer);
    } catch (err) {
        console.error('Error interno durante la descarga:', err.message);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor.',
            error: err.message,
        });
    }
});



// Ruta POST para recibir datos del formulario
app.post('/enviar', upload.single('hojaVida'), async (req, res) => {
    try {
        const {
            fechaPostulacion, nombreApellido, nivelEducativo, cargo,
            telefono, genero, Departamento, Ciudad,
            zonaResidencia, barrio, fechaNacimiento, tipoDocumento,
            numeroDocumento, recomendado
        } = req.body;

        const hojaVidaFile = req.file;

        if (!hojaVidaFile) {
            return res.status(400).json({ success: false, message: "La hoja de vida es obligatoria." });
        }

        const safeFileName = normalizeFileName(hojaVidaFile.originalname);
        const filePath = `hojas-vida/${Date.now()}-${safeFileName}`;

        const { data, error } = await supabase.storage
            .from('hojas-vida')
            .upload(filePath, hojaVidaFile.buffer, {
                contentType: hojaVidaFile.mimetype,
            });

        if (error) {
            console.error("Error al subir el archivo a Supabase: ", error.message);
            return res.status(500).json({ success: false, message: "Error al subir el archivo." });
        }

        const hojaVidaURL = `${process.env.SUPABASE_URL}/storage/v1/object/public/${data.path}`;

        const query = `
            INSERT INTO "Postulaciones" (
                "fechaPostulacion", "nombreApellido", "nivelEducativo", cargo,
                telefono, genero, "Departamento", "Ciudad",
                "zonaResidencia", barrio, "fechaNacimiento", "tipoDocumento",
                "numeroDocumento", recomendado, "hojaVida"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `;

        await pool.query(query, [
            fechaPostulacion,
            nombreApellido,
            nivelEducativo,
            cargo,
            telefono,
            genero,
            Departamento,
            Ciudad,
            zonaResidencia,
            barrio,
            fechaNacimiento,
            tipoDocumento,
            numeroDocumento,
            recomendado,
            hojaVidaURL,
        ]);

        res.status(200).json({
            success: true,
            message: "Formulario enviado exitosamente",
            data: {
                fechaPostulacion,
                nombreApellido,
                nivelEducativo,
                cargo,
                telefono,
                genero,
                Departamento,
                Ciudad,
                zonaResidencia,
                barrio,
                fechaNacimiento,
                tipoDocumento,
                numeroDocumento,
                recomendado,
                hojaVida: hojaVidaURL,
            },
        });
    } catch (err) {
        console.error("Error al insertar datos en la base de datos: ", err);
        res.status(500).json({
            success: false,
            message: "Error al procesar el formulario",
            error: err.message,
        });
    }
});

// Puerto del servidor
const PORT = process.env.PORT || 7777;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
