import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().trim().max(60).optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function toSkipTake(input: Pick<PaginationInput, "page" | "pageSize">) {
  return {
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
  };
}

export function buildMeta(
  input: Pick<PaginationInput, "page" | "pageSize">,
  total: number,
): Paginated<never>["meta"] {
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages,
    hasNext: input.page < totalPages,
    hasPrev: input.page > 1,
  };
}

/** Parse URLSearchParams into a plain object for zod. */
export function searchParamsToObject(sp: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of sp.entries()) obj[k] = v;
  return obj;
}
