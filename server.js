import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import registroRoutes from "./routes/registroRoutes.js"; // Tus rutas principales

dotenv.config();

const app = express();

// --- CONFIGURACIÓN CORS MEJORADA ---
const allowedOrigins = [
  'http://localhost:5173', // Tu frontend local
  'https://merkahorro.com', // Tu dominio de producción (si tienes uno)
  'https://www.merkahorro.com', // Otra versión de tu dominio
  // Agrega cualquier otro dominio donde vaya a estar tu frontend
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (como de Postman, curl, o navegadores viejos)
    if (!origin) return callback(null, true);
    // Permitir el origen si está en la lista de permitidos
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Asegura que todos los métodos necesarios estén permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Asegura que los headers comunes estén permitidos
  credentials: true, // Si vas a usar cookies o tokens con credenciales
  optionsSuccessStatus: 200, // Para compatibilidad con algunos navegadores
}));

app.options('*', cors()); // Manejar pre-flight requests para todas las rutas

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rutas
app.use(registroRoutes); // Tus rutas de la API

// Exportar para Vercel
export default app;

// Escuchar solo en desarrollo local
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 7777;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}