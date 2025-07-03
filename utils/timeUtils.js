// backend/utils/timeUtils.js
export const getCurrentColombiaTimeISO = () => {
    const now = new Date();
    // Obtener la fecha/hora en la zona horaria de Colombia (UTC-5)
    const colombiaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
    // Formatear a ISO string para Supabase (que espera UTC)
    // Supabase interpretará esto correctamente si el tipo de columna es 'timestamp with time zone' (timestamptz)
    return colombiaTime.toISOString();
};