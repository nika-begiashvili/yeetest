import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IsUUID } from 'class-validator';
import { Transaction } from '../../transactions/entities/transaction.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export enum UserStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  BLOCKED = 'blocked',
  DELETED = 'deleted',
}

export enum UserAttribute {
  id = 'id',
  createdAt = 'createdAt',
  updatedAt = 'updatedAt',
  status = 'status',
  balance = 'balance',
}

@Entity('users')
@Index(['username'], { unique: true })
@Index(['email'], { unique: true })
@Index(['createdAt'])
export class User {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The unique identifier of the user',
  })
  @PrimaryGeneratedColumn('uuid')
  @IsUUID(4, { message: 'ID must be a valid UUID v4' })
  id: string;

  @ApiProperty({ example: 'john_doe', description: 'The username of the user' })
  @Column({ unique: true })
  username: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'The email of the user',
  })
  @Column({ unique: true, nullable: true })
  email: string;

  @ApiProperty({ example: 'John', description: 'The first name of the user' })
  @Column()
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'The last name of the user' })
  @Column()
  lastName: string;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'When the user was created',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'When the user was last updated',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @Exclude()
  @Column()
  password: string;

  @Column({
    type: 'simple-array',
  })
  roles: UserRole[];

  @Column({ type: 'simple-enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: string;

  // Relationships
  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];
}
