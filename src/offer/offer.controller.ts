import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferService } from './offer.service';
import { JwtAuthGuard } from 'src/guards/jwt.guard';

@Controller('offer')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offersService: OfferService) {}

  @Post()
  create(@Body() dto: CreateOfferDto, @Req() req) {
    return this.offersService.create(dto, req.user.id);
  }

  @Get('my-offers')
  findMyOffers(@Req() req) {
    return this.offersService.findMyOffers(req.user.id);
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string, @Req() req) {
    return this.offersService.accept(id, req.user.id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Req() req) {
    return this.offersService.reject(id, req.user.id);
  }
}
