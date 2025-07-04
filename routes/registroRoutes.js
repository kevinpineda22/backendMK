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
// Si no estás usando estas funcionalidades en este momento y quieres un backend mínimo,
// puedes comentar estas líneas y sus rutas correspondientes.
// Por ahora, las incluyo como estaban en tu código para completitud.
import {
  enviarSolicitudPersonal,
  obtenerSolicitudesPersonal,
  procesarAprobacion,
} from "../controllers/solicitudPersonalController.js";

// 3. entrevistasController (funciones de agendamiento de entrevistas)
// ESTE ES EL NUEVO Y CRÍTICO CONTROLADOR PARA EL AGENDAMIENTO
import {
  checkPostulanteForInterview,
  getAvailableInterviewDays,
  reserveInterviewSlot,
  cancelInterviewReservation, // <-- ¡NUEVA FUNCIÓN IMPORTADA!
  // Funciones de gestión de RRHH (comentadas por ahora, se activarán después)
  // manageInterviewDays,
  // getAllInterviewDays,
  // deleteInterviewDay,
  // getInterviewReservations,
  // updateInterviewReservationStatus
} from "../controllers/entrevistasController.js"; 


// --- Inicialización del Router ---
const router = Router();

// --- Middlewares (Ejemplo - DEBES IMPLEMENTAR LA LÓGICA REAL PARA PRODUCCIÓN) ---
const authenticate = (req, res, next) => {
    // Si tu aplicación no tiene un sistema de autenticación de backend (JWT, sesiones),
    // y solo dependes de la protección del frontend, puedes dejarlo así para pruebas.
    // En producción, TODAS las rutas que requieran un usuario logueado DEBEN tener autenticación real.
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


// Rutas de SOLICITUD DE PERSONAL (Si las estás usando)
router.post("/api/solicitud-personal", enviarSolicitudPersonal);
router.get("/api/solicitudes-personal", obtenerSolicitudesPersonal);
router.post("/api/procesar-aprobacion", procesarAprobacion);


// --- RUTAS DE AGENDAMIENTO DE ENTREVISTAS ---
// Estas rutas no requieren autenticación en este flujo actual de postulantes
router.get("/api/entrevistas/check-postulante/:numeroDocumento", checkPostulanteForInterview);
router.get("/api/entrevistas/disponibilidad", getAvailableInterviewDays);
router.post("/api/entrevistas/reservar", reserveInterviewSlot);
router.delete("/api/entrevistas/cancelar/:id", cancelInterviewReservation); // <-- ¡NUEVA RUTA DELETE!


// --- Exportar el Router ---
export default router;