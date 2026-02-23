import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReviewDto, reviewerId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: dto.requestId },
      include: {
        execution: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Solo se puede calificar después de que el servicio esté completado',
      );
    }

    const isClient = request.clientId === reviewerId;
    const isProfessional = request.execution?.professionalId === reviewerId;

    if (!isClient && !isProfessional) {
      throw new ForbiddenException('No participaste en esta solicitud');
    }

    let reviewedId: string;

    if (isClient) {
      reviewedId = request.execution?.professionalId!;
    } else {
      reviewedId = request.clientId;
    }

    if (reviewerId === reviewedId) {
      throw new BadRequestException('No podés calificarte a vos mismo');
    }

    const existingReview = await this.prisma.review.findUnique({
      where: {
        requestId_reviewerId: {
          requestId: dto.requestId,
          reviewerId,
        },
      },
    });

    if (existingReview) {
      throw new BadRequestException('Ya calificaste esta solicitud');
    }

    const review = await this.prisma.review.create({
      data: {
        requestId: dto.requestId,
        reviewerId,
        reviewedId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        reviewed: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        request: {
          include: { category: true },
        },
      },
    });

    this.logger.log(
      `Nueva reseña: ${review.id} | ${review.rating}⭐ | De: ${reviewerId} → Para: ${reviewedId}`,
    );

    return review;
  }

  async findPending(userId: string) {
    const completedRequests = await this.prisma.serviceRequest.findMany({
      where: {
        status: 'COMPLETED',
        OR: [{ clientId: userId }, { execution: { professionalId: userId } }],
        NOT: {
          reviews: {
            some: { reviewerId: userId },
          },
        },
      },
      include: {
        category: true,
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        execution: {
          include: {
            professional: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return completedRequests;
  }

  async findReceived(userId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { reviewedId: userId },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        request: {
          include: { category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calcular estadísticas
    const stats = this.calculateStats(reviews);

    return { reviews, stats };
  }

  async findGiven(userId: string) {
    return this.prisma.review.findMany({
      where: { reviewerId: userId },
      include: {
        reviewed: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        request: {
          include: { category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const reviews = await this.prisma.review.findMany({
      where: { reviewedId: userId },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        request: {
          include: { category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = this.calculateStats(reviews);

    return { user, reviews, stats };
  }

  private calculateStats(reviews: any[]) {
    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = Math.round((sum / total) * 10) / 10;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      distribution[r.rating]++;
    });

    return {
      averageRating: average,
      totalReviews: total,
      distribution,
    };
  }
}
