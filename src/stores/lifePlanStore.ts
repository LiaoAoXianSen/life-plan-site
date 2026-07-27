import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { lifePlanRepository } from '../services/lifePlanRepository';
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
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  function replace(next: LifePlanData, reason: string, source: 'user' | 'sync' = 'user') {
    data.value = normalizeTopLevelData(next);
    commit(reason, source);
  }

  return { data, isLoaded, lastError, openTodos, load, commit, replace };
});
