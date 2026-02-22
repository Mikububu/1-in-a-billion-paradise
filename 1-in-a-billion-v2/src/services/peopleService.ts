import { useProfileStore } from '@/store/profileStore';
import { syncPeopleToSupabase, deletePersonFromSupabase as deletePersonFromCloud } from '@/services/peopleCloud';

export async function insertPersonToSupabase(userId: string, person: any) {
  if (!userId) {
    return { success: false, error: 'Missing userId' };
  }

  const statePeople = useProfileStore.getState().people || [];
  const exists = statePeople.some((p) => p.id === person?.id);
  const people = exists ? statePeople : [...statePeople, person];

  const result = await syncPeopleToSupabase(userId, people as any);
  if (!result.success) {
    return { success: false, error: result.error || 'Sync failed' };
  }

  return { success: true };
}

export async function deletePersonFromSupabase(userId: string, personId: string) {
  if (!userId) {
    return { success: false, error: 'Missing userId' };
  }
  if (!personId) {
    return { success: false, error: 'Missing personId' };
  }

  return await deletePersonFromCloud(userId, personId);
}
