import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateRequestDto {
  @IsString({ message: 'El categoryId debe ser texto (UUID)' })
  categoryId: string;

  @IsString({ message: 'La descripción debe ser texto' })
  @MinLength(20, {
    message: 'La descripción debe tener al menos 20 caracteres',
  })
  @MaxLength(1000)
  description: string;

  @IsIn(['EMERGENCY', 'TODAY', 'SCHEDULED'], {
    message: 'La urgencia debe ser EMERGENCY, TODAY o SCHEDULED',
  })
  urgency: string;

  @IsString({ message: 'La dirección debe ser texto' })
  @MinLength(5, { message: 'La dirección debe tener al menos 5 caracteres' })
  @MaxLength(500)
  address: string;

  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsString()
  @IsOptional()
  scheduledAt?: string;
}
