import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { RegisterClientDto } from './dto/register-client.dto';
import { AuthService } from './auth.service';
import { RegisterProfessionalDto } from './dto/register-professional.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from 'src/guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/client')
  registerClient(@Body() registerClientDto: RegisterClientDto) {
    return this.authService.registerClient(registerClientDto);
  }

  @Post('register/professional')
  registerProfessional(
    @Body() registerProfessionalDto: RegisterProfessionalDto,
  ) {
    return this.authService.registerProfessional(registerProfessionalDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req) {
    return this.authService.getProfile(req.user.id);
  }
}
