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

// Ruta raíz
router.get("/", getRoot);

// Rutas de postulaciones
router.get("/api/postulaciones", getPostulaciones);
router.patch("/api/postulaciones/:id/check", updateCheckBD);
router.patch("/api/postulaciones/:id/observacion", updateObservacionBD);
router.patch("/api/postulaciones/:id/estado", updateEstado);
router.get("/api/postulaciones/stats", getStats);
router.get("/api/postulaciones/details", getDetails);

// Descargar archivos
router.get("/api/descargar/*", descargarArchivo);

// Enviar formulario

router.post("/enviar", upload.single("hojaVida"), enviarFormulario);
router.post("/historial", registrarHistorial);
router.post("/postulaciones/:id/estado-con-historial", actualizarEstadoConHistorial);

// Rutas de documentos
router.post("/api/documentos", upload.single("archivo"), subirDocumento);
router.post("/api/documentos/multiple", upload.array("archivos"), subirDocumentosMultiples);
router.delete("/api/documentos/:id", eliminarDocumento);

// Nueva ruta para enviar correos
router.post("/api/send-email", sendEmail);

export default router;