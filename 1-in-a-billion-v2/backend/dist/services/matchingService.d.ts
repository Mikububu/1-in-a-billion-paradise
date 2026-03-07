/**
 * MATCHING SERVICE
 *
 * Handles user matching, gallery, and chat functionality.
 */
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
/**
 * Get gallery of all users with AI portraits
 */
export declare function getGallery(options?: {
    limit?: number;
    offset?: number;
    excludeUserId?: string;
}): Promise<GalleryPerson[]>;
/**
 * Get random selection from gallery
 */
export declare function getRandomGallery(count?: number, excludeUserId?: string): Promise<GalleryPerson[]>;
/**
 * Create a new match between two users
 */
export declare function createMatch(user1Id: string, user2Id: string, options?: {
    person1Id?: string;
    person2Id?: string;
    compatibilityScore?: number;
    matchReason?: string;
    systemsMatched?: string[];
}): Promise<{
    matchId: string;
} | null>;
/**
 * Get all matches for a user
 */
export declare function getUserMatches(userId: string): Promise<Match[]>;
/**
 * Mark a match as seen by a user
 */
export declare function markMatchSeen(matchId: string, userId: string): Promise<boolean>;
/**
 * Get all conversations for a user
 */
export declare function getUserConversations(userId: string): Promise<Conversation[]>;
/**
 * Get messages for a conversation
 */
export declare function getConversationMessages(conversationId: string, options?: {
    limit?: number;
    before?: string;
}): Promise<Message[]>;
/**
 * Send a message in a conversation
 */
export declare function sendMessage(conversationId: string, senderId: string, content: string, messageType?: string): Promise<Message | null>;
/**
 * Mark messages as read
 */
export declare function markMessagesRead(conversationId: string, userId: string): Promise<boolean>;
//# sourceMappingURL=matchingService.d.ts.map