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
  upload,
  sendEmail,
  registrarHistorial,
  updateCodigoRequisicion,
} from "../controllers/registroController.js";
import {
  enviarSolicitudPersonal,
  obtenerSolicitudesPersonal,
  actualizarCodigoRequisicionSolicitud,
  actualizarCodigoRequisicionPostulacion,
} from "../controllers/solicitudPersonalController.js";


const router = Router();

// Middleware de autenticación (ejemplo, implementar según tu sistema)
const authenticate = (req, res, next) => {
  
  next(); // Temporalmente sin autenticación
};

// Ruta raíz
router.get("/", getRoot);

// Rutas de postulaciones
router.get("/api/postulaciones", getPostulaciones);
router.patch("/api/postulaciones/:id/check", updateCheckBD);
router.patch("/api/postulaciones/:id/observacion", updateObservacionBD);
router.get("/api/postulaciones/stats", getStats);
router.get("/api/postulaciones/details", getDetails);

// Descargar archivos
router.get("/api/descargar/*", descargarArchivo);

// Enviar formulario y historial
router.post("/api/enviar", enviarFormulario); // Sin multer, ya que el frontend envía JSON
router.post("/api/historial", registrarHistorial);

// Actualizar estado
router.put("/estado/:id", updateEstado);

// Rutas de documentos
router.post("/api/documentos", upload.single("archivo"), subirDocumento);
router.post("/api/documentos/multiple", upload.array("archivos"), subirDocumentosMultiples);
router.delete("/api/documentos/:id", eliminarDocumento);

// Enviar correos
router.post("/api/send-email", authenticate, sendEmail);

router.patch("/api/postulaciones/:id/codigo-requisicion", updateCodigoRequisicion);


//---------------------------------------SOLICITUD PERSONAL----------------------------------------------//
router.post("/api/solicitud-personal", enviarSolicitudPersonal);
router.get("/api/solicitudes-personal", obtenerSolicitudesPersonal);

// Ruta para enviar una nueva solicitud de personal
router.post("/", enviarSolicitudPersonal);

// Ruta para obtener todas las solicitudes de personal
router.get("/", obtenerSolicitudesPersonal);

export default router;