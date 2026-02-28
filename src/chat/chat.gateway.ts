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
      const { message } = await this.chatService.sendMessage(
        data.conversationId,
        data.senderId,
        data.content,
      );

      // Emitir a toda la sala (ambos lo reciben)
      this.server
        .to(`conversation_${data.conversationId}`)
        .emit('new_message', message);

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
  handleTyping(
    @MessageBody()
    data: { conversationId: string; userId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    // client.to() envía a todos EN la sala EXCEPTO al que emite
    client
      .to(`conversation_${data.conversationId}`)
      .emit('user_typing', { userId: data.userId, isTyping: data.isTyping });
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
