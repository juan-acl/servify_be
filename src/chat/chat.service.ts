import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(private readonly prisma: PrismaService) {}

  findManyConversation(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        OR: [
          {
            clientId: userId,
          },
          {
            professionalId: userId,
          },
        ],
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            content: true,
            type: true,
            createdAt: true,
            senderId: true,
          },
        },
        professional: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        request: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async findOneConversation(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id,
        isActive: true,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        professional: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
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

    if (!conversation) {
      this.logger.warn(`Conversation with id ${id} not found`);
      throw new NotFoundException(`Conversation with id ${id} not found`);
    }

    if (
      conversation.clientId !== userId &&
      conversation.professionalId !== userId
    ) {
      this.logger.warn(
        `Conversation with id ${id} has the same client and professional`,
      );
      throw new NotFoundException(`Conversation with id ${id} not found`);
    }

    return conversation;
  }

  async findMessages(
    conversationId: string,
    userId: string,
    take: number = 20,
    cursor?: string,
  ) {
    await this.findOneConversation(conversationId, userId);
    const query: any = {
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    };

    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    }

    const messages = await this.prisma.message.findMany(query);

    return {
      messages,
      hasMore: messages.length === take,
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
    };
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const conversation = await this.findOneConversation(
      conversationId,
      senderId,
    );
    if (!conversation) {
      this.logger.warn(`Conversation with id ${conversationId} not found`);
      throw new NotFoundException(
        `Conversation with id ${conversationId} not found`,
      );
    }

    if (
      conversation.clientId !== senderId &&
      conversation.professionalId !== senderId
    ) {
      throw new ForbiddenException('No pertenecés a esta conversación');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        type: MessageType.TEXT,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    this.logger.log(
      `Mensaje enviado | Conversación: ${conversationId} | De: ${senderId}`,
    );
    // se lo mando para que el getway del socket sepa a quien mandar el mensaje
    // es decir si el quien lo manda es el cliente hay que notificar al profesional y viceversa
    const recipientId =
      conversation.clientId === senderId
        ? conversation.professionalId
        : conversation.clientId;
    return {
      message,
      recipientId,
    };
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.findOneConversation(conversationId, userId);

    const myMessages = await this.prisma.message.updateMany({
      where: {
        id: conversationId,
        senderId: {
          not: userId,
        },
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    this.logger.log(
      `Mensajes marcados como leídos | Conversación: ${conversationId} | Usuario: ${userId} | Cantidad: ${myMessages.count}`,
    );

    return { totalMarkedAsRead: myMessages.count };
  }
}
