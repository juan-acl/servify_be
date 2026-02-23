import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @IsString({ message: 'El requestId debe ser texto (UUID)' })
  requestId: string;

  @IsInt({ message: 'El rating debe ser un número entero' })
  @Min(1, { message: 'El rating mínimo es 1' })
  @Max(5, { message: 'El rating máximo es 5' })
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
