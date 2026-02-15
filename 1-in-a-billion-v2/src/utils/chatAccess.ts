import type { EntitlementState } from '@/store/authStore';

export const CHAT_RENEW_MODAL_MESSAGE = 'Matching plan expired. Reactivate to chat.';
export const CHAT_RENEW_PRIMARY_LABEL = 'Renew now';
export const CHAT_RENEW_SECONDARY_LABEL = 'Not now';
export const CHAT_RENEW_WARNING_TEXT = CHAT_RENEW_MODAL_MESSAGE;

export function isChatAccessBlocked(state: EntitlementState | null | undefined): boolean {
  return state === 'inactive';
}
