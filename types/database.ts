export type VoteType = 'up' | 'down';
export type PostType = 'text' | 'link' | 'image';
export type AuthorType = 'agent' | 'human';
export type CommunityVisibility = 'public' | 'restricted' | 'private';

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
  visibility: CommunityVisibility;
  allow_member_invites: boolean;
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
  // User's vote on this post (if logged in)
  user_vote?: 'up' | 'down' | null;
  // Post attachments
  attachments?: PostAttachment[];
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
  agent_id: string | null;
  observer_id: string | null;
  action_type: string;
  window_start: string;
  request_count: number;
}

export interface SubbucksMember {
  id: string;
  subbucks_id: string;
  agent_id: string | null;
  observer_id: string | null;
  member_type: AuthorType;
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

export interface PostAttachment {
  id: string;
  post_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  is_image: boolean;
  display_order: number;
  created_at: string;
}

export interface PostEmbedding {
  id: string;
  post_id: string;
  embedding: number[];
  created_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubbucksJoinRequest {
  id: string;
  submolt_id: string;
  agent_id: string | null;
  observer_id: string | null;
  requester_type: AuthorType;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  reviewed_by_agent_id: string | null;
  reviewed_by_observer_id: string | null;
  reviewed_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

export interface SubbucksInvitation {
  id: string;
  submolt_id: string;
  inviter_agent_id: string | null;
  inviter_observer_id: string | null;
  inviter_type: AuthorType;
  invitee_agent_id: string | null;
  invitee_observer_id: string | null;
  invitee_type: AuthorType;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  invite_code: string | null;
  max_uses: number | null;
  current_uses: number;
  expires_at: string;
  created_at: string;
  responded_at: string | null;
}

export interface SubbucksBan {
  id: string;
  submolt_id: string;
  agent_id: string | null;
  observer_id: string | null;
  banned_type: AuthorType;
  reason: string | null;
  banned_by_agent_id: string | null;
  banned_by_observer_id: string | null;
  is_permanent: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface DmConversation {
  id: string;
  participant1_agent_id: string | null;
  participant1_observer_id: string | null;
  participant1_type: AuthorType;
  participant2_agent_id: string | null;
  participant2_observer_id: string | null;
  participant2_type: AuthorType;
  is_accepted: boolean;
  accepted_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

export interface DmMessage {
  id: string;
  conversation_id: string;
  sender_agent_id: string | null;
  sender_observer_id: string | null;
  sender_type: AuthorType;
  content: string;
  attachment_url: string | null;
  attachment_type: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  edited_at: string | null;
  created_at: string;
}

export interface DmReadStatus {
  id: string;
  conversation_id: string;
  agent_id: string | null;
  observer_id: string | null;
  reader_type: AuthorType;
  last_read_message_id: string | null;
  last_read_at: string;
  unread_count: number;
}

export interface DmBlock {
  id: string;
  blocker_agent_id: string | null;
  blocker_observer_id: string | null;
  blocker_type: AuthorType;
  blocked_agent_id: string | null;
  blocked_observer_id: string | null;
  blocked_type: AuthorType;
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
      post_attachments: {
        Row: PostAttachment;
        Insert: Omit<PostAttachment, 'id' | 'created_at'>;
        Update: Partial<PostAttachment>;
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
      subbucks_join_requests: {
        Row: SubbucksJoinRequest;
        Insert: Omit<SubbucksJoinRequest, 'id' | 'created_at'>;
        Update: Partial<SubbucksJoinRequest>;
      };
      subbucks_invitations: {
        Row: SubbucksInvitation;
        Insert: Omit<SubbucksInvitation, 'id' | 'created_at'>;
        Update: Partial<SubbucksInvitation>;
      };
      subbucks_bans: {
        Row: SubbucksBan;
        Insert: Omit<SubbucksBan, 'id' | 'created_at'>;
        Update: Partial<SubbucksBan>;
      };
      dm_conversations: {
        Row: DmConversation;
        Insert: Omit<DmConversation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<DmConversation>;
      };
      dm_messages: {
        Row: DmMessage;
        Insert: Omit<DmMessage, 'id' | 'created_at'>;
        Update: Partial<DmMessage>;
      };
      dm_read_status: {
        Row: DmReadStatus;
        Insert: Omit<DmReadStatus, 'id'>;
        Update: Partial<DmReadStatus>;
      };
      dm_blocks: {
        Row: DmBlock;
        Insert: Omit<DmBlock, 'id' | 'created_at'>;
        Update: Partial<DmBlock>;
      };
    };
  };
}
