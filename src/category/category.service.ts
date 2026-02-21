import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationDto } from 'src/commons/dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CategoryService {
  private readonly logger: Logger = new Logger(CategoryService.name);
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    this.logger.log('Creacion de una categoria', createCategoryDto);
    const existingCategory = await this.prisma.category.findUnique({
      where: { name: createCategoryDto.name, isActive: true },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    await this.prisma.category.create({
      data: {
        ...createCategoryDto,
      },
    });
  }

  async findAll(paginator: PaginationDto) {
    const { limit, page } = paginator;
    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        take: limit,
        skip: (page - 1) * limit,
        where: {
          isActive: true,
        },
      }),
      this.prisma.category.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      total,
      page,
      limit,
      totalPages,
      categories,
    };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: {
        id: id,
      },
    });

    if (!category) {
      throw new ConflictException('Category not found');
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id);
    if (updateCategoryDto.name) {
      const existingCategory = await this.prisma.category.findUnique({
        where: { name: updateCategoryDto.name, isActive: true },
      });

      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    await this.prisma.category.update({
      where: {
        id: id,
      },
      data: {
        ...updateCategoryDto,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.category.update({
      where: {
        id: id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
