import { Router } from "express";
import {
  getRoot,
  getPostulaciones,
  updateCheckBD,
  updateObservacionBD,
  updateEstado,
  getStats, // Usado en Dashboard de Postulaciones (si lo tienes)
  getDetails, // Usado para buscar postulaciones (si lo tienes)
  descargarArchivo,
  enviarFormulario, // Para el formulario Trabaja.jsx
  subirDocumento,
  subirDocumentosMultiples,
  eliminarDocumento,
  upload, // Multer middleware
  sendEmail, // Función genérica de envío de email
  registrarHistorial,
  updateCodigoRequisicion,
} from "../controllers/registroController.js";


// IMPORTANTE: NO IMPORTAR empleadosController.js NI solicitudPersonalController.js AQUÍ
// Porque no los estamos usando en este alcance simplificado.

// Importar el controlador de entrevistas (este SÍ es necesario)
import {
    checkPostulanteForInterview,
    getAvailableInterviewDays,
    reserveInterviewSlot,
    // Las funciones de gestión de RRHH las dejamos comentadas por ahora,
    // ya que no son parte de "agendar la entrevista" por el postulante.
    // manageInterviewDays,
    // getAllInterviewDays,
    // deleteInterviewDay,
    // getInterviewReservations,
    // updateInterviewReservationStatus
} from "../controllers/entrevistasController.js"; 


const router = Router();

// Middleware de autenticación (placeholder, no se usa para rutas de postulante)
const authenticate = (req, res, next) => {
    next(); 
};

// --- Rutas Básicas ---
router.get("/", getRoot);

// --- Rutas de Postulaciones (desde el formulario Trabaja.jsx) ---
router.post("/api/enviar", enviarFormulario); // Envío del formulario de postulación
router.get("/api/postulaciones", getPostulaciones); // Para PostulacionesTable.jsx
router.get("/api/postulaciones/stats", getStats); // Para DashboardPostulaciones.jsx
router.get("/api/postulaciones/details", getDetails); // Para PostulacionesTable.jsx (filtro)
router.patch("/api/postulaciones/:id/check", updateCheckBD); // Para PostulacionesTable.jsx
router.patch("/api/postulaciones/:id/observacion", updateObservacionBD); // Para PostulacionesTable.jsx
router.patch("/api/postulaciones/:id/codigo-requisicion", updateCodigoRequisicion); // Para PostulacionesTable.jsx
router.put("/estado/:id", updateEstado); // Para PostulacionesTable.jsx

// --- Rutas de Documentos (para el PanelPostulante o similares) ---
router.get("/api/descargar/*", descargarArchivo); // Para descargar cualquier archivo del storage
router.post("/api/documentos", upload.single("archivo"), subirDocumento); // Subir un solo documento
router.post("/api/documentos/multiple", upload.array("archivos"), subirDocumentosMultiples); // Subir múltiples documentos
router.delete("/api/documentos/:id", eliminarDocumento); // Eliminar un documento

// --- Rutas de Historial (para PostulacionesTable o PanelPostulante) ---
router.post("/api/historial", registrarHistorial); // Registro en historial_postulacion

// --- Rutas de Envío de Correos (genérica, usada por el backend para notificaciones) ---
router.post("/api/send-email", sendEmail);


// --- RUTAS DE AGENDAMIENTO DE ENTREVISTAS (NUEVAS y ESPECÍFICAS PARA EL POSTULANTE) ---
// 1. Verificar si una cédula existe y su estado
router.get("/api/entrevistas/check-postulante/:numeroDocumento", checkPostulanteForInterview);
// 2. Obtener los días de entrevista disponibles
router.get("/api/entrevistas/disponibilidad", getAvailableInterviewDays);
// 3. Registrar la reserva de entrevista
router.post("/api/entrevistas/reservar", reserveInterviewSlot);

// Las rutas de gestión de RRHH para empleados y días de entrevista se mantienen
// fuera de este `registroRoutes.js` si queremos que este archivo sea solo para
// el flujo de postulantes y entrevistas por parte del postulante.
// Si las incluiste en la versión anterior de este archivo, REMUÉVELAS.


export default router;