/**
 * CHAT & MATCHING ROUTES
 * 
 * API endpoints for:
 * - Gallery of claymation portraits
 * - User matches
 * - Chat conversations and messages
 */

import { Hono } from 'hono';
import {
  getGallery,
  getRandomGallery,
  createMatch,
  getUserMatches,
  markMatchSeen,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  markMessagesRead,
} from '../services/matchingService';

const router = new Hono();

// ═══════════════════════════════════════════════════════════════════════════
// GALLERY ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/gallery
 * Get worldwide gallery of claymation portraits
 */
router.get('/gallery', async (c) => {
  const userId = c.req.header('X-User-Id');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const gallery = await getGallery({
    limit,
    offset,
    excludeUserId: userId || undefined,
  });

  return c.json({ success: true, gallery, count: gallery.length });
});

/**
 * GET /api/chat/gallery/random
 * Get random selection of claymation portraits
 * NOTE: Includes the user's own profile so they can view it
 */
router.get('/gallery/random', async (c) => {
  const count = parseInt(c.req.query('count') || '20');

  // Don't exclude the user - they should be able to see their own portrait in the gallery
  const gallery = await getRandomGallery(count);

  return c.json({ success: true, gallery, count: gallery.length });
});

// ═══════════════════════════════════════════════════════════════════════════
// MATCH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/matches
 * Get all matches for the current user
 */
router.get('/matches', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  const matches = await getUserMatches(userId);
  const unseenCount = matches.filter(m => !m.seenAt).length;

  return c.json({
    success: true,
    matches,
    count: matches.length,
    unseenCount,
  });
});

/**
 * POST /api/chat/matches
 * Create a new match (admin/system use)
 */
router.post('/matches', async (c) => {
  try {
    const body = await c.req.json();
    const { user1Id, user2Id, person1Id, person2Id, compatibilityScore, matchReason, systemsMatched } = body;

    if (!user1Id || !user2Id) {
      return c.json({ success: false, error: 'Missing user IDs' }, 400);
    }

    const result = await createMatch(user1Id, user2Id, {
      person1Id,
      person2Id,
      compatibilityScore,
      matchReason,
      systemsMatched,
    });

    if (!result) {
      return c.json({ success: false, error: 'Failed to create match' }, 500);
    }

    return c.json({ success: true, matchId: result.matchId });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/chat/matches/:matchId/seen
 * Mark a match as seen
 */
router.post('/matches/:matchId/seen', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  const matchId = c.req.param('matchId');
  const success = await markMatchSeen(matchId, userId);

  return c.json({ success });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/conversations
 * Get all conversations for the current user
 */
router.get('/conversations', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  const conversations = await getUserConversations(userId);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return c.json({
    success: true,
    conversations,
    count: conversations.length,
    totalUnread,
  });
});

/**
 * GET /api/chat/conversations/:conversationId/messages
 * Get messages for a conversation
 */
router.get('/conversations/:conversationId/messages', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  const conversationId = c.req.param('conversationId');
  const limit = parseInt(c.req.query('limit') || '50');
  const before = c.req.query('before');

  const messages = await getConversationMessages(conversationId, { limit, before });

  return c.json({ success: true, messages, count: messages.length });
});

/**
 * POST /api/chat/conversations/:conversationId/messages
 * Send a message
 */
router.post('/conversations/:conversationId/messages', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  try {
    const conversationId = c.req.param('conversationId');
    const body = await c.req.json();
    const { content, messageType } = body;

    if (!content) {
      return c.json({ success: false, error: 'Missing message content' }, 400);
    }

    const message = await sendMessage(conversationId, userId, content, messageType);

    if (!message) {
      return c.json({ success: false, error: 'Failed to send message' }, 500);
    }

    return c.json({ success: true, message });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/chat/conversations/:conversationId/read
 * Mark all messages in a conversation as read
 */
router.post('/conversations/:conversationId/read', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  const conversationId = c.req.param('conversationId');
  const success = await markMessagesRead(conversationId, userId);

  return c.json({ success });
});

export default router;
