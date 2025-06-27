import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { LoginDto } from './dto/login';

@Controller('auth')
@ApiSecurity('bearer')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully logged in.',
  })
  async login(@Request() req) {
    return this.authService.createToken(req.user);
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const hashedPassword = await this.authService.hashPassword(
      createUserDto.password,
    );
    const user = await this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return this.authService.createToken(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
