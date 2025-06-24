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
import { DatabaseOptions } from '../../src/database/database-options';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let authService: AuthService;
  let adminToken: string;
  let moderatorToken: string;
  let userToken: string;
  let testUsers: User[];

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

    // Create test users
    testUsers = await createTestUsers();

    // Generate tokens for different user roles
    adminToken = await generateToken(testUsers[0]); // admin
    moderatorToken = await generateToken(testUsers[1]); // moderator
    userToken = await generateToken(testUsers[3]); // regular user
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
      },
      {
        username: 'moderator_user',
        email: 'moderator@test.com',
        password: 'password123',
        firstName: 'Moderator',
        lastName: 'User',
        roles: [UserRole.MODERATOR],
        status: UserStatus.ACTIVE,
      },
      {
        username: 'testuser',
        email: 'testuser@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        roles: [UserRole.USER],
        status: UserStatus.ACTIVE,
      },
      {
        username: 'regular_user',
        email: 'user@test.com',
        password: 'password123',
        firstName: 'Regular',
        lastName: 'User',
        roles: [UserRole.USER],
        status: UserStatus.ACTIVE,
      },
    ];

    return Promise.all(users.map((user) => usersService.create(user)));
  }

  async function generateToken(user: User): Promise<string> {
    const result = await authService.createToken(user);
    return result.access_token;
  }

  describe('/users (POST)', () => {
    it('should create a new user when admin is authenticated', () => {
      const newUser = {
        username: 'uniqueuser',
        email: 'uniqueuser@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.username).toBe(newUser.username);
          expect(res.body.email).toBe(newUser.email);
          expect(res.body.firstName).toBe(newUser.firstName);
          expect(res.body.lastName).toBe(newUser.lastName);
          expect(res.body).toHaveProperty('roles');
          expect(res.body).toHaveProperty('status');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should return 403 when moderator tries to create user', () => {
      const newUser = {
        username: 'newuser2',
        email: 'newuser2@test.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };

      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send(newUser)
        .expect(403);
    });

    it('should return 401 when no token is provided', () => {
      const newUser = {
        username: 'newuser3',
        email: 'newuser3@test.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };

      return request(app.getHttpServer())
        .post('/users')
        .send(newUser)
        .expect(401);
    });

    it('should return 400 when invalid data is provided', () => {
      const invalidUser = {
        username: 'ab', // too short
        email: 'invalid-email',
        password: '123', // too short
      };

      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUser)
        .expect(400);
    });
  });

  describe('/users (GET)', () => {
    it('should return paginated users when admin is authenticated', () => {
      return request(app.getHttpServer())
        .get('/users')
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

    it('should return paginated users when moderator is authenticated', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should return 403 when regular user tries to list users', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 when no token is provided', () => {
      return request(app.getHttpServer()).get('/users').expect(401);
    });

    it('should handle pagination parameters correctly', () => {
      return request(app.getHttpServer())
        .get('/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(2);
          expect(res.body.data.length).toBeLessThanOrEqual(2);
        });
    });

    it('should handle sorting parameters correctly', () => {
      return request(app.getHttpServer())
        .get('/users?sort=createdAt&order=DESC')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThan(0);
          if (res.body.data.length > 1) {
            const firstDate = new Date(res.body.data[0].createdAt);
            const secondDate = new Date(res.body.data[1].createdAt);
            expect(firstDate.getTime()).toBeGreaterThanOrEqual(
              secondDate.getTime(),
            );
          }
        });
    });
  });

  describe('/users/:id (GET)', () => {
    it('should return a user by id when admin is authenticated', () => {
      const userId = testUsers[0].id;

      return request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(userId);
          expect(res.body).toHaveProperty('username');
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('firstName');
          expect(res.body).toHaveProperty('lastName');
          expect(res.body).toHaveProperty('roles');
          expect(res.body).toHaveProperty('status');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should return a user by id when moderator is authenticated', () => {
      const userId = testUsers[1].id;

      return request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(userId);
        });
    });

    it('should return 403 when regular user tries to get user by id', () => {
      const userId = testUsers[0].id;

      return request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 when no token is provided', () => {
      const userId = testUsers[0].id;

      return request(app.getHttpServer()).get(`/users/${userId}`).expect(401);
    });

    it('should return 404 when user does not exist', () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      return request(app.getHttpServer())
        .get(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 400 when invalid id format is provided', () => {
      return request(app.getHttpServer())
        .get('/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('/users/:id (PATCH)', () => {
    it('should update a user when admin is authenticated', () => {
      const userId = testUsers[2].id;
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@test.com',
        status: UserStatus.PENDING,
        roles: [UserRole.USER, UserRole.MODERATOR],
      };

      return request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(userId);
          expect(res.body.firstName).toBe(updateData.firstName);
          expect(res.body.lastName).toBe(updateData.lastName);
          expect(res.body.email).toBe(updateData.email);
          expect(res.body.status).toBe(updateData.status);
          expect(res.body.roles).toEqual(updateData.roles);
        });
    });

    it('should return 403 when moderator tries to update user', () => {
      const userId = testUsers[2].id;
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      return request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 403 when regular user tries to update user', () => {
      const userId = testUsers[2].id;
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      return request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 401 when no token is provided', () => {
      const userId = testUsers[2].id;
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      return request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .send(updateData)
        .expect(401);
    });

    it('should return 404 when user does not exist', () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      return request(app.getHttpServer())
        .patch(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should return 400 when invalid data is provided', () => {
      const userId = testUsers[2].id;
      const invalidData = {
        email: 'invalid-email',
        status: 'invalid-status',
      };

      return request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);
    });

    it('should return 400 when invalid id format is provided', () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      return request(app.getHttpServer())
        .patch('/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);
    });
  });

  describe('/users/:id (DELETE)', () => {
    it('should delete a user when admin is authenticated', async () => {
      const userToDelete = await usersService.create({
        username: 'user_to_delete',
        email: 'delete@test.com',
        password: 'password123',
        firstName: 'Delete',
        lastName: 'User',
      });

      return request(app.getHttpServer())
        .delete(`/users/${userToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should return 403 when moderator tries to delete user', () => {
      const userId = testUsers[2].id;

      return request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .expect(403);
    });

    it('should return 403 when regular user tries to delete user', () => {
      const userId = testUsers[2].id;

      return request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 when no token is provided', () => {
      const userId = testUsers[2].id;

      return request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .expect(401);
    });

    it('should return 404 when user does not exist', () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      return request(app.getHttpServer())
        .delete(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 400 when invalid id format is provided', () => {
      return request(app.getHttpServer())
        .delete('/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests with invalid JWT token', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject requests with malformed Authorization header', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);
    });
  });
});
