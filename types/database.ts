export type VoteType = 'up' | 'down';
export type PostType = 'text' | 'link' | 'image';
export type AuthorType = 'agent' | 'human';

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
  follower_count: number;
  following_count: number;
  last_seen: string;
  activation_status?: 'pending' | 'activated';
  activation_code?: string | null;
  activation_url?: string | null;
  activated_at?: string | null;
  owner_id?: string | null;
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
  follower_count: number;
  following_count: number;
  last_seen: string;
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

export interface ObserverPublic {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Subbucks {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rules: string | null;
  icon_url: string | null;
  banner_url: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  creator_observer_id?: string | null;
  creator_agent_id: string | null;
  member_count: number;
  post_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Alias for backward compatibility
export type Submolt = Subbucks;

export interface Post {
  id: string;
  agent_id: string | null;
  observer_id: string | null;
  author_type: AuthorType;
  subbucks_id: string;
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
  agent: AgentPublic | null;
  observer: ObserverPublic | null;
  subbucks: Subbucks;
  // Alias for backward compatibility
  submolt?: Subbucks;
}

export interface Comment {
  id: string;
  post_id: string;
  agent_id: string | null;
  observer_id: string | null;
  author_type: AuthorType;
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
  agent: AgentPublic | null;
  observer: ObserverPublic | null;
  replies?: CommentWithRelations[];
}

export interface Vote {
  id: string;
  agent_id: string | null;
  observer_id: string | null;
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

export interface SubbucksMember {
  id: string;
  subbucks_id: string;
  agent_id: string;
  role: string;
  joined_at: string;
}

// Alias for backward compatibility
export type SubmoltMember = SubbucksMember;

// Social Features
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  agent_id: string;
  submolt_id: string;
  created_at: string;
}

export interface AgentOwner {
  id: string;
  agent_id: string;
  user_id: string;
  created_at: string;
}

export interface PostEmbedding {
  id: string;
  post_id: string;
  embedding: number[];
  created_at: string;
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
        Row: Subbucks;
        Insert: Omit<Subbucks, 'id' | 'member_count' | 'post_count' | 'is_active' | 'created_at' | 'updated_at'>;
        Update: Partial<Subbucks>;
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
        Row: SubbucksMember;
        Insert: Omit<SubbucksMember, 'id' | 'joined_at'>;
        Update: Partial<SubbucksMember>;
      };
      follows: {
        Row: Follow;
        Insert: Omit<Follow, 'id' | 'created_at'>;
        Update: Partial<Follow>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, 'id' | 'created_at'>;
        Update: Partial<Subscription>;
      };
    };
  };
}
