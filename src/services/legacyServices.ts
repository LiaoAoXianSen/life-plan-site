import '../../sync-service.js';
import '../../snapshot-service.js';
import '../../records-service.js';
import '../../todos-service.js';
import '../../habit-service.js';
import '../../fitness-service.js';
import '../../ai-service.js';

import type { LifePlanData } from '../types/lifePlan';

type LegacyFactory = { create: (options?: Record<string, unknown>) => any };

declare global {
  interface Window {
    LifePlanSyncService: LegacyFactory;
    LifePlanSnapshotService: LegacyFactory;
    LifePlanRecordsService: LegacyFactory;
    LifePlanTodosService: LegacyFactory;
    LifePlanHabitService: LegacyFactory;
    LifePlanFitnessService: LegacyFactory;
    LifePlanAiService: LegacyFactory;
    AppSyncKit?: unknown;
  }
}

const urgencyMeta = {
  urgent: { label: '紧急', rank: 4 },
  high: { label: '高', rank: 3 },
  medium: { label: '中', rank: 2 },
  low: { label: '低', rank: 1 },
};

export function getTodayStr(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function getNowLocal(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${getTodayStr(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function genId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function formatDate(value = ''): string {
  if (!value) return '';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function createLegacyServices() {
  const sync = window.LifePlanSyncService.create({
    appSyncKit: () => window.AppSyncKit,
    fetchImpl: (...args: Parameters<typeof fetch>) => fetch(...args),
    getNowLocal,
    normalizeHabitCurrency: (value: unknown) => String(value || '金币').trim() || '金币',
    defaultCurrency: '金币',
  });
  const todos = window.LifePlanTodosService.create({
    urgencyMeta,
    formatDate,
    getTodayStr,
    getNowLocal,
    formatClockTime: (date: Date) => date.toTimeString().slice(0, 5),
    genId,
  });
  const records = window.LifePlanRecordsService.create({
    ideaStatusOptions: ['待整理', '待实践', '实践中', '已验证', '已放弃'],
    ideaUnprocessedStatuses: new Set(['待整理', '待实践']),
    normalizeTagList: (value: unknown) => Array.from(new Set(
      (Array.isArray(value) ? value : String(value || '').split(/[,，、;；/\s]+/))
        .map(item => String(item || '').trim()).filter(Boolean),
    )),
    formatDate,
    formatLocalDateKey: getTodayStr,
  });
  const snapshots = window.LifePlanSnapshotService.create({
    storage: localStorage,
    key: 'lifePlanSnapshots',
    maxSnapshots: 20,
    schemaVersion: 2,
    genId,
    getHash: (data: LifePlanData) => sync.getDataHash(data),
    getNowLocal,
  });
  const fitness = window.LifePlanFitnessService.create({ getTodayStr, getNowLocal, genId });
  const ai = window.LifePlanAiService.create({ urgencyMeta, getTodayStr, getNowLocal, fetchImpl: (...args: Parameters<typeof fetch>) => fetch(...args) });

  return { sync, todos, records, snapshots, fitness, ai, urgencyMeta };
}
