import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { lifePlanRepository } from '../services/lifePlanRepository';
import { notifyMainDataUserCommit } from '../services/mainCloudSync';
import { normalizeTopLevelData, type LifePlanData } from '../types/lifePlan';

export const useLifePlanStore = defineStore('lifePlan', () => {
  const data = ref<LifePlanData>(normalizeTopLevelData({}));
  const isLoaded = ref(false);
  const lastError = ref('');

  const openTodos = computed(() => data.value.todos.filter(todo => !todo.done));

  function load() {
    if (isLoaded.value) return;
    data.value = lifePlanRepository.load();
    isLoaded.value = true;
  }

  function commit(reason: string, source: 'user' | 'sync' = 'user') {
    try {
      data.value = lifePlanRepository.commit(data.value, reason, source);
      lastError.value = '';
      if (source === 'user') notifyMainDataUserCommit();
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  function mutate(reason: string, mutation: (draft: LifePlanData) => void, source: 'user' | 'sync' = 'user') {
    mutation(data.value);
    commit(reason, source);
  }

  function replace(next: LifePlanData, reason: string, source: 'user' | 'sync' = 'user') {
    data.value = normalizeTopLevelData(next);
    commit(reason, source);
  }

  function importData(raw: unknown) {
    data.value = lifePlanRepository.mergeImport(data.value, raw);
  }

  function exportData() {
    lifePlanRepository.exportData(data.value);
  }

  return { data, isLoaded, lastError, openTodos, load, commit, mutate, replace, importData, exportData };
});
