import express from "express";
import cors from "cors";
import bodyParser from "body-parser"; // Importar bodyParser
import dotenv from "dotenv";
import registroRoutes from "./routes/registroRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  'http://localhost:5173', 
  'https://merkahorro.com', 
  'https://www.merkahorro.com', 
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], 
  allowedHeaders: ['Content-Type', 'Authorization'], 
  credentials: true, 
  optionsSuccessStatus: 200, 
}));

app.options('*', cors()); 

// CRÍTICO: Asegurarse de que bodyParser.json() y bodyParser.urlencoded() estén ANTES de las rutas
app.use(bodyParser.json()); // Para parsear JSON en el body de las peticiones
app.use(bodyParser.urlencoded({ extended: true })); // Para parsear application/x-www-form-urlencoded

// Rutas
app.use(registroRoutes); 

export default app;

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 7777;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}