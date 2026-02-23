import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from 'src/guards/jwt.guard';
import { ReviewsService } from './review.service';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  create(@Body() dto: CreateReviewDto, @Req() req) {
    return this.reviewsService.create(dto, req.user.id);
  }

  @Get('pending')
  findPending(@Req() req) {
    return this.reviewsService.findPending(req.user.id);
  }

  @Get('received')
  findReceived(@Req() req) {
    return this.reviewsService.findReceived(req.user.id);
  }

  @Get('given')
  findGiven(@Req() req) {
    return this.reviewsService.findGiven(req.user.id);
  }

  @Get('user/:id')
  findByUser(@Param('id') id: string) {
    return this.reviewsService.findByUser(id);
  }
}
