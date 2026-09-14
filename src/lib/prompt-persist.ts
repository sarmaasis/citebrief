import type { PromptDraft, PromptMix } from "@/lib/prompts";

export type StoredPrompt = {
  id: string;
  text: string;
  mix: string;
  sortOrder: number;
  archivedAt: Date | null;
};

export type PromptSaveUpdate = {
  id: string;
  text: string;
  mix: PromptMix;
  sortOrder: number;
  unarchive: boolean;
};

export type PromptSaveInsert = {
  text: string;
  mix: PromptMix;
  sortOrder: number;
};

export type PromptSavePlan = {
  updates: PromptSaveUpdate[];
  inserts: PromptSaveInsert[];
  archiveIds: string[];
};

/** Normalize prompt text for stable matching across regenerate/save. */
export function normalizePromptKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Plan a prompt set save without hard deletes.
 * - Reuses IDs by draft.id, then by normalized text (active, then archived).
 * - Archives active prompts that drop out of the new set.
 * - Never deletes rows (preserves run_rows FK / historical metrics).
 */
export function planPromptSave(existing: StoredPrompt[], drafts: PromptDraft[]): PromptSavePlan {
  const active = existing.filter((row) => !row.archivedAt);
  const archived = existing.filter((row) => row.archivedAt);

  const activeById = new Map(active.map((row) => [row.id, row]));
  const activeByKey = new Map<string, StoredPrompt[]>();
  for (const row of active) {
    const key = normalizePromptKey(row.text);
    const list = activeByKey.get(key) ?? [];
    list.push(row);
    activeByKey.set(key, list);
  }
  const archivedByKey = new Map<string, StoredPrompt[]>();
  for (const row of archived) {
    const key = normalizePromptKey(row.text);
    const list = archivedByKey.get(key) ?? [];
    list.push(row);
    archivedByKey.set(key, list);
  }

  const usedIds = new Set<string>();
  const updates: PromptSaveUpdate[] = [];
  const inserts: PromptSaveInsert[] = [];

  for (const draft of drafts) {
    let match: StoredPrompt | undefined;

    if (draft.id && !usedIds.has(draft.id) && activeById.has(draft.id)) {
      match = activeById.get(draft.id);
    }

    const key = normalizePromptKey(draft.text);
    if (!match) {
      match = (activeByKey.get(key) ?? []).find((row) => !usedIds.has(row.id));
    }
    if (!match) {
      match = (archivedByKey.get(key) ?? []).find((row) => !usedIds.has(row.id));
    }

    if (match) {
      usedIds.add(match.id);
      updates.push({
        id: match.id,
        text: draft.text.trim(),
        mix: draft.mix,
        sortOrder: draft.sortOrder,
        unarchive: Boolean(match.archivedAt),
      });
      continue;
    }

    inserts.push({
      text: draft.text.trim(),
      mix: draft.mix,
      sortOrder: draft.sortOrder,
    });
  }

  return {
    updates,
    inserts,
    archiveIds: active.filter((row) => !usedIds.has(row.id)).map((row) => row.id),
  };
}
