// backend/utils/timeUtils.js

/**
 * Obtiene la fecha y hora actual de Colombia como string ISO en UTC.
 * Útil para columnas timestamptz en Supabase.
 * @returns {string} - ISO string en UTC (ej: "2026-03-03T18:30:00.000Z")
 */
export const getCurrentColombiaTimeISO = () => {
  // Simplemente retornamos la hora actual en UTC.
  // Supabase con timestamptz almacena en UTC internamente.
  // La conversión a hora de Colombia se hace al mostrar, no al almacenar.
  return new Date().toISOString();
};

/**
 * Obtiene la fecha actual en Colombia como string YYYY-MM-DD.
 * Útil para comparaciones de fecha (ej: filtrar días pasados).
 * @returns {string} - Fecha en formato "2026-03-03"
 */
export const getCurrentColombiaDate = () => {
  const now = new Date();
  // Formatear la fecha en la zona horaria de Colombia
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Bogota",
  });
  return formatter.format(now); // Retorna "2026-03-03"
};
