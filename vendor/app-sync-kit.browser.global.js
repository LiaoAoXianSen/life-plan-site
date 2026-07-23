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
    habitAppAdapter: () => habitAppAdapter,
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

  // packages/sync-core/dist/types.js
  var SyncHttpError = class extends Error {
    constructor(message, options = { status: 0 }) {
      super(message);
      this.name = "SyncHttpError";
      this.status = options.status;
      this.method = options.method || "";
      this.etag = options.etag || "";
    }
  };
  function isConditionalWriteConflict(error) {
    if (!error || typeof error !== "object")
      return false;
    const status = Number(error.status || 0);
    return status === 412;
  }

  // packages/sync-core/dist/syncManager.js
  var DEFAULT_METADATA2 = {
    dirty: false,
    lastLocalHash: "",
    lastRemoteHash: "",
    lastRemoteEtag: "",
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
        ...metadata,
        lastRemoteEtag: metadata.lastRemoteEtag || ""
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
      const remoteHash = remoteDocument ? this.adapter.getHash(remoteDocument.data) : "";
      const remoteEtag = remoteEnvelope?.etag || "";
      const localChanged = metadata.dirty || !!metadata.lastRemoteHash && localHash !== metadata.lastRemoteHash || !metadata.lastRemoteHash && !!remoteDocument && localHash !== remoteHash;
      const remoteChanged = !!remoteDocument && (!!metadata.lastRemoteHash && remoteHash !== metadata.lastRemoteHash || !metadata.lastRemoteHash && remoteHash !== localHash);
      if (direction === "up") {
        return this.pushCurrentData(config, localData, metadata, localHash, remoteDocument, remoteHash, remoteEtag);
      }
      if (direction === "down") {
        return this.pullRemoteData(localData, metadata, localHash, remoteDocument, remoteHash, remoteEtag);
      }
      if (!remoteDocument) {
        return this.pushCurrentData(config, localData, metadata, localHash, null, "", "");
      }
      if (!metadata.lastRemoteHash && !metadata.dirty) {
        if (localHash === remoteHash) {
          const nextMetadata = {
            ...metadata,
            dirty: false,
            lastLocalHash: localHash,
            lastRemoteHash: remoteHash,
            lastRemoteEtag: remoteEtag || metadata.lastRemoteEtag || "",
            lastPullAt: this.nowIso(),
            lastSyncAt: this.nowIso()
          };
          this.storage.saveMetadata(nextMetadata);
          return {
            action: "idle",
            data: localData,
            metadata: nextMetadata,
            document: remoteDocument
          };
        }
        return this.pullRemoteData(localData, metadata, localHash, remoteDocument, remoteHash, remoteEtag);
      }
      if (!localChanged && !remoteChanged) {
        const nextMetadata = {
          ...metadata,
          lastRemoteHash: remoteHash || metadata.lastRemoteHash,
          lastRemoteEtag: remoteEtag || metadata.lastRemoteEtag || "",
          lastPullAt: this.nowIso()
        };
        this.storage.saveMetadata(nextMetadata);
        return {
          action: "idle",
          data: localData,
          metadata: nextMetadata,
          document: remoteDocument
        };
      }
      if (!localChanged && remoteChanged) {
        return this.pullRemoteData(localData, metadata, localHash, remoteDocument, remoteHash, remoteEtag);
      }
      if (localChanged && !remoteChanged) {
        return this.pushCurrentData(config, localData, metadata, localHash, remoteDocument, remoteHash, remoteEtag);
      }
      return this.mergeAndUpload(config, localData, remoteDocument, metadata, remoteHash, remoteEtag);
    }
    async pullRemoteData(localData, metadata, localHash, remoteDocument, remoteHash, remoteEtag = "") {
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
        dirty: shouldMerge && nextHash !== remoteHash,
        lastLocalHash: nextHash,
        lastRemoteHash: remoteHash,
        lastRemoteEtag: remoteEtag || metadata.lastRemoteEtag || "",
        lastPullAt: this.nowIso(),
        lastSyncAt: shouldMerge && nextHash !== remoteHash ? metadata.lastSyncAt : this.nowIso(),
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
    async pushCurrentData(config, localData, metadata, localHash, remoteDocument, remoteHash, remoteEtag = "", options = {}) {
      if (remoteDocument && remoteHash && remoteHash !== localHash && remoteHash !== metadata.lastRemoteHash) {
        return this.mergeAndUpload(config, localData, remoteDocument, metadata, remoteHash, remoteEtag, options);
      }
      if (remoteDocument && !metadata.lastRemoteHash && remoteHash && remoteHash !== localHash) {
        return this.mergeAndUpload(config, localData, remoteDocument, metadata, remoteHash, remoteEtag, options);
      }
      try {
        const pushed = await this.provider.push(config, this.createDocument(localData), {
          ifMatch: remoteEtag || metadata.lastRemoteEtag || ""
        });
        const nextMetadata = {
          ...metadata,
          dirty: false,
          lastLocalHash: localHash,
          lastRemoteHash: localHash,
          lastRemoteEtag: pushed.etag || remoteEtag || metadata.lastRemoteEtag || "",
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
      } catch (error) {
        if (options.retryOnConditionalConflict !== false && isConditionalWriteConflict(error)) {
          const latest = await this.provider.pull(config);
          if (!latest?.document) {
            throw error;
          }
          return this.mergeAndUpload(config, localData, latest.document, metadata, this.adapter.getHash(latest.document.data), latest.etag || "", { retryOnConditionalConflict: false });
        }
        throw error;
      }
    }
    async mergeAndUpload(config, localData, remoteDocument, metadata, remoteHash, remoteEtag = "", options = {}) {
      const mergedData = this.adapter.merge(localData, remoteDocument.data);
      const mergedHash = this.adapter.getHash(mergedData);
      this.storage.saveData(mergedData);
      try {
        const pushed = await this.provider.push(config, this.createDocument(mergedData), {
          ifMatch: remoteEtag || metadata.lastRemoteEtag || ""
        });
        const nextMetadata = {
          ...metadata,
          dirty: false,
          lastLocalHash: mergedHash,
          lastRemoteHash: mergedHash,
          lastRemoteEtag: pushed.etag || remoteEtag || metadata.lastRemoteEtag || "",
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
      } catch (error) {
        if (options.retryOnConditionalConflict !== false && isConditionalWriteConflict(error)) {
          const latest = await this.provider.pull(config);
          if (!latest?.document) {
            throw error;
          }
          const rematched = this.adapter.merge(mergedData, latest.document.data);
          this.storage.saveData(rematched);
          const pushed = await this.provider.push(config, this.createDocument(rematched), {
            ifMatch: latest.etag || ""
          });
          const rematchedHash = this.adapter.getHash(rematched);
          const nextMetadata = {
            ...metadata,
            dirty: false,
            lastLocalHash: rematchedHash,
            lastRemoteHash: rematchedHash,
            lastRemoteEtag: pushed.etag || latest.etag || "",
            lastPushAt: this.nowIso(),
            lastSyncAt: this.nowIso(),
            lastConflictAt: this.nowIso()
          };
          this.storage.saveMetadata(nextMetadata);
          return {
            action: "merged-then-uploaded",
            data: rematched,
            metadata: nextMetadata,
            document: pushed.document
          };
        }
        throw error;
      }
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

  // packages/adapter-habit-app/dist/index.js
  var DEFAULT_GROUP_ID = "default";
  var DEFAULT_CURRENCY_ID = "default";
  var DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";
  var COLLECTIONS = /* @__PURE__ */ new Set([
    "habits",
    "habitGroups",
    "habitRecords",
    "habitRewards",
    "habitRewardRecords",
    "habitFineRecords",
    "habitLedger",
    "habitCurrencies",
    "habitMilestones",
    "habitMilestoneClaims",
    "habitOverdueEvents",
    "habitMoodNotes",
    "habitTimeTasks"
  ]);
  var TERMINAL_OVERDUE = /* @__PURE__ */ new Set(["fined", "exempt", "made_up"]);
  function text(value, fallback = "") {
    return typeof value === "string" ? value.trim() || fallback : fallback;
  }
  function numberValue(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  function intMin(value, min, fallback = min) {
    return Math.max(min, Math.trunc(numberValue(value, fallback)));
  }
  function timestamp(value) {
    return typeof value === "string" && value.trim() ? value.trim() : void 0;
  }
  function normalizeTimestamp(value) {
    const time = new Date(String(value ?? "")).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  function getEntityTime(item) {
    if (!item)
      return 0;
    return normalizeTimestamp(item.updatedAt ?? item.createdAt ?? item.deletedAt);
  }
  function getDeletedKey(collection, id, parentId = "") {
    return parentId ? `${collection}:${parentId}:${id}` : `${collection}:${id}`;
  }
  function idOf(input) {
    if (!input || typeof input !== "object")
      return "";
    return text(input.id);
  }
  function baseOf(input, rest) {
    const id = idOf(input);
    if (!id)
      return null;
    const source = input;
    return {
      id,
      createdAt: timestamp(source.createdAt),
      updatedAt: timestamp(source.updatedAt) || timestamp(source.createdAt),
      deletedAt: timestamp(source.deletedAt) || void 0,
      ...rest
    };
  }
  function normalizeStatus(value) {
    return value === "archived" ? "archived" : "active";
  }
  function normalizeRepeatUnit(value) {
    return value === "weekly" || value === "any" ? value : "daily";
  }
  function normalizeRecordType(value) {
    const allowed = ["normal", "makeup", "exempt", "overdue_break", "streak_reward", "target_reward", "manual_reward", "reverse", "adjust"];
    return allowed.includes(value) ? value : "normal";
  }
  function normalizeLedgerType(value) {
    const allowed = ["checkin", "makeup", "exempt", "overdue_break", "streak_reward", "target_reward", "reward_redeem", "fine", "adjust", "reverse"];
    return allowed.includes(value) ? value : "adjust";
  }
  function normalizeOverdueStatus(value) {
    const allowed = ["pending", "deferred", "fined", "exempt", "made_up"];
    return allowed.includes(value) ? value : "pending";
  }
  function normalizeWeekdays(value) {
    const set = /* @__PURE__ */ new Set();
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const day = Math.trunc(numberValue(entry, 0));
        if (day >= 1 && day <= 7)
          set.add(day);
      });
    }
    return Array.from(set).sort((a, b) => a - b);
  }
  function normalizeReminderTimes(value) {
    if (!Array.isArray(value))
      return [];
    return Array.from(new Set(value.map((entry) => text(entry)).filter((entry) => /^\d{2}:\d{2}$/.test(entry))));
  }
  function normalizeGroup(input) {
    const source = input || {};
    return baseOf(input, {
      name: text(source.name, "\u9ED8\u8BA4"),
      sort: intMin(source.sort, 0, 0),
      color: text(source.color) || void 0,
      icon: text(source.icon) || void 0
    });
  }
  function normalizeCurrency(input) {
    const source = input || {};
    return baseOf(input, {
      name: text(source.name, source.id === DEFAULT_CURRENCY_ID ? "\u91D1\u5E01" : "\u672A\u547D\u540D\u5E01\u79CD"),
      icon: text(source.icon, source.id === DEFAULT_CURRENCY_ID ? "\u{1FA99}" : ""),
      sort: intMin(source.sort, 0, 0)
    });
  }
  function normalizeHabit(input) {
    const source = input || {};
    return baseOf(input, {
      title: text(source.title, "\u672A\u547D\u540D\u4E60\u60EF"),
      description: text(source.description),
      status: normalizeStatus(source.status),
      sort: intMin(source.sort, 0, 0),
      icon: text(source.icon, "\u2705"),
      color: text(source.color, "#6EA6E4"),
      groupId: text(source.groupId, DEFAULT_GROUP_ID),
      rewardAmount: intMin(source.rewardAmount, 0, 0),
      rewardCurrencyId: text(source.rewardCurrencyId, DEFAULT_CURRENCY_ID),
      fineAmount: intMin(source.fineAmount, 0, 0),
      fineCurrencyId: text(source.fineCurrencyId, DEFAULT_CURRENCY_ID),
      repeatUnit: normalizeRepeatUnit(source.repeatUnit),
      weekdays: normalizeWeekdays(source.weekdays),
      reminderTimes: normalizeReminderTimes(source.reminderTimes),
      targetCount: intMin(source.targetCount, 0, 0),
      targetRewardAmount: intMin(source.targetRewardAmount, 0, 0),
      requiredCountPerDay: intMin(source.requiredCountPerDay, 1, 1),
      taskDurationSec: intMin(source.taskDurationSec, 0, 0),
      lastCheckAt: timestamp(source.lastCheckAt)
    });
  }
  function getRecordDefaultFlags(type) {
    if (type === "exempt")
      return { countsAsCompletion: false, countsForStreak: true };
    if (type === "overdue_break")
      return { countsAsCompletion: false, countsForStreak: false };
    if (type === "normal" || type === "makeup")
      return { countsAsCompletion: true, countsForStreak: true };
    return { countsAsCompletion: false, countsForStreak: false };
  }
  function normalizeBoolean(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }
  function normalizeHabitRecord(input) {
    const source = input || {};
    const recordTime = text(source.recordTime);
    const type = normalizeRecordType(source.type);
    const flags = getRecordDefaultFlags(type);
    return baseOf(input, {
      habitId: text(source.habitId),
      recordTime,
      recordDate: text(source.recordDate, recordTime.slice(0, 10)),
      amount: intMin(source.amount, 0, 0),
      currencyId: text(source.currencyId, DEFAULT_CURRENCY_ID),
      type,
      note: text(source.note),
      countsAsCompletion: normalizeBoolean(source.countsAsCompletion, flags.countsAsCompletion),
      countsForStreak: normalizeBoolean(source.countsForStreak, flags.countsForStreak),
      sourceKey: text(source.sourceKey) || void 0
    });
  }
  function normalizeReward(input) {
    const source = input || {};
    return baseOf(input, {
      name: text(source.name, "\u672A\u547D\u540D\u5FC3\u613F"),
      description: text(source.description),
      cost: intMin(source.cost, 1, 1),
      currencyId: text(source.currencyId, DEFAULT_CURRENCY_ID),
      status: normalizeStatus(source.status),
      sort: intMin(source.sort, 0, 0),
      icon: text(source.icon, "\u{1F381}"),
      color: text(source.color, "#6EA6E4"),
      stock: intMin(source.stock, 0, 0),
      redeemedCount: source.redeemedCount === void 0 ? void 0 : intMin(source.redeemedCount, 0, 0)
    });
  }
  function normalizeRewardRecord(input) {
    const source = input || {};
    return baseOf(input, {
      rewardId: text(source.rewardId),
      redeemedAt: text(source.redeemedAt),
      amount: intMin(source.amount, 0, 0),
      currencyId: text(source.currencyId, DEFAULT_CURRENCY_ID),
      note: text(source.note),
      ledgerId: text(source.ledgerId) || void 0,
      sourceKey: text(source.sourceKey) || void 0
    });
  }
  function normalizeFineRecord(input) {
    const source = input || {};
    return baseOf(input, {
      habitId: text(source.habitId),
      finedAt: text(source.finedAt),
      amount: intMin(source.amount, 0, 0),
      currencyId: text(source.currencyId, DEFAULT_CURRENCY_ID),
      reason: text(source.reason),
      overdueEventId: text(source.overdueEventId) || void 0,
      ledgerId: text(source.ledgerId) || void 0,
      sourceKey: text(source.sourceKey) || void 0
    });
  }
  function normalizeLedger(input) {
    const source = input || {};
    return baseOf(input, {
      type: normalizeLedgerType(source.type),
      amount: Math.trunc(numberValue(source.amount, 0)),
      currencyId: text(source.currencyId, DEFAULT_CURRENCY_ID),
      date: text(source.date),
      habitId: text(source.habitId) || void 0,
      rewardId: text(source.rewardId) || void 0,
      sourceId: text(source.sourceId) || void 0,
      note: text(source.note)
    });
  }
  function normalizeMilestone(input) {
    const source = input || {};
    return baseOf(input, {
      habitId: text(source.habitId),
      targetDays: intMin(source.targetDays, 1, 1),
      rewardAmount: intMin(source.rewardAmount, 0, 0),
      currencyId: text(source.currencyId, DEFAULT_CURRENCY_ID),
      sort: intMin(source.sort, 0, 0),
      label: text(source.label)
    });
  }
  function normalizeMilestoneClaim(input) {
    const source = input || {};
    return baseOf(input, {
      habitId: text(source.habitId),
      milestoneId: text(source.milestoneId),
      cycleStartDate: text(source.cycleStartDate),
      achievedDays: intMin(source.achievedDays, 1, 1),
      rewardAmount: intMin(source.rewardAmount, 0, 0),
      currencyId: text(source.currencyId, DEFAULT_CURRENCY_ID),
      claimedAt: text(source.claimedAt),
      habitRecordId: text(source.habitRecordId) || void 0,
      ledgerId: text(source.ledgerId) || void 0
    });
  }
  function normalizeOverdue(input) {
    const source = input || {};
    return baseOf(input, {
      habitId: text(source.habitId),
      dueDate: text(source.dueDate),
      requiredCount: intMin(source.requiredCount, 1, 1),
      observedCount: intMin(source.observedCount, 0, 0),
      missingCount: intMin(source.missingCount, 0, 0),
      fineAmount: intMin(source.fineAmount, 0, 0),
      fineCurrencyId: text(source.fineCurrencyId, DEFAULT_CURRENCY_ID),
      status: normalizeOverdueStatus(source.status),
      handledAt: timestamp(source.handledAt),
      exemptionWeekStart: text(source.exemptionWeekStart) || void 0,
      fineRecordId: text(source.fineRecordId) || void 0
    });
  }
  function normalizeMoodNote(input) {
    const source = input || {};
    return baseOf(input, {
      habitId: text(source.habitId) || void 0,
      rewardId: text(source.rewardId) || void 0,
      moodId: intMin(source.moodId, 0, 0),
      content: text(source.content),
      notedAt: text(source.notedAt)
    });
  }
  function normalizeTimeTask(input) {
    const source = input || {};
    const status = ["idle", "running", "paused", "done"].includes(String(source.status)) ? source.status : "idle";
    return baseOf(input, {
      habitId: text(source.habitId),
      title: text(source.title, "\u672A\u547D\u540D\u8BA1\u65F6"),
      durationSec: intMin(source.durationSec, 0, 0),
      leftSec: intMin(source.leftSec, 0, 0),
      status
    });
  }
  function normalizeDeletedItem(input) {
    if (!input || typeof input !== "object")
      return null;
    const source = input;
    const collection = source.collection;
    if (!COLLECTIONS.has(collection))
      return null;
    const id = text(source.id);
    const deletedAt = text(source.deletedAt);
    if (!id || !deletedAt)
      return null;
    return {
      collection,
      id,
      deletedAt,
      parentId: text(source.parentId) || void 0
    };
  }
  function normalizeArray(value, mapper) {
    return Array.isArray(value) ? value.map(mapper).filter((item) => !!item) : [];
  }
  function ensureDefaultGroup(groups) {
    if (groups.some((group) => group.id === DEFAULT_GROUP_ID && !group.deletedAt))
      return groups;
    return [{ id: DEFAULT_GROUP_ID, name: "\u9ED8\u8BA4", sort: 0, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP }, ...groups];
  }
  function ensureDefaultCurrency(currencies) {
    if (currencies.some((currency) => currency.id === DEFAULT_CURRENCY_ID && !currency.deletedAt))
      return currencies;
    return [{ id: DEFAULT_CURRENCY_ID, name: "\u91D1\u5E01", icon: "\u{1FA99}", sort: 0, createdAt: DEFAULT_TIMESTAMP, updatedAt: DEFAULT_TIMESTAMP }, ...currencies];
  }
  function normalizeHabitSnapshot(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      habits: normalizeArray(source.habits, normalizeHabit),
      habitGroups: ensureDefaultGroup(normalizeArray(source.habitGroups, normalizeGroup)),
      habitRecords: normalizeArray(source.habitRecords, normalizeHabitRecord),
      habitRewards: normalizeArray(source.habitRewards, normalizeReward),
      habitRewardRecords: normalizeArray(source.habitRewardRecords, normalizeRewardRecord),
      habitFineRecords: normalizeArray(source.habitFineRecords, normalizeFineRecord),
      habitLedger: normalizeArray(source.habitLedger, normalizeLedger),
      habitCurrencies: ensureDefaultCurrency(normalizeArray(source.habitCurrencies, normalizeCurrency)),
      habitMilestones: normalizeArray(source.habitMilestones, normalizeMilestone),
      habitMilestoneClaims: normalizeArray(source.habitMilestoneClaims, normalizeMilestoneClaim),
      habitOverdueEvents: normalizeArray(source.habitOverdueEvents, normalizeOverdue),
      habitMoodNotes: normalizeArray(source.habitMoodNotes, normalizeMoodNote),
      habitTimeTasks: normalizeArray(source.habitTimeTasks, normalizeTimeTask),
      deletedItems: normalizeArray(source.deletedItems, normalizeDeletedItem)
    };
  }
  function collectSoftDeletes(snapshot) {
    const items = [];
    const collect = (collection, entries) => {
      entries.forEach((entry) => {
        if (entry.deletedAt)
          items.push({ collection, id: entry.id, deletedAt: entry.deletedAt });
      });
    };
    collect("habits", snapshot.habits);
    collect("habitGroups", snapshot.habitGroups.filter((item) => item.id !== DEFAULT_GROUP_ID));
    collect("habitRecords", snapshot.habitRecords);
    collect("habitRewards", snapshot.habitRewards);
    collect("habitRewardRecords", snapshot.habitRewardRecords);
    collect("habitFineRecords", snapshot.habitFineRecords);
    collect("habitLedger", snapshot.habitLedger);
    collect("habitCurrencies", snapshot.habitCurrencies.filter((item) => item.id !== DEFAULT_CURRENCY_ID));
    collect("habitMilestones", snapshot.habitMilestones);
    collect("habitMilestoneClaims", snapshot.habitMilestoneClaims);
    collect("habitOverdueEvents", snapshot.habitOverdueEvents);
    collect("habitMoodNotes", snapshot.habitMoodNotes);
    collect("habitTimeTasks", snapshot.habitTimeTasks);
    return items;
  }
  function pruneDeletedItems(items) {
    const map = /* @__PURE__ */ new Map();
    items.forEach((item) => {
      if (item.collection === "habitGroups" && item.id === DEFAULT_GROUP_ID || item.collection === "habitCurrencies" && item.id === DEFAULT_CURRENCY_ID) {
        return;
      }
      const key = getDeletedKey(item.collection, item.id, item.parentId || "");
      const current = map.get(key);
      if (!current || normalizeTimestamp(item.deletedAt) > normalizeTimestamp(current.deletedAt)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values()).sort((a, b) => getDeletedKey(a.collection, a.id, a.parentId || "").localeCompare(getDeletedKey(b.collection, b.id, b.parentId || "")));
  }
  function buildDeletionMap(local, remote) {
    const deleted = pruneDeletedItems([
      ...local.deletedItems,
      ...remote.deletedItems,
      ...collectSoftDeletes(local),
      ...collectSoftDeletes(remote)
    ]);
    return new Map(deleted.map((item) => [getDeletedKey(item.collection, item.id, item.parentId || ""), item]));
  }
  function shouldKeep(collection, item, deletionMap) {
    if (collection === "habitGroups" && item.id === DEFAULT_GROUP_ID)
      return true;
    if (collection === "habitCurrencies" && item.id === DEFAULT_CURRENCY_ID)
      return true;
    if (item.deletedAt)
      return false;
    const deleted = deletionMap.get(getDeletedKey(collection, item.id));
    if (!deleted)
      return true;
    return getEntityTime(item) > normalizeTimestamp(deleted.deletedAt);
  }
  function mergeByKey(collection, localItems, remoteItems, deletionMap, getKey = (item) => `id:${item.id}`, choose) {
    const merged = /* @__PURE__ */ new Map();
    [...localItems, ...remoteItems].forEach((item, index) => {
      if (!item?.id)
        return;
      const key = getKey(item, index);
      const current = merged.get(key);
      if (!current) {
        merged.set(key, item);
        return;
      }
      merged.set(key, choose ? choose(current, item) : getEntityTime(item) >= getEntityTime(current) ? item : current);
    });
    return Array.from(merged.values()).filter((item) => shouldKeep(collection, item, deletionMap));
  }
  function getRecordKey(item, index) {
    if (item.sourceKey)
      return `record-source:${item.sourceKey}`;
    return item.id ? `id:${item.id}` : `record:${item.habitId}:${item.recordTime}:${item.type}:${item.currencyId}:${item.amount}:${index}`;
  }
  function getRewardRecordKey(item, index) {
    if (item.sourceKey)
      return `redeem-source:${item.sourceKey}`;
    return item.id ? `id:${item.id}` : `redeem:${item.rewardId}:${item.redeemedAt}:${item.currencyId}:${item.amount}:${index}`;
  }
  function getFineRecordKey(item, index) {
    if (item.sourceKey)
      return `fine-source:${item.sourceKey}`;
    return item.id ? `id:${item.id}` : `fine:${item.habitId}:${item.finedAt}:${item.currencyId}:${item.amount}:${item.reason}:${index}`;
  }
  function getLedgerKey(item, index) {
    if (item.sourceId)
      return `ledger:${item.type}:${item.sourceId}:${item.currencyId}`;
    if (item.id)
      return `id:${item.id}`;
    return ["ledger-fallback", item.type, item.habitId || "", item.rewardId || "", item.date || "", item.currencyId, String(item.amount || 0), item.note || "", String(index)].join(":");
  }
  function getClaimKey(item) {
    return `claim:${item.habitId}:${item.milestoneId}:${item.cycleStartDate}:${item.achievedDays}:${item.currencyId}`;
  }
  function getOverdueKey(item) {
    return `overdue:${item.habitId}:${item.dueDate}`;
  }
  function chooseOverdue(left, right) {
    const leftTime = getEntityTime(left);
    const rightTime = getEntityTime(right);
    if (rightTime !== leftTime)
      return rightTime > leftTime ? right : left;
    const score = (status) => TERMINAL_OVERDUE.has(status) ? 3 : status === "deferred" ? 2 : 1;
    const rightScore = score(right.status);
    const leftScore = score(left.status);
    if (rightScore !== leftScore)
      return rightScore > leftScore ? right : left;
    return right.id >= left.id ? right : left;
  }
  function mergeHabitSnapshots(localData, remoteData) {
    const local = normalizeHabitSnapshot(localData);
    const remote = normalizeHabitSnapshot(remoteData);
    const deletionMap = buildDeletionMap(local, remote);
    const deletedItems = pruneDeletedItems([...Array.from(deletionMap.values()), ...collectSoftDeletes(local), ...collectSoftDeletes(remote)]);
    return normalizeHabitSnapshot({
      habits: mergeByKey("habits", local.habits, remote.habits, deletionMap),
      habitGroups: mergeByKey("habitGroups", local.habitGroups, remote.habitGroups, deletionMap),
      habitRecords: mergeByKey("habitRecords", local.habitRecords, remote.habitRecords, deletionMap, getRecordKey),
      habitRewards: mergeByKey("habitRewards", local.habitRewards, remote.habitRewards, deletionMap),
      habitRewardRecords: mergeByKey("habitRewardRecords", local.habitRewardRecords, remote.habitRewardRecords, deletionMap, getRewardRecordKey),
      habitFineRecords: mergeByKey("habitFineRecords", local.habitFineRecords, remote.habitFineRecords, deletionMap, getFineRecordKey),
      habitLedger: mergeByKey("habitLedger", local.habitLedger, remote.habitLedger, deletionMap, getLedgerKey),
      habitCurrencies: mergeByKey("habitCurrencies", local.habitCurrencies, remote.habitCurrencies, deletionMap),
      habitMilestones: mergeByKey("habitMilestones", local.habitMilestones, remote.habitMilestones, deletionMap),
      habitMilestoneClaims: mergeByKey("habitMilestoneClaims", local.habitMilestoneClaims, remote.habitMilestoneClaims, deletionMap, getClaimKey),
      habitOverdueEvents: mergeByKey("habitOverdueEvents", local.habitOverdueEvents, remote.habitOverdueEvents, deletionMap, getOverdueKey, chooseOverdue),
      habitMoodNotes: mergeByKey("habitMoodNotes", local.habitMoodNotes, remote.habitMoodNotes, deletionMap),
      habitTimeTasks: mergeByKey("habitTimeTasks", local.habitTimeTasks, remote.habitTimeTasks, deletionMap),
      deletedItems
    });
  }
  function getHashPayload(snapshot) {
    const normalized = normalizeHabitSnapshot(snapshot);
    return {
      ...normalized,
      deletedItems: pruneDeletedItems(normalized.deletedItems)
    };
  }
  var habitAppAdapter = {
    appId: "habit-app",
    schemaVersion: 1,
    createDefaultData() {
      return normalizeHabitSnapshot({});
    },
    normalizeData(input) {
      return normalizeHabitSnapshot(input);
    },
    merge(localData, remoteData) {
      return mergeHabitSnapshots(localData, remoteData);
    },
    getHash(data) {
      return createHash(getHashPayload(normalizeHabitSnapshot(data)));
    },
    getStorageKeys() {
      return {
        dataKey: "habitAppData",
        metadataKey: "habitAppSyncState",
        providerConfigKey: "habitAppSyncConfig"
      };
    },
    getDefaultRemotePath() {
      return "/apps/habit-app/data.json";
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
  function normalizeArray2(value) {
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
    const timestamp2 = new Date(String(raw)).getTime();
    return Number.isFinite(timestamp2) ? timestamp2 : 0;
  }
  function getDeletedItemKey(collection, id) {
    return `${collection}:${id}`;
  }
  function buildDeletionMap2(localData, remoteData) {
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
      if (!localItem || getItemUpdatedTime(remoteItem) > getItemUpdatedTime(localItem)) {
        merged.set(key, remoteItem);
      }
    });
    return Array.from(merged.values()).filter((item) => shouldKeepMergedItem(collection, item, deletions));
  }
  function normalizeRecordMergeText(text2 = "") {
    return String(text2 || "").replace(/\r\n/g, "\n");
  }
  function normalizeRecordCompareText(text2 = "") {
    return normalizeRecordMergeText(text2).replace(/[\s，。！？、；：,.!?;:"'“”‘’（）()【】[\]《》<>#\-_*`~]+/g, "");
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
    const latest = remoteTime > localTime ? remoteRecord : localRecord;
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
      wheels: normalizeArray2(source.wheels),
      wheelTags: normalizeArray2(source.wheelTags),
      wheelLibraryItems: normalizeArray2(source.wheelLibraryItems),
      wheelHistory: normalizeArray2(source.wheelHistory),
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
      if (!current || getWheelEntityUpdatedTime(item) > getWheelEntityUpdatedTime(current)) {
        merged.set(key, item);
      }
    });
    return Array.from(merged.values()).filter((item) => !item?.deletedAt).filter((item) => !collection || shouldKeepMergedItem(collection, item, deletions));
  }
  function mergeWheelSnapshots(localSnapshot, remoteSnapshot) {
    const local = getWheelSnapshot(localSnapshot);
    const remote = getWheelSnapshot(remoteSnapshot);
    const deletions = buildDeletionMap2(normalizeLifePlanData(localSnapshot), normalizeLifePlanData(remoteSnapshot));
    const remoteWheelMap = new Map(remote.wheels.map((item) => [getString(item, "id"), item]));
    return {
      wheels: mergeWheelEntities(local.wheels, remote.wheels, "wheels", deletions).map((wheel) => {
        const wheelId = getString(wheel, "id");
        const localWheel = local.wheels.find((item) => getString(item, "id") === wheelId);
        const remoteWheel = remoteWheelMap.get(wheelId);
        const baseWheel = !localWheel ? remoteWheel : !remoteWheel ? localWheel : getWheelEntityUpdatedTime(remoteWheel) > getWheelEntityUpdatedTime(localWheel) ? remoteWheel : localWheel;
        return {
          ...baseWheel,
          items: mergeWheelEntities(normalizeArray2(localWheel?.items), normalizeArray2(remoteWheel?.items), "wheelItems", deletions)
        };
      }),
      wheelTags: mergeWheelEntities(local.wheelTags, remote.wheelTags, "wheelTags", deletions),
      wheelLibraryItems: mergeWheelEntities(local.wheelLibraryItems, remote.wheelLibraryItems, "wheelLibraryItems", deletions),
      wheelHistory: mergeWheelEntities(local.wheelHistory, remote.wheelHistory, "wheelHistory", deletions),
      deletedItems: Array.from(deletions.values()).filter((item) => isWheelDeletionCollection(item.collection))
    };
  }
  function pruneDeletedItems2(target) {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1e3;
    target.deletedItems = target.deletedItems.filter((item) => {
      const time = new Date(item.deletedAt || 0).getTime();
      return !Number.isFinite(time) || time >= cutoff;
    });
    return target;
  }
  function normalizeLifePlanData(input) {
    const source = input && typeof input === "object" ? input : {};
    const base = createDefaultCollectionState();
    LIFE_PLAN_COLLECTIONS.forEach((key) => {
      base[key] = normalizeArray2(source[key]);
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
      const deletions = buildDeletionMap2(normalizedLocal, normalizedRemote);
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
      return pruneDeletedItems2(merged);
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
  function normalizeArray3(value) {
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
    const timestamp2 = new Date(String(candidate ?? "")).getTime();
    return Number.isFinite(timestamp2) ? timestamp2 : 0;
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
      pantry: normalizeArray3(source.pantry),
      stapleSeasonings: normalizeArray3(source.stapleSeasonings),
      shoppingList: normalizeArray3(source.shoppingList),
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
  var WHEEL_DELETION_COLLECTIONS2 = /* @__PURE__ */ new Set([
    "wheels",
    "wheelTags",
    "wheelLibraryItems",
    "wheelHistory",
    "wheelItems"
  ]);
  function normalizeTimestamp2(value) {
    const timestamp2 = new Date(String(value ?? "")).getTime();
    return Number.isFinite(timestamp2) ? timestamp2 : 0;
  }
  function getEntityTime2(item) {
    if (!item)
      return 0;
    return normalizeTimestamp2(item.updatedAt ?? item.createdAt ?? item.deletedAt);
  }
  function pickLatest(left, right) {
    if (!left)
      return right;
    if (!right)
      return left;
    return getEntityTime2(right) >= getEntityTime2(left) ? right : left;
  }
  function getDeletedKey2(collection, id, parentId = "") {
    return parentId ? `${collection}:${parentId}:${id}` : `${collection}:${id}`;
  }
  function buildDeletionMap3(local, remote) {
    const map = /* @__PURE__ */ new Map();
    const sources = [...local.deletedItems || [], ...remote.deletedItems || []];
    sources.forEach((item) => {
      if (!item?.collection || !item?.id || !item?.deletedAt)
        return;
      if (!WHEEL_DELETION_COLLECTIONS2.has(item.collection))
        return;
      const key = getDeletedKey2(item.collection, item.id, item.parentId || "");
      const existing = map.get(key);
      if (!existing || normalizeTimestamp2(item.deletedAt) > normalizeTimestamp2(existing.deletedAt)) {
        map.set(key, {
          collection: item.collection,
          id: item.id,
          deletedAt: item.deletedAt,
          parentId: item.parentId
        });
      }
    });
    const collectSoftDeletes2 = (collection, items, parentId = "") => {
      items.forEach((item) => {
        if (!item?.id || !item.deletedAt)
          return;
        const key = getDeletedKey2(collection, item.id, parentId);
        const candidate = {
          collection,
          id: item.id,
          deletedAt: item.deletedAt,
          parentId: parentId || void 0
        };
        const existing = map.get(key);
        if (!existing || normalizeTimestamp2(candidate.deletedAt) > normalizeTimestamp2(existing.deletedAt)) {
          map.set(key, candidate);
        }
      });
    };
    collectSoftDeletes2("wheels", local.wheels);
    collectSoftDeletes2("wheels", remote.wheels);
    collectSoftDeletes2("wheelTags", local.wheelTags);
    collectSoftDeletes2("wheelTags", remote.wheelTags);
    collectSoftDeletes2("wheelLibraryItems", local.wheelLibraryItems);
    collectSoftDeletes2("wheelLibraryItems", remote.wheelLibraryItems);
    collectSoftDeletes2("wheelHistory", local.wheelHistory);
    collectSoftDeletes2("wheelHistory", remote.wheelHistory);
    [...local.wheels, ...remote.wheels].forEach((wheel) => {
      if (!wheel?.id)
        return;
      collectSoftDeletes2("wheelItems", wheel.items || [], wheel.id);
    });
    return map;
  }
  function shouldKeepEntity(collection, item, deletionMap, parentId = "") {
    if (item.deletedAt)
      return false;
    const deleted = deletionMap.get(getDeletedKey2(collection, item.id, parentId));
    if (!deleted)
      return true;
    return getEntityTime2(item) > normalizeTimestamp2(deleted.deletedAt);
  }
  function mergeByLatest(localItems, remoteItems, collection, deletionMap, parentId = "") {
    const merged = /* @__PURE__ */ new Map();
    [...localItems, ...remoteItems].forEach((item) => {
      if (!item?.id)
        return;
      const current = merged.get(item.id);
      if (!current || getEntityTime2(item) >= getEntityTime2(current)) {
        merged.set(item.id, item);
      }
    });
    return Array.from(merged.values()).filter((item) => shouldKeepEntity(collection, item, deletionMap, parentId));
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
  function normalizeDeletedItem2(input) {
    if (!input || typeof input !== "object")
      return null;
    const item = input;
    if (!item.collection || !item.id || !item.deletedAt)
      return null;
    if (!WHEEL_DELETION_COLLECTIONS2.has(String(item.collection)))
      return null;
    return {
      collection: String(item.collection),
      id: String(item.id),
      deletedAt: String(item.deletedAt),
      parentId: typeof item.parentId === "string" && item.parentId ? item.parentId : void 0
    };
  }
  function normalizeWheelSnapshot(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      wheels: Array.isArray(source.wheels) ? source.wheels.map(normalizeWheel).filter((item) => !!item) : [],
      wheelTags: Array.isArray(source.wheelTags) ? source.wheelTags.map(normalizeWheelTag).filter((item) => !!item) : [],
      wheelLibraryItems: Array.isArray(source.wheelLibraryItems) ? source.wheelLibraryItems.map(normalizeWheelItem).filter((item) => !!item) : [],
      wheelHistory: Array.isArray(source.wheelHistory) ? source.wheelHistory.map(normalizeWheelHistoryItem).filter((item) => !!item) : [],
      deletedItems: Array.isArray(source.deletedItems) ? source.deletedItems.map(normalizeDeletedItem2).filter((item) => !!item) : []
    };
  }
  function collectSoftDeleteTombstones(snapshot) {
    const items = [];
    snapshot.wheels.forEach((wheel) => {
      if (wheel.deletedAt) {
        items.push({ collection: "wheels", id: wheel.id, deletedAt: wheel.deletedAt });
      }
      (wheel.items || []).forEach((item) => {
        if (item.deletedAt) {
          items.push({
            collection: "wheelItems",
            id: item.id,
            deletedAt: item.deletedAt,
            parentId: wheel.id
          });
        }
      });
    });
    snapshot.wheelTags.forEach((tag) => {
      if (tag.deletedAt)
        items.push({ collection: "wheelTags", id: tag.id, deletedAt: tag.deletedAt });
    });
    snapshot.wheelLibraryItems.forEach((item) => {
      if (item.deletedAt) {
        items.push({ collection: "wheelLibraryItems", id: item.id, deletedAt: item.deletedAt });
      }
    });
    snapshot.wheelHistory.forEach((item) => {
      if (item.deletedAt) {
        items.push({ collection: "wheelHistory", id: item.id, deletedAt: item.deletedAt });
      }
    });
    return items;
  }
  function pruneDeletedItems3(items) {
    const map = /* @__PURE__ */ new Map();
    items.forEach((item) => {
      if (!item?.collection || !item?.id || !item?.deletedAt)
        return;
      const key = getDeletedKey2(item.collection, item.id, item.parentId || "");
      const existing = map.get(key);
      if (!existing || normalizeTimestamp2(item.deletedAt) > normalizeTimestamp2(existing.deletedAt)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }
  function mergeWheelSnapshots2(localData, remoteData) {
    const local = normalizeWheelSnapshot(localData);
    const remote = normalizeWheelSnapshot(remoteData);
    const deletionMap = buildDeletionMap3(local, remote);
    const remoteWheelMap = new Map(remote.wheels.map((wheel) => [wheel.id, wheel]));
    const wheels = mergeByLatest(local.wheels, remote.wheels, "wheels", deletionMap).map((wheel) => {
      const localWheel = local.wheels.find((item) => item.id === wheel.id);
      const remoteWheel = remoteWheelMap.get(wheel.id);
      const baseWheel = pickLatest(localWheel, remoteWheel) ?? wheel;
      return {
        ...baseWheel,
        items: mergeByLatest(localWheel?.items ?? [], remoteWheel?.items ?? [], "wheelItems", deletionMap, wheel.id)
      };
    });
    return {
      wheels,
      wheelTags: mergeByLatest(local.wheelTags, remote.wheelTags, "wheelTags", deletionMap),
      wheelLibraryItems: mergeByLatest(local.wheelLibraryItems, remote.wheelLibraryItems, "wheelLibraryItems", deletionMap),
      wheelHistory: mergeByLatest(local.wheelHistory, remote.wheelHistory, "wheelHistory", deletionMap),
      deletedItems: pruneDeletedItems3([
        ...Array.from(deletionMap.values()),
        ...collectSoftDeleteTombstones(local),
        ...collectSoftDeleteTombstones(remote)
      ])
    };
  }
  function getHashPayload2(snapshot) {
    return {
      wheels: snapshot.wheels,
      wheelTags: snapshot.wheelTags,
      wheelLibraryItems: snapshot.wheelLibraryItems,
      wheelHistory: snapshot.wheelHistory,
      deletedItems: snapshot.deletedItems || []
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
      return mergeWheelSnapshots2(localData, remoteData);
    },
    getHash(data) {
      return createHash(getHashPayload2(normalizeWheelSnapshot(data)));
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
  function getResponseEtag(response) {
    const etag = response.headers.get("ETag") || response.headers.get("X-Remote-ETag") || "";
    return String(etag || "").trim();
  }
  async function request(fetchImpl, endpoint, remotePath, method, body, acceptedStatuses = [200, 201, 204, 207], extraHeaders = {}, timeoutMs = 2e4) {
    const base = `${endpoint.replace(/\/+$/, "")}/`;
    const target = remotePath.replace(/^\/+/, "");
    const headers = { ...extraHeaders };
    if (body)
      headers["Content-Type"] = "application/json; charset=utf-8";
    if (method === "PROPFIND" && !headers.Depth)
      headers.Depth = "0";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(base + target, {
        method,
        mode: "cors",
        headers: Object.keys(headers).length ? headers : void 0,
        body,
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`WebDAV ${method} timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      const detail = await response.clone().text().catch(() => "");
      throw new SyncHttpError(`WebDAV ${method} failed: ${response.status}${detail ? ` ${detail.slice(0, 120)}` : ""}`, {
        status: response.status,
        method,
        etag: getResponseEtag(response)
      });
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
  async function ensureRemoteFolders(fetchImpl, endpoint, remotePath, timeoutMs) {
    const folders = getParentFolders(remotePath);
    for (const folder of folders) {
      await request(fetchImpl, endpoint, folder, "MKCOL", void 0, [200, 201, 204, 207, 405], {}, timeoutMs);
    }
  }
  function toEnvelope(config, payload, etag = "") {
    const candidate = payload;
    if (config.writeMode !== "legacy-raw-data" && candidate?.appId && candidate?.schemaVersion && "data" in candidate) {
      const document = candidate;
      return {
        document,
        hash: createHash(document.data),
        etag
      };
    }
    return {
      document: {
        appId: "legacy-app",
        schemaVersion: 1,
        updatedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
        data: payload
      },
      hash: createHash(payload),
      etag
    };
  }
  function createWebdavProvider(options = {}) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const timeoutMs = options.timeoutMs ?? 2e4;
    return {
      async pull(config) {
        try {
          const response = await request(fetchImpl, config.endpoint, config.remotePath, "GET", void 0, [200, 201, 204, 207], {}, timeoutMs);
          const text2 = await response.text();
          if (!text2.trim())
            return null;
          return toEnvelope(config, JSON.parse(text2), getResponseEtag(response));
        } catch (error) {
          if (error instanceof SyncHttpError && error.status === 404 || error instanceof Error && error.message.includes(" 404")) {
            return null;
          }
          throw error;
        }
      },
      async push(config, document, pushOptions = {}) {
        const remotePath = normalizeRemotePath(config.remotePath);
        const payload = config.writeMode === "legacy-raw-data" ? JSON.stringify(document.data, null, 2) : JSON.stringify(document, null, 2);
        await ensureRemoteFolders(fetchImpl, config.endpoint, remotePath, timeoutMs);
        const headers = {};
        if (pushOptions.ifMatch)
          headers["If-Match"] = pushOptions.ifMatch;
        const response = await request(fetchImpl, config.endpoint, remotePath, "PUT", payload, [200, 201, 204, 207], headers, timeoutMs);
        let responseEtag = getResponseEtag(response);
        if (!responseEtag) {
          try {
            const body = await response.clone().json();
            if (body?.etag)
              responseEtag = String(body.etag);
          } catch {
          }
        }
        return {
          document,
          hash: createHash(document.data),
          etag: responseEtag
        };
      },
      async healthCheck(config) {
        const remotePath = normalizeRemotePath(config.remotePath);
        const folderPath = remotePath.split("/").slice(0, -1).join("/") || "/";
        await request(fetchImpl, config.endpoint, folderPath, "PROPFIND", void 0, [200, 201, 204, 207, 404], { Depth: "0" }, timeoutMs);
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
    habitApp: habitAppAdapter,
    lifePlan: lifePlanAdapter,
    pantryChef: pantryChefAdapter,
    wheelApp: wheelAppAdapter
  };
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=app-sync-kit.browser.global.js.map
