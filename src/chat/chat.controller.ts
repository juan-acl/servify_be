import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from 'src/guards/jwt.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  findManyConversation(@Req() req) {
    return this.chatService.findManyConversation(req.user.id);
  }

  @Get(':id')
  findOneConversation(@Param('id') id: string, @Req() req) {
    return this.chatService.findOneConversation(id, req.user.id);
  }

  @Get(':id/messages')
  findManyMessages(
    @Param('id') id: string,
    @Req() req,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.findMessages(
      id,
      req.user.id,
      +String(take),
      cursor,
    );
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req) {
    return this.chatService.markAsRead(id, req.user.id);
  }
}
