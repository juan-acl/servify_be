import { Module } from '@nestjs/common';
import { OfferService } from './offer.service';
import { OfferGateway } from './offer.gateway';
import { OffersController } from './offer.controller';

@Module({
  controllers: [OffersController],
  providers: [OfferGateway, OfferService],
  exports: [OfferService],
})
export class OfferModule {}
