import {
  IsEmail,
  IsString,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class RegisterProfessionalDto {
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100)
  firstName: string;

  @IsString({ message: 'El apellido debe ser texto' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(100)
  lastName: string;

  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsString()
  @MinLength(8, { message: 'El teléfono debe tener al menos 8 dígitos' })
  phone: string;

  @IsString({ message: 'El DPI debe ser texto' })
  @MinLength(13, { message: 'El DPI debe tener 13 dígitos' })
  @MaxLength(13, { message: 'El DPI debe tener 13 dígitos' })
  dpiNumber: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsInt({ message: 'El radio debe ser un número entero' })
  @Min(1, { message: 'El radio mínimo es 1 km' })
  @Max(50, { message: 'El radio máximo es 50 km' })
  @IsOptional()
  radiusKm?: number;
}
