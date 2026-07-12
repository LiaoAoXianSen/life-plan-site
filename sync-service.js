(function () {
    function hashString(str) {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return (hash >>> 0).toString(36);
    }

    function normalizeRemotePath(path, fallback = '/life-plan.json') {
        const raw = String(path || fallback || '').trim() || fallback;
        return raw.startsWith('/') ? raw : `/${raw}`;
    }

    function getFolderPath(remotePath) {
        return normalizeRemotePath(remotePath).split('/').slice(0, -1).join('/') || '/';
    }

    function create(options = {}) {
        const {
            appSyncKit = () => window.AppSyncKit,
            fetchImpl = (...args) => fetch(...args),
            getNowLocal = () => new Date().toISOString(),
            normalizeHabitCurrency = value => String(value || '').trim(),
            defaultCurrency = '金币'
        } = options;

        const getKit = () => (typeof appSyncKit === 'function' ? appSyncKit() : appSyncKit) || null;

        function getDataHash(value = {}) {
            return hashString(JSON.stringify(value || {}));
        }

        function isWheelDeletionCollection(collection = '') {
            return ['wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory', 'wheelItems'].includes(collection);
        }

        function getWheelSnapshot(source = {}) {
            return {
                wheels: Array.isArray(source.wheels) ? source.wheels : [],
                wheelTags: Array.isArray(source.wheelTags) ? source.wheelTags : [],
                wheelLibraryItems: Array.isArray(source.wheelLibraryItems) ? source.wheelLibraryItems : [],
                wheelHistory: Array.isArray(source.wheelHistory) ? source.wheelHistory : [],
                deletedItems: Array.isArray(source.deletedItems)
                    ? source.deletedItems.filter(item => isWheelDeletionCollection(item?.collection))
                    : []
            };
        }

        function getWheelDataHash(value = getWheelSnapshot()) {
            return getDataHash(value || {});
        }

        function getProvider() {
            const kit = getKit();
            if (!kit?.createWebdavProvider) return null;
            return kit.createWebdavProvider();
        }

        function getProviderConfig(config = {}, path) {
            return {
                endpoint: config.webdavUrl || '',
                remotePath: path || config.remotePath || '/life-plan.json',
                writeMode: 'legacy-raw-data'
            };
        }

        function createAppSyncDocument(payload, appId = 'life-plan') {
            return {
                appId,
                schemaVersion: 1,
                updatedAt: new Date().toISOString(),
                data: payload
            };
        }

        async function request(config = {}, path, method, body = null) {
            if (!config.webdavUrl) throw new Error('请先填写 Cloudflare Worker 同步中转地址');
            const base = `${config.webdavUrl.replace(/\/+$/, '')}/`;
            const target = String(path || '').replace(/^\/+/, '');
            const url = base + target;
            const headers = {};
            if (body !== null) headers['Content-Type'] = 'application/json; charset=utf-8';
            if (method === 'PROPFIND') headers.Depth = '0';
            const response = await fetchImpl(url, { method, headers, body, mode: 'cors' });
            if (!response.ok && response.status !== 207) {
                const detail = await response.clone().text().catch(() => '');
                const err = new Error(`WebDAV ${method} 失败：${response.status}${detail ? ` ${detail.slice(0, 120)}` : ''}`);
                err.status = response.status;
                err.method = method;
                throw err;
            }
            return response;
        }

        async function pullJson(config = {}, path, normalizePayload = value => value, hashPayload = getDataHash) {
            const remotePath = path || config.remotePath || '/life-plan.json';
            const provider = getProvider();
            if (provider) {
                const envelope = await provider.pull(getProviderConfig(config, remotePath));
                if (!envelope?.document) return null;
                const remoteData = normalizePayload(envelope.document.data);
                return { data: remoteData, hash: hashPayload(remoteData) };
            }

            let response;
            try {
                response = await request(config, remotePath, 'GET');
            } catch (err) {
                if (err.status === 404) return null;
                throw err;
            }
            const text = await response.text();
            if (!text.trim()) return null;
            const remoteData = JSON.parse(text);
            const normalized = normalizePayload(remoteData);
            return { data: normalized, hash: hashPayload(normalized) };
        }

        async function pushJson(config = {}, path, payload, appId = 'life-plan') {
            const remotePath = normalizeRemotePath(path || config.remotePath);
            const provider = getProvider();
            if (provider) {
                await provider.push(getProviderConfig(config, remotePath), createAppSyncDocument(payload, appId));
                return true;
            }

            const folderPath = getFolderPath(remotePath);
            if (folderPath && folderPath !== '/') {
                try { await request(config, folderPath, 'MKCOL'); } catch (err) {}
            }
            await request(config, remotePath, 'PUT', JSON.stringify(payload, null, 2));
            return true;
        }

        async function healthCheck(config = {}, path) {
            const remotePath = normalizeRemotePath(path || config.remotePath);
            const provider = getProvider();
            if (provider?.healthCheck) {
                try {
                    await provider.healthCheck(getProviderConfig(config, remotePath));
                    return true;
                } catch (err) {
                    if (String(err?.message || '').includes('404')) return null;
                    throw err;
                }
            }

            try {
                await request(config, getFolderPath(remotePath), 'PROPFIND');
                return true;
            } catch (err) {
                if (err.status === 404) return null;
                throw err;
            }
        }

        function getHabitLedgerMergeKey(entry) {
            if (!entry || typeof entry !== 'object') return '';
            if (entry.sourceId && ['checkin', 'milestone', 'reverse', 'miss', 'break', 'reverse-penalty'].includes(entry.type)) {
                return `ledger:${entry.type}:${entry.sourceId}:${normalizeHabitCurrency(entry.currency) || defaultCurrency}`;
            }
            return '';
        }

        function getItemMergeKey(item, fallbackIndex, collection = '') {
            if (!item || typeof item !== 'object') return `value-${fallbackIndex}`;
            if (collection === 'habitPointLedger') return getHabitLedgerMergeKey(item) || (item.id ? `id:${item.id}` : `value-${fallbackIndex}`);
            if (item.id) return `id:${item.id}`;
            if (item.habitId && item.date) return `habit:${item.habitId}:${item.date}`;
            if (item.type && item.period) return `period:${item.type}:${item.period}`;
            if (item.title && item.date) return `title:${item.title}:${item.date}`;
            return `json:${JSON.stringify(item)}`;
        }

        function getItemUpdatedTime(item) {
            if (!item || typeof item !== 'object') return 0;
            const raw = item.updatedAt || item.completedAt || item.createdAt || item.date || item.recordTime || '';
            const time = new Date(raw).getTime();
            return Number.isFinite(time) ? time : 0;
        }

        function getDeletedItemKey(collection, id) {
            return `${collection}:${id}`;
        }

        function pruneDeletedItems(target = {}) {
            if (!Array.isArray(target.deletedItems)) target.deletedItems = [];
            // Keep tombstones indefinitely: an offline device must not resurrect an old deletion.
            target.deletedItems = target.deletedItems.filter(item => item?.collection && item?.id && item?.deletedAt);
            return target.deletedItems;
        }

        function markDeletedItem(target, collection, id, extra = {}) {
            if (!id || !target) return;
            if (!Array.isArray(target.deletedItems)) target.deletedItems = [];
            const key = getDeletedItemKey(collection, id);
            target.deletedItems = target.deletedItems.filter(item => getDeletedItemKey(item.collection, item.id) !== key);
            target.deletedItems.push({
                collection,
                id,
                deletedAt: getNowLocal(),
                ...extra
            });
            pruneDeletedItems(target);
        }

        function buildDeletionMap(localData = {}, remoteData = {}) {
            const map = new Map();
            [...(localData.deletedItems || []), ...(remoteData.deletedItems || [])].forEach(item => {
                if (!item?.collection || !item?.id) return;
                const key = getDeletedItemKey(item.collection, item.id);
                const existing = map.get(key);
                if (!existing || new Date(item.deletedAt || 0) > new Date(existing.deletedAt || 0)) {
                    map.set(key, item);
                }
            });
            return map;
        }

        function shouldKeepMergedItem(collection, item, deletionMap) {
            if (!item?.id) return true;
            const deleted = deletionMap.get(getDeletedItemKey(collection, item.id));
            if (!deleted) return true;
            return getItemUpdatedTime(item) > new Date(deleted.deletedAt || 0).getTime();
        }

        function mergeArrayByIdentity(collection, localItems = [], remoteItems = [], deletionMap = new Map()) {
            const merged = new Map();
            localItems.forEach((item, index) => merged.set(getItemMergeKey(item, index, collection), item));
            remoteItems.forEach((remoteItem, index) => {
                const key = getItemMergeKey(remoteItem, index, collection);
                const localItem = merged.get(key);
                if (!localItem || getItemUpdatedTime(remoteItem) >= getItemUpdatedTime(localItem)) {
                    merged.set(key, remoteItem);
                }
            });
            return Array.from(merged.values()).filter(item => shouldKeepMergedItem(collection, item, deletionMap));
        }

        function normalizeRecordMergeText(text = '') {
            return String(text || '').replace(/\r\n/g, '\n');
        }

        function normalizeRecordCompareText(text = '') {
            return normalizeRecordMergeText(text).replace(/[\s，。！？、；：,.!?;:"'“”‘’（）()【】[\]《》<>#\-_*`~]+/g, '');
        }

        function isTextSubsequence(needle, haystack) {
            if (!needle) return true;
            if (!haystack) return false;
            let index = 0;
            for (let i = 0; i < haystack.length && index < needle.length; i++) {
                if (haystack[i] === needle[index]) index += 1;
            }
            return index === needle.length;
        }

        function isRecordTextSuperset(candidateText, otherText) {
            if (!otherText) return !!candidateText;
            if (!candidateText) return false;
            if (candidateText.includes(otherText)) return true;
            return isTextSubsequence(
                normalizeRecordCompareText(otherText),
                normalizeRecordCompareText(candidateText)
            );
        }

        function getRecordMergeStamp(...items) {
            const winner = items
                .filter(Boolean)
                .sort((a, b) => getItemUpdatedTime(b) - getItemUpdatedTime(a))[0];
            return winner?.updatedAt || winner?.createdAt || getNowLocal();
        }

        function hasRecordConflictCopy(records, originalId, contentHash) {
            return records.some(record => record?.conflictOf === originalId && record.conflictContentHash === contentHash);
        }

        function createRecordConflictCopy(record, originalId, sourceLabel, existingRecords = []) {
            const contentHash = hashString(normalizeRecordMergeText(record?.content || ''));
            if (!contentHash || hasRecordConflictCopy(existingRecords, originalId, contentHash)) return null;
            const stamp = getNowLocal();
            const baseTitle = record.title || record.startDate || record.createdAt || '未命名记录';
            return {
                ...record,
                id: `${originalId}-conflict-${contentHash}`,
                title: `${baseTitle}（冲突副本-${sourceLabel}）`,
                conflictOf: originalId,
                conflictSource: sourceLabel,
                conflictContentHash: contentHash,
                conflictCreatedAt: stamp,
                createdAt: record.createdAt || stamp,
                updatedAt: record.updatedAt || record.createdAt || stamp
            };
        }

        function mergeRecordPair(localRecord, remoteRecord, existingRecords = []) {
            const localText = normalizeRecordMergeText(localRecord.content || '');
            const remoteText = normalizeRecordMergeText(remoteRecord.content || '');
            const localTime = getItemUpdatedTime(localRecord);
            const remoteTime = getItemUpdatedTime(remoteRecord);
            const latest = remoteTime >= localTime ? remoteRecord : localRecord;
            const older = latest === remoteRecord ? localRecord : remoteRecord;
            const olderSource = older === localRecord ? '本地' : '云端';

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
                        content: supersetRecord.content || '',
                        updatedAt: getRecordMergeStamp(localRecord, remoteRecord)
                    },
                    conflict: null
                };
            }

            return {
                primary: latest,
                conflict: createRecordConflictCopy(older, latest.id || older.id, olderSource, existingRecords)
            };
        }

        function mergeRecordsByIdentity(localItems = [], remoteItems = [], deletionMap = new Map()) {
            const merged = new Map();
            const conflictCopies = [];
            localItems.forEach((item, index) => merged.set(getItemMergeKey(item, index, 'records'), item));
            remoteItems.forEach((remoteItem, index) => {
                const key = getItemMergeKey(remoteItem, index, 'records');
                const localItem = merged.get(key);
                if (!localItem) {
                    merged.set(key, remoteItem);
                    return;
                }
                const existingRecords = [...localItems, ...remoteItems, ...Array.from(merged.values()), ...conflictCopies];
                const { primary, conflict } = mergeRecordPair(localItem, remoteItem, existingRecords);
                merged.set(key, primary);
                if (conflict) conflictCopies.push(conflict);
            });
            return [...Array.from(merged.values()), ...conflictCopies]
                .filter(item => shouldKeepMergedItem('records', item, deletionMap));
        }

        function getWheelEntityUpdatedTime(item) {
            if (!item || typeof item !== 'object') return 0;
            return getItemUpdatedTime(item);
        }

        function mergeWheelEntities(localItems = [], remoteItems = [], collection = '', deletionMap = new Map()) {
            const merged = new Map();
            [...localItems, ...remoteItems].forEach((item, index) => {
                if (!item || typeof item !== 'object') return;
                const key = item.id ? `id:${item.id}` : `json:${index}:${JSON.stringify(item)}`;
                const current = merged.get(key);
                if (!current || getWheelEntityUpdatedTime(item) >= getWheelEntityUpdatedTime(current)) {
                    merged.set(key, item);
                }
            });
            return Array.from(merged.values())
                .filter(item => !item?.deletedAt)
                .filter(item => !collection || shouldKeepMergedItem(collection, item, deletionMap));
        }

        function mergeWheelSnapshots(localSnapshot, remoteSnapshot) {
            const local = getWheelSnapshot(localSnapshot || {});
            const remote = getWheelSnapshot(remoteSnapshot || {});
            const deletionMap = buildDeletionMap(local, remote);
            const remoteWheelMap = new Map(remote.wheels.map(item => [item.id, item]));
            return {
                wheels: mergeWheelEntities(local.wheels, remote.wheels, 'wheels', deletionMap).map(wheel => {
                    const localWheel = local.wheels.find(item => item.id === wheel.id);
                    const remoteWheel = remoteWheelMap.get(wheel.id);
                    const baseWheel = !localWheel ? remoteWheel : !remoteWheel ? localWheel
                        : getWheelEntityUpdatedTime(remoteWheel) >= getWheelEntityUpdatedTime(localWheel) ? remoteWheel : localWheel;
                    return {
                        ...baseWheel,
                        items: mergeWheelEntities(localWheel?.items || [], remoteWheel?.items || [], 'wheelItems', deletionMap)
                    };
                }),
                wheelTags: mergeWheelEntities(local.wheelTags, remote.wheelTags, 'wheelTags', deletionMap),
                wheelLibraryItems: mergeWheelEntities(local.wheelLibraryItems, remote.wheelLibraryItems, 'wheelLibraryItems', deletionMap),
                wheelHistory: mergeWheelEntities(local.wheelHistory, remote.wheelHistory, 'wheelHistory', deletionMap),
                deletedItems: Array.from(deletionMap.values()).filter(item => isWheelDeletionCollection(item.collection))
            };
        }

        function mergeCloudData(localData = {}, remoteData = {}) {
            const kit = getKit();
            const adapter = kit?.adapters?.lifePlan || null;
            if (adapter?.merge) {
                return adapter.merge(localData || {}, remoteData || {});
            }
            const merged = { ...localData, ...remoteData };
            const deletionMap = buildDeletionMap(localData, remoteData);
            merged.records = mergeRecordsByIdentity(localData.records || [], remoteData.records || [], deletionMap);
            const wheelSnapshot = mergeWheelSnapshots(localData, remoteData);
            merged.wheels = wheelSnapshot.wheels;
            merged.wheelTags = wheelSnapshot.wheelTags;
            merged.wheelLibraryItems = wheelSnapshot.wheelLibraryItems;
            merged.wheelHistory = wheelSnapshot.wheelHistory;
            ['records', 'todos', 'habits', 'checkins', 'habitPointLedger', 'habitRewards', 'habitCurrencies', 'templates', 'goals', 'materials', 'wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory'].forEach(key => {
                if (['records', 'wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory'].includes(key)) return;
                merged[key] = mergeArrayByIdentity(key, localData[key] || [], remoteData[key] || [], deletionMap);
            });
            merged.deletedItems = Array.from(deletionMap.values());
            pruneDeletedItems(merged);
            return merged;
        }

        return {
            hashString,
            normalizeRemotePath,
            getFolderPath,
            getDataHash,
            getWheelSnapshot,
            getWheelDataHash,
            isWheelDeletionCollection,
            mergeWheelSnapshots,
            mergeCloudData,
            request,
            pullJson,
            pushJson,
            healthCheck,
            getItemUpdatedTime,
            getDeletedItemKey,
            markDeletedItem,
            pruneDeletedItems
        };
    }

    window.LifePlanSyncService = { create, hashString, normalizeRemotePath, getFolderPath };
})();
