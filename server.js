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
const storage = multer.memoryStorage(); // Usamos memoryStorage para mantener el archivo solo en la memoria
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
    origin: process.env.ALLOWED_ORIGIN || '*', // Configura el dominio permitido o usa '*' para permitir todos
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    optionsSuccessStatus: 200,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Función para normalizar el nombre del archivo
function normalizeFileName(fileName) {
    return fileName
        .normalize("NFD") // Descompone los caracteres acentuados
        .replace(/[\u0300-\u036f]/g, "") // Elimina los acentos
        .replace(/[^a-zA-Z0-9._-]/g, "_"); // Reemplaza caracteres no válidos por "_"
}

// Endpoint de prueba para verificar el estado del servidor
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: '¡El backend está funcionando correctamente!',
    });
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

        // Generar un nombre seguro y normalizado para el archivo
        const safeFileName = normalizeFileName(hojaVidaFile.originalname);
        const filePath = `hojas-vida/${Date.now()}-${safeFileName}`;

        // Subir el archivo PDF a Supabase
        const { data, error } = await supabase.storage
            .from('hojas-vida') // Reemplaza con el nombre de tu bucket
            .upload(filePath, hojaVidaFile.buffer, {
                contentType: hojaVidaFile.mimetype,
            });

        if (error) {
            console.error("Error al subir el archivo a Supabase: ", error.message);
            return res.status(500).json({ success: false, message: "Error al subir el archivo." });
        }

        // URL pública del archivo
        const hojaVidaURL = `${process.env.SUPABASE_URL}/storage/v1/object/public/${data.path}`;

        // Consulta para insertar en la base de datos
        const query = `
            INSERT INTO "Postulaciones" (
                "fechaPostulacion", "nombreApellido", "nivelEducativo", cargo,
                telefono, genero, "Departamento", "Ciudad",
                "zonaResidencia", barrio, "fechaNacimiento", "tipoDocumento",
                "numeroDocumento", recomendado, "hojaVida"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `;

        // Ejecución del query
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
            hojaVidaURL, // Guardar la URL del archivo en la base de datos
        ]);

        // Respuesta al cliente
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

