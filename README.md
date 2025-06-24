# NestJS Project

A complete NestJS boilerplate application with OpenAPI documentation, TypeORM database integration, and comprehensive testing setup using Jest and Supertest.

## Stack

- **NestJS Framework** - Event though it's a small project I wanted to showcase how good initial design can support scaling to
    larger project, that's the primary reason I chose nestjs, it has declarative api, provides dependency injection, configuration
    management, modules and nice integration with other tools
- **OpenAPI/Swagger** - With Nestjs integration I was able to provide code first approach to openapi docs, all information is 
    declared on controller itself resulting in nice single source of truth
- **TypeORM** - Unless there's specific reason to use raw database driver it's better to use some kind of abstraction, typeorm provides
    excelent type support which helps avoid mistakes, single source of entities, in-memory sqlite for testing and other features
- **Passport** - For implementing JWT Auth
- **Class Validator** - Is a great library for validating input/output and configuration

## Dev setup

1. Clone the repository and run docker compose:

```bash
# Build and start development services
docker-compose -f docker-compose.dev.yml up --build
```

This will run postgres and nodejs app also set all necessery env vars as well and automatically synchronize database schema
It will also mount your local source code and watch for file changes

### Environment Variables

```env
DATABASE_TYPE=postgres or sqlite
DATABASE_HOST=localhost
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=yeetest_dev
DATABASE_PORT=5432
DATABASE_SYNC_SCHEMA=true # should typeorm automatically sync database schema with connected database

PORT=3000
NODE_ENV=local
JWT_SECRET=dev-jwt-secret-key
```

### Migrations

Generate a migration:
```bash
npm run migration:generate -- src/database/migrations/MigrationName
```

Run migrations:
```bash
npm run migration:run
```

Revert migrations:
```bash
npm run migration:revert
```

## API Documentation

Once the application is running, you can access the Swagger UI at:
- **Local**: http://localhost:3000/api/docs

The API includes the following endpoints:

### Application Endpoints (/)
- `GET /` - Get hello message
- `GET /health` - Health check endpoint

### Authentication Endpoints (/auth)
- `POST /auth/login` - Login user and generate JWT token
- `POST /auth/register` - Register a new user and return JWT token  
- `GET /auth/profile` - Get current user profile (requires JWT authentication)

### Users Endpoints (/users)
All endpoints require JWT authentication and role-based authorization

- `POST /users` - Create a new user (ADMIN only)
- `GET /users` - List all users with pagination, sorting, and filtering (ADMIN, MODERATOR)
  - Query parameters: page, limit, sort, order
- `GET /users/:id` - Get a specific user by ID (ADMIN, MODERATOR)
- `PATCH /users/:id` - Update a user (ADMIN only)
- `DELETE /users/:id` - Delete a user (ADMIN only)

### Transactions Endpoints (/transactions) 
All endpoints require JWT authentication and role-based authorization

- `POST /transactions` - Create a new transaction (ADMIN only)
- `GET /transactions` - List all transactions with pagination, sorting, and filtering (ADMIN, MODERATOR)
  - Query parameters: page, limit, sort, order
- `GET /transactions/my` - Get current user's transactions with pagination (USER, ADMIN)
  - Query parameters: page, limit, sort, order
- `GET /transactions/:id` - Get a specific transaction by ID (ADMIN, MODERATOR)

## JWT Auth

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Three user roles (USER, MODERATOR, ADMIN)
- **Password Hashing**: Secure password storage using bcrypt
- **Protected Routes**: Different access levels for different endpoints using decorators

## Testing

The project uses in-memory sqlite for very fast tests it also makes running them very easy:

Make sure node modules are installed
```bash
npm i
```

### Unit Tests
```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:cov
```

### End-to-End Tests
```bash
# Run e2e tests
npm run test:e2e
```

### Test Structure
- Unit tests are located in `test/` directory with following suffix `.spec.ts`
- E2E tests are located in `test/` directory with following suffix `.e2e.spec.ts`
- Mocking is implemented for database operations in unit tests
- E2E tests use the actual application setup but with sqlite in-memory database

## Scripts

- `npm run prebuild` - Clean dist directory
- `npm run build` - Build the application using tsc
- `npm run format` - Format code using prettier
- `npm run start` - Start the application in production mode
- `npm run start:dev` - Start in development mode with hot reload
- `npm run start:debug` - Start in debug mode with --inspect flag
- `npm run start:prod` - Start from production build
- `npm run lint` - Run ESLint
- `npm run test` - Run jest unit tests in watch mode
- `npm run test:watch` - Run jest tests in watch mode
- `npm run test:cov` - Run jest tests with coverage
- `npm run test:debug` - Run tests in debug mode
- `npm run test:e2e` - Run end-to-end tests
- `npm run migration:generate` - Generate a new migration file
- `npm run migration:create` - Create a new empty migration file
- `npm run migration:run` - Run pending migrations
- `npm run migration:revert` - Revert last executed migration
- `npm run migration:show` - Show all migrations and their status
- `npm run schema:drop` - Drop all tables in database
- `npm run schema:sync` - Sync database schema with entities

## Development

### Adding a New Module

```bash
nest generate module <module-name>
nest generate controller <module-name>
nest generate service <module-name>
```

2. Create the entity in `src/<module-name>/entities/`
3. Create DTOs in `src/<module-name>/dto/`
4. Add the entity to the database configuration
5. Write unit and e2e tests

### Code Quality

The project includes:
- ESLint for code linting (TODO: linter errors aren't resolved)
- Prettier for code formatting
- TypeScript for type safety
- Class-validator for runtime validation
