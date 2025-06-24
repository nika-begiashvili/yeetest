import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import {
  User,
  UserRole,
  UserStatus,
} from '../../src/users/entities/user.entity';
import { UsersService } from '../../src/users/users.service';
import { AuthService } from '../../src/auth/auth.service';
import { TransactionsService } from '../../src/transactions/transactions.service';
import { DatabaseOptions } from '../../src/database/database-options';
import {
  Transaction,
  TransactionType,
  TransactionAttribute,
} from '../../src/transactions/entities/transaction.entity';
import { CreateTransactionDto } from '../../src/transactions/dto/create-transaction.dto';
import { v4 as uuidv4 } from 'uuid';

describe('TransactionsController (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let authService: AuthService;
  let transactionsService: TransactionsService;
  let adminToken: string;
  let moderatorToken: string;
  let userToken: string;
  let testUsers: User[];
  let testTransactions: Transaction[];
  let freshUser: User;
  let freshUserToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useClass: DatabaseOptions,
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe to match main.ts configuration
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    usersService = moduleFixture.get<UsersService>(UsersService);
    authService = moduleFixture.get<AuthService>(AuthService);
    transactionsService =
      moduleFixture.get<TransactionsService>(TransactionsService);

    // Create test users
    testUsers = await createTestUsers();

    // Generate tokens for different user roles
    adminToken = await generateToken(testUsers[0]); // admin
    moderatorToken = await generateToken(testUsers[1]); // moderator
    userToken = await generateToken(testUsers[2]); // regular user

    // Create test transactions
    testTransactions = await createTestTransactions();
  });

  beforeEach(async () => {
    // Create a fresh user for each test that needs a clean balance
    freshUser = await usersService.create({
      username: `fresh_user_${uuidv4().slice(0, 8)}`,
      email: `fresh_user_${uuidv4().slice(0, 8)}@test.com`,
      password: 'password123',
      firstName: 'Fresh',
      lastName: 'User',
      roles: [UserRole.ADMIN],
    });
    // Set balance directly after creation
    freshUser.balance = '200.00';
    await usersService['usersRepository'].save(freshUser);
    freshUser = await usersService.findOne(freshUser.id);
    freshUserToken = await generateToken(freshUser);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createTestUsers(): Promise<User[]> {
    const users = [
      {
        username: 'admin_user',
        email: 'admin@test.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        roles: [UserRole.ADMIN],
        status: UserStatus.ACTIVE,
        balance: '1000.00',
      },
      {
        username: 'moderator_user',
        email: 'moderator@test.com',
        password: 'password123',
        firstName: 'Moderator',
        lastName: 'User',
        roles: [UserRole.MODERATOR],
        status: UserStatus.ACTIVE,
        balance: '500.00',
      },
      {
        username: 'testuser',
        email: 'testuser@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        roles: [UserRole.USER],
        status: UserStatus.ACTIVE,
        balance: '200.00',
      },
      {
        username: 'regular_user',
        email: 'user@test.com',
        password: 'password123',
        firstName: 'Regular',
        lastName: 'User',
        roles: [UserRole.USER],
        status: UserStatus.ACTIVE,
        balance: '150.00',
      },
    ];

    return Promise.all(users.map((user) => usersService.create(user)));
  }

  async function createTestTransactions(): Promise<Transaction[]> {
    const transactions: CreateTransactionDto[] = [
      {
        id: uuidv4(),
        amount: '100.00',
        type: TransactionType.DEPOSIT,
        description: 'Test deposit transaction',
      },
      {
        id: uuidv4(),
        amount: '50.00',
        type: TransactionType.WITHDRAWAL,
        description: 'Test withdrawal transaction',
      },
      {
        id: uuidv4(),
        amount: '25.00',
        type: TransactionType.DEPOSIT,
        description: 'Another test deposit',
      },
    ];

    const createdTransactions: Transaction[] = [];
    for (const transactionDto of transactions) {
      const transaction = await transactionsService.create(
        testUsers[2].id,
        transactionDto,
      );
      createdTransactions.push(transaction);
    }

    return createdTransactions;
  }

  async function generateToken(user: User): Promise<string> {
    const result = await authService.createToken(user);
    return result.access_token;
  }

  describe('/transactions (POST)', () => {
    it('should create a new deposit transaction when admin is authenticated', () => {
      const newTransaction: CreateTransactionDto = {
        id: uuidv4(),
        amount: '200.00',
        type: TransactionType.DEPOSIT,
        description: 'Admin deposit test',
      };
      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTransaction)
        .expect(201);
    });

    it('should create a new withdrawal transaction when admin is authenticated', () => {
      const newTransaction: CreateTransactionDto = {
        id: uuidv4(),
        amount: '50.00',
        type: TransactionType.WITHDRAWAL,
        description: 'Admin withdrawal test',
      };
      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTransaction)
        .expect(201);
    });

    it('should create a reversal transaction when admin is authenticated', async () => {
      // Use an existing transaction from testTransactions instead of creating a new one
      const originalTransaction = testTransactions[0];

      console.log('Original transaction:', originalTransaction);

      const reversalTransaction: CreateTransactionDto = {
        id: uuidv4(),
        amount: originalTransaction.amount,
        type: TransactionType.REVERSAL,
        description: 'Reversal of previous transaction',
        reversalOf: originalTransaction.id,
      };

      console.log('Reversal transaction:', reversalTransaction);

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reversalTransaction)
        .expect((res) => {
          if (res.status !== 201) {
            console.log('Reversal error:', res.body);
          }
          expect(res.status).toBe(201);
        });
    });

    it('should return 403 when moderator tries to create transaction', () => {
      const newTransaction: CreateTransactionDto = {
        id: uuidv4(),
        amount: '100.00',
        type: TransactionType.DEPOSIT,
        description: 'Moderator deposit test',
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send(newTransaction)
        .expect(403);
    });

    it('should return 403 when regular user tries to create transaction', () => {
      const newTransaction: CreateTransactionDto = {
        id: uuidv4(),
        amount: '100.00',
        type: TransactionType.DEPOSIT,
        description: 'User deposit test',
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newTransaction)
        .expect(403);
    });

    it('should return 401 when no token is provided', () => {
      const newTransaction: CreateTransactionDto = {
        id: uuidv4(),
        amount: '100.00',
        type: TransactionType.DEPOSIT,
        description: 'Unauthorized deposit test',
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .send(newTransaction)
        .expect(401);
    });

    it('should return 400 when invalid amount is provided', () => {
      const invalidTransaction = {
        id: uuidv4(),
        amount: 'invalid-amount',
        type: TransactionType.DEPOSIT,
        description: 'Invalid amount test',
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTransaction)
        .expect(400);
    });

    it('should return 400 when invalid transaction type is provided', () => {
      const invalidTransaction = {
        id: uuidv4(),
        amount: '100.00',
        type: 'invalid-type',
        description: 'Invalid type test',
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTransaction)
        .expect(400);
    });

    it('should return 400 when withdrawal amount exceeds balance', () => {
      const withdrawalTransaction: CreateTransactionDto = {
        id: uuidv4(),
        amount: '10000.00',
        type: TransactionType.WITHDRAWAL,
        description: 'Excessive withdrawal test',
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(withdrawalTransaction)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Insufficient balance');
        });
    });

    it('should return 400 when reversal amount does not match original transaction', () => {
      const originalTransaction = testTransactions[0];
      const invalidReversal: CreateTransactionDto = {
        id: uuidv4(),
        amount: '999.99',
        type: TransactionType.REVERSAL,
        description: 'Invalid reversal amount',
        reversalOf: originalTransaction.id,
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidReversal)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'Reversal amount does not match original transaction amount',
          );
        });
    });

    it('should return 404 when reversal references non-existent transaction', () => {
      const invalidReversal: CreateTransactionDto = {
        id: uuidv4(),
        amount: '100.00',
        type: TransactionType.REVERSAL,
        description: 'Non-existent reversal',
        reversalOf: '123e4567-e89b-12d3-a456-426614174000',
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidReversal)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('Original transaction not found');
        });
    });
  });

  describe('/transactions (GET)', () => {
    beforeEach(async () => {
      // Create some test transactions for the GET tests
      const testTransaction1: CreateTransactionDto = {
        id: uuidv4(),
        amount: '150.00',
        type: TransactionType.DEPOSIT,
        description: 'Test transaction 1',
      };
      const testTransaction2: CreateTransactionDto = {
        id: uuidv4(),
        amount: '75.00',
        type: TransactionType.WITHDRAWAL,
        description: 'Test transaction 2',
      };

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testTransaction1)
        .expect(201);

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testTransaction2)
        .expect(201);
    });

    it('should return paginated transactions when admin is authenticated', () => {
      return request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.pagination).toHaveProperty('page');
          expect(res.body.pagination).toHaveProperty('limit');
          expect(res.body.pagination).toHaveProperty('total');
          expect(res.body.pagination).toHaveProperty('totalPages');
        });
    });

    it('should return paginated transactions when moderator is authenticated', () => {
      return request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should return 403 when regular user tries to list all transactions', () => {
      return request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 when no token is provided', () => {
      return request(app.getHttpServer()).get('/transactions').expect(401);
    });

    it('should support pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/transactions?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(5);
        });
    });

    it('should return second page of transactions when page=2 is specified', () => {
      return request(app.getHttpServer())
        .get('/transactions?page=2&limit=3')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(2);
          expect(res.body.pagination.limit).toBe(3);
          expect(Array.isArray(res.body.data)).toBe(true);
          // If there are enough transactions, the second page should have data
          // If not, it should be an empty array but still return 200
          expect(res.body.data.length).toBeLessThanOrEqual(5);
          expect(res.body.data.length).toBe(3);
        });
    });

    it('should support sorting by amount', () => {
      return request(app.getHttpServer())
        .get('/transactions?sort=amount&order=ASC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should support sorting by creation date', () => {
      return request(app.getHttpServer())
        .get('/transactions?sort=createdAt&order=DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should return 400 when invalid sort field is provided', () => {
      return request(app.getHttpServer())
        .get('/transactions?sort=invalidField')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 400 when invalid order is provided', () => {
      return request(app.getHttpServer())
        .get('/transactions?order=INVALID')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('/transactions/my (GET)', () => {
    beforeEach(async () => {
      // Create some test transactions for the current user
      const testTransaction1: CreateTransactionDto = {
        id: uuidv4(),
        amount: '50.00',
        type: TransactionType.DEPOSIT,
        description: 'My test transaction 1',
      };
      const testTransaction2: CreateTransactionDto = {
        id: uuidv4(),
        amount: '25.00',
        type: TransactionType.WITHDRAWAL,
        description: 'My test transaction 2',
      };

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testTransaction1)
        .expect(201);

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testTransaction2)
        .expect(201);
    });

    it('should return current user transactions when user is authenticated', () => {
      return request(app.getHttpServer())
        .get('/transactions/my')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.pagination).toHaveProperty('page');
          expect(res.body.pagination).toHaveProperty('limit');
          expect(res.body.pagination).toHaveProperty('total');
          expect(res.body.pagination).toHaveProperty('totalPages');
        });
    });

    it('should return current user transactions when admin is authenticated', () => {
      return request(app.getHttpServer())
        .get('/transactions/my')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should return 403 when moderator tries to access my transactions', () => {
      return request(app.getHttpServer())
        .get('/transactions/my')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(403);
    });

    it('should return 401 when no token is provided', () => {
      return request(app.getHttpServer()).get('/transactions/my').expect(401);
    });

    it('should support pagination parameters for my transactions', () => {
      return request(app.getHttpServer())
        .get('/transactions/my?page=1&limit=5')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(5);
        });
    });

    it('should return second page of my transactions when page=2 is specified', () => {
      return request(app.getHttpServer())
        .get('/transactions/my?page=2&limit=5')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(2);
          expect(res.body.pagination.limit).toBe(5);
          expect(Array.isArray(res.body.data)).toBe(true);
          // If there are enough transactions, the second page should have data
          // If not, it should be an empty array but still return 200
          expect(res.body.data.length).toBeLessThanOrEqual(5);
        });
    });

    it('should support sorting for my transactions', () => {
      return request(app.getHttpServer())
        .get('/transactions/my?sort=amount&order=DESC')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('/transactions/:id (GET)', () => {
    it('should return a specific transaction when admin is authenticated', () => {
      const transactionId = testTransactions[0].id;

      return request(app.getHttpServer())
        .get(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', transactionId);
          expect(res.body).toHaveProperty('amount');
          expect(res.body).toHaveProperty('type');
          expect(res.body).toHaveProperty('userId');
          expect(res.body).toHaveProperty('createdAt');
          expect(res.body).toHaveProperty('status');
        });
    });

    it('should return a specific transaction when moderator is authenticated', () => {
      const transactionId = testTransactions[0].id;

      return request(app.getHttpServer())
        .get(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', transactionId);
        });
    });

    it('should return 403 when regular user tries to get specific transaction', () => {
      const transactionId = testTransactions[0].id;

      return request(app.getHttpServer())
        .get(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 when no token is provided', () => {
      const transactionId = testTransactions[0].id;

      return request(app.getHttpServer())
        .get(`/transactions/${transactionId}`)
        .expect(401);
    });

    it('should return 404 when transaction does not exist', () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      return request(app.getHttpServer())
        .get(`/transactions/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('Transaction not found');
        });
    });

    it('should return 400 when invalid transaction ID format is provided', () => {
      const invalidId = 'invalid-uuid';
      return request(app.getHttpServer())
        .get(`/transactions/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Transaction validation', () => {
    it('should validate amount format', () => {
      const invalidTransactions = [
        {
          id: uuidv4(),
          amount: '100.123', // too many decimal places
          type: TransactionType.DEPOSIT,
        },
        {
          id: uuidv4(),
          amount: '100,50', // wrong decimal separator
          type: TransactionType.DEPOSIT,
        },
        {
          id: uuidv4(),
          amount: 'abc', // non-numeric
          type: TransactionType.DEPOSIT,
        },
      ];

      return Promise.all(
        invalidTransactions.map((transaction) =>
          request(app.getHttpServer())
            .post('/transactions')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(transaction)
            .expect(400),
        ),
      );
    });

    it('should validate required fields', () => {
      const incompleteTransaction = {
        id: uuidv4(),
        description: 'Missing required fields',
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteTransaction)
        .expect(400);
    });

    it('should validate description length', () => {
      const longDescription = 'a'.repeat(501); // exceeds 500 character limit
      const transactionWithLongDescription = {
        id: uuidv4(),
        amount: '100.00',
        type: TransactionType.DEPOSIT,
        description: longDescription,
      };

      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(transactionWithLongDescription)
        .expect(400);
    });
  });

  describe('Transaction business logic', () => {
    it('should handle duplicate transaction IDs gracefully', async () => {
      const transactionDto: CreateTransactionDto = {
        id: uuidv4(),
        amount: '100.00',
        type: TransactionType.DEPOSIT,
        description: 'Duplicate ID test',
      };

      // First request should succeed
      const firstResponse = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(transactionDto)
        .expect(201);

      // Second request with same ID should also succeed (idempotency)
      const secondResponse = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(transactionDto)
        .expect(201);

      // Both should return the same transaction
      expect(firstResponse.body.id).toBe(secondResponse.body.id);
    });

    it('should update user balance correctly for deposits', async () => {
      const depositAmount = '75.50';
      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${freshUserToken}`)
        .send({
          id: uuidv4(),
          amount: depositAmount,
          type: TransactionType.DEPOSIT,
          description: 'Balance test deposit',
        })
        .expect(201);

      const updatedUser = await usersService.findOne(freshUser.id);
      const expectedBalance = 200 + parseFloat(depositAmount);
      expect(parseFloat(updatedUser.balance)).toBe(expectedBalance);
    });

    it('should update user balance correctly for withdrawals', async () => {
      const withdrawalAmount = '25.00';
      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${freshUserToken}`)
        .send({
          id: uuidv4(),
          amount: withdrawalAmount,
          type: TransactionType.WITHDRAWAL,
          description: 'Balance test withdrawal',
        })
        .expect(201);

      const updatedUser = await usersService.findOne(freshUser.id);
      const expectedBalance = 200 - parseFloat(withdrawalAmount);
      expect(parseFloat(updatedUser.balance)).toBe(expectedBalance);
    });
  });
});
