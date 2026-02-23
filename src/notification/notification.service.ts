import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export const NotificationType = {
  NEW_OFFER: 'NEW_OFFER',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  OFFER_REJECTED: 'OFFER_REJECTED',
  SERVICE_IN_TRANSIT: 'SERVICE_IN_TRANSIT',
  SERVICE_ARRIVED: 'SERVICE_ARRIVED',
  SERVICE_STARTED: 'SERVICE_STARTED',
  SERVICE_COMPLETED: 'SERVICE_COMPLETED',
  SERVICE_CANCELLED: 'SERVICE_CANCELLED',
  NEW_MESSAGE: 'NEW_MESSAGE',
  NEW_REVIEW: 'NEW_REVIEW',
  REVIEW_PENDING: 'REVIEW_PENDING',
} as const;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: data ? JSON.stringify(data) : null,
      },
    });

    this.logger.log(`Notificación creada: ${type} → Usuario: ${userId}`);

    return notification;
  }

  async findAll(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications.map((n) => ({
      ...n,
      data: n.data ? JSON.parse(n.data) : null,
    }));
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Esta notificación no es tuya');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { markedAsRead: result.count };
  }

  async remove(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Esta notificación no es tuya');
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return { deleted: true };
  }
}
