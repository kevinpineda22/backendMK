import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import registroRoutes from "./routes/registroRoutes.js";

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: ["https://merkahorro.com", "http://localhost:3000"], // Ajusta según los dominios del frontend
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use(registroRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Ruta no encontrada",
  });
});

// Exportar para Vercel
export default app;

// Escuchar solo en desarrollo local
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 7777;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}