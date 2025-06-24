import { registerAs } from '@nestjs/config';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Local = 'local',
}

export default registerAs('app', () => ({
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  env: process.env.NODE_ENV || Environment.Local,
  jwtSecret:
    process.env.JWT_SECRET ||
    (() => {
      throw new Error('JWT_SECRET is not set');
    })(),
  jwtExpiration: process.env.JWT_EXPIRATION || '1d',
}));
