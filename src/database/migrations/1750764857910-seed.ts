import { MigrationInterface, QueryRunner } from "typeorm";

export class Seed1750764857910 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // This is how to insert test seed data
        if( process.env.NODE_ENV === 'test' ) {
            await queryRunner.query(`INSERT INTO users (username, email, firstName, lastName, password, roles, status, balance) VALUES ('admin', 'admin@example.com', 'Admin', 'User', 'password', 'ADMIN', 'active', 1000)`);
            await queryRunner.query(`INSERT INTO users (username, email, firstName, lastName, password, roles, status, balance) VALUES ('moderator', 'moderator@example.com', 'Moderator', 'User', 'password', 'MODERATOR', 'active', 1000)`);
            await queryRunner.query(`INSERT INTO users (username, email, firstName, lastName, password, roles, status, balance) VALUES ('user', 'user@example.com', 'User', 'User', 'password', 'USER', 'active', 1000)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
