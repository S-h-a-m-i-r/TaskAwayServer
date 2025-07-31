class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Convenience methods for common errors
export const createError = {
  badRequest: (message = 'Bad Request', details = null) => 
    new AppError(message, 400, details),
  
  unauthorized: (message = 'Unauthorized', details = null) => 
    new AppError(message, 401, details),
  
  forbidden: (message = 'Forbidden', details = null) => 
    new AppError(message, 403, details),
  
  notFound: (message = 'Not Found', details = null) => 
    new AppError(message, 404, details),
  
  conflict: (message = 'Conflict', details = null) => 
    new AppError(message, 409, details),
  
  validation: (message = 'Validation Failed', details = null) => 
    new AppError(message, 422, details),
  
  tooManyRequests: (message = 'Too Many Requests', details = null) => 
    new AppError(message, 429, details),
  
  internal: (message = 'Internal Server Error', details = null) => 
    new AppError(message, 500, details),
  
  serviceUnavailable: (message = 'Service Unavailable', details = null) => 
    new AppError(message, 503, details)
};

export default AppError; 