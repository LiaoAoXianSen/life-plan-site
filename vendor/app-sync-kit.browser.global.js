"use strict";
var AppSyncKit = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // packages/browser/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    SyncManager: () => SyncManager,
    adapters: () => adapters,
    createBrowserSyncStorage: () => createBrowserSyncStorage,
    createBrowserWebdavSyncManager: () => createBrowserWebdavSyncManager,
    createHash: () => createHash,
    createWebdavProvider: () => createWebdavProvider,
    lifePlanAdapter: () => lifePlanAdapter,
    pantryChefAdapter: () => pantryChefAdapter,
    wheelAppAdapter: () => wheelAppAdapter
  });

  // packages/sync-core/dist/browserStorage.js
  var DEFAULT_METADATA = {
    dirty: false,
    lastLocalHash: "",
    lastRemoteHash: "",
    lastSyncAt: null,
    lastPullAt: null,
    lastPushAt: null,
    lastConflictAt: null
  };
  function readJson(storage, key, fallback) {
    const raw = storage.getItem(key);
    if (!raw)
      return fallback;
    try {
      return { ...fallback, ...JSON.parse(raw) };
    } catch {
      return fallback;
    }
  }
  function createBrowserSyncStorage(options) {
    const storage = options.localStorage ?? window.localStorage;
    return {
      loadData(defaultData) {
        return readJson(storage, options.dataKey, defaultData);
      },
      saveData(data) {
        storage.setItem(options.dataKey, JSON.stringify(data));
      },
      loadMetadata(defaultMetadata) {
        return readJson(storage, options.metadataKey, { ...DEFAULT_METADATA, ...defaultMetadata });
      },
      saveMetadata(metadata) {
        storage.setItem(options.metadataKey, JSON.stringify(metadata));
      },
      loadProviderConfig(defaultConfig) {
        return readJson(storage, options.providerConfigKey, defaultConfig);
      },
      saveProviderConfig(config) {
        storage.setItem(options.providerConfigKey, JSON.stringify(config));
      }
    };
  }

  // packages/sync-core/dist/hash.js
  function stableStringify(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`);
    return `{${entries.join(",")}}`;
  }
  function createHash(value) {
    const source = stableStringify(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a:${(hash >>> 0).toString(16)}`;
  }

  // packages/sync-core/dist/syncManager.js
  var DEFAULT_METADATA2 = {
    dirty: false,
    lastLocalHash: "",
    lastRemoteHash: "",
    lastSyncAt: null,
    lastPullAt: null,
    lastPushAt: null,
    lastConflictAt: null
  };
  var SyncManager = class {
    constructor(options) {
      this.adapter = options.adapter;
      this.provider = options.provider;
      this.storage = options.storage;
      this.defaultProviderConfig = options.defaultProviderConfig;
      this.now = options.now ?? (() => /* @__PURE__ */ new Date());
    }
    loadData() {
      const defaultData = this.adapter.createDefaultData();
      const data = this.storage.loadData(defaultData);
      return this.adapter.normalizeData(data);
    }
    saveData(data) {
      const normalized = this.adapter.normalizeData(data);
      this.storage.saveData(normalized);
      const metadata = this.getMetadata();
      const lastLocalHash = this.adapter.getHash(normalized);
      this.storage.saveMetadata({
        ...metadata,
        dirty: true,
        lastLocalHash
      });
      return normalized;
    }
    getProviderConfig() {
      return this.storage.loadProviderConfig(this.defaultProviderConfig);
    }
    saveProviderConfig(config) {
      this.storage.saveProviderConfig(config);
      return config;
    }
    getMetadata() {
      const metadata = this.storage.loadMetadata(DEFAULT_METADATA2);
      return {
        ...DEFAULT_METADATA2,
        ...metadata
      };
    }
    async testConnection() {
      const config = this.getProviderConfig();
      await this.provider.healthCheck?.(config);
    }
    async sync(direction = "both") {
      const config = this.getProviderConfig();
      const localData = this.loadData();
      const metadata = this.getMetadata();
      const localHash = this.adapter.getHash(localData);
      const remoteEnvelope = await this.provider.pull(config);
      const remoteDocument = remoteEnvelope?.document ?? null;
      const remoteHash = remoteEnvelope?.hash ?? "";
      const localChanged = metadata.dirty || !!metadata.lastRemoteHash && localHash !== metadata.lastRemoteHash || !metadata.lastRemoteHash;
      const remoteChanged = !!remoteEnvelope && !!metadata.lastRemoteHash && remoteHash !== metadata.lastRemoteHash;
      if (direction === "up") {
        return this.pushCurrentData(config, localData, metadata, localHash, remoteDocument, remoteHash);
      }
      if (direction === "down") {
        return this.pullRemoteData(localData, metadata, localHash, remoteDocument, remoteHash);
      }
      if (!remoteDocument) {
        return this.pushCurrentData(config, localData, metadata, localHash, null, "");
      }
      if (!localChanged && !remoteChanged) {
        const nextMetadata2 = {
          ...metadata,
          lastPullAt: this.nowIso()
        };
        this.storage.saveMetadata(nextMetadata2);
        return {
          action: "idle",
          data: localData,
          metadata: nextMetadata2,
          document: remoteDocument
        };
      }
      if (!localChanged) {
        return this.pullRemoteData(localData, metadata, localHash, remoteDocument, remoteHash);
      }
      if (!remoteChanged) {
        return this.pushCurrentData(config, localData, metadata, localHash, remoteDocument, remoteHash);
      }
      const mergedData = this.adapter.merge(localData, remoteDocument.data);
      const mergedHash = this.adapter.getHash(mergedData);
      this.storage.saveData(mergedData);
      const pushed = await this.provider.push(config, this.createDocument(mergedData));
      const nextMetadata = {
        ...metadata,
        dirty: false,
        lastLocalHash: mergedHash,
        lastRemoteHash: pushed.hash,
        lastPushAt: this.nowIso(),
        lastSyncAt: this.nowIso(),
        lastConflictAt: this.nowIso()
      };
      this.storage.saveMetadata(nextMetadata);
      return {
        action: "merged-then-uploaded",
        data: mergedData,
        metadata: nextMetadata,
        document: pushed.document
      };
    }
    async pullRemoteData(localData, metadata, localHash, remoteDocument, remoteHash) {
      if (!remoteDocument) {
        return {
          action: "idle",
          data: localData,
          metadata,
          document: null
        };
      }
      const shouldMerge = metadata.dirty && localHash !== remoteHash;
      const nextData = shouldMerge ? this.adapter.merge(localData, remoteDocument.data) : remoteDocument.data;
      const nextHash = this.adapter.getHash(nextData);
      this.storage.saveData(nextData);
      const nextMetadata = {
        ...metadata,
        dirty: shouldMerge,
        lastLocalHash: nextHash,
        lastRemoteHash: remoteHash,
        lastPullAt: this.nowIso(),
        lastSyncAt: shouldMerge ? metadata.lastSyncAt : this.nowIso(),
        lastConflictAt: shouldMerge ? this.nowIso() : metadata.lastConflictAt
      };
      this.storage.saveMetadata(nextMetadata);
      return {
        action: shouldMerge ? "merged-locally" : "downloaded",
        data: nextData,
        metadata: nextMetadata,
        document: remoteDocument
      };
    }
    async pushCurrentData(config, localData, metadata, localHash, remoteDocument, remoteHash) {
      if (remoteDocument && remoteHash && remoteHash !== localHash && remoteHash !== metadata.lastRemoteHash) {
        const mergedData = this.adapter.merge(localData, remoteDocument.data);
        const mergedHash = this.adapter.getHash(mergedData);
        this.storage.saveData(mergedData);
        const pushed2 = await this.provider.push(config, this.createDocument(mergedData));
        const nextMetadata2 = {
          ...metadata,
          dirty: false,
          lastLocalHash: mergedHash,
          lastRemoteHash: pushed2.hash,
          lastPushAt: this.nowIso(),
          lastSyncAt: this.nowIso(),
          lastConflictAt: this.nowIso()
        };
        this.storage.saveMetadata(nextMetadata2);
        return {
          action: "merged-then-uploaded",
          data: mergedData,
          metadata: nextMetadata2,
          document: pushed2.document
        };
      }
      const pushed = await this.provider.push(config, this.createDocument(localData));
      const nextMetadata = {
        ...metadata,
        dirty: false,
        lastLocalHash: localHash,
        lastRemoteHash: pushed.hash,
        lastPushAt: this.nowIso(),
        lastSyncAt: this.nowIso()
      };
      this.storage.saveMetadata(nextMetadata);
      return {
        action: remoteDocument ? "uploaded" : "bootstrapped-remote",
        data: localData,
        metadata: nextMetadata,
        document: pushed.document
      };
    }
    createDocument(data) {
      return {
        appId: this.adapter.appId,
        schemaVersion: this.adapter.schemaVersion,
        updatedAt: this.nowIso(),
        data
      };
    }
    nowIso() {
      return this.now().toISOString();
    }
  };

  // packages/adapter-life-plan/dist/index.js
  var LIFE_PLAN_COLLECTIONS = [
    "records",
    "todos",
    "habits",
    "checkins",
    "habitPointLedger",
    "habitRewards",
    "habitCurrencies",
    "templates",
    "goals",
    "materials",
    "wheels",
    "wheelTags",
    "wheelLibraryItems",
    "wheelHistory"
  ];
  var WHEEL_DELETION_COLLECTIONS = /* @__PURE__ */ new Set([
    "wheels",
    "wheelTags",
    "wheelLibraryItems",
    "wheelHistory",
    "wheelItems"
  ]);
  function createDefaultCollectionState() {
    return LIFE_PLAN_COLLECTIONS.reduce((state, key) => {
      state[key] = [];
      return state;
    }, {});
  }
  function normalizeArray(value) {
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
  }
  function getString(item, key) {
    const value = item[key];
    return typeof value === "string" ? value : "";
  }
  function normalizeHabitCurrency(value) {
    return typeof value === "string" && value.trim() ? value.trim() : "\u91D1\u5E01";
  }
  function getHabitLedgerMergeKey(item) {
    const type = getString(item, "type");
    const sourceId = getString(item, "sourceId");
    if (sourceId && ["checkin", "milestone", "reverse", "miss", "break", "reverse-penalty"].includes(type)) {
      return `ledger:${type}:${sourceId}:${normalizeHabitCurrency(item.currency)}`;
    }
    return "";
  }
  function getItemMergeKey(item, fallbackIndex, collection = "") {
    if (!item || typeof item !== "object")
      return `value-${fallbackIndex}`;
    if (collection === "habitPointLedger")
      return getHabitLedgerMergeKey(item) || (getString(item, "id") ? `id:${getString(item, "id")}` : `value-${fallbackIndex}`);
    if (getString(item, "id"))
      return `id:${getString(item, "id")}`;
    if (getString(item, "habitId") && getString(item, "date"))
      return `habit:${getString(item, "habitId")}:${getString(item, "date")}`;
    if (getString(item, "type") && getString(item, "period"))
      return `period:${getString(item, "type")}:${getString(item, "period")}`;
    if (getString(item, "title") && getString(item, "date"))
      return `title:${getString(item, "title")}:${getString(item, "date")}`;
    return `json:${JSON.stringify(item)}`;
  }
  function getItemUpdatedTime(item) {
    if (!item || typeof item !== "object")
      return 0;
    const raw = item.updatedAt ?? item.completedAt ?? item.createdAt ?? item.date ?? item.recordTime ?? "";
    const timestamp = new Date(String(raw)).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  function getDeletedItemKey(collection, id) {
    return `${collection}:${id}`;
  }
  function buildDeletionMap(localData, remoteData) {
    const map = /* @__PURE__ */ new Map();
    [...localData.deletedItems, ...remoteData.deletedItems].forEach((item) => {
      if (!item?.collection || !item?.id)
        return;
      const key = getDeletedItemKey(item.collection, item.id);
      const current = map.get(key);
      if (!current || new Date(item.deletedAt || 0).getTime() > new Date(current.deletedAt || 0).getTime()) {
        map.set(key, item);
      }
    });
    return map;
  }
  function shouldKeepMergedItem(collection, item, deletions) {
    const id = getString(item, "id");
    if (!id)
      return true;
    const deleted = deletions.get(getDeletedItemKey(collection, id));
    if (!deleted)
      return true;
    return getItemUpdatedTime(item) > new Date(deleted.deletedAt || 0).getTime();
  }
  function mergeArrayByIdentity(collection, localItems = [], remoteItems = [], deletions = /* @__PURE__ */ new Map()) {
    const merged = /* @__PURE__ */ new Map();
    localItems.forEach((item, index) => merged.set(getItemMergeKey(item, index, collection), item));
    remoteItems.forEach((remoteItem, index) => {
      const key = getItemMergeKey(remoteItem, index, collection);
      const localItem = merged.get(key);
      if (!localItem || getItemUpdatedTime(remoteItem) >= getItemUpdatedTime(localItem)) {
        merged.set(key, remoteItem);
      }
    });
    return Array.from(merged.values()).filter((item) => shouldKeepMergedItem(collection, item, deletions));
  }
  function normalizeRecordMergeText(text = "") {
    return String(text || "").replace(/\r\n/g, "\n");
  }
  function normalizeRecordCompareText(text = "") {
    return normalizeRecordMergeText(text).replace(/[\s，。！？、；：,.!?;:"'“”‘’（）()【】[\]《》<>#\-_*`~]+/g, "");
  }
  function isTextSubsequence(needle, haystack) {
    if (!needle)
      return true;
    if (!haystack)
      return false;
    let index = 0;
    for (let i = 0; i < haystack.length && index < needle.length; i += 1) {
      if (haystack[i] === needle[index])
        index += 1;
    }
    return index === needle.length;
  }
  function isRecordTextSuperset(candidateText, otherText) {
    if (!otherText)
      return !!candidateText;
    if (!candidateText)
      return false;
    if (candidateText.includes(otherText))
      return true;
    return isTextSubsequence(normalizeRecordCompareText(otherText), normalizeRecordCompareText(candidateText));
  }
  function getRecordMergeStamp(...items) {
    const winner = items.filter(Boolean).sort((a, b) => getItemUpdatedTime(b) - getItemUpdatedTime(a))[0];
    return getString(winner, "updatedAt") || getString(winner, "createdAt") || (/* @__PURE__ */ new Date()).toISOString();
  }
  function hasRecordConflictCopy(records, originalId, contentHash) {
    return records.some((record) => record?.conflictOf === originalId && record.conflictContentHash === contentHash);
  }
  function createRecordConflictCopy(record, originalId, sourceLabel, existingRecords = []) {
    const contentHash = createHash(normalizeRecordMergeText(getString(record, "content")));
    if (!contentHash || hasRecordConflictCopy(existingRecords, originalId, contentHash))
      return null;
    const stamp = (/* @__PURE__ */ new Date()).toISOString();
    const baseTitle = getString(record, "title") || getString(record, "startDate") || getString(record, "createdAt") || "\u672A\u547D\u540D\u8BB0\u5F55";
    return {
      ...record,
      id: `${originalId}-conflict-${contentHash}`,
      title: `${baseTitle}\uFF08\u51B2\u7A81\u526F\u672C-${sourceLabel}\uFF09`,
      conflictOf: originalId,
      conflictSource: sourceLabel,
      conflictContentHash: contentHash,
      conflictCreatedAt: stamp,
      createdAt: getString(record, "createdAt") || stamp,
      updatedAt: getString(record, "updatedAt") || getString(record, "createdAt") || stamp
    };
  }
  function mergeRecordPair(localRecord, remoteRecord, existingRecords = []) {
    const localText = normalizeRecordMergeText(getString(localRecord, "content"));
    const remoteText = normalizeRecordMergeText(getString(remoteRecord, "content"));
    const localTime = getItemUpdatedTime(localRecord);
    const remoteTime = getItemUpdatedTime(remoteRecord);
    const latest = remoteTime >= localTime ? remoteRecord : localRecord;
    const older = latest === remoteRecord ? localRecord : remoteRecord;
    const olderSource = older === localRecord ? "\u672C\u5730" : "\u4E91\u7AEF";
    if (localText === remoteText) {
      return { primary: latest, conflict: null };
    }
    const localIsSuperset = isRecordTextSuperset(localText, remoteText);
    const remoteIsSuperset = isRecordTextSuperset(remoteText, localText);
    if (localIsSuperset || remoteIsSuperset) {
      const supersetRecord = remoteIsSuperset && !localIsSuperset ? remoteRecord : localRecord;
      return {
        primary: {
          ...supersetRecord,
          ...latest,
          content: getString(supersetRecord, "content"),
          updatedAt: getRecordMergeStamp(localRecord, remoteRecord)
        },
        conflict: null
      };
    }
    return {
      primary: latest,
      conflict: createRecordConflictCopy(older, getString(latest, "id") || getString(older, "id"), olderSource, existingRecords)
    };
  }
  function mergeRecordsByIdentity(localItems = [], remoteItems = [], deletions = /* @__PURE__ */ new Map()) {
    const merged = /* @__PURE__ */ new Map();
    const conflictCopies = [];
    localItems.forEach((item, index) => merged.set(getItemMergeKey(item, index, "records"), item));
    remoteItems.forEach((remoteItem, index) => {
      const key = getItemMergeKey(remoteItem, index, "records");
      const localItem = merged.get(key);
      if (!localItem) {
        merged.set(key, remoteItem);
        return;
      }
      const existingRecords = [...localItems, ...remoteItems, ...Array.from(merged.values()), ...conflictCopies];
      const { primary, conflict } = mergeRecordPair(localItem, remoteItem, existingRecords);
      merged.set(key, primary);
      if (conflict)
        conflictCopies.push(conflict);
    });
    return [...Array.from(merged.values()), ...conflictCopies].filter((item) => shouldKeepMergedItem("records", item, deletions));
  }
  function isWheelDeletionCollection(collection = "") {
    return WHEEL_DELETION_COLLECTIONS.has(collection);
  }
  function getWheelSnapshot(source = {}) {
    return {
      wheels: normalizeArray(source.wheels),
      wheelTags: normalizeArray(source.wheelTags),
      wheelLibraryItems: normalizeArray(source.wheelLibraryItems),
      wheelHistory: normalizeArray(source.wheelHistory),
      deletedItems: Array.isArray(source.deletedItems) ? source.deletedItems.filter((item) => isWheelDeletionCollection(item?.collection)) : []
    };
  }
  function getWheelEntityUpdatedTime(item) {
    return getItemUpdatedTime(item);
  }
  function mergeWheelEntities(localItems = [], remoteItems = [], collection = "", deletions = /* @__PURE__ */ new Map()) {
    const merged = /* @__PURE__ */ new Map();
    [...localItems, ...remoteItems].forEach((item, index) => {
      const key = getString(item, "id") || JSON.stringify(item) || String(index);
      const current = merged.get(key);
      if (!current || getWheelEntityUpdatedTime(item) >= getWheelEntityUpdatedTime(current)) {
        merged.set(key, item);
      }
    });
    return Array.from(merged.values()).filter((item) => !item?.deletedAt).filter((item) => !collection || shouldKeepMergedItem(collection, item, deletions));
  }
  function mergeWheelSnapshots(localSnapshot, remoteSnapshot) {
    const local = getWheelSnapshot(localSnapshot);
    const remote = getWheelSnapshot(remoteSnapshot);
    const deletions = buildDeletionMap(normalizeLifePlanData(localSnapshot), normalizeLifePlanData(remoteSnapshot));
    const remoteWheelMap = new Map(remote.wheels.map((item) => [getString(item, "id"), item]));
    return {
      wheels: mergeWheelEntities(local.wheels, remote.wheels, "wheels", deletions).map((wheel) => {
        const wheelId = getString(wheel, "id");
        const localWheel = local.wheels.find((item) => getString(item, "id") === wheelId);
        const remoteWheel = remoteWheelMap.get(wheelId);
        const baseWheel = !localWheel ? remoteWheel : !remoteWheel ? localWheel : getWheelEntityUpdatedTime(remoteWheel) >= getWheelEntityUpdatedTime(localWheel) ? remoteWheel : localWheel;
        return {
          ...baseWheel,
          items: mergeWheelEntities(normalizeArray(localWheel?.items), normalizeArray(remoteWheel?.items), "wheelItems", deletions)
        };
      }),
      wheelTags: mergeWheelEntities(local.wheelTags, remote.wheelTags, "wheelTags", deletions),
      wheelLibraryItems: mergeWheelEntities(local.wheelLibraryItems, remote.wheelLibraryItems, "wheelLibraryItems", deletions),
      wheelHistory: mergeWheelEntities(local.wheelHistory, remote.wheelHistory, "wheelHistory", deletions),
      deletedItems: Array.from(deletions.values()).filter((item) => isWheelDeletionCollection(item.collection))
    };
  }
  function pruneDeletedItems(target) {
    target.deletedItems = target.deletedItems.filter((item) => item && item.collection && item.id && item.deletedAt);
    return target;
  }
  function normalizeLifePlanData(input) {
    const source = input && typeof input === "object" ? input : {};
    const base = createDefaultCollectionState();
    LIFE_PLAN_COLLECTIONS.forEach((key) => {
      base[key] = normalizeArray(source[key]);
    });
    return {
      ...source,
      ...base,
      deletedItems: Array.isArray(source.deletedItems) ? source.deletedItems.filter((item) => !!item && typeof item === "object" && typeof item.collection === "string" && typeof item.id === "string" && typeof item.deletedAt === "string") : []
    };
  }
  var lifePlanAdapter = {
    appId: "life-plan",
    schemaVersion: 1,
    createDefaultData() {
      return normalizeLifePlanData({});
    },
    normalizeData(input) {
      return normalizeLifePlanData(input);
    },
    merge(localData, remoteData) {
      const normalizedLocal = normalizeLifePlanData(localData);
      const normalizedRemote = normalizeLifePlanData(remoteData);
      const deletions = buildDeletionMap(normalizedLocal, normalizedRemote);
      const merged = normalizeLifePlanData({ ...normalizedLocal, ...normalizedRemote });
      const wheelSnapshot = mergeWheelSnapshots(normalizedLocal, normalizedRemote);
      merged.records = mergeRecordsByIdentity(normalizedLocal.records, normalizedRemote.records, deletions);
      merged.wheels = wheelSnapshot.wheels;
      merged.wheelTags = wheelSnapshot.wheelTags;
      merged.wheelLibraryItems = wheelSnapshot.wheelLibraryItems;
      merged.wheelHistory = wheelSnapshot.wheelHistory;
      LIFE_PLAN_COLLECTIONS.forEach((collection) => {
        if (["records", "wheels", "wheelTags", "wheelLibraryItems", "wheelHistory"].includes(collection))
          return;
        merged[collection] = mergeArrayByIdentity(collection, normalizedLocal[collection], normalizedRemote[collection], deletions);
      });
      merged.deletedItems = Array.from(deletions.values());
      return pruneDeletedItems(merged);
    },
    getHash(data) {
      return createHash(data);
    },
    getStorageKeys() {
      return {
        dataKey: "lifePlanData",
        metadataKey: "lifePlanSyncState",
        providerConfigKey: "lifePlanSyncConfig"
      };
    },
    getDefaultRemotePath() {
      return "/life-plan.json";
    }
  };

  // packages/adapter-pantry-chef/dist/index.js
  function normalizeArray2(value) {
    return Array.isArray(value) ? value.filter((item) => !!item && typeof item === "object") : [];
  }
  function normalizeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  }
  function getMergeKey(item, fallbackIndex) {
    if (typeof item.id === "string" && item.id)
      return `id:${item.id}`;
    if (typeof item.name === "string" && item.name)
      return `name:${item.name}`;
    if (typeof item.label === "string" && item.label)
      return `label:${item.label}`;
    return `json:${fallbackIndex}:${JSON.stringify(item)}`;
  }
  function getUpdatedTime(item) {
    const candidate = item.updatedAt ?? item.createdAt ?? item.checkedAt ?? item.addedAt;
    const timestamp = new Date(String(candidate ?? "")).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  function mergeCollection(localItems, remoteItems) {
    const merged = /* @__PURE__ */ new Map();
    localItems.forEach((item, index) => {
      merged.set(getMergeKey(item, index), item);
    });
    remoteItems.forEach((item, index) => {
      const key = getMergeKey(item, index);
      const current = merged.get(key);
      if (!current || getUpdatedTime(item) >= getUpdatedTime(current)) {
        merged.set(key, item);
      }
    });
    return Array.from(merged.values()).filter((item) => !item.deletedAt);
  }
  function normalizePantryChefData(input) {
    const source = normalizeObject(input);
    return {
      pantry: normalizeArray2(source.pantry),
      stapleSeasonings: normalizeArray2(source.stapleSeasonings),
      shoppingList: normalizeArray2(source.shoppingList),
      preferences: normalizeObject(source.preferences)
    };
  }
  var pantryChefAdapter = {
    appId: "pantry-chef",
    schemaVersion: 1,
    createDefaultData() {
      return normalizePantryChefData({});
    },
    normalizeData(input) {
      return normalizePantryChefData(input);
    },
    merge(localData, remoteData) {
      const local = normalizePantryChefData(localData);
      const remote = normalizePantryChefData(remoteData);
      return {
        pantry: mergeCollection(local.pantry, remote.pantry),
        stapleSeasonings: mergeCollection(local.stapleSeasonings, remote.stapleSeasonings),
        shoppingList: mergeCollection(local.shoppingList, remote.shoppingList),
        preferences: {
          ...remote.preferences,
          ...local.preferences
        }
      };
    },
    getHash(data) {
      return createHash(data);
    },
    getStorageKeys() {
      return {
        dataKey: "pantryChefData",
        metadataKey: "pantryChefSyncState",
        providerConfigKey: "pantryChefSyncConfig"
      };
    },
    getDefaultRemotePath() {
      return "/apps/pantry-chef/data.json";
    }
  };

  // packages/adapter-wheel-app/dist/index.js
  function normalizeTimestamp(value) {
    const timestamp = new Date(String(value ?? "")).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  function pickLatest(left, right) {
    if (!left)
      return right;
    if (!right)
      return left;
    return normalizeTimestamp(right.updatedAt ?? right.createdAt) >= normalizeTimestamp(left.updatedAt ?? left.createdAt) ? right : left;
  }
  function mergeByLatest(localItems, remoteItems) {
    const merged = /* @__PURE__ */ new Map();
    [...localItems, ...remoteItems].forEach((item) => {
      if (!item?.id)
        return;
      const current = merged.get(item.id);
      if (!current || normalizeTimestamp(item.updatedAt ?? item.createdAt) >= normalizeTimestamp(current.updatedAt ?? current.createdAt)) {
        merged.set(item.id, item);
      }
    });
    return Array.from(merged.values()).filter((item) => !item.deletedAt);
  }
  function normalizeWheelItem(input) {
    if (!input || typeof input !== "object")
      return null;
    const item = input;
    if (!item.id || typeof item.id !== "string")
      return null;
    return {
      id: item.id,
      name: typeof item.name === "string" && item.name ? item.name : "\u672A\u547D\u540D\u9009\u9879",
      weight: Math.max(1, Number(item.weight) || 1),
      note: typeof item.note === "string" ? item.note : "",
      enabled: item.enabled !== false,
      tagIds: Array.isArray(item.tagIds) ? item.tagIds.filter((entry) => typeof entry === "string" && entry.length > 0) : void 0,
      sourceLibraryItemId: typeof item.sourceLibraryItemId === "string" && item.sourceLibraryItemId ? item.sourceLibraryItemId : void 0,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : void 0,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : item.createdAt,
      deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : void 0
    };
  }
  function normalizeWheelTag(input) {
    if (!input || typeof input !== "object")
      return null;
    const tag = input;
    if (!tag.id || typeof tag.id !== "string")
      return null;
    return {
      id: tag.id,
      name: typeof tag.name === "string" && tag.name ? tag.name : "\u672A\u547D\u540D\u6807\u7B7E",
      color: typeof tag.color === "string" && tag.color ? tag.color : "#216e4e",
      weight: Math.max(1, Number(tag.weight) || 1),
      enabled: tag.enabled !== false,
      createdAt: typeof tag.createdAt === "string" ? tag.createdAt : void 0,
      updatedAt: typeof tag.updatedAt === "string" ? tag.updatedAt : tag.createdAt,
      deletedAt: typeof tag.deletedAt === "string" ? tag.deletedAt : void 0
    };
  }
  function normalizeWheelHistoryItem(input) {
    if (!input || typeof input !== "object")
      return null;
    const item = input;
    if (!item.id || typeof item.id !== "string")
      return null;
    return {
      id: item.id,
      wheelId: typeof item.wheelId === "string" ? item.wheelId : "",
      wheelName: typeof item.wheelName === "string" && item.wheelName ? item.wheelName : "\u672A\u547D\u540D\u8F6C\u76D8",
      mode: item.mode === "tag" ? "tag" : "normal",
      tagId: typeof item.tagId === "string" && item.tagId ? item.tagId : void 0,
      tagName: typeof item.tagName === "string" && item.tagName ? item.tagName : void 0,
      resultId: typeof item.resultId === "string" && item.resultId ? item.resultId : void 0,
      resultName: typeof item.resultName === "string" && item.resultName ? item.resultName : "\u672A\u547D\u540D\u7ED3\u679C",
      note: typeof item.note === "string" ? item.note : "",
      convertedTodoId: typeof item.convertedTodoId === "string" ? item.convertedTodoId : "",
      createdAt: typeof item.createdAt === "string" ? item.createdAt : void 0,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : item.createdAt,
      deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : void 0
    };
  }
  function normalizeWheel(input) {
    if (!input || typeof input !== "object")
      return null;
    const wheel = input;
    if (!wheel.id || typeof wheel.id !== "string")
      return null;
    return {
      id: wheel.id,
      name: typeof wheel.name === "string" && wheel.name ? wheel.name : "\u672A\u547D\u540D\u8F6C\u76D8",
      mode: wheel.mode === "tag" ? "tag" : "normal",
      items: Array.isArray(wheel.items) ? wheel.items.map(normalizeWheelItem).filter((item) => !!item) : [],
      tagIds: Array.isArray(wheel.tagIds) ? wheel.tagIds.filter((entry) => typeof entry === "string" && entry.length > 0) : void 0,
      createdAt: typeof wheel.createdAt === "string" ? wheel.createdAt : void 0,
      updatedAt: typeof wheel.updatedAt === "string" ? wheel.updatedAt : wheel.createdAt,
      deletedAt: typeof wheel.deletedAt === "string" ? wheel.deletedAt : void 0
    };
  }
  function normalizeWheelSnapshot(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      wheels: Array.isArray(source.wheels) ? source.wheels.map(normalizeWheel).filter((item) => !!item) : [],
      wheelTags: Array.isArray(source.wheelTags) ? source.wheelTags.map(normalizeWheelTag).filter((item) => !!item) : [],
      wheelLibraryItems: Array.isArray(source.wheelLibraryItems) ? source.wheelLibraryItems.map(normalizeWheelItem).filter((item) => !!item) : [],
      wheelHistory: Array.isArray(source.wheelHistory) ? source.wheelHistory.map(normalizeWheelHistoryItem).filter((item) => !!item) : []
    };
  }
  var wheelAppAdapter = {
    appId: "wheel-app",
    schemaVersion: 1,
    createDefaultData() {
      return normalizeWheelSnapshot({});
    },
    normalizeData(input) {
      return normalizeWheelSnapshot(input);
    },
    merge(localData, remoteData) {
      const local = normalizeWheelSnapshot(localData);
      const remote = normalizeWheelSnapshot(remoteData);
      const remoteWheelMap = new Map(remote.wheels.map((wheel) => [wheel.id, wheel]));
      return {
        wheels: mergeByLatest(local.wheels, remote.wheels).map((wheel) => {
          const localWheel = local.wheels.find((item) => item.id === wheel.id);
          const remoteWheel = remoteWheelMap.get(wheel.id);
          const baseWheel = pickLatest(localWheel, remoteWheel) ?? wheel;
          return {
            ...baseWheel,
            items: mergeByLatest(localWheel?.items ?? [], remoteWheel?.items ?? [])
          };
        }),
        wheelTags: mergeByLatest(local.wheelTags, remote.wheelTags),
        wheelLibraryItems: mergeByLatest(local.wheelLibraryItems, remote.wheelLibraryItems),
        wheelHistory: mergeByLatest(local.wheelHistory, remote.wheelHistory)
      };
    },
    getHash(data) {
      return createHash(data);
    },
    getStorageKeys() {
      return {
        dataKey: "wheelAppData",
        metadataKey: "wheelAppSyncState",
        providerConfigKey: "wheelAppSyncConfig"
      };
    },
    getDefaultRemotePath() {
      return "/apps/wheel-app/data.json";
    }
  };

  // packages/provider-webdav/dist/index.js
  async function request(fetchImpl, endpoint, remotePath, method, body, acceptedStatuses = [200, 201, 204, 207]) {
    const base = `${endpoint.replace(/\/+$/, "")}/`;
    const target = remotePath.replace(/^\/+/, "");
    const response = await fetchImpl(base + target, {
      method,
      mode: "cors",
      headers: body ? { "Content-Type": "application/json; charset=utf-8" } : void 0,
      body
    });
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      const detail = await response.clone().text().catch(() => "");
      throw new Error(`WebDAV ${method} failed: ${response.status}${detail ? ` ${detail.slice(0, 120)}` : ""}`);
    }
    return response;
  }
  function normalizeRemotePath(remotePath) {
    return remotePath.startsWith("/") ? remotePath : `/${remotePath}`;
  }
  function getParentFolders(remotePath) {
    const segments = normalizeRemotePath(remotePath).split("/").filter(Boolean).slice(0, -1);
    const folders = [];
    let current = "";
    segments.forEach((segment) => {
      current += `/${segment}`;
      folders.push(current);
    });
    return folders;
  }
  async function ensureRemoteFolders(fetchImpl, endpoint, remotePath) {
    const folders = getParentFolders(remotePath);
    for (const folder of folders) {
      await request(fetchImpl, endpoint, folder, "MKCOL", void 0, [200, 201, 204, 207, 405]);
    }
  }
  function toEnvelope(config, payload) {
    const candidate = payload;
    if (config.writeMode !== "legacy-raw-data" && candidate?.appId && candidate?.schemaVersion && "data" in candidate) {
      const document = candidate;
      return {
        document,
        hash: createHash(document.data)
      };
    }
    return {
      document: {
        appId: "legacy-app",
        schemaVersion: 1,
        updatedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
        data: payload
      },
      hash: createHash(payload)
    };
  }
  function createWebdavProvider(options = {}) {
    const fetchImpl = options.fetchImpl ?? fetch;
    return {
      async pull(config) {
        try {
          const response = await request(fetchImpl, config.endpoint, config.remotePath, "GET");
          const text = await response.text();
          if (!text.trim())
            return null;
          return toEnvelope(config, JSON.parse(text));
        } catch (error) {
          if (error instanceof Error && error.message.includes(" 404")) {
            return null;
          }
          throw error;
        }
      },
      async push(config, document) {
        const remotePath = normalizeRemotePath(config.remotePath);
        const payload = config.writeMode === "legacy-raw-data" ? JSON.stringify(document.data, null, 2) : JSON.stringify(document, null, 2);
        await ensureRemoteFolders(fetchImpl, config.endpoint, remotePath);
        await request(fetchImpl, config.endpoint, remotePath, "PUT", payload);
        return {
          document,
          hash: createHash(document.data)
        };
      },
      async healthCheck(config) {
        const remotePath = normalizeRemotePath(config.remotePath);
        const folderPath = remotePath.split("/").slice(0, -1).join("/") || "/";
        await request(fetchImpl, config.endpoint, folderPath, "PROPFIND");
      }
    };
  }

  // packages/browser/src/index.ts
  function createBrowserWebdavSyncManager(options) {
    const storageKeys = options.adapter.getStorageKeys();
    const storageOptions = {
      ...storageKeys,
      localStorage: options.localStorage
    };
    return new SyncManager({
      adapter: options.adapter,
      provider: createWebdavProvider({ fetchImpl: options.fetchImpl }),
      storage: createBrowserSyncStorage(storageOptions),
      defaultProviderConfig: {
        endpoint: options.endpoint,
        remotePath: options.remotePath ?? options.adapter.getDefaultRemotePath(),
        writeMode: options.writeMode ?? "legacy-raw-data"
      },
      now: options.now
    });
  }
  var adapters = {
    lifePlan: lifePlanAdapter,
    pantryChef: pantryChefAdapter,
    wheelApp: wheelAppAdapter
  };
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=app-sync-kit.browser.global.js.map
