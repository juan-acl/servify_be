import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CreateRequestDto } from './dto/create-request.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RequestService {
  private readonly logger = new Logger(RequestService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRequestDto, clientId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role !== 'CLIENT') {
      throw new ForbiddenException(
        'Solo los clientes pueden crear solicitudes',
      );
    }

    const activeRequest = await this.prisma.serviceRequest.findFirst({
      where: {
        clientId,
        status: {
          in: ['PENDING', 'ACTIVE', 'ACCEPTED', 'IN_TRANSIT', 'IN_PROGRESS'],
        },
      },
    });

    if (activeRequest) {
      throw new BadRequestException(
        'Ya tenés una solicitud activa. Completala o cancelala antes de crear otra.',
      );
    }

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category || category.isActive === false) {
      throw new NotFoundException('Categoría no encontrada o inactiva');
    }

    const expiresAt = this.calculateExpiration(dto.urgency, dto.scheduledAt);

    const request = await this.prisma.serviceRequest.create({
      data: {
        clientId,
        categoryId: dto.categoryId,
        description: dto.description,
        urgency: dto.urgency,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        expiresAt,
      },
      include: {
        category: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    this.logger.log(
      `Nueva solicitud creada: ${request.id} | ${category.name} | ${dto.urgency}`,
    );

    return request;
  }

  async findMyRequests(clientId: string, status?: string) {
    const where: any = { clientId };

    if (status) {
      where.status = status;
    }

    return this.prisma.serviceRequest.findMany({
      where,
      include: {
        category: true,
        offers: {
          select: {
            id: true,
            price: true,
            status: true,
            professional: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: { offers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAvailable(professionalId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId: professionalId },
    });

    if (!profile) {
      throw new ForbiddenException('No tenés perfil profesional');
    }

    if (!profile.isVerifiedByAdmin) {
      throw new ForbiddenException(
        'Tu perfil aún no ha sido verificado por un administrador',
      );
    }

    if (!profile.isAvailable) {
      throw new BadRequestException(
        'Activá tu disponibilidad para ver solicitudes',
      );
    }

    const now = new Date();

    return this.prisma.serviceRequest.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { gt: now },
        NOT: {
          offers: {
            some: {
              professionalId,
            },
          },
        },
      },
      include: {
        category: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { offers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        category: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        offers: {
          include: {
            professional: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                professionalProfile: {
                  select: {
                    bio: true,
                    level: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        execution: true,
        _count: {
          select: { offers: true, reviews: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    return request;
  }

  async cancel(id: string, clientId: string, reason?: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.clientId !== clientId) {
      throw new ForbiddenException(
        'No podés cancelar una solicitud que no es tuya',
      );
    }

    const cancellableStatuses = ['PENDING', 'ACTIVE', 'ACCEPTED'];
    if (!cancellableStatuses.includes(request.status)) {
      throw new BadRequestException(
        `No se puede cancelar una solicitud en estado ${request.status}`,
      );
    }

    const [updatedRequest] = await this.prisma.$transaction([
      this.prisma.serviceRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      this.prisma.offer.updateMany({
        where: {
          requestId: id,
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
      }),
    ]);

    this.logger.warn(
      `Solicitud cancelada: ${id} | Razón: ${reason || 'Sin razón'}`,
    );

    return updatedRequest;
  }

  private calculateExpiration(urgency: string, scheduledAt?: string): Date {
    const now = new Date();
    const defaultExpiration = new Date(now.getTime() + 2 * 60 * 60 * 1000); // Expira en 2 horas

    const mappedUrgency = {
      EMERGENCY: new Date(now.getTime() + 30 * 60 * 1000), // Expira en 30 minutos
      TODAY: new Date(now.getTime() + 2 * 60 * 60 * 1000), // Expira en 2 horas
      SCHEDULED: scheduledAt
        ? new Date(new Date(scheduledAt).getTime() - 6 * 60 * 60 * 1000)
        : new Date(now.getTime() + 2 * 60 * 60 * 1000), // Expira 6 horas antes de la fecha programada o en 2 horas si no se proporciona
    };

    return mappedUrgency[urgency] || defaultExpiration;
  }
}
