import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from '../../src/transactions/transactions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import {
  Transaction,
  TransactionType,
} from '../../src/transactions/entities/transaction.entity';
import { User } from '../../src/users/entities/user.entity';
import { CreateTransactionDto } from '../../src/transactions/dto/create-transaction.dto';
import appConfig, { Environment } from '../../src/config/app.config';
import Decimal from 'decimal.js';

const mockTransactionsRepository = () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
});

const mockDataSource = () => ({
  createQueryRunner: jest.fn(),
});

const mockQueryRunner = () => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  manager: {
    findOne: jest.fn(),
    save: jest.fn(),
  },
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
});

describe('TransactionsService', () => {
  let service: TransactionsService;
  let transactionsRepository;
  let dataSource;
  let queryRunner;
  let config;

  beforeEach(async () => {
    transactionsRepository = mockTransactionsRepository();
    dataSource = mockDataSource();
    queryRunner = mockQueryRunner();
    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    config = { env: Environment.Test };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionsRepository,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: appConfig.KEY, useValue: config },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe('create', () => {
    it('should create a transaction and update user balance', async () => {
      const userId = 'user-1';
      const transactionId = '123e4567-e89b-12d3-a456-426614174000';
      const createTransactionDto: CreateTransactionDto = {
        id: transactionId,
        amount: '100',
        type: TransactionType.DEPOSIT,
      } as any;
      const transaction = { ...createTransactionDto, userId };
      const user = { id: userId, balance: '200' };

      transactionsRepository.create.mockReturnValue(transaction);
      queryRunner.manager.findOne.mockResolvedValue(user);
      queryRunner.manager.save.mockResolvedValueOnce(user); // for user
      queryRunner.manager.save.mockResolvedValueOnce(transaction); // for transaction

      const result = await service.create(userId, createTransactionDto);

      expect(transactionsRepository.create).toHaveBeenCalledWith({
        ...createTransactionDto,
        id: transactionId,
        userId,
      });
      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(User, {
        where: { id: userId },
      });
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ id: userId }),
      );
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        Transaction,
        transaction,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual(transaction);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      const userId = 'non-existent-user';
      const transactionId = '123e4567-e89b-12d3-a456-426614174000';
      const createTransactionDto: CreateTransactionDto = {
        id: transactionId,
        amount: '100',
        type: TransactionType.DEPOSIT,
      } as any;
      const transaction = { ...createTransactionDto, userId };

      transactionsRepository.create.mockReturnValue(transaction);
      queryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.create(userId, createTransactionDto),
      ).rejects.toThrow('User not found');

      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(User, {
        where: { id: userId },
      });
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should return existing transaction if transaction with same ID already exists', async () => {
      const userId = 'user-1';
      const transactionId = '123e4567-e89b-12d3-a456-426614174000';
      const createTransactionDto: CreateTransactionDto = {
        id: transactionId,
        amount: '100',
        type: TransactionType.DEPOSIT,
      } as any;
      const transaction = { ...createTransactionDto, userId };
      const user = { id: userId, balance: '200' };
      const existingTransaction = { ...transaction, status: 'completed' };

      transactionsRepository.create.mockReturnValue(transaction);
      queryRunner.manager.findOne.mockResolvedValue(user);
      // Simulate unique constraint error
      const error = new Error() as any;
      error.code = '23505';
      error.constraint = 'transactions_pkey_id';
      queryRunner.manager.save.mockImplementationOnce(() => {
        throw error;
      });
      transactionsRepository.findOne.mockResolvedValue(existingTransaction);

      const result = await service.create(userId, createTransactionDto);

      expect(transactionsRepository.create).toHaveBeenCalledWith({
        ...createTransactionDto,
        id: transactionId,
        userId,
      });
      expect(transactionsRepository.findOne).toHaveBeenCalledWith({
        where: { id: transactionId },
        relations: ['user'],
      });
      expect(result).toEqual(existingTransaction);
    });
  });
});
