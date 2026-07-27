export type DataEntity = Record<string, unknown> & { id?: string; updatedAt?: string; createdAt?: string };

export interface Todo extends DataEntity {
  id: string;
  text: string;
  note: string;
  done: boolean;
  dueDate: string;
  planStartDate: string;
  planEndDate: string;
  urgency: 'urgent' | 'high' | 'medium' | 'low';
  group: string;
  subTodos: Array<{ text: string; done: boolean }>;
  sessions: Array<Record<string, unknown>>;
  completedAt: string;
  sourceType: string;
  sourceRecordId: string;
  sourceMatchKey: string;
}

export interface LifePlanData {
  records: DataEntity[];
  todos: Todo[];
  habits: DataEntity[];
  checkins: DataEntity[];
  habitPointLedger: DataEntity[];
  habitRewards: DataEntity[];
  habitCurrencies: DataEntity[];
  templates: DataEntity[];
  goals: DataEntity[];
  deletedItems: DataEntity[];
  materials: DataEntity[];
  bodyMetrics: DataEntity[];
  fitnessPlans: DataEntity[];
  fitnessWorkouts: DataEntity[];
  exerciseLibrary: DataEntity[];
  wheels: DataEntity[];
  wheelTags: DataEntity[];
  wheelLibraryItems: DataEntity[];
  wheelHistory: DataEntity[];
}

export const collectionKeys = [
  'records', 'todos', 'habits', 'checkins', 'habitPointLedger', 'habitRewards', 'habitCurrencies',
  'templates', 'goals', 'deletedItems', 'materials', 'bodyMetrics', 'fitnessPlans', 'fitnessWorkouts',
  'exerciseLibrary', 'wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory',
] as const satisfies ReadonlyArray<keyof LifePlanData>;

export function createEmptyLifePlanData(): LifePlanData {
  return Object.fromEntries(collectionKeys.map(key => [key, []])) as unknown as LifePlanData;
}

export function normalizeTopLevelData(value: unknown): LifePlanData {
  const source = value && typeof value === 'object' ? value as Partial<LifePlanData> : {};
  const target = { ...source } as LifePlanData;
  collectionKeys.forEach(key => {
    if (!Array.isArray(target[key])) target[key] = [];
  });
  return target;
}
