import { Router } from "express";
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
  upload, // multer upload middleware
  sendEmail, // general sendEmail function
  registrarHistorial,
  updateCodigoRequisicion,
} from "../controllers/registroController.js";
import {
  enviarSolicitudPersonal,
  obtenerSolicitudesPersonal,
  procesarAprobacion,
} from "../controllers/solicitudPersonalController.js";

// Importar los nuevos controladores para Empleados y Entrevistas
import {
    createEmpleado, getEmpleados, getEmpleadoById, updateEmpleado, deleteEmpleado,
    assignHorario, getEmployeeSchedules, updateAssignedHorario, deleteAssignedHorario,
    getEmployeeDashboardStats
} from "../controllers/empleadosController.js"; 

import {
    checkPostulanteForInterview, getAvailableInterviewDays, reserveInterviewSlot,
    manageInterviewDays, getAllInterviewDays, deleteInterviewDay,
    getInterviewReservations, updateInterviewReservationStatus
} from "../controllers/entrevistasController.js"; 


const router = Router();

// Middleware de autenticación (ejemplo, implementar según tu sistema)
const authenticate = (req, res, next) => {
  
  next(); // Temporalmente sin autenticación
};


// --- Rutas Básicas ---
router.get("/", getRoot);

// --- Rutas de Postulaciones (existentes) ---
router.get("/api/postulaciones", getPostulaciones);
router.patch("/api/postulaciones/:id/check", updateCheckBD);
router.patch("/api/postulaciones/:id/observacion", updateObservacionBD);
router.patch("/api/postulaciones/:id/codigo-requisicion", updateCodigoRequisicion);
router.get("/api/postulaciones/stats", getStats);
router.get("/api/postulaciones/details", getDetails);

// --- Rutas de Archivos (Descarga y Subida) ---
router.get("/api/descargar/*", descargarArchivo); // Para descargar cualquier archivo del storage
router.post("/api/documentos", upload.single("archivo"), subirDocumento); // Subir un solo documento
router.post("/api/documentos/multiple", upload.array("archivos"), subirDocumentosMultiples); // Subir múltiples documentos
router.delete("/api/documentos/:id", eliminarDocumento); // Eliminar un documento

// --- Rutas de Formulario y Historial ---
router.post("/api/enviar", enviarFormulario); // Envío del formulario de postulación
router.post("/api/historial", registrarHistorial); // Registro en historial_postulacion

// --- Rutas de Estado de Postulaciones ---
router.put("/estado/:id", updateEstado); // Actualizar estado de una postulación

// --- Rutas de Envío de Correos ---
router.post("/api/send-email", sendEmail); // Ruta genérica para enviar correos

// --- Rutas de Solicitud de Personal (para aprobación de gerentes) ---
router.post("/api/solicitud-personal", enviarSolicitudPersonal);
router.get("/api/solicitudes-personal", obtenerSolicitudesPersonal);
router.post("/api/procesar-aprobacion", procesarAprobacion);


// --- NUEVAS RUTAS: GESTIÓN DE EMPLEADOS (PARA GERENTES) ---
// Requieren autenticación y quizás autorización por rol/sede
router.post("/api/empleados", authenticate, createEmpleado);
router.get("/api/empleados", authenticate, getEmpleados); // getEmpleados manejará el filtrado por sede si aplica
router.get("/api/empleados/:id", authenticate, getEmpleadoById);
router.put("/api/empleados/:id", authenticate, updateEmpleado);
router.delete("/api/empleados/:id", authenticate, deleteEmpleado);

// --- NUEVAS RUTAS: GESTIÓN DE HORARIOS DE EMPLEADOS ---
router.post("/api/horarios-empleados", authenticate, assignHorario);
router.get("/api/horarios-empleados/:empleadoId", authenticate, getEmployeeSchedules);
router.put("/api/horarios-empleados/:id", authenticate, updateAssignedHorario);
router.delete("/api/horarios-empleados/:id", authenticate, deleteAssignedHorario);

// --- NUEVAS RUTAS: DASHBOARD DE EMPLEADOS ---
router.get("/api/dashboard/empleados", authenticate, getEmployeeDashboardStats); 

// --- NUEVAS RUTAS: GESTIÓN DE ENTREVISTAS ---
// Para el Postulante (no necesitan autenticación de gerente)
router.get("/api/entrevistas/check-postulante/:numeroDocumento", checkPostulanteForInterview);
router.get("/api/entrevistas/disponibilidad", getAvailableInterviewDays);
router.post("/api/entrevistas/reservar", reserveInterviewSlot);

// Para Gestión Humana (requieren autenticación de gerente)
router.post("/api/entrevistas/gestion-dias", authenticate, manageInterviewDays); // Crear/actualizar días de entrevista
router.get("/api/entrevistas/todos-dias", authenticate, getAllInterviewDays); // Obtener todos los días para GH
router.delete("/api/entrevistas/dias/:id", authenticate, deleteInterviewDay); // Eliminar día
router.get("/api/entrevistas/reservas", authenticate, getInterviewReservations); // Obtener todas las reservas de entrevista
router.patch("/api/entrevistas/reservas/:id", authenticate, updateInterviewReservationStatus); // Actualizar estado de una reserva (confirmada, asistió)


export default router;