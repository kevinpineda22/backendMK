import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import registroRoutes from "./routes/registroRoutes.js";
import solicitudPersonalRoutes from "./routes/solicitudPersonalRoutes.js";

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    optionsSuccessStatus: 200,
  })
);

app.options("*", cors()); // Responder preflight

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rutas
app.use(registroRoutes);
app.use("/api/solicitudes-personal", solicitudPersonalRoutes);

// Exportar para Vercel
export default app;

// Escuchar solo en desarrollo local
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 7777;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}
