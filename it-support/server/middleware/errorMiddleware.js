/**
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode >= 400 ? res.statusCode : 500;
  const isProd = process.env.NODE_ENV === 'production';

  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);

  // Distinguish 404 from real errors
  let message;
  if (statusCode === 404) {
    message = `Not Found — ${req.originalUrl}`;
  } else if (isProd) {
    message = 'حدث خطأ داخلي.';
  } else {
    message = err.message || 'حدث خطأ داخلي.';
  }

  res.status(statusCode).json({
    message,
    ...(isProd ? {} : { stack: err.stack }),
  });
};

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};
