import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class OfferGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OfferGateway.name);

  private readonly connectedUsers = new Map<string, string>();

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        this.logger.log(`Usuario desconectado: ${userId}`);
        break;
      }
    }
  }

  @SubscribeMessage('register')
  handleRegister(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.connectedUsers.set(data.userId, client.id);
    this.logger.log(
      `Usuario registrado: ${data.userId} → Socket: ${client.id}`,
    );
    return { event: 'registered', data: { success: true } };
  }

  @SubscribeMessage('join_request')
  handleJoinRequest(
    @MessageBody() data: { requestId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`request_${data.requestId}`);
    this.logger.log(
      `Socket ${client.id} se unió a sala request_${data.requestId}`,
    );
    return { event: 'joined_request', data: { requestId: data.requestId } };
  }

  notifyNewOffer(clientId: string, offer: any) {
    const socketId = this.connectedUsers.get(clientId);
    if (socketId) {
      this.server.to(socketId).emit('new_offer', offer);
      this.logger.log(`Oferta enviada al cliente ${clientId}`);
    }
  }

  notifyOfferAccepted(professionalId: string, data: any) {
    const socketId = this.connectedUsers.get(professionalId);
    if (socketId) {
      this.server.to(socketId).emit('offer_accepted', data);
      this.logger.log(`Notificación de aceptación enviada a ${professionalId}`);
    }
  }

  notifyOfferRejected(professionalId: string, data: any) {
    const socketId = this.connectedUsers.get(professionalId);
    if (socketId) {
      this.server.to(socketId).emit('offer_rejected', data);
      this.logger.log(`Notificación de rechazo enviada a ${professionalId}`);
    }
  }
}
