import { IsNumber, IsOptional, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @IsPositive()
  @Type(() => Number)
  page: number = 1;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  limit: number = 10;
}
