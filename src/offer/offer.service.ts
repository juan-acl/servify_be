import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CreateOfferDto } from './dto/create-offer.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OfferGateway } from './offer.gateway';
import { OfferStatus, RequestStatus } from '@prisma/client';

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly offersGateway: OfferGateway,
  ) {}

  async create(dto: CreateOfferDto, professionalId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId: professionalId },
    });

    if (!profile) {
      throw new ForbiddenException('No tenés perfil profesional');
    }

    if (!profile.isVerifiedByAdmin) {
      throw new ForbiddenException('Tu perfil no está verificado');
    }

    if (!profile.isAvailable) {
      throw new BadRequestException('Activá tu disponibilidad para ofertar');
    }

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: dto.requestId },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `No se puede ofertar en una solicitud con estado ${request.status}`,
      );
    }

    if (new Date() > new Date(request.expiresAt)) {
      throw new BadRequestException('Esta solicitud ya expiró');
    }

    const existingOffer = await this.prisma.offer.findUnique({
      where: {
        requestId_professionalId: {
          requestId: dto.requestId,
          professionalId,
        },
      },
    });

    if (existingOffer) {
      throw new BadRequestException('Ya enviaste una oferta a esta solicitud');
    }

    const offerCount = await this.prisma.offer.count({
      where: { requestId: dto.requestId },
    });

    if (offerCount >= 10) {
      throw new BadRequestException(
        'Esta solicitud ya alcanzó el máximo de 10 ofertas',
      );
    }

    const offer = await this.prisma.offer.create({
      data: {
        requestId: dto.requestId,
        professionalId,
        price: dto.price,
        estimatedArrivalMinutes: dto.estimatedArrivalMinutes,
        comment: dto.comment,
      },
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
    });

    this.offersGateway.notifyNewOffer(request.clientId, offer);

    this.logger.log(
      `Nueva oferta: ${offer.id} | Solicitud: ${dto.requestId} | Precio: Q${dto.price}`,
    );

    return offer;
  }

  async findMyOffers(professionalId: string) {
    return this.prisma.offer.findMany({
      where: { professionalId },
      include: {
        request: {
          include: {
            category: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(offerId: string, clientId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        request: true,
        professional: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Oferta no encontrada');
    }

    if (offer.request.clientId !== clientId) {
      throw new ForbiddenException(
        'No podés aceptar ofertas de solicitudes ajenas',
      );
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(`Esta oferta ya fue ${offer.status}`);
    }

    if (offer.request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        'Esta solicitud ya tiene una oferta aceptada',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const acceptedOffer = await tx.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.ACCEPTED },
        include: {
          request: {
            include: {
              client: true,
            },
          },
        },
      });

      await tx.offer.updateMany({
        where: {
          requestId: offer.requestId,
          id: { not: offerId },
          status: OfferStatus.PENDING,
        },
        data: { status: OfferStatus.REJECTED },
      });

      await tx.serviceRequest.update({
        where: { id: offer.requestId },
        data: { status: OfferStatus.ACCEPTED },
      });

      const execution = await tx.serviceExecution.create({
        data: {
          requestId: offer.requestId,
          professionalId: offer.professionalId,
          offerId: offer.id,
          originalPrice: offer.price,
          finalPrice: offer.price,
        },
      });

      const conversation = await tx.conversation.create({
        data: {
          requestId: offer.requestId,
          clientId,
          professionalId: offer.professionalId,
        },
      });

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: clientId,
          content: `Oferta aceptada. Precio acordado: Q${offer.price}. ${offer.professional.firstName} está por confirmar.`,
          type: 'SYSTEM',
        },
      });

      const fullNameClient = `${acceptedOffer.request.client.firstName} ${acceptedOffer.request.client.lastName}`;
      const fullNameProfessional = `${offer.professional.firstName} ${offer.professional.lastName}`;

      await tx.notification.create({
        data: {
          userId: offer.professionalId,
          title: `${fullNameClient} acaba de aceptar tu oferta.`,
          body: `Tu oferta para la solicitud "${offer.request.address}" fue aceptada. Precio acordado: Q${offer.price}.`,
          type: 'OFFER_ACCEPTED',
          isRead: false,
          data: JSON.stringify({
            requestId: offer.requestId,
            executionId: execution.id,
            conversationId: conversation.id,
          }),
        },
      });

      await tx.notification.create({
        data: {
          userId: clientId,
          title: `${fullNameProfessional} acaba de ofertar a tu solicitud.`,
          body: `Tu oferta para la solicitud "${offer.request.address}" fue aceptada. Precio acordado: Q${offer.price}.`,
          type: 'OFFER_ACCEPTED',
          isRead: false,
          data: JSON.stringify({
            requestId: offer.requestId,
            executionId: execution.id,
            conversationId: conversation.id,
          }),
        },
      });

      return { acceptedOffer, execution, conversation };
    });

    this.offersGateway.notifyOfferAccepted(offer.professionalId, {
      offerId: offer.id,
      requestId: offer.requestId,
      conversationId: result.conversation.id,
    });

    const rejectedOffers = await this.prisma.offer.findMany({
      where: {
        requestId: offer.requestId,
        status: OfferStatus.REJECTED,
      },
      select: { professionalId: true },
    });

    for (const rejected of rejectedOffers) {
      this.offersGateway.notifyOfferRejected(rejected.professionalId, {
        offerId: offer.id,
        requestId: offer.requestId,
      });
    }

    this.logger.log(
      `Oferta aceptada: ${offerId} | Profesional: ${offer.professional.firstName} | Precio: Q${offer.price}`,
    );

    return result;
  }

  async reject(offerId: string, clientId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        request: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Oferta no encontrada');
    }

    if (offer.request.clientId !== clientId) {
      throw new ForbiddenException(
        'No podés rechazar ofertas de solicitudes ajenas',
      );
    }

    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException(`Esta oferta ya fue ${offer.status}`);
    }

    const rejectedOffer = await this.prisma.offer.update({
      where: { id: offerId },
      data: { status: OfferStatus.REJECTED },
    });

    this.offersGateway.notifyOfferRejected(offer.professionalId, {
      offerId: offer.id,
      requestId: offer.requestId,
    });

    const fullNameClient = `${offer.request.client.firstName} ${offer.request.client.lastName}`;

    await this.prisma.notification.create({
      data: {
        userId: offer.professionalId,
        title: `${fullNameClient} acaba de rechazar tu oferta.`,
        body: `Tu oferta para la solicitud "${offer.request.address}" fue rechazada. Precio acordado: Q${offer.price}.`,
        type: 'OFFER_REJECTED',
        isRead: false,
        data: JSON.stringify({
          requestId: offer.requestId,
        }),
      },
    });

    this.logger.log(`Oferta rechazada: ${offerId}`);

    return rejectedOffer;
  }
}
