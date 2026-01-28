/**
 * MATCHING SERVICE
 * 
 * Handles user matching, gallery, and chat functionality.
 */

import { createSupabaseServiceClient } from './supabaseClient';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface GalleryPerson {
  id: string;
  userId: string;
  displayName: string;
  portraitUrl: string | null;
  sunSign: string | null;
  moonSign: string | null;
  risingSign: string | null;
  bio: string | null;
  lastActiveAt: string | null;
}

export interface Match {
  id: string;
  otherUserId: string;
  otherPersonId: string;
  otherName: string;
  otherPortraitUrl: string | null;
  compatibilityScore: number | null;
  matchReason: string | null;
  systemsMatched: string[];
  status: string;
  seenAt: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  matchId: string;
  otherName: string;
  otherPortraitUrl: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  status: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  isSystemMessage: boolean;
  readAt: string | null;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// GALLERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get gallery of all users with AI portraits
 */
export async function getGallery(options?: {
  limit?: number;
  offset?: number;
  excludeUserId?: string;
}): Promise<GalleryPerson[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  let query = supabase
    .from('library_people')
    .select(`
      user_id,
      client_person_id,
      name,
      portrait_url,
      placements,
      updated_at
    `)
    .not('portrait_url', 'is', null)
    .eq('is_user', true)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (options?.excludeUserId) {
    query = query.neq('user_id', options.excludeUserId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Gallery fetch error:', error);
    return [];
  }

  return (data || []).map((p: any) => ({
    id: p.client_person_id, // Use client_person_id as the unique identifier
    userId: p.user_id,
    displayName: p.name,
    portraitUrl: p.portrait_url,
    sunSign: p.placements?.sunSign || null,
    moonSign: p.placements?.moonSign || null,
    risingSign: p.placements?.risingSign || null,
    bio: null, // Bio feature not implemented yet
    lastActiveAt: p.updated_at,
  }));
}

/**
 * Get random selection from gallery
 */
export async function getRandomGallery(count: number = 20, excludeUserId?: string): Promise<GalleryPerson[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  // Fetch more than needed, then shuffle client-side (Supabase doesn't have random sort)
  let query = supabase
    .from('library_people')
    .select(`
      user_id,
      client_person_id,
      name,
      portrait_url,
      placements,
      updated_at
    `)
    .not('portrait_url', 'is', null)
    .eq('is_user', true)
    .limit(count * 3);

  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Random gallery error:', error);
    return [];
  }

  // Shuffle and take requested count
  const shuffled = (data || []).sort(() => Math.random() - 0.5).slice(0, count);

  return shuffled.map((p: any) => ({
    id: p.client_person_id, // Use client_person_id as the unique identifier
    userId: p.user_id,
    displayName: p.name,
    portraitUrl: p.portrait_url,
    sunSign: p.placements?.sunSign || null,
    moonSign: p.placements?.moonSign || null,
    risingSign: p.placements?.risingSign || null,
    bio: null, // Bio feature not implemented yet
    lastActiveAt: p.updated_at,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// MATCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new match between two users
 */
export async function createMatch(
  user1Id: string,
  user2Id: string,
  options?: {
    person1Id?: string;
    person2Id?: string;
    compatibilityScore?: number;
    matchReason?: string;
    systemsMatched?: string[];
  }
): Promise<{ matchId: string } | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('create_match', {
    p_user1_id: user1Id,
    p_user2_id: user2Id,
    p_person1_id: options?.person1Id || null,
    p_person2_id: options?.person2Id || null,
    p_compatibility_score: options?.compatibilityScore || null,
    p_match_reason: options?.matchReason || null,
    p_systems_matched: JSON.stringify(options?.systemsMatched || []),
  });

  if (error) {
    console.error('Create match error:', error);
    return null;
  }

  return { matchId: data };
}

/**
 * Get all matches for a user
 */
export async function getUserMatches(userId: string): Promise<Match[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('matches')
    .select(`
      id,
      user1_id,
      user2_id,
      person1_id,
      person2_id,
      compatibility_score,
      match_reason,
      systems_matched,
      status,
      user1_seen_at,
      user2_seen_at,
      created_at,
      person1:person1_id (display_name, portrait_url),
      person2:person2_id (display_name, portrait_url)
    `)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Get matches error:', error);
    return [];
  }

  return (data || []).map((m: any) => {
    const isUser1 = m.user1_id === userId;
    const otherPerson = isUser1 ? m.person2 : m.person1;
    
    return {
      id: m.id,
      otherUserId: isUser1 ? m.user2_id : m.user1_id,
      otherPersonId: isUser1 ? m.person2_id : m.person1_id,
      otherName: otherPerson?.display_name || 'Unknown',
      otherPortraitUrl: otherPerson?.portrait_url || null,
      compatibilityScore: m.compatibility_score,
      matchReason: m.match_reason,
      systemsMatched: m.systems_matched || [],
      status: m.status,
      seenAt: isUser1 ? m.user1_seen_at : m.user2_seen_at,
      createdAt: m.created_at,
    };
  });
}

/**
 * Mark a match as seen by a user
 */
export async function markMatchSeen(matchId: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return false;

  // First get the match to determine which user column to update
  const { data: match } = await supabase
    .from('matches')
    .select('user1_id, user2_id')
    .eq('id', matchId)
    .single();

  if (!match) return false;

  const column = match.user1_id === userId ? 'user1_seen_at' : 'user2_seen_at';

  const { error } = await supabase
    .from('matches')
    .update({ [column]: new Date().toISOString() })
    .eq('id', matchId);

  return !error;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all conversations for a user
 */
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      match_id,
      last_message_at,
      last_message_preview,
      user1_unread_count,
      user2_unread_count,
      status,
      match:match_id (
        user1_id,
        user2_id,
        person1:person1_id (display_name, portrait_url),
        person2:person2_id (display_name, portrait_url)
      )
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Get conversations error:', error);
    return [];
  }

  // Filter to only include conversations where user is a participant
  return (data || [])
    .filter((c: any) => c.match?.user1_id === userId || c.match?.user2_id === userId)
    .map((c: any) => {
      const isUser1 = c.match?.user1_id === userId;
      const otherPerson = isUser1 ? c.match?.person2 : c.match?.person1;

      return {
        id: c.id,
        matchId: c.match_id,
        otherName: otherPerson?.display_name || 'Unknown',
        otherPortraitUrl: otherPerson?.portrait_url || null,
        lastMessageAt: c.last_message_at,
        lastMessagePreview: c.last_message_preview,
        unreadCount: isUser1 ? c.user1_unread_count : c.user2_unread_count,
        status: c.status,
      };
    });
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  options?: { limit?: number; before?: string }
): Promise<Message[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50);

  if (options?.before) {
    query = query.lt('created_at', options.before);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Get messages error:', error);
    return [];
  }

  return (data || []).reverse().map((m: any) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    content: m.content,
    messageType: m.message_type,
    isSystemMessage: m.is_system_message,
    readAt: m.read_at,
    createdAt: m.created_at,
  }));
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  messageType: string = 'text'
): Promise<Message | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType,
    })
    .select()
    .single();

  if (error) {
    console.error('Send message error:', error);
    return null;
  }

  return {
    id: data.id,
    conversationId: data.conversation_id,
    senderId: data.sender_id,
    content: data.content,
    messageType: data.message_type,
    isSystemMessage: data.is_system_message,
    readAt: data.read_at,
    createdAt: data.created_at,
  };
}

/**
 * Mark messages as read
 */
export async function markMessagesRead(conversationId: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);

  return !error;
}
