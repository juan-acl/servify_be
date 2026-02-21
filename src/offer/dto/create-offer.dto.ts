import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateOfferDto {
  @IsString({ message: 'El requestId debe ser texto (UUID)' })
  requestId: string;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(1, { message: 'El precio mínimo es Q1' })
  @Max(50000, { message: 'El precio máximo es Q50,000' })
  price: number;

  @IsInt({ message: 'El tiempo de llegada debe ser un número entero' })
  @Min(1, { message: 'El tiempo mínimo es 1 minuto' })
  @Max(480, { message: 'El tiempo máximo es 8 horas (480 minutos)' })
  estimatedArrivalMinutes: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
