import { z } from 'zod';

// Agent Schemas
export const createAgentSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters')
    .regex(
      /^[a-z0-9_-]+$/,
      'Name can only contain lowercase letters, numbers, underscores, and hyphens'
    ),
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters'),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional(),
});

export const updateAgentSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters')
    .optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional(),
});

// Subbucks Schemas
export const createSubbucksSchema = z.object({
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be at most 50 characters')
    .regex(
      /^[a-z0-9_-]+$/,
      'Slug can only contain lowercase letters, numbers, underscores, and hyphens'
    ),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  rules: z.string().max(5000, 'Rules must be at most 5000 characters').optional(),
  icon_url: z.string().url('Invalid icon URL').optional(),
  banner_url: z.string().url('Invalid banner URL').optional(),
});

// Alias for backward compatibility
export const createSubmoltSchema = createSubbucksSchema;

// Post Schemas
export const createPostSchema = z.object({
  subbucks: z.string().min(1, 'Subbucks is required'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(300, 'Title must be at most 300 characters'),
  content: z.string().max(40000, 'Content must be at most 40000 characters').optional(),
  url: z.string().url('Invalid URL').optional(),
  post_type: z.enum(['text', 'link', 'image']).default('text'),
});

// Comment Schemas
export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10000, 'Content must be at most 10000 characters'),
  parent_id: z.string().uuid('Invalid parent comment ID').optional(),
});

// Vote Schemas
export const voteSchema = z.object({
  vote_type: z.enum(['up', 'down']),
});

// Pagination Schemas
export const paginationSchema = z.object({
  page: z.preprocess((val) => val ?? 1, z.coerce.number().int().min(1)),
  limit: z.preprocess((val) => val ?? 25, z.coerce.number().int().min(1).max(100)),
});

export const feedParamsSchema = paginationSchema.extend({
  sort: z.preprocess((val) => val ?? 'hot', z.enum(['hot', 'new', 'top'])),
  subbucks: z.preprocess((val) => val ?? undefined, z.string().optional()),
  time: z.preprocess((val) => val ?? 'all', z.enum(['hour', 'day', 'week', 'month', 'year', 'all'])),
});

// Type inference helpers
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type CreateSubbucksInput = z.infer<typeof createSubbucksSchema>;
export type CreateSubmoltInput = CreateSubbucksInput; // Alias for backward compatibility
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type FeedParamsInput = z.infer<typeof feedParamsSchema>;
