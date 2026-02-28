import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CategoryModule } from './category/category.module';
import { RequestModule } from './request/request.module';
import { OfferModule } from './offer/offer.module';
import { ExecutionModule } from './execution/execution.module';
import { ChatModule } from './chat/chat.module';
import { ReviewModule } from './review/review.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    CategoryModule,
    RequestModule,
    OfferModule,
    ExecutionModule,
    ChatModule,
    ReviewModule,
    NotificationModule,
  ],
})
export class AppModule {}
