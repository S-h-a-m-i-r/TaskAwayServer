const errorHandler = (err, req, res, next) => {
  let status = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';
  let details = null;

  // Handle MongoDB/Mongoose errors
  if (err.name === 'MongoServerError') {
    switch (err.code) {
      case 11000: // Duplicate key error
        status = 409; // Conflict
        const field = Object.keys(err.keyPattern)[0];
        const value = err.keyValue[field];
        message = `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`;
        details = {
          field,
          value,
          code: 'DUPLICATE_KEY'
        };
        break;

      case 121: // Document validation failed
        status = 400;
        message = 'Document validation failed';
        details = {
          code: 'VALIDATION_ERROR',
          errors: err.errInfo?.details?.schemaRulesNotSatisfied
        };
        break;

      default:
        status = 400;
        message = 'Database operation failed';
        details = {
          code: err.code,
          message: err.message
        };
    }
  }

  // Handle Mongoose validation errors
  else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = {
      code: 'VALIDATION_ERROR',
      errors: Object.values(err.errors).map((error) => ({
        field: error.path,
        message: error.message,
        value: error.value
      }))
    };
  }

  // Handle Mongoose cast errors (invalid ObjectId, etc.)
  else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    details = {
      code: 'CAST_ERROR',
      field: err.path,
      value: err.value
    };
  }

  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
    details = {
      code: 'INVALID_TOKEN'
    };
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
    details = {
      code: 'TOKEN_EXPIRED'
    };
  }

  // Handle custom application errors
  else if (err.statusCode) {
    status = err.statusCode;
    message = err.message;
    if (err.details) {
      details = err.details;
    }
  }

  // Handle network/connection errors
  else if (err.code === 'ECONNREFUSED') {
    status = 503;
    message = 'Database connection failed';
    details = {
      code: 'DB_CONNECTION_ERROR'
    };
  }

  // Handle timeout errors
  else if (err.code === 'ETIMEDOUT') {
    status = 408;
    message = 'Request timeout';
    details = {
      code: 'TIMEOUT_ERROR'
    };
  }

  // Log error for debugging (in development)
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: status
    });
  }

  // Send error response
  const errorResponse = {
    success: false,
    message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      name: err.name,
      code: err.code
    })
  };

  res.status(status).json(errorResponse);
};

export default errorHandler;
