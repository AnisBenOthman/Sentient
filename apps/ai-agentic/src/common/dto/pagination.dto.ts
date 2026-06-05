import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginationToSkipTake(query: PaginationQueryDto): { skip: number; take: number } {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}
