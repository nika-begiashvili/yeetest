import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import databaseConfig from '../config/database.config';
import appConfig, { Environment } from '../config/app.config';


export function getDatabaseOptions(dbConfig: ConfigType<typeof databaseConfig>, config: ConfigType<typeof appConfig>) {
  return {
    type: dbConfig.type,
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    synchronize: dbConfig.synchronize,
    logging: config.env === Environment.Development,
    dropSchema: config.env === Environment.Test,
    entities: ['dist/**/**/*.entity{.ts,.js}'],
    migrations: ['dist/database/migrations/*{.ts,.js}'],
    autoLoadEntities: true,
  };
}

@Injectable()
export class DatabaseOptions implements TypeOrmOptionsFactory {
  constructor(
    @Inject(databaseConfig.KEY)
    private dbConfig: ConfigType<typeof databaseConfig>,
    @Inject(appConfig.KEY)
    private config: ConfigType<typeof appConfig>,
  ) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return getDatabaseOptions(this.dbConfig, this.config);
  }
}
