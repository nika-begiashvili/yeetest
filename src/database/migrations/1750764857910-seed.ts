import * as bcrypt from 'bcryptjs';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Seed1750764857910 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // This is how to insert test seed data
    if (process.env.NODE_ENV === 'test') {

      const hashedPassword = await bcrypt.hash('password', 10);

      await queryRunner.query(
        `INSERT INTO users (username, email, "firstName", "lastName", password, roles, status, balance) VALUES ('admin', 'admin@example.com', 'Admin', 'User', '${hashedPassword}', 'ADMIN', 'active', 1000)`,
      );
      await queryRunner.query(
        `INSERT INTO users (username, email, "firstName", "lastName", password, roles, status, balance) VALUES ('moderator', 'moderator@example.com', 'Moderator', 'User', '${hashedPassword}', 'MODERATOR', 'active', 1000)`,
      );
      await queryRunner.query(
        `INSERT INTO users (username, email, "firstName", "lastName", password, roles, status, balance) VALUES ('user', 'user@example.com', 'User', 'User', '${hashedPassword}', 'USER', 'active', 1000)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
