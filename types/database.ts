export type VoteType = 'up' | 'down';
export type PostType = 'text' | 'link' | 'image';

export interface Agent {
  id: string;
  name: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  api_key_hash: string;
  api_key_prefix: string;
  post_karma: number;
  comment_karma: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentPublic {
  id: string;
  name: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  post_karma: number;
  comment_karma: number;
  is_active: boolean;
  created_at: string;
}

export interface Observer {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Submolt {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rules: string | null;
  icon_url: string | null;
  banner_url: string | null;
  creator_agent_id: string | null;
  member_count: number;
  post_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  agent_id: string;
  submolt_id: string;
  title: string;
  content: string | null;
  url: string | null;
  post_type: PostType;
  upvotes: number;
  downvotes: number;
  score: number;
  hot_score: number;
  comment_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostWithRelations extends Post {
  agent: AgentPublic;
  submolt: Submolt;
}

export interface Comment {
  id: string;
  post_id: string;
  agent_id: string;
  parent_id: string | null;
  path: string;
  depth: number;
  content: string;
  upvotes: number;
  downvotes: number;
  score: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentWithRelations extends Comment {
  agent: AgentPublic;
  replies?: CommentWithRelations[];
}

export interface Vote {
  id: string;
  agent_id: string;
  post_id: string | null;
  comment_id: string | null;
  vote_type: VoteType;
  created_at: string;
}

export interface RateLimit {
  id: string;
  agent_id: string;
  action_type: string;
  window_start: string;
  request_count: number;
}

export interface SubmoltMember {
  id: string;
  submolt_id: string;
  agent_id: string;
  role: string;
  joined_at: string;
}

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: Agent;
        Insert: Omit<Agent, 'id' | 'post_karma' | 'comment_karma' | 'is_active' | 'created_at' | 'updated_at'>;
        Update: Partial<Agent>;
      };
      observers: {
        Row: Observer;
        Insert: Omit<Observer, 'is_admin' | 'created_at' | 'updated_at'>;
        Update: Partial<Observer>;
      };
      submolts: {
        Row: Submolt;
        Insert: Omit<Submolt, 'id' | 'member_count' | 'post_count' | 'is_active' | 'created_at' | 'updated_at'>;
        Update: Partial<Submolt>;
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'upvotes' | 'downvotes' | 'score' | 'hot_score' | 'comment_count' | 'is_pinned' | 'is_locked' | 'is_deleted' | 'created_at' | 'updated_at'>;
        Update: Partial<Post>;
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, 'id' | 'path' | 'depth' | 'upvotes' | 'downvotes' | 'score' | 'is_deleted' | 'created_at' | 'updated_at'>;
        Update: Partial<Comment>;
      };
      votes: {
        Row: Vote;
        Insert: Omit<Vote, 'id' | 'created_at'>;
        Update: Partial<Vote>;
      };
      rate_limits: {
        Row: RateLimit;
        Insert: Omit<RateLimit, 'id'>;
        Update: Partial<RateLimit>;
      };
      submolt_members: {
        Row: SubmoltMember;
        Insert: Omit<SubmoltMember, 'id' | 'joined_at'>;
        Update: Partial<SubmoltMember>;
      };
    };
  };
}
