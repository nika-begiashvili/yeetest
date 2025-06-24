import {
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'The unique identifier of the transaction (optional, will be generated if not provided)',
  })
  @IsString()
  @Matches(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    {
      message: 'ID must be a valid UUID v4',
    },
  )
  id: string;

  @ApiProperty({
    example: '100.50',
    description: 'The amount of the transaction',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'Amount must be a valid decimal number with up to 2 decimal places',
  })
  amount: string;

  @ApiProperty({
    example: 'deposit',
    description: 'The type of transaction',
    enum: TransactionType,
  })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    example: 'Payment for services',
    description: 'Description of the transaction',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'The ID of the transaction that this transaction is a reversal of',
  })
  @IsOptional()
  @IsString()
  reversalOf?: string;
}
