(function () {
    function cloneDataSnapshot(value = {}) {
        return JSON.parse(JSON.stringify(value || {}));
    }

    function formatBytes(bytes = 0) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }

    function getTimestampForFile(date = new Date()) {
        const pad = n => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    }

    function downloadJsonFile(filename, payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function create(options = {}) {
        const {
            storage = localStorage,
            key = 'lifePlanSnapshots',
            maxSnapshots = 20,
            schemaVersion = 2,
            genId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
            getHash = value => JSON.stringify(value || {}).length.toString(36),
            getNowLocal = () => new Date().toISOString()
        } = options;

        function normalize(snapshots = []) {
            const sortedOldestFirst = [...snapshots].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            const fallbackVersions = new Map();
            sortedOldestFirst.forEach((snapshot, index) => {
                fallbackVersions.set(snapshot.id || `${snapshot.createdAt || ''}-${index}`, index + 1);
            });

            return snapshots.map((snapshot, index) => {
                const snapshotData = snapshot.data || {};
                const keyForVersion = snapshot.id || `${snapshot.createdAt || ''}-${index}`;
                const version = Number(snapshot.version || fallbackVersions.get(keyForVersion) || 1);
                return {
                    schemaVersion: snapshot.schemaVersion || 1,
                    id: snapshot.id || genId(),
                    version,
                    reason: snapshot.reason || '本地快照',
                    createdAt: snapshot.createdAt || getNowLocal(),
                    hash: snapshot.hash || getHash(snapshotData),
                    bytes: snapshot.bytes || new TextEncoder().encode(JSON.stringify(snapshotData)).length,
                    parent: snapshot.parent || null,
                    mergedWith: snapshot.mergedWith || null,
                    source: snapshot.source || 'legacy',
                    action: snapshot.action || '',
                    data: snapshotData
                };
            });
        }

        function getAll() {
            try {
                const saved = storage.getItem(key);
                const snapshots = saved ? JSON.parse(saved) : [];
                return Array.isArray(snapshots) ? normalize(snapshots) : [];
            } catch (err) {
                console.warn('本地快照读取失败', err);
                return [];
            }
        }

        function saveAll(snapshots) {
            const limited = normalize(snapshots)
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, maxSnapshots);
            storage.setItem(key, JSON.stringify(limited));
            return limited;
        }

        function getNextVersion(snapshots = getAll()) {
            return snapshots.reduce((max, snapshot) => Math.max(max, Number(snapshot.version || 0)), 0) + 1;
        }

        function getParent(snapshots = getAll(), meta = {}) {
            if (meta.parentSnapshotId || meta.parentVersion || meta.parentHash) {
                return {
                    id: meta.parentSnapshotId || '',
                    version: meta.parentVersion || '',
                    hash: meta.parentHash || ''
                };
            }
            const latest = [...snapshots].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
            if (!latest) return null;
            return {
                id: latest.id,
                version: latest.version,
                hash: latest.hash
            };
        }

        function createSnapshot(reason = '自动快照', sourceData = {}, meta = {}) {
            try {
                const existingSnapshots = getAll();
                const snapshotData = cloneDataSnapshot(sourceData);
                const snapshot = {
                    schemaVersion,
                    id: genId(),
                    version: getNextVersion(existingSnapshots),
                    reason,
                    createdAt: getNowLocal(),
                    hash: getHash(snapshotData),
                    bytes: new TextEncoder().encode(JSON.stringify(snapshotData)).length,
                    parent: getParent(existingSnapshots, meta),
                    mergedWith: meta.mergedWith || null,
                    source: meta.source || 'local',
                    action: meta.action || '',
                    data: snapshotData
                };
                saveAll([snapshot, ...existingSnapshots]);
                return snapshot;
            } catch (err) {
                console.warn('本地快照写入失败', err);
                return null;
            }
        }

        function getStorageStats(snapshots = getAll()) {
            const raw = storage.getItem(key) || '[]';
            const totalBytes = new TextEncoder().encode(raw).length;
            const latestBytes = snapshots[0]?.bytes || 0;
            return {
                count: snapshots.length,
                totalBytes,
                latestBytes,
                isRisky: totalBytes > 3 * 1024 * 1024 || latestBytes > 350 * 1024 || snapshots.length >= maxSnapshots
            };
        }

        return {
            cloneDataSnapshot,
            getTimestampForFile,
            formatBytes,
            downloadJsonFile,
            normalize,
            getAll,
            saveAll,
            getNextVersion,
            getParent,
            createSnapshot,
            getStorageStats
        };
    }

    window.LifePlanSnapshotService = {
        create,
        cloneDataSnapshot,
        getTimestampForFile,
        formatBytes,
        downloadJsonFile
    };
})();
