import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Transaction,
  TransactionAttribute,
  TransactionType,
} from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PagedResult } from '../utils/api';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import appConfig, { Environment } from '../config/app.config';
import { ConfigType } from '@nestjs/config';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private dataSource: DataSource,
    @Inject(appConfig.KEY)
    private config: ConfigType<typeof appConfig>,
  ) {}

  async create(
    userId: string,
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    await this.checkReversal(createTransactionDto);

    const transaction = this.transactionsRepository.create({
      ...createTransactionDto,
      id: createTransactionDto.id || uuidv4(),
      userId,
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    // we're using sqlite for tests which doesn't support REPEATABLE READ isolation level
    // ideally we should be testing this with postgres
    if (this.config.env === Environment.Test)
      await queryRunner.startTransaction('SERIALIZABLE');
    else await queryRunner.startTransaction('REPEATABLE READ');

    try {
      // fetch user inside transaction to get latest balance and lock user row
      const currentUser = await queryRunner.manager.findOne(User, {
        where: { id: userId },
      });

      if (!currentUser) {
        throw new NotFoundException('User not found');
      }

      const currentBalance = new Decimal(currentUser.balance);
      const transactionAmount = new Decimal(transaction.amount);

      // Validate withdrawal amount with fresh user data
      if (transaction.type === TransactionType.WITHDRAWAL) {
        if (currentBalance.lessThan(transactionAmount)) {
          throw new BadRequestException('Insufficient balance');
        }
      }

      if (
        transaction.type === TransactionType.DEPOSIT ||
        transaction.type === TransactionType.REVERSAL
      ) {
        currentUser.balance = currentBalance.plus(transactionAmount).toString();
      } else {
        currentUser.balance = currentBalance
          .minus(transactionAmount)
          .toString();
      }

      await queryRunner.manager.save(User, currentUser);
      await queryRunner.manager.save(Transaction, transaction);

      await queryRunner.commitTransaction();
      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // Check if this is a unique constraint error on the transaction ID
      if (error.code === '23505' && error.constraint?.includes('id')) {
        // This is a duplicate transaction ID, return the existing transaction
        const existingTransaction = await this.transactionsRepository.findOne({
          where: { id: transaction.id },
          relations: ['user'],
        });

        if (existingTransaction) {
          return existingTransaction;
        }
      }

      if (error instanceof BadRequestException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Failed to process ${transaction.type}`);
    } finally {
      await queryRunner.release();
    }
  }

  private async checkReversal(
    createTransactionDto: CreateTransactionDto,
  ): Promise<void> {
    // Check if reversal amount matches the original transaction amount
    if (createTransactionDto.type === TransactionType.REVERSAL) {
      const originalTransaction = await this.transactionsRepository.findOne({
        where: { id: createTransactionDto.reversalOf },
        select: ['amount'],
      });

      if (!originalTransaction) {
        throw new NotFoundException('Original transaction not found');
      }

      // Compare using Decimal.js for numeric equality
      if (
        !new Decimal(originalTransaction.amount).equals(
          new Decimal(createTransactionDto.amount),
        )
      ) {
        throw new BadRequestException(
          'Reversal amount does not match original transaction amount',
        );
      }
    }
  }

  async findOne(id: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async list(
    page: number,
    limit: number,
    sort: TransactionAttribute,
    order: 'ASC' | 'DESC',
    userId?: string,
  ): Promise<PagedResult<Transaction>> {
    const queryBuilder =
      this.transactionsRepository.createQueryBuilder('transaction');

    if (userId) {
      queryBuilder.where('transaction.userId = :userId', { userId });
    }

    // Counting total transactions is not efficient, assuming we can afford it for now
    const [transactions, total] = await queryBuilder
      .orderBy(`transaction.${sort}`, order)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
