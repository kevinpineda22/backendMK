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
  createInterviewDay,          // <--- ¡NUEVA FUNCIÓN IMPORTADA!
  getAllInterviewDaysAdmin,    // <--- ¡NUEVA FUNCIÓN IMPORTADA!
  getInterviewDayDetails,      // <--- ¡NUEVA FUNCIÓN IMPORTADA!
  deleteInterviewDay,          // <--- ¡FUNCIÓN ACTUALIZADA IMPORTADA!
} from "../controllers/entrevistasController.js";


// --- Inicialización del Router ---
const router = Router();

// --- Middlewares (Ejemplo - DEBES IMPLEMENTAR LA LÓGICA REAL PARA PRODUCCIÓN) ---
const authenticate = (req, res, next) => {
    // ESTO ES SOLO UN MARCADOR DE POSICIÓN.
    // Para producción, DEBES implementar una autenticación real (JWT, sesiones, etc.)
    // para proteger las rutas de administración.
    console.log("Middleware de autenticación: Usuario autenticado (simulado)");
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

// Rutas de Envío de Correos (genérica, usada por el backend para notificaciones)
router.post("/api/send-email", sendEmail);


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


// --- NUEVAS RUTAS DE AGENDAMIENTO PARA ADMINISTRACIÓN (RRHH) ---
// Estas rutas DEBERÍAN estar protegidas por un middleware de autenticación REAL.
router.post("/api/admin/entrevistas/day", authenticate, createInterviewDay); // Crear un nuevo día disponible
router.get("/api/admin/entrevistas/days", authenticate, getAllInterviewDaysAdmin); // Obtener todos los días con sus cupos
router.get("/api/admin/entrevistas/day/:id", authenticate, getInterviewDayDetails); // Obtener detalles de un día y sus reservas
router.delete("/api/admin/entrevistas/day/:id", authenticate, deleteInterviewDay); // Eliminar un día y sus reservas


// --- Exportar el Router ---
export default router;