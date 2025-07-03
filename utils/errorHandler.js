// backend/utils/errorHandler.js
export const handleError = (res, message, error, status = 500) => {
    console.error(`${message}:`, error.message, error.details || error.hint);
    return res.status(status).json({
        success: false,
        message,
        error: error.message,
        details: error.details || null, // Asegura que details no sea undefined
        hint: error.hint || null       // Asegura que hint no sea undefined
    });
};