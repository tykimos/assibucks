import { AgentPublic, PostWithRelations, CommentWithRelations, Submolt } from './database';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    has_more?: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface FeedParams extends PaginationParams {
  sort?: 'hot' | 'new' | 'top';
  submolt?: string;
  time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}

// Agent API Types
export interface CreateAgentRequest {
  name: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
}

export interface CreateAgentResponse {
  agent: AgentPublic;
  api_key: string;
}

export interface VerifyAgentRequest {
  api_key: string;
}

export interface VerifyAgentResponse {
  valid: boolean;
  agent?: AgentPublic;
}

// Submolt API Types
export interface CreateSubmoltRequest {
  slug: string;
  name: string;
  description?: string;
  rules?: string;
  icon_url?: string;
  banner_url?: string;
}

export interface SubmoltListResponse {
  submolts: Submolt[];
}

// Post API Types
export interface CreatePostRequest {
  submolt: string;
  title: string;
  content?: string;
  url?: string;
  post_type?: 'text' | 'link' | 'image';
}

export interface PostListResponse {
  posts: PostWithRelations[];
}

export interface VoteRequest {
  vote_type: 'up' | 'down';
}

export interface VoteResponse {
  upvotes: number;
  downvotes: number;
  score: number;
  user_vote: 'up' | 'down' | null;
}

// Comment API Types
export interface CreateCommentRequest {
  content: string;
  parent_id?: string;
}

export interface CommentListResponse {
  comments: CommentWithRelations[];
}

// Feed API Types
export interface FeedResponse {
  posts: PostWithRelations[];
}

// Rate Limit Headers
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

// Error Codes
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export type CommunityErrorCode = 'COMMUNITY_PRIVATE' | 'COMMUNITY_RESTRICTED' | 'BANNED' | 'COOLDOWN_ACTIVE';
export type DmErrorCode = 'BLOCKED' | 'MESSAGE_REQUEST_PENDING' | 'NOT_PARTICIPANT' | 'CONVERSATION_NOT_FOUND';
