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
  sendEmailController,
  registrarHistorial,
} from "../controllers/registroController.js";

const router = Router();

// Middleware de autenticación (ejemplo, implementar según tu sistema)
const authenticate = (req, res, next) => {
  // Aquí verificarías un token JWT o similar
  // Por ejemplo, usando jsonwebtoken
  /*
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "No autorizado" });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Token inválido" });
  }
  */
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
router.post("/api/enviar", upload.single("hojaVida"), enviarFormulario);
router.post("/api/historial", registrarHistorial);

// Actualizar estado
router.put("/estado/:id", updateEstado);

// Rutas de documentos
router.post("/api/documentos", upload.single("archivo"), subirDocumento);
router.post("/api/documentos/multiple", upload.array("archivos"), subirDocumentosMultiples);
router.delete("/api/documentos/:id", eliminarDocumento);

// Enviar correos
router.post("/api/send-email", authenticate, sendEmailController);

export default router;