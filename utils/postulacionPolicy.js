// utils/postulacionPolicy.js
//
// Reglas centralizadas para determinar si una persona puede postularse o
// re-postularse. Pensado para reutilizarse desde el endpoint de envío del
// formulario y desde el endpoint de pre-verificación.

/**
 * Estados donde la postulación se considera ACTIVA — bloquea aplicar de nuevo.
 */
export const ESTADOS_ACTIVOS = [
  "Postulado",
  "Entrevista",
  "Preseleccionado",
  "Exámenes médicos",
  "Documentación",
];

/**
 * Estados donde la postulación se considera CERRADA — permite re-postulación
 * sujeta a la política de cooldown.
 */
export const ESTADOS_CERRADOS = ["Rechazado", "Inactivo", "Contratado"];

/**
 * Días mínimos que deben pasar tras una postulación cerrada antes de permitir
 * re-postulación. Los valores son por defecto razonables; si Gestión Humana
 * necesita afinar por cargo o empresa, se hace acá.
 */
export const COOLDOWN_DIAS = {
  Rechazado: 90,
  Inactivo: 30,
  // Contratado se maneja como "no permitido nunca" — si la persona ya está
  // retirada, Gestión Humana debe mover su última postulación a "Inactivo"
  // antes de que pueda reaplicar.
  Contratado: null,
};

const MS_POR_DIA = 1000 * 60 * 60 * 24;

const formatFechaLarga = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  });
};

const ordenarPorFechaDesc = (postulaciones) =>
  [...postulaciones].sort(
    (a, b) =>
      new Date(b.fechaPostulacion || b.created_at || 0) -
      new Date(a.fechaPostulacion || a.created_at || 0),
  );

/**
 * Evalúa si una persona puede crear una nueva postulación.
 *
 * @param {Array} postulacionesPrevias - Postulaciones existentes de la persona
 *   (puede venir vacío). Se espera que cada item tenga al menos:
 *   { id, estado, empresaPostula, cargo, fechaPostulacion }
 * @returns {Object} Resultado de la evaluación:
 *   - permitido: boolean
 *   - code: string (uno de: ACTIVE_APPLICATION, ALREADY_HIRED, COOLDOWN_ACTIVE, OK)
 *   - razon: string legible para el usuario
 *   - Datos adicionales según el caso (postulacion_activa, dias_restantes, etc.)
 */
export const evaluarElegibilidad = (postulacionesPrevias = []) => {
  if (!Array.isArray(postulacionesPrevias) || postulacionesPrevias.length === 0) {
    return {
      permitido: true,
      code: "OK",
      razon: "Primera postulación: sin restricciones.",
      primera_postulacion: true,
      postulaciones_anteriores: 0,
    };
  }

  // 1) ¿Hay alguna postulación activa? Si sí, se bloquea con información clara.
  const activa = postulacionesPrevias.find((p) =>
    ESTADOS_ACTIVOS.includes(p.estado),
  );
  if (activa) {
    return {
      permitido: false,
      code: "ACTIVE_APPLICATION",
      razon: `Ya tiene una postulación activa en estado "${activa.estado}" para el cargo "${activa.cargo}" en ${activa.empresaPostula}. Espere la respuesta de Gestión Humana antes de aplicar nuevamente.`,
      postulacion_activa: {
        id: activa.id,
        estado: activa.estado,
        empresa: activa.empresaPostula,
        cargo: activa.cargo,
        fecha: activa.fechaPostulacion,
      },
    };
  }

  // 2) Todas son cerradas. Tomamos la más reciente para aplicar cooldown.
  const ordenadas = ordenarPorFechaDesc(postulacionesPrevias);
  const ultima = ordenadas[0];

  // 3) Si fue contratado, no puede re-aplicar por flujo normal.
  if (ultima.estado === "Contratado") {
    return {
      permitido: false,
      code: "ALREADY_HIRED",
      razon: "Nuestro sistema indica que usted ya forma parte de nuestro equipo. Si considera que hay un error en este dato, por favor contacte a Gestión Humana.",
      ultima_postulacion: {
        id: ultima.id,
        estado: ultima.estado,
        empresa: ultima.empresaPostula,
        cargo: ultima.cargo,
        fecha: ultima.fechaPostulacion,
      },
    };
  }

  // 4) Aplicar cooldown según el estado de la última postulación cerrada.
  const diasCooldown = COOLDOWN_DIAS[ultima.estado];
  if (diasCooldown && Number.isFinite(diasCooldown)) {
    const fechaUltima = new Date(ultima.fechaPostulacion);
    const fechaHabilitacion = new Date(fechaUltima.getTime() + diasCooldown * MS_POR_DIA);
    const ahora = new Date();

    if (ahora < fechaHabilitacion) {
      const diasRestantes = Math.ceil(
        (fechaHabilitacion - ahora) / MS_POR_DIA,
      );
      return {
        permitido: false,
        code: "COOLDOWN_ACTIVE",
        razon: `Su última postulación fue marcada como "${ultima.estado}" el ${formatFechaLarga(ultima.fechaPostulacion)}. Podrá volver a postularse a partir del ${formatFechaLarga(fechaHabilitacion.toISOString())} (faltan ${diasRestantes} días).`,
        cooldown_hasta: fechaHabilitacion.toISOString(),
        dias_restantes: diasRestantes,
        ultima_postulacion: {
          id: ultima.id,
          estado: ultima.estado,
          empresa: ultima.empresaPostula,
          cargo: ultima.cargo,
          fecha: ultima.fechaPostulacion,
        },
      };
    }
  }

  // 5) Pasó todos los filtros: puede postularse, pero es una re-postulación.
  return {
    permitido: true,
    code: "OK",
    razon: "Puede postularse. Esta es una re-postulación.",
    repostulacion: true,
    postulaciones_anteriores: postulacionesPrevias.length,
    ultima_postulacion: {
      id: ultima.id,
      estado: ultima.estado,
      empresa: ultima.empresaPostula,
      cargo: ultima.cargo,
      fecha: ultima.fechaPostulacion,
    },
  };
};

/**
 * Selecciona, de una lista de postulaciones, la más relevante para flujos
 * que asumen "una postulación por persona" (ej: agendamiento de entrevista).
 * Prioriza la postulación activa más reciente; si no hay activas, devuelve
 * la más reciente en general.
 */
export const seleccionarPostulacionRelevante = (postulaciones = []) => {
  if (!Array.isArray(postulaciones) || postulaciones.length === 0) return null;
  const ordenadas = ordenarPorFechaDesc(postulaciones);
  const activa = ordenadas.find((p) => ESTADOS_ACTIVOS.includes(p.estado));
  return activa || ordenadas[0];
};
