// backend/utils/timeUtils.js

export const getCurrentColombiaTimeISO = () => {
    // Crea un objeto Date para el momento actual.
    const now = new Date();

    // Opciones para formatear la fecha a la zona horaria de Colombia (UTC-5)
    // Usamos 'en-CA' para un formato ISO-like que es más fácil de manipular
    // y especificamos la zona horaria de Bogotá.
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3, // Para milisegundos si es necesario
        hour12: false, // Formato de 24 horas
        timeZone: 'America/Bogota'
    };

    // Obtenemos las partes de la fecha en la zona horaria de Colombia
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);

    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    const millisecond = parts.find(p => p.type === 'fractionalSecondDigits')?.value || '000'; // Obtener milisegundos si están disponibles

    // Construir la cadena en formato ISO 8601 (YYYY-MM-DDTHH:MM:SS.sssZ)
    // Para timestamptz, Supabase prefiere que el backend le envíe la hora en UTC.
    // La forma más segura es crear un objeto Date con la hora local de Colombia,
    // y luego convertirlo a ISO string, que por defecto está en UTC.
    // NodeJS interpretará "2025-07-10T15:00:00" como hora local si no hay Z o offset.
    // Para forzar la interpretación como hora de Colombia y luego convertir a UTC para la BD,
    // es mejor construir el string local y luego usar `new Date(localTimeString).toISOString()`.

    const localColombiaTimeStr = `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}`;
    const colombiaDateObj = new Date(localColombiaTimeStr);

    // Si tu columna en Supabase es `timestamp with time zone` (timestamptz),
    // enviar un ISO string con la 'Z' al final (indicando UTC) es el estándar.
    // Date.toISOString() ya lo hace.
    return colombiaDateObj.toISOString();
};