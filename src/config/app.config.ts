import { registerAs } from '@nestjs/config';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Local = 'local',
}

const getEnvironment = (): Environment => {
  const nodeEnv = process.env.NODE_ENV;

  if (!nodeEnv) {
    return Environment.Local;
  }

  if (Object.values(Environment).includes(nodeEnv as Environment)) {
    return nodeEnv as Environment;
  }

  return Environment.Local;
};

export default registerAs('app', () => {
  return {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    env: getEnvironment(),
    jwtSecret:
      process.env.JWT_SECRET ||
      (() => {
        throw new Error('JWT_SECRET is not set');
      })(),
    jwtExpiration: process.env.JWT_EXPIRATION || '1d',
  };
});
