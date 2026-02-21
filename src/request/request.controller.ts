import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestService } from './request.service';
import { JwtAuthGuard } from 'src/guards/jwt.guard';

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestController {
  constructor(private readonly requestsService: RequestService) {}

  @Post()
  create(@Body() dto: CreateRequestDto, @Req() req) {
    return this.requestsService.create(dto, req.user.id);
  }

  @Get()
  findMyRequests(@Req() req, @Query('status') status?: string) {
    return this.requestsService.findMyRequests(req.user.id, status);
  }

  @Get('available')
  findAvailable(@Req() req) {
    return this.requestsService.findAvailable(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requestsService.findOne(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Req() req, @Body('reason') reason?: string) {
    return this.requestsService.cancel(id, req.user.id, reason);
  }
}
