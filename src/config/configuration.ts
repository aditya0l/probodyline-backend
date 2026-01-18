export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  fileUpload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ],
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  auth: {
    disabled: process.env.DISABLE_AUTH === 'true',
  },
});
