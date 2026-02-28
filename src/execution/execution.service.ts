import { OfferStatus, RequestStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

const VALID_TRANSITIONS: Record<string, string> = {
  ACCEPTED: 'IN_TRANSIT',
  IN_TRANSIT: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  constructor(private readonly primsa: PrismaService) {}

  async nextStatus(
    idEx: string,
    profesionalId: string,
    targetStatus: RequestStatus,
  ) {
    const execution = await this.primsa.serviceExecution.findUnique({
      where: {
        id: idEx,
      },
      include: {
        request: true,
      },
    });

    if (!execution) {
      this.logger.error(`Execution with id ${idEx} not found`);
      throw new NotFoundException(`Execution with id ${idEx} not found`);
    }

    if (execution.professionalId !== profesionalId) {
      this.logger.error(
        'El profesional no tiene permiso para actualizar esta ejecución',
      );
      throw new ForbiddenException(
        'El profesional no tiene permiso para actualizar esta ejecución',
      );
    }

    const currentStatus = execution.request.status;
    const nextStatus = VALID_TRANSITIONS[currentStatus];
    if (!nextStatus || nextStatus !== targetStatus) {
      this.logger.error(
        `Invalid status transition from ${currentStatus} to ${targetStatus}`,
      );
      throw new ForbiddenException(
        `No se puede pasar de ${currentStatus} a ${targetStatus}. El siguiente estado válido es: ${nextStatus || 'ninguno'}`,
      );
    }

    const dataUpdate = {};

    if (targetStatus === RequestStatus.IN_TRANSIT) {
      dataUpdate['startedAt'] = new Date();
    }

    if (targetStatus === RequestStatus.COMPLETED) {
      dataUpdate['completedAt'] = new Date();
    }

    const [_, serviceExecution] = await this.primsa.$transaction([
      this.primsa.serviceRequest.update({
        where: {
          id: execution.requestId,
        },
        data: {
          status: targetStatus,
        },
      }),
      this.primsa.serviceExecution.update({
        where: {
          id: idEx,
        },
        data: {
          ...dataUpdate,
        },
        include: {
          request: {
            include: {
              category: true,
            },
          },
        },
      }),
    ]);

    return serviceExecution;
  }

  async markArrived(idEx: string, profesionalId: string) {
    const execution = await this.primsa.serviceExecution.findUnique({
      where: {
        id: idEx,
      },
    });

    if (!execution) {
      this.logger.log('Execution with id ${idEx} not found');
      throw new NotFoundException(`Execution with id ${idEx} not found`);
    }

    if (execution.professionalId !== profesionalId) {
      this.logger.error(
        'El profesional no tiene permiso para actualizar esta ejecución',
      );
      throw new ForbiddenException(
        'El profesional no tiene permiso para actualizar esta ejecución',
      );
    }

    const executionUpdated = await this.primsa.serviceExecution.update({
      where: {
        id: idEx,
      },
      data: {
        arrivedAt: new Date(),
      },
      include: {
        request: {
          include: {
            category: true,
          },
        },
      },
    });

    return executionUpdated;
  }

  async markCompleted(idEx: string, profesionalId: string) {
    const execution = await this.primsa.serviceExecution.findUnique({
      where: {
        id: idEx,
      },
    });

    if (!execution) {
      this.logger.error(`Execution with id ${idEx} not found`);
      throw new NotFoundException(`Execution with id ${idEx} not found`);
    }

    // if (execution.professionalId !== profesionalId) {
    //   this.logger.error(
    //     'El profesional no tiene permiso para actualizar esta ejecución',
    //   );
    //   throw new ForbiddenException(
    //     'El profesional no tiene permiso para actualizar esta ejecución',
    //   );
    // }

    const [executionUpdated] = await this.primsa.$transaction([
      this.primsa.serviceExecution.update({
        where: {
          id: idEx,
        },
        data: {
          completedAt: new Date(),
        },
        include: {
          request: {
            include: {
              category: true,
            },
          },
        },
      }),
    ]);
    return executionUpdated;
  }

  async getDetailsExecution(idEx: string, profesionalId: string) {
    const currentExecution = await this.primsa.serviceExecution.findUnique({
      where: {
        id: idEx,
      },
      include: {
        offer: true,
        request: {
          include: {
            category: true,
            client: true,
            conversation: true,
          },
        },
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
            // offer: {
            //   select: {
            //     price: true,
            //     comment: true,
            //     estimatedArrivalMinutes: true,
            //   },
            // },
          },
        },
      },
    });

    if (!currentExecution) {
      this.logger.error(`Execution with id ${idEx} not found`);
      throw new NotFoundException(`Execution with id ${idEx} not found`);
    }

    // verificarlo pero con el clientId, no con el profesionalId, porque el request tiene el clientId, no el profesionalId
    // if (currentExecution.request.clientId !== profesionalId) {
    //   this.logger.error(
    //     'El profesional no tiene permiso para ver esta ejecución',
    //   );
    //   throw new ForbiddenException(
    //     'El profesional no tiene permiso para ver esta ejecución',
    //   );
    // }

    return currentExecution;
  }

  async cancelByClient(idEx: string, clientId: string, reason?: string) {
    const execution = await this.primsa.serviceExecution.findUnique({
      where: {
        id: idEx,
      },
      include: {
        request: true,
      },
    });

    if (!execution) {
      this.logger.log('Servicio de execution no encotrado');
      throw new NotFoundException('Servicio de execution no encontrado');
    }

    if (execution.request.clientId !== clientId) {
      this.logger.error(
        'El cliente no tiene permiso para cancelar esta ejecución',
      );
      throw new ForbiddenException(
        'El cliente no tiene permiso para cancelar esta ejecución',
      );
    }

    const permitedStatus = ['IN_TRANSIT', 'IN_TRANSIT'];
    if (!permitedStatus.includes(execution.request.status)) {
      this.logger.error(
        `No se puede cancelar la ejecución en estado ${execution.request.status}`,
      );
      throw new ForbiddenException(
        `No se puede cancelar la ejecución en estado ${execution.request.status}`,
      );
    }

    const result = await this.primsa.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: {
          id: execution.requestId,
        },
        data: {
          status: RequestStatus.CANCELLED,
        },
      });

      await tx.offer.update({
        where: {
          id: execution.offerId,
        },
        data: {
          status: OfferStatus.REJECTED,
        },
      });

      await tx.conversation.updateMany({
        where: {
          id: idEx,
        },
        data: {
          isActive: false,
        },
      });

      const conversation = await tx.conversation.findUnique({
        where: {
          id: execution.requestId,
        },
      });
      this.logger.log('Esta es la conversacion', conversation);
      if (conversation) {
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: clientId,
            content: `El cliente canceló el servicio. Razón: ${reason || 'No especificada'}`,
            type: 'SYSTEM',
          },
        });
        this.logger.log(
          'Se creo un mensage del sistema sobre el motivo de la cancelacion',
        );
      }
      const serviceExe = await tx.serviceExecution.findUnique({
        where: {
          id: idEx,
        },
        include: {
          request: true,
          offer: {
            select: {
              comment: true,
              price: true,
            },
          },
        },
      });
      return serviceExe;
    });
    this.logger.warn(
      `Servicio cancelado por CLIENTE | Ejecución: ${idEx} | Razón: ${reason || 'Sin razón'}`,
    );
    return result;
  }

  async cancelByProfessional(
    idEx: string,
    professionalId: string,
    reason?: string,
  ) {
    const execution = await this.primsa.serviceExecution.findUnique({
      where: {
        id: idEx,
      },
      include: {
        request: true,
      },
    });

    if (!execution) {
      this.logger.log('No se encontro la ejecucion con id:', idEx);
      throw new NotFoundException('No se encontro la ejecucion');
    }

    if (execution.professionalId !== professionalId) {
      this.logger.log(
        'El servicio de ejecicion no coincide con el mismo profesional',
      );
      throw new ForbiddenException(
        'No sos el profesional asignado a este servicio',
      );
    }

    const cancellableStatuses = ['ACCEPTED', 'IN_TRANSIT'];
    if (!cancellableStatuses.includes(execution.request.status)) {
      throw new BadRequestException(
        `No se puede cancelar un servicio en estado ${execution.request.status}. Solo se permite cancelar en ACCEPTED o IN_TRANSIT`,
      );
    }

    const result = await this.primsa.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: {
          id: idEx,
        },
        data: {
          status: RequestStatus.PENDING,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      await tx.offer.update({
        where: {
          id: idEx,
        },
        data: {
          status: OfferStatus.REJECTED,
        },
      });

      this.logger.log(
        'Se procede a eliminar el service execution con id',
        idEx,
      );
      await tx.serviceExecution.delete({
        where: {
          id: idEx,
        },
      });

      this.logger.log('Se elimino el service execution con id', idEx);
      const conversation = await tx.conversation.findUnique({
        where: { requestId: execution.requestId },
      });

      if (conversation) {
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: professionalId,
            content: `El profesional canceló el servicio. Razón: ${reason || 'No especificada'}. La solicitud se reabrió para otros profesionales.`,
            type: 'SYSTEM',
          },
        });

        await tx.conversation.update({
          where: { id: conversation.id },
          data: { isActive: false },
        });
      }

      return tx.serviceRequest.findUnique({
        where: { id: execution.requestId },
        include: { category: true },
      });
    });
    return result;
  }
}
