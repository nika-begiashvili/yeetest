import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ParseEnumPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  Transaction,
  TransactionAttribute,
} from './entities/transaction.entity';
import { PagedResult } from '../utils/api';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

class PagedTransactionResult extends PagedResult<Transaction> {}

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({
    status: 201,
    description: 'The transaction has been successfully created.',
    type: Transaction,
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  create(@Request() req, @Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.id, createTransactionDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'List all transactions' })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'sort',
    type: 'enum',
    required: false,
    description: 'Sort field',
    enum: TransactionAttribute,
  })
  @ApiQuery({
    name: 'order',
    type: 'enum',
    required: false,
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
  })
  @ApiExtraModels(PagedTransactionResult)
  @ApiResponse({
    status: 200,
    description: 'List of transactions',
    type: PagedTransactionResult,
  })
  listTransactions(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('sort', new ParseEnumPipe(TransactionAttribute, { optional: true }))
    sort: TransactionAttribute = TransactionAttribute.createdAt,
    @Query('order', new ParseEnumPipe(['ASC', 'DESC'], { optional: true }))
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PagedResult<Transaction>> {
    return this.transactionsService.list(page, limit, sort, order);
  }

  @Get('my')
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current user transactions' })
  @ApiQuery({
    name: 'page',
    type: 'number',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'sort',
    type: 'enum',
    required: false,
    description: 'Sort field',
    enum: TransactionAttribute,
  })
  @ApiQuery({
    name: 'order',
    type: 'enum',
    required: false,
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
  })
  @ApiExtraModels(PagedTransactionResult)
  @ApiResponse({
    status: 200,
    description: 'List of user transactions',
    type: PagedTransactionResult,
  })
  getMyTransactions(
    @Request() req,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('sort', new ParseEnumPipe(TransactionAttribute, { optional: true }))
    sort: TransactionAttribute = TransactionAttribute.createdAt,
    @Query('order', new ParseEnumPipe(['ASC', 'DESC'], { optional: true }))
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PagedResult<Transaction>> {
    return this.transactionsService.list(page, limit, sort, order, req.user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Get a transaction by id' })
  @ApiParam({ name: 'id', type: 'string', description: 'Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'The transaction',
    type: Transaction,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found.' })
  findOne(@Param('id') id: string): Promise<Transaction> {
    return this.transactionsService.findOne(id);
  }
}
