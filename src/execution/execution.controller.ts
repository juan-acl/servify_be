import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Req,
  Body,
} from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { JwtAuthGuard } from 'src/guards/jwt.guard';

@Controller('execution')
@UseGuards(JwtAuthGuard)
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Get(':idEx')
  getDetailsExecution(@Param('idEx') idEx: string, @Req() req) {
    return this.executionService.getDetailsExecution(idEx, req.user.id);
  }

  @Patch(':id/in-transit')
  markInTransit(@Param('id') id: string, @Req() req) {
    return this.executionService.nextStatus(id, req.user.id, 'IN_TRANSIT');
  }

  @Patch(':id/arrived')
  markInStart(@Param('id') id: string, @Req() req) {
    return this.executionService.nextStatus(id, req.user.id, 'IN_PROGRESS');
  }

  @Patch(':id/completed')
  complete(@Param('id') id: string, @Req() req) {
    return this.executionService.nextStatus(id, req.user.id, 'COMPLETED');
  }

  @Patch(':id/confirmedClient')
  confirmed(@Param('id') id: string, @Req() req) {
    return this.executionService.markCompleted(id, req.user.id);
  }

  @Patch(':id/cancel/client')
  cancelByClient(
    @Param('id') id: string,
    @Req() req,
    @Body('reason') reason?: string,
  ) {
    return this.executionService.cancelByClient(id, req.user.id, reason);
  }

  @Patch(':id/cancel/professional')
  cancelByProfessional(
    @Param('id') id: string,
    @Req() req,
    @Body('reason') reason?: string,
  ) {
    return this.executionService.cancelByProfessional(id, req.user.id, reason);
  }
}
