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
} from "../controllers/registroController.js";

const router = Router();

// Middleware de autenticación (desactivado temporalmente)
const authenticate = (req, res, next) => {
  // Implementar autenticación con JWT si es necesario
  next();
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
router.patch("/estado/:id", updateEstado); // Cambiado a PATCH para consistencia

// Rutas de documentos
router.post("/api/documentos", upload.single("archivo"), subirDocumento);
router.post("/api/documentos/multiple", upload.array("archivos"), subirDocumentosMultiples);
router.delete("/api/documentos/:id", eliminarDocumento);

// Enviar correos
router.post("/api/send-email", authenticate, sendEmail);

export default router;