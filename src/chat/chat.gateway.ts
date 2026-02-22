import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedUsers: Map<string, string> = new Map();

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    for (const [user, socketid] of this.connectedUsers.entries()) {
      if (socketid === client.id) {
        this.connectedUsers.delete(user);
        this.logger.log(`User disconnected: ${user} (socket id: ${client.id})`);
        break;
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('register')
  handleRegister(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.connectedUsers.set(data.userId, client.id);
    this.logger.log(
      `User registered: ${data.userId} (socket id: ${client.id})`,
    );
    return { event: 'registered', data: { success: true } };
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`conversation_${data.conversationId}`);
    this.logger.log(
      `Socket ${client.id} joined conversation_${data.conversationId}`,
    );
    return {
      event: 'joined_conversation',
      data: { conversationId: data.conversationId },
    };
  }

  @SubscribeMessage('send_message')
  async handleSendMessageToConversation(
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
      senderId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { message, recipientId } = await this.chatService.sendMessage(
        data.conversationId,
        data.content,
        data.senderId,
      );

      this.server
        .to(`conversation_${data.conversationId}`)
        .emit('new_message', {
          message,
        });

      // También enviar directamente al destinatario por si no está en la sala
      const recipientSocketId = this.connectedUsers.get(recipientId);
      if (recipientSocketId) {
        this.server.to(recipientSocketId).emit('new_message', message);
      }

      return {
        event: 'message_sent',
        data: { message },
      };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return {
        event: 'error',
        data: { message: error.message },
      };
    }
  }

  @SubscribeMessage('typing')
  handleIsTyping(
    @MessageBody() data: { conversationId: string; senderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(`conversation_${data.conversationId}`).emit('typing', {
      conversationId: data.conversationId,
      senderId: data.senderId,
    });
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @MessageBody() data: { conversationId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const response = await this.chatService.markAsRead(
        data.conversationId,
        data.userId,
      );
      this.server
        .to(`conversation_${data.conversationId}`)
        .emit('messages_read', {
          conversationId: data.conversationId,
          userId: data.userId,
          count: response.totalMarkedAsRead,
        });
    } catch (error) {
      this.logger.error(`Error marking messages as read: ${error.message}`);
      return {
        event: 'error',
        data: { message: error.message },
      };
    }
  }
}
