import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
  MAX_FILE_SIZE: Joi.number().default(10485760), // 10MB in bytes
  JWT_SECRET: Joi.string().default('your-secret-key-change-in-production'),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  DISABLE_AUTH: Joi.boolean().default(false),
});

