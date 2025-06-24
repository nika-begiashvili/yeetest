import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  REVERSAL = 'reversal', // for reversing a transaction
}

export enum TransactionStatus {
  // PENDING = 'pending', pending status would be useful if we wanted to delay transaction processing
  // in case of micro-services or other distributed transaction cases
  COMPLETED = 'completed',
  // FAILED = 'failed', would be useful if we want to retry the transaction, or just keep track of failed transactions
}

export enum TransactionAttribute {
  id = 'id',
  createdAt = 'createdAt',
  amount = 'amount',
  type = 'type',
  userId = 'userId',
}

@Entity('transactions')
@Index(['userId'])
@Index(['createdAt'])
export class Transaction {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The unique identifier of the transaction',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'The ID of the transaction that this transaction is a reversal of',
  })
  @Column({ nullable: true })
  reversalOf: string;

  @ApiProperty({ example: 100.5, description: 'The amount of the transaction' })
  @Column({ type: 'decimal', precision: 10, scale: 2 }) // for crypto we're gonna need a different scale
  amount: string;

  @ApiProperty({
    example: 'deposit',
    description: 'The type of transaction',
    enum: TransactionType,
  })
  @Column({ type: 'simple-enum', enum: TransactionType })
  type: TransactionType;

  @ApiProperty({
    example: 'completed',
    description: 'The status of the transaction',
    enum: TransactionStatus,
  })
  @Column({
    type: 'simple-enum',
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @ApiProperty({
    example: 'Payment for services',
    description: 'Description of the transaction',
  })
  @Column({ nullable: true })
  description: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The ID of the user who made the transaction',
  })
  @Column()
  userId: string;

  @ApiProperty({
    example: '2023-01-01T00:00:00Z',
    description: 'When the transaction was created',
  })
  @CreateDateColumn()
  createdAt: Date;

  // Relationships
  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'userId' })
  user: User;
}
