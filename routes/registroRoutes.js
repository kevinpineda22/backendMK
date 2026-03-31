// registroRoutes.js

import { Router } from "express";

// --- Importaciones de CONTROLADORES ---
// 1. registroController (funciones generales de postulaciones y archivos)
import {
  getRoot,
  getPostulaciones,
  updateCheckBD,
  updateObservacionBD,
  updateEstado,
  getStats,
  getDetails,
  descargarArchivo,
  enviarFormulario,
  subirDocumento,
  subirDocumentosMultiples,
  eliminarDocumento,
  upload, // multer middleware
  sendEmail, // general sendEmail function
  registrarHistorial,
  updateCodigoRequisicion,
} from "../controllers/registroController.js";

// 2. solicitudPersonalController (funciones de solicitud de personal)
import {
  enviarSolicitudPersonal,
  obtenerSolicitudesPersonal,
  procesarAprobacion,
} from "../controllers/solicitudPersonalController.js";

// 3. entrevistasController (funciones de agendamiento de entrevistas)
import {
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
} from "../controllers/entrevistasController.js";

import rateLimit from "express-rate-limit";

// --- Inicialización del Router ---
const router = Router();

// --- Rate limiter estricto para endpoints de email ---
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 emails por IP cada 15 min
  message: { success: false, message: "Demasiadas solicitudes de email, intenta más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Middleware de autenticación por API Key ---
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ success: false, message: "No autorizado." });
  }
  next();
};


// --- DEFINICIÓN DE RUTAS ---

// Rutas básicas
router.get("/", getRoot);

// Rutas de Postulaciones (para el frontend PostulacionesTable.jsx)
router.get("/api/postulaciones", getPostulaciones);
router.patch("/api/postulaciones/:id/check", updateCheckBD);
router.patch("/api/postulaciones/:id/observacion", updateObservacionBD);
router.patch("/api/postulaciones/:id/codigo-requisicion", updateCodigoRequisicion);
router.get("/api/postulaciones/stats", getStats); // Para DashboardPostulaciones
router.get("/api/postulaciones/details", getDetails);

// Rutas de Descarga y Subida de Archivos
router.get("/api/descargar/*", descargarArchivo); // Para descargar cualquier archivo del storage
router.post("/api/documentos", upload.single("archivo"), subirDocumento); // Subir un solo documento
router.post("/api/documentos/multiple", upload.array("archivos"), subirDocumentosMultiples); // Subir múltiples documentos
router.delete("/api/documentos/:id", eliminarDocumento); // Eliminar un documento

// Rutas de Formulario de Postulación y Historial
router.post("/api/enviar", enviarFormulario); // Envío del formulario de Trabaja.jsx
router.post("/api/historial", registrarHistorial); // Registro en historial_postulacion

// Rutas de Actualización de Estado de Postulaciones
router.put("/estado/:id", updateEstado); // Actualizar estado de una postulación

// Rutas de Envío de Correos (protegida con API Key + rate limiting)
router.post("/api/send-email", authenticateApiKey, emailLimiter, sendEmail);


// Rutas de SOLICITUD DE PERSONAL
router.post("/api/solicitud-personal", enviarSolicitudPersonal);
router.get("/api/solicitudes-personal", obtenerSolicitudesPersonal);
router.post("/api/procesar-aprobacion", procesarAprobacion);


// --- RUTAS DE AGENDAMIENTO DE ENTREVISTAS (Públicas para postulantes) ---
// Estas rutas no requieren autenticación en este flujo actual de postulantes
router.get("/api/entrevistas/check-postulante/:numeroDocumento", checkPostulanteForInterview);
router.get("/api/entrevistas/disponibilidad", getAvailableInterviewDays);
router.post("/api/entrevistas/reservar", reserveInterviewSlot);
router.delete("/api/entrevistas/cancelar/:id", cancelInterviewReservation);
router.patch("/api/admin/entrevistas/day/:id/status", authenticateApiKey, updateInterviewDayStatus);


// --- NUEVAS RUTAS DE AGENDAMIENTO PARA ADMINISTRACIÓN (RRHH) ---
router.post("/api/admin/entrevistas/day", authenticateApiKey, createInterviewDay);
router.get("/api/admin/entrevistas/days", authenticateApiKey, getAllInterviewDaysAdmin);
router.get("/api/admin/entrevistas/day/:id", authenticateApiKey, getInterviewDayDetails);
router.delete("/api/admin/entrevistas/day/:id", authenticateApiKey, deleteInterviewDay);
router.patch("/api/admin/entrevistas/reserva/:reservaId/status", authenticateApiKey, updateInterviewAttendanceStatus);


// --- Exportar el Router ---
export default router;