// backend/utils/errorHandler.js

const isProduction = process.env.NODE_ENV === "production";

/**
 * Maneja errores del servidor y envía respuesta JSON al cliente.
 * En producción, NO envía detalles internos (error.message, error.details, error.hint)
 * para evitar filtrar información de la base de datos al usuario.
 */
export const handleError = (res, message, error, status = 500) => {
  console.error(
    `[ERROR] ${message}:`,
    error?.message,
    error?.details || "",
    error?.hint || "",
  );

  const response = {
    success: false,
    message, // Mensaje legible para el usuario (definido por el desarrollador)
  };

  // Solo incluir detalles técnicos en desarrollo
  if (!isProduction) {
    response.error = error?.message || null;
    response.details = error?.details || null;
    response.hint = error?.hint || null;
  }

  return res.status(status).json(response);
};
