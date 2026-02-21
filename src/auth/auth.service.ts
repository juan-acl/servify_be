import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterClientDto } from './dto/register-client.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'generated/prisma/enums';
import { User } from 'generated/prisma/browser';
import { RegisterProfessionalDto } from './dto/register-professional.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger: Logger;
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.logger = new Logger(AuthService.name);
  }

  async registerClient(client: RegisterClientDto) {
    return await this.prisma.$transaction(async (prisma) => {
      const user = await this.prisma.user.findUnique({
        where: { email: client.email },
      });
      if (user) {
        this.logger.warn(`Usuario ${user.id} ya existe`);
        throw new BadRequestException('Error al crear el usuario');
      }
      const hashedPassword = await bcrypt.hash(client.password, 10);

      const newClient = await prisma.user.create({
        data: {
          ...client,
          password: hashedPassword,
        },
      });

      const tokenSession = this.generateTokenSession(
        newClient.id,
        UserRole.CLIENT,
      );

      return {
        tokenSession,
        user: this.excludePassword(newClient),
      };
    });
  }

  async registerProfessional(professional: RegisterProfessionalDto) {
    await this.validateUser(professional.email);

    const hashedPassword: string = await bcrypt.hash(professional.password, 10);

    const newProfessional = await this.prisma.user.create({
      data: {
        firstName: professional.firstName,
        lastName: professional.lastName,
        email: professional.email,
        phone: professional.phone,
        password: hashedPassword,
        role: UserRole.PROFESSIONAL,
        professionalProfile: {
          create: {
            dpiNumber: professional.dpiNumber,
            bio: professional.bio,
            radiusKm: professional.radiusKm,
          },
        },
      },

      include: {
        professionalProfile: true,
      },
    });

    const tokenSession = this.generateTokenSession(
      newProfessional.id,
      UserRole.PROFESSIONAL,
    );

    return {
      tokenSession,
      user: this.excludePassword(newProfessional),
    };
  }

  async login(loginDto: LoginDto) {
    const currentUser = await this.prisma.user.findUnique({
      where: {
        email: loginDto.email,
      },
    });

    if (!currentUser) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (!currentUser.isActive) {
      this.logger.warn(`Usuario ${currentUser.id} no activo`);
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const isPasswordValid = await this.verifyPassword(
      loginDto.password,
      currentUser.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const tokenSession = this.generateTokenSession(
      currentUser.id,
      currentUser.role as UserRole,
    );

    return {
      tokenSession,
      user: this.excludePassword(currentUser),
    };
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        professionalProfile: true,
      },
    });
    return this.excludePassword(user as User);
  }

  private async validateUser(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (user) {
      this.logger.warn(`Usuario ${user.id} ya existe`);
      throw new BadRequestException('Error al crear el usuario');
    }
  }

  private generateTokenSession(userId: string, role: UserRole): string {
    const payload = { sub: userId, role };
    return this.jwtService.sign(payload);
  }

  private async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  private excludePassword(user: User): User {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
}
