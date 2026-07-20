(function () {
    const palette = ['#ff6b6b', '#ff9f43', '#ffd166', '#06d6a0', '#2ec4b6', '#00bbf9', '#5c7cfa', '#9b5de5', '#f15bb5', '#8ac926'];
    let wheelRotation = 0;
    let wheelSpinning = false;
    let wheelStageState = createWheelStageState();
    let wheelPanelCollapsed = true;
    let wheelCreateMode = 'normal';
    let wheelCreateItemsDraft = [];
    let wheelBatchTarget = 'panel';
    let wheelLibraryCopyTagFilter = '';
    let wheelLibraryTagFilter = '';
    let wheelListModeFilter = 'normal';
    let wheelActionMenuOpen = false;
    let editingWheelTagId = null;
    const wheelSelectedLibraryItemIds = new Set();
    const wheelLibraryQuickTagIds = new Set();
    let wheelLibraryAiSuggestions = [];
    let wheelLibraryAiStatus = '';
    let wheelLibraryAiRunning = false;
    let wheelDragState = null;
    let wheelRenderCache = null;
    let wheelRenderCacheKey = '';

    function createWheelStageState() {
        return {
            type: 'wheel',
            tagWheelId: '',
            tagId: '',
            tagName: '',
            tagColor: '',
            itemCount: 0
        };
    }

    function safeHtml(value = '') {
        if (typeof escapeHtml === 'function') return escapeHtml(value);
        return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
    }

    function safeColor(value, fallback = '#216e4e') {
        const color = String(value || '').trim();
        return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
    }

    function pickRandomTagColor(exclude = []) {
        const used = new Set(
            (Array.isArray(exclude) ? exclude : [])
                .map(item => String(item || '').toLowerCase())
                .filter(Boolean)
        );
        const unused = palette.filter(color => !used.has(String(color).toLowerCase()));
        const pool = unused.length ? unused : palette;
        return pool[Math.floor(Math.random() * pool.length)] || '#216e4e';
    }

    function now() {
        return typeof getLocalDateTimeStr === 'function' ? getLocalDateTimeStr() : new Date().toISOString();
    }

    function today() {
        return typeof getTodayStr === 'function' ? getTodayStr() : new Date().toISOString().slice(0, 10);
    }

    function id() {
        return typeof genId === 'function' ? genId() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    }

    function safeJsArg(value) {
        const stringify = window.escapeInlineJsArg;
        return stringify ? stringify(value) : JSON.stringify(String(value || '')).replace(/"/g, '&quot;');
    }

    function persist() {
        if (typeof saveData === 'function') saveData();
    }

    function refreshApp() {
        renderWheelPage();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderTodoTable === 'function') renderTodoTable();
        if (typeof renderAllRecords === 'function') renderAllRecords();
    }

    function normalizeName(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function uniqueTagIds(tagIds = []) {
        const valid = new Set(data.wheelTags.map(tag => tag.id));
        const seen = new Set();
        return (Array.isArray(tagIds) ? tagIds : [])
            .filter(tagId => valid.has(tagId))
            .filter(tagId => {
                if (seen.has(tagId)) return false;
                seen.add(tagId);
                return true;
            });
    }

    function getTagById(tagId) {
        return data.wheelTags.find(tag => tag.id === tagId) || null;
    }

    function getTagItemPool(tagId) {
        return data.wheelLibraryItems.filter(item => item.enabled !== false && item.tagIds?.includes(tagId));
    }

    function getTagChipMarkup(name, color = '#216e4e') {
        return `<span class="wheel-chip" style="--chip-color:${safeColor(color)}">${safeHtml(name || '未命名标签')}</span>`;
    }

    function splitWheelLabel(value, maxCharsPerLine = 4, maxLines = 2) {
        const text = String(value || '').trim();
        if (!text || maxLines <= 0 || maxCharsPerLine <= 0) return [];
        const lines = [];
        for (let index = 0; index < text.length && lines.length < maxLines; index += maxCharsPerLine) {
            lines.push(text.slice(index, index + maxCharsPerLine));
        }
        if (text.length > maxCharsPerLine * maxLines) {
            const lastIndex = lines.length - 1;
            lines[lastIndex] = `${lines[lastIndex].slice(0, Math.max(1, maxCharsPerLine - 1))}…`;
        }
        return lines;
    }

    function getWheelLabelPlan(count = 0) {
        if (count <= 8) {
            return { mode: 'full', maxChars: 6, maxLines: 2, fontSize: 15, showStroke: true, shadow: true, numberPrefix: false };
        }
        if (count <= 16) {
            return { mode: 'full', maxChars: 5, maxLines: 2, fontSize: 12, showStroke: true, shadow: false, numberPrefix: false };
        }
        if (count <= 36) {
            return { mode: 'short', maxChars: 7, maxLines: 1, fontSize: 11, showStroke: false, shadow: false, numberPrefix: true };
        }
        if (count <= 80) {
            return { mode: 'short', maxChars: 5, maxLines: 1, fontSize: 10, showStroke: false, shadow: false, numberPrefix: true };
        }
        // Very dense wheels: number + very short text keeps the chart readable.
        return { mode: 'dense', maxChars: 4, maxLines: 1, fontSize: 9, showStroke: false, shadow: false, numberPrefix: true };
    }

    function getWheelSliceColor(entry, index, count, selected = false) {
        if (selected) return '#fb5d57';
        if (entry?.color) return entry.color;
        if (count <= palette.length * 2) return palette[index % palette.length];
        // Soft pastel spectrum for dense wheels (closer to common large-wheel UIs).
        const hue = Math.round((index * 137.508) % 360);
        return `hsl(${hue} 62% 72%)`;
    }

    function formatWheelSliceLabel(entry, index, plan) {
        const raw = String(entry?.name || '').trim() || '未命名';
        if (plan.mode === 'number') return [`${index + 1}`];
        const compact = raw
            .replace(/^[\d]+[\.、\s]*/, '')
            .replace(/\s+/g, '')
            .trim() || raw;
        if (plan.mode === 'dense') {
            const short = compact.slice(0, plan.maxChars);
            return [`${index + 1}.${short}${compact.length > plan.maxChars ? '…' : ''}`];
        }
        if (plan.numberPrefix) {
            const short = compact.slice(0, plan.maxChars);
            return [`${index + 1}.${short}${compact.length > plan.maxChars ? '…' : ''}`];
        }
        return splitWheelLabel(compact, plan.maxChars, plan.maxLines);
    }

    function invalidateWheelRenderCache() {
        wheelRenderCache = null;
        wheelRenderCacheKey = '';
    }

    function getWheelEntriesCacheKey(entries = []) {
        return entries.map(entry => `${entry.id || ''}|${entry.name || ''}|${entry.color || ''}|${entry.weight || 1}`).join('||');
    }

    function buildWheelRenderCache(entries = []) {
        const key = getWheelEntriesCacheKey(entries);
        if (wheelRenderCache && wheelRenderCacheKey === key && wheelRenderCache.count === entries.length) {
            return wheelRenderCache;
        }
        const size = 720;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        const radius = size / 2 - 28;
        const count = entries.length;
        const plan = getWheelLabelPlan(count);
        const innerRadius = Math.max(58, radius * (count >= 60 ? 0.2 : count >= 30 ? 0.24 : 0.28));
        const labelRadius = innerRadius + (radius - innerRadius) * (
            count <= 8 ? 0.52 : count <= 20 ? 0.58 : count <= 48 ? 0.64 : 0.7
        );

        ctx.clearRect(0, 0, size, size);
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(cx, cy, radius + 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = '#f7f9fc';
        ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
        ctx.fill();

        if (!count) {
            wheelRenderCache = { canvas, cx, cy, radius, innerRadius, count: 0 };
            wheelRenderCacheKey = key;
            return wheelRenderCache;
        }

        const slice = (Math.PI * 2) / count;
        entries.forEach((entry, index) => {
            // Keep the same angle basis as spin math: 0deg at right, 270deg at top pointer.
            const start = index * slice;
            const end = start + slice;
            const mid = start + slice / 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(start) * innerRadius, cy + Math.sin(start) * innerRadius);
            ctx.arc(cx, cy, radius, start, end);
            ctx.arc(cx, cy, innerRadius, end, start, true);
            ctx.closePath();
            ctx.fillStyle = getWheelSliceColor(entry, index, count, false);
            ctx.fill();
            if (plan.showStroke) {
                ctx.lineWidth = count <= 12 ? 2 : 1;
                ctx.strokeStyle = 'rgba(255,255,255,.92)';
                ctx.stroke();
            }

            const lines = formatWheelSliceLabel(entry, index, plan);
            if (!lines.length) return;
            const labelX = cx + Math.cos(mid) * labelRadius;
            const labelY = cy + Math.sin(mid) * labelRadius;
            ctx.save();
            ctx.translate(labelX, labelY);
            let textAngle = mid;
            if (textAngle > Math.PI / 2 && textAngle < Math.PI * 1.5) textAngle += Math.PI;
            ctx.rotate(textAngle);
            ctx.fillStyle = count >= 36 ? 'rgba(32, 38, 45, 0.88)' : '#ffffff';
            if (plan.shadow) {
                ctx.shadowColor = 'rgba(16, 23, 19, .14)';
                ctx.shadowBlur = 8;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.font = `800 ${plan.fontSize}px Microsoft YaHei, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lineHeight = plan.fontSize + 4;
            const lineOffset = lines.length > 1 ? lineHeight / 2 : 0;
            lines.forEach((line, lineIndex) => {
                ctx.fillText(line, 0, lineIndex * lineHeight - lineOffset);
            });
            ctx.restore();
        });

        // Outer ring
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,.95)';
        ctx.lineWidth = 10;
        ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(23,33,27,.06)';
        ctx.lineWidth = 2;
        ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
        ctx.stroke();

        wheelRenderCache = { canvas, cx, cy, radius, innerRadius, count };
        wheelRenderCacheKey = key;
        return wheelRenderCache;
    }

    function isTrailingWeightToken(value = '') {
        const text = String(value || '').trim();
        if (!text) return false;
        // Only a pure trailing number (optional %) can be weight; reject signs/exponents/text.
        const match = text.match(/^(\d+(?:\.\d+)?)%?$/);
        if (!match) return false;
        const numeric = Number(match[1]);
        return Number.isFinite(numeric);
    }

    function parseWeightedLines(text) {
        return String(text || '').split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                // Only peel a trailing weight; keep the original name punctuation intact.
                // Weight is valid only when the line ends with: separator + pure number (optional %).
                // Examples:
                //   火锅            -> name=火锅, weight=1
                //   火锅,10         -> name=火锅, weight=10
                //   麦当劳,肯德基,3 -> name=麦当劳,肯德基, weight=3
                //   周末晨跑,2,运动 -> name=周末晨跑,2,运动, weight=1
                //   站起来走动，拉伸一下 -> keeps Chinese commas, weight=1
                const weightMatch = line.match(/^(.*?)[,，\t]\s*(\d+(?:\.\d+)?)%?\s*$/);
                if (weightMatch) {
                    const name = weightMatch[1].trim();
                    const weightToken = weightMatch[2];
                    if (name && isTrailingWeightToken(weightToken)) {
                        return { name, weight: ensureWheelWeight(weightToken) };
                    }
                }
                return { name: line, weight: 1 };
            })
            .filter(item => item.name);
    }

    function ensureWheelCollections() {
        ['wheels', 'wheelTags', 'wheelLibraryItems', 'wheelHistory'].forEach(key => {
            if (!Array.isArray(data[key])) data[key] = [];
        });
    }

    function ensureWheelWeight(value) {
        return Math.max(1, Math.round(Number(value) || 1));
    }

    function ensureWheelTimestamp(value, fallback) {
        return typeof value === 'string' && value ? value : fallback;
    }

    function dedupeWheelItemsByName(items = []) {
        const seen = new Set();
        return (Array.isArray(items) ? items : []).filter(item => {
            const key = normalizeName(item?.name);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function normalizeWheelDataShape() {
        ensureWheelCollections();
        const stamp = now();
        const rawTags = data.wheelTags.map(tag => {
            const createdAt = ensureWheelTimestamp(tag?.createdAt, stamp);
            return {
                id: tag?.id || id(),
                name: String(tag?.name || '未命名标签').trim() || '未命名标签',
                    color: safeColor(tag?.color, palette[data.wheelTags.length % palette.length]),
                    weight: ensureWheelWeight(tag?.weight),
                    enabled: tag?.enabled !== false,
                    createdAt,
                updatedAt: ensureWheelTimestamp(tag?.updatedAt, createdAt)
            };
        });
        const tagIdRemap = new Map();
        const seenTags = new Map();
        rawTags.forEach(tag => {
            const key = normalizeName(tag.name);
            const existingId = seenTags.get(key);
            if (existingId) tagIdRemap.set(tag.id, existingId);
            else {
                seenTags.set(key, tag.id);
                tagIdRemap.set(tag.id, tag.id);
            }
        });
        data.wheelTags = rawTags.filter(tag => tagIdRemap.get(tag.id) === tag.id);
        const validTagIds = new Set(data.wheelTags.map(tag => tag.id));
        const ensureUncategorizedTagId = () => {
            const key = normalizeName('未分类');
            let tag = data.wheelTags.find(item => normalizeName(item.name) === key);
            if (!tag) {
                tag = {
                    id: id(),
                    name: '未分类',
                    color: '#8a8f98',
                    weight: 1,
                    enabled: true,
                    createdAt: stamp,
                    updatedAt: stamp
                };
                data.wheelTags.push(tag);
                validTagIds.add(tag.id);
            }
            return tag.id;
        };
        const normalizeTagIds = (tagIds, fallbackToUncategorized = false) => {
            const seen = new Set();
            const normalized = (Array.isArray(tagIds) ? tagIds : [])
                .map(tagId => tagIdRemap.get(tagId) || tagId)
                .filter(tagId => validTagIds.has(tagId))
                .filter(tagId => {
                    if (seen.has(tagId)) return false;
                    seen.add(tagId);
                    return true;
                });
            if (!normalized.length && fallbackToUncategorized) normalized.push(ensureUncategorizedTagId());
            return normalized;
        };
        data.wheelLibraryItems = dedupeWheelItemsByName(data.wheelLibraryItems.map(item => {
            const createdAt = ensureWheelTimestamp(item?.createdAt, stamp);
            return {
                id: item?.id || id(),
                name: String(item?.name || '未命名公共项').trim() || '未命名公共项',
                note: item?.note || '',
                weight: ensureWheelWeight(item?.weight),
                enabled: item?.enabled !== false,
                tagIds: normalizeTagIds(item?.tagIds, true),
                createdAt,
                updatedAt: ensureWheelTimestamp(item?.updatedAt, createdAt)
            };
        }));
        data.wheels = data.wheels.map(wheel => {
            const createdAt = ensureWheelTimestamp(wheel?.createdAt, stamp);
            const mode = wheel?.mode === 'tag' ? 'tag' : 'normal';
            const normalized = {
                id: wheel?.id || id(),
                name: String(wheel?.name || '未命名转盘').trim() || '未命名转盘',
                mode,
                items: [],
                createdAt,
                updatedAt: ensureWheelTimestamp(wheel?.updatedAt, createdAt)
            };
            if (mode === 'tag') {
                normalized.tagIds = normalizeTagIds(wheel?.tagIds);
                return normalized;
            }
            normalized.items = dedupeWheelItemsByName(wheel?.items).map(item => {
                const itemCreatedAt = ensureWheelTimestamp(item?.createdAt, stamp);
                return {
                    id: item?.id || id(),
                    name: String(item?.name || '未命名选项').trim() || '未命名选项',
                    note: item?.note || '',
                    weight: ensureWheelWeight(item?.weight),
                    enabled: item?.enabled !== false,
                    sourceLibraryItemId: item?.sourceLibraryItemId || undefined,
                    createdAt: itemCreatedAt,
                    updatedAt: ensureWheelTimestamp(item?.updatedAt, itemCreatedAt)
                };
            });
            return normalized;
        });
        data.wheelHistory = (Array.isArray(data.wheelHistory) ? data.wheelHistory : []).map(item => {
            const createdAt = ensureWheelTimestamp(item?.createdAt, stamp);
            return {
                id: item?.id || id(),
                wheelId: item?.wheelId || '',
                wheelName: item?.wheelName || '未命名转盘',
                mode: item?.mode === 'tag' ? 'tag' : 'normal',
                tagId: item?.tagId || '',
                tagName: item?.tagName || '',
                resultId: item?.resultId || '',
                resultName: item?.resultName || '未命名结果',
                note: item?.note || '',
                convertedTodoId: item?.convertedTodoId || '',
                createdAt,
                updatedAt: ensureWheelTimestamp(item?.updatedAt, createdAt)
            };
        });
    }

    function ensureSeedData() {
        ensureWheelCollections();
        normalizeWheelDataShape();
        if (data.wheels.length || data.wheelTags.length || data.wheelLibraryItems.length || data.wheelHistory.length) return;

        const stamp = now();
        const seedTags = [
            ['出门', '#2f7d6d'],
            ['在家', '#e86c52'],
            ['学习', '#3e65b0'],
            ['美食', '#ebb050']
        ].map(([name, color]) => ({ id: id(), name, color, weight: 1, enabled: true, createdAt: stamp, updatedAt: stamp }));

        const tagId = name => seedTags.find(tag => tag.name === name)?.id;
        const seedItems = [
            ['去公园走走', ['出门'], '换个地方透透气'],
            ['整理房间', ['在家'], '让空间清爽一点'],
            ['背 20 个单词', ['学习'], '小任务也算前进'],
            ['吃火锅', ['美食'], '适合奖励自己'],
            ['咖啡店学习', ['出门', '学习', '美食'], '出门和学习一起完成']
        ].map(([name, tags, note]) => ({
            id: id(),
            name,
            note,
            weight: 1,
            enabled: true,
            tagIds: tags.map(tagId).filter(Boolean),
            createdAt: stamp,
            updatedAt: stamp
        }));

        data.wheelTags.push(...seedTags);
        data.wheelLibraryItems.push(...seedItems);
        data.wheels.push({
            id: id(),
            name: '默认普通转盘',
            mode: 'normal',
            items: seedItems.map(item => ({
                id: id(),
                name: item.name,
                note: item.note,
                weight: item.weight,
                enabled: true,
                sourceLibraryItemId: item.id,
                createdAt: stamp,
                updatedAt: stamp
            })),
            createdAt: stamp,
            updatedAt: stamp
        });
        data.wheels.push({
            id: id(),
            name: '默认标签转盘',
            mode: 'tag',
            tagIds: seedTags.map(tag => tag.id),
            items: [],
            createdAt: stamp,
            updatedAt: stamp
        });
        currentWheelId = data.wheels[0].id;
        persist();
    }

    function getCurrentWheel() {
        ensureSeedData();
        let wheel = data.wheels.find(item => item.id === currentWheelId);
        if (!wheel) {
            wheel = data.wheels.find(item => item.mode === currentWheelMode) || data.wheels[0];
            currentWheelId = wheel?.id || null;
        }
        if (wheel) currentWheelMode = wheel.mode || 'normal';
        return wheel;
    }

    function getSelectedTagsForWheel(wheel = {}) {
        const selected = new Set(uniqueTagIds(Array.isArray(wheel.tagIds) ? wheel.tagIds : []));
        return data.wheelTags.filter(tag => tag.enabled !== false && selected.has(tag.id));
    }

    function getTagCandidatesForWheel(wheel = {}) {
        return getSelectedTagsForWheel(wheel)
            .map(tag => ({ tag, items: getTagItemPool(tag.id) }))
            .filter(entry => entry.items.length > 0);
    }

    function getEnabledEntries(wheel) {
        if (!wheel) return [];
        if (wheel.mode === 'tag') {
            return getTagCandidatesForWheel(wheel).map(entry => entry.tag);
        }
        return (wheel.items || []).filter(item => item.enabled !== false);
    }

    function tagNames(tagIds = []) {
        return tagIds.map(tagId => data.wheelTags.find(tag => tag.id === tagId)?.name).filter(Boolean);
    }

    function getFilteredLibraryItemsForCopy() {
        return data.wheelLibraryItems.filter(item => (
            item.enabled !== false
            && (!wheelLibraryCopyTagFilter || item.tagIds?.includes(wheelLibraryCopyTagFilter))
        ));
    }

    function tagChips(tagIds = []) {
        const tags = tagIds.map(tagId => data.wheelTags.find(tag => tag.id === tagId)).filter(Boolean);
        if (!tags.length) return '<span class="wheel-chip muted">无标签</span>';
        return tags.map(tag => `<span class="wheel-chip" style="--chip-color:${safeColor(tag.color)}">${safeHtml(tag.name)}</span>`).join('');
    }

    function weightedPick(items) {
        const total = items.reduce((sum, item) => sum + Math.max(1, Number(item.weight) || 1), 0);
        let draw = Math.random() * total;
        for (const item of items) {
            draw -= Math.max(1, Number(item.weight) || 1);
            if (draw <= 0) return item;
        }
        return items[0];
    }

    function downloadTextFile(filename, content, type = 'application/json;charset=utf-8') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    function csvCell(value) {
        return `"${String(value ?? '').replace(/"/g, '""')}"`;
    }

    function getWheelBackupSnapshot() {
        return {
            wheels: data.wheels || [],
            wheelTags: data.wheelTags || [],
            wheelLibraryItems: data.wheelLibraryItems || [],
            wheelHistory: data.wheelHistory || []
        };
    }

    function resetWheelStageState() {
        wheelStageState = createWheelStageState();
    }

    function setTagItemsStage(tag, wheelId = currentWheelId || '') {
        const items = getTagItemPool(tag?.id);
        if (!tag || !items.length) return null;
        wheelStageState = {
            type: 'tag-items',
            tagWheelId: wheelId,
            tagId: tag.id,
            tagName: tag.name,
            tagColor: tag.color || '#216e4e',
            itemCount: items.length
        };
        return items;
    }

    function isTagItemsStage(wheel) {
        return Boolean(wheel && wheelStageState.type === 'tag-items' && wheelStageState.tagId && wheel.id === wheelStageState.tagWheelId);
    }

    function getStageEntries(wheel) {
        if (!wheel) return [];
        if (isTagItemsStage(wheel)) {
            return data.wheelLibraryItems
                .filter(item => item.enabled !== false && item.tagIds?.includes(wheelStageState.tagId))
                .map((item, index) => ({
                    ...item,
                    color: palette[index % palette.length]
                }));
        }
        return getEnabledEntries(wheel).map((item, index) => ({
            ...item,
            color: item.color || palette[index % palette.length]
        }));
    }

    function countWheelHistory(wheelId = '') {
        return data.wheelHistory.filter(item => item.wheelId === wheelId).length;
    }

    function getWheelHeadline(wheel) {
        if (!wheel) return '工具转盘';
        if (wheel.name === '默认普通转盘') return '今天做什么';
        if (wheel.name === '默认标签转盘') return '先抽个方向';
        return wheel.name || '未命名转盘';
    }

    function getWheelPanelSummaryMarkup(wheel) {
        const activeWheelCount = isTagItemsStage(wheel)
            ? (Number(wheelStageState.itemCount) || 0)
            : getEnabledEntries(wheel).length;
        const activeLabel = wheel?.mode === 'tag'
            ? (isTagItemsStage(wheel) ? '标签内候选' : '可抽标签')
            : '当前选项';
        const libraryCount = data.wheelLibraryItems.filter(item => item.enabled !== false).length;
        const tagCount = data.wheelTags.filter(tag => tag.enabled !== false).length;
        const historyCount = countWheelHistory(wheel?.id || '');
        return `
            <span class="wheel-panel-stat"><strong>${activeWheelCount}</strong><span>${activeLabel}</span></span>
            <span class="wheel-panel-stat"><strong>${libraryCount}</strong><span>公共项</span></span>
            <span class="wheel-panel-stat"><strong>${tagCount}</strong><span>标签</span></span>
            <span class="wheel-panel-stat"><strong>${historyCount}</strong><span>记录</span></span>
        `;
    }

    function getFilteredLibraryItemsForManage() {
        return data.wheelLibraryItems.filter(item => (
            !wheelLibraryTagFilter || item.tagIds?.includes(wheelLibraryTagFilter)
        ));
    }

    function getSelectedLibraryItemIds() {
        const existing = new Set(data.wheelLibraryItems.map(item => item.id));
        Array.from(wheelSelectedLibraryItemIds).forEach(itemId => {
            if (!existing.has(itemId)) wheelSelectedLibraryItemIds.delete(itemId);
        });
        return Array.from(wheelSelectedLibraryItemIds);
    }

    function formatLibrarySelectionCount(selectedTotalCount, selectedVisibleCount, filteredCount) {
        // Always show total selected count used by bulk actions; also show current filter view.
        if (wheelLibraryTagFilter && selectedTotalCount !== selectedVisibleCount) {
            return `选中 ${selectedTotalCount}（当前筛选 ${selectedVisibleCount}/${filteredCount}）`;
        }
        return `选中 ${selectedTotalCount}/${filteredCount}`;
    }

    function getWheelPanelMarkup(panel = currentWheelPanel) {
        const wheel = getCurrentWheel();
        if (panel === 'library') return renderLibraryPanel();
        if (panel === 'tags') return renderTagsPanel();
        if (panel === 'history') return renderHistoryPanel();
        return renderItemsPanel(wheel);
    }

    function renderWheelModalBody(panel = currentWheelPanel) {
        const body = document.getElementById(`wheel-${panel}-modal-body`);
        if (body) body.innerHTML = getWheelPanelMarkup(panel);
    }

    function renderActiveWheelModalBody() {
        ['items', 'library', 'tags', 'history'].forEach(panel => {
            if (document.getElementById(`wheel-${panel}-modal`)?.classList.contains('active')) {
                renderWheelModalBody(panel);
            }
        });
        if (document.getElementById('wheel-list-modal')?.classList.contains('active')) {
            renderWheelListModalBody();
        }
    }

    function getWheelCandidateCount(wheel) {
        if (!wheel) return 0;
        if (wheel.mode === 'tag') {
            return uniqueTagIds(wheel.tagIds || []).reduce((sum, tagId) => sum + getTagItemPool(tagId).length, 0);
        }
        return (wheel.items || []).filter(item => item.enabled !== false).length;
    }

    function renderWheelListModalBody() {
        const body = document.getElementById('wheel-list-modal-body');
        if (!body) return;
        body.innerHTML = renderWheelListPanel();
    }

    function renderWheelListPanel() {
        const mode = wheelListModeFilter === 'tag' ? 'tag' : 'normal';
        const wheels = data.wheels
            .filter(wheel => (wheel.mode || 'normal') === mode)
            .slice()
            .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
        return `
            <div class="wheel-list-toolbar">
                <div class="segmented wheel-list-mode-filter" id="wheel-list-mode-filter">
                    <button type="button" class="${mode === 'normal' ? 'active' : ''}" onclick="setWheelListModeFilter('normal')">普通</button>
                    <button type="button" class="${mode === 'tag' ? 'active' : ''}" onclick="setWheelListModeFilter('tag')">标签</button>
                </div>
                <button class="btn btn-secondary" type="button" onclick="openWheelCreateModalFromList()">新建转盘</button>
            </div>
            <div class="wheel-list-stack">
                ${wheels.map(wheel => {
                    const selected = wheel.id === currentWheelId;
                    const candidateCount = getWheelCandidateCount(wheel);
                    const historyCount = countWheelHistory(wheel.id);
                    const modeLabel = wheel.mode === 'tag' ? '标签' : '普通';
                    const extra = wheel.mode === 'tag'
                        ? `${(wheel.tagIds || []).length} 个标签 · ${candidateCount} 个候选`
                        : `${candidateCount} 个选项`;
                    return `
                        <article class="wheel-list-card ${selected ? 'selected' : ''}" data-wheel-id="${safeHtml(wheel.id)}">
                            <div class="wheel-list-card-main">
                                <div class="wheel-list-card-title">
                                    <strong>${safeHtml(wheel.name || '未命名转盘')}</strong>
                                    ${selected ? '<span class="wheel-list-badge current">当前</span>' : ''}
                                </div>
                                <div class="wheel-list-card-meta">
                                    <span class="wheel-list-badge">${modeLabel}</span>
                                    <span>${safeHtml(extra)}</span>
                                    <span>${historyCount} 条记录</span>
                                </div>
                            </div>
                            <div class="wheel-list-card-actions">
                                <button class="wheel-mini-btn primary" type="button" onclick="openWheelFromList(${safeJsArg(wheel.id)})">打开</button>
                                <button class="wheel-mini-btn" type="button" onclick="editWheelFromList(${safeJsArg(wheel.id)})">修改</button>
                                <button class="wheel-mini-btn" type="button" onclick="renameWheelFromList(${safeJsArg(wheel.id)})">重命名</button>
                                <button class="wheel-mini-btn danger" type="button" onclick="deleteWheelFromList(${safeJsArg(wheel.id)})">删除</button>
                            </div>
                        </article>
                    `;
                }).join('') || `
                    <div class="empty-state">
                        <strong>这一类还没有转盘</strong>
                        <div class="wheel-hint">${mode === 'tag' ? '先新建一个标签盘。' : '先新建一个普通盘。'}</div>
                        <button class="btn btn-primary" type="button" onclick="openWheelCreateModalFromList()">新建转盘</button>
                    </div>
                `}
            </div>
        `;
    }

    function renderWheelActionMenu() {
        const menu = document.getElementById('wheel-action-menu');
        const button = document.getElementById('wheel-action-menu-button');
        if (menu) menu.hidden = !wheelActionMenuOpen;
        if (button) button.setAttribute('aria-expanded', String(wheelActionMenuOpen));
    }

    function openWheelPanelModal(panel = 'items') {
        currentWheelPanel = ['items', 'library', 'tags', 'history'].includes(panel) ? panel : 'items';
        renderWheelModalBody(currentWheelPanel);
        document.getElementById(`wheel-${currentWheelPanel}-modal`)?.classList.add('active');
    }

    function drawWheelCanvas(entries = [], selectedIndex = -1) {
        const canvas = document.getElementById('wheel-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        ctx.clearRect(0, 0, width, height);

        const cache = buildWheelRenderCache(entries);
        const drawScale = Math.min(width, height) / cache.canvas.width;
        const drawSize = cache.canvas.width * drawScale;
        const radius = cache.radius * drawScale;
        const innerRadius = cache.innerRadius * drawScale;

        if (!entries.length) {
            ctx.beginPath();
            ctx.fillStyle = '#eef2f7';
            ctx.arc(cx, cy, Math.min(width, height) / 2 - 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.fillStyle = '#ffffff';
            ctx.arc(cx, cy, Math.max(52, (Math.min(width, height) / 2 - 20) * 0.28), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#647269';
            ctx.font = '700 18px Microsoft YaHei, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('暂无可抽内容', cx, cy);
            return;
        }

        // Rotate the pre-rendered wheel image instead of redrawing every slice/text each frame.
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((wheelRotation * Math.PI) / 180);
        ctx.drawImage(cache.canvas, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        ctx.restore();

        if (selectedIndex >= 0 && selectedIndex < entries.length) {
            const slice = (Math.PI * 2) / entries.length;
            const start = (wheelRotation * Math.PI) / 180 + selectedIndex * slice;
            const end = start + slice;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(start) * innerRadius, cy + Math.sin(start) * innerRadius);
            ctx.arc(cx, cy, radius, start, end);
            ctx.arc(cx, cy, innerRadius, end, start, true);
            ctx.closePath();
            ctx.fillStyle = 'rgba(251, 93, 87, 0.28)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(251, 93, 87, 0.95)';
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(cx, cy, innerRadius + 8, 0, Math.PI * 2);
        ctx.fill();

        const centerGradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, innerRadius + 8);
        centerGradient.addColorStop(0, '#ffffff');
        centerGradient.addColorStop(1, '#f2f5f9');
        ctx.beginPath();
        ctx.fillStyle = centerGradient;
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(23,33,27,.08)';
        ctx.lineWidth = 2;
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#68766f';
        ctx.font = '700 12px Microsoft YaHei, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('点击旋转', cx, cy - 9);
        ctx.fillStyle = '#16201b';
        ctx.font = '900 16px Microsoft YaHei, sans-serif';
        ctx.fillText('GO', cx, cy + 13);
    }

    function renderSelector() {
        const selector = document.getElementById('wheel-selector');
        if (!selector) return;
        const modeWheels = data.wheels.filter(wheel => (wheel.mode || 'normal') === currentWheelMode);
        const fallbackWheel = modeWheels[0] || data.wheels[0] || null;
        if (!modeWheels.some(wheel => wheel.id === currentWheelId)) {
            currentWheelId = fallbackWheel?.id || null;
            if (fallbackWheel) currentWheelMode = fallbackWheel.mode || 'normal';
        }
        selector.innerHTML = modeWheels.map(wheel => `<option value="${safeHtml(wheel.id)}" ${wheel.id === currentWheelId ? 'selected' : ''}>${safeHtml(wheel.name)} · ${wheel.mode === 'tag' ? '标签' : '普通'}</option>`).join('');
        selector.disabled = modeWheels.length === 0;
    }

    function renderStageSummary(wheel) {
        const container = document.getElementById('wheel-stage-summary');
        if (!container) return;
        const headline = safeHtml(getWheelHeadline(wheel));
        if (isTagItemsStage(wheel)) {
            const tag = getTagById(wheelStageState.tagId);
            const tagColor = wheelStageState.tagColor || tag?.color || '#216e4e';
            container.innerHTML = `
                <div class="wheel-stage-card hero compact active">
                    <div class="wheel-stage-card-top">
                        <span class="wheel-stage-badge">第二段</span>
                        <span class="wheel-stage-badge muted">标签已锁定</span>
                    </div>
                    <div class="wheel-stage-title">已锁定 ${getTagChipMarkup(wheelStageState.tagName, tagColor)}</div>
                    <div class="wheel-stage-copy">${headline} · 再转一次抽具体内容。</div>
                </div>
            `;
            return;
        }
        if (wheel?.mode === 'tag') {
            const tagCandidates = getTagCandidatesForWheel(wheel).slice(0, 6);
            container.innerHTML = `
                <div class="wheel-stage-card hero compact">
                    <div class="wheel-stage-card-top">
                        <span class="wheel-stage-badge">标签转盘</span>
                        <span class="wheel-stage-badge muted">两段抽取</span>
                    </div>
                    <div class="wheel-stage-title">${headline}</div>
                    <div class="wheel-stage-copy">先抽一个标签，再抽该标签下的公共项。也可以单独点某个标签直接转。</div>
                    ${tagCandidates.length ? `
                        <div class="wheel-stage-quick-tags">
                            ${tagCandidates.map(entry => `
                                <button type="button" class="wheel-stage-quick-tag" onclick="spinDirectTag(${safeJsArg(entry.tag.id)})">
                                    ${getTagChipMarkup(entry.tag.name, entry.tag.color || '#216e4e')}
                                    <span>${entry.items.length} 项</span>
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            return;
        }
        container.innerHTML = `
            <div class="wheel-stage-card hero compact">
                <div class="wheel-stage-card-top">
                    <span class="wheel-stage-badge">普通转盘</span>
                    <span class="wheel-stage-badge muted">一步出结果</span>
                </div>
                <div class="wheel-stage-title">${headline}</div>
                <div class="wheel-stage-copy">先转出一个明确答案。</div>
            </div>
        `;
    }

    function renderResult() {
        const container = document.getElementById('wheel-result');
        if (!container) return;
        const wheel = getCurrentWheel();
        const history = data.wheelHistory.find(item => item.id === currentWheelResultId);
        if (!history) {
            const itemCount = isTagItemsStage(wheel) ? Number(wheelStageState.itemCount) || 0 : getStageEntries(wheel).length;
            container.innerHTML = `
                <div class="wheel-result-card pending compact">
                    <span class="wheel-result-kicker">${isTagItemsStage(wheel) ? '第二段' : '准备开始'}</span>
                    <strong class="wheel-result-title">${isTagItemsStage(wheel) ? '再转一次' : '转一转'}</strong>
                    <span class="wheel-result-note">${itemCount} 个候选</span>
                </div>
            `;
            return;
        }
        const converted = history.convertedTodoId && data.todos.some(todo => todo.id === history.convertedTodoId);
        container.innerHTML = `
            <div class="wheel-result-card">
                <div class="wheel-result-meta">
                    <span class="wheel-result-meta-item">${safeHtml(history.wheelName || '当前转盘')}</span>
                    <span class="wheel-result-meta-item">${history.mode === 'tag' ? `标签 · ${safeHtml(history.tagName || '-')}` : '普通模式'}</span>
                </div>
                <div class="wheel-result-kicker">${history.mode === 'tag' ? '最终结果' : '这次抽中了'}</div>
                <div class="wheel-result-title">${safeHtml(history.resultName || '未命名结果')}</div>
                <div class="wheel-result-note">${history.note ? safeHtml(history.note) : '如果这个答案正好对味，就直接把它转成待办，省掉继续纠结的那一步。'}</div>
                <div class="wheel-result-actions">
                    <button class="btn btn-primary" ${converted ? 'disabled' : ''} onclick="convertWheelResultToTodo(${safeJsArg(history.id)})">${converted ? '已转入待办' : '转入待办'}</button>
                    <button class="btn btn-secondary" onclick="clearWheelCurrentResult()">只保留记录</button>
                </div>
            </div>
        `;
    }

    function getWheelPointerAngle(event, element) {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        return Math.atan2(y, x) * 180 / Math.PI;
    }

    function attachWheelPointerGestures(entries) {
        const canvasWrap = document.querySelector('.wheel-canvas-wrap');
        if (!canvasWrap) return;
        const startDrag = (clientX, clientY, pointerId = 'mouse') => {
            wheelDragState = {
                pointerId,
                startX: clientX,
                startY: clientY,
                startAngle: getWheelPointerAngle({ clientX, clientY }, canvasWrap),
                startRotation: wheelRotation,
                moved: false,
                suppressClick: false
            };
            canvasWrap.classList.add('dragging');
        };
        const moveDrag = (clientX, clientY) => {
            if (!wheelDragState || wheelSpinning) return;
            const dx = clientX - wheelDragState.startX;
            const dy = clientY - wheelDragState.startY;
            if (Math.hypot(dx, dy) > 8) wheelDragState.moved = true;
            if (!wheelDragState.moved) return;
            const currentAngle = getWheelPointerAngle({ clientX, clientY }, canvasWrap);
            wheelRotation = wheelDragState.startRotation + currentAngle - wheelDragState.startAngle;
            drawWheelCanvas(entries);
        };
        const finishDrag = () => {
            if (!wheelDragState) return;
            const shouldSpin = wheelDragState.moved;
            canvasWrap.classList.remove('dragging');
            wheelDragState = null;
            if (shouldSpin && !wheelSpinning) spinWheel();
            if (shouldSpin) {
                canvasWrap.dataset.suppressNextClick = '1';
                window.setTimeout(() => {
                    if (canvasWrap.dataset.suppressNextClick === '1') delete canvasWrap.dataset.suppressNextClick;
                }, 0);
            }
        };
        canvasWrap.onpointerdown = event => {
            if (wheelSpinning || !entries.length || event.button > 0) return;
            startDrag(event.clientX, event.clientY, event.pointerId);
            canvasWrap.setPointerCapture?.(event.pointerId);
        };
        canvasWrap.onpointermove = event => {
            if (!wheelDragState || wheelDragState.pointerId !== event.pointerId || wheelSpinning) return;
            moveDrag(event.clientX, event.clientY);
        };
        const finishPointer = event => {
            if (!wheelDragState || wheelDragState.pointerId !== event.pointerId) return;
            canvasWrap.releasePointerCapture?.(event.pointerId);
            finishDrag();
        };
        canvasWrap.onpointerup = finishPointer;
        canvasWrap.onpointercancel = event => {
            if (wheelDragState?.pointerId === event.pointerId) {
                canvasWrap.releasePointerCapture?.(event.pointerId);
                canvasWrap.classList.remove('dragging');
                wheelDragState = null;
                drawWheelCanvas(entries);
            }
        };
        canvasWrap.onmousedown = event => {
            if (wheelDragState || wheelSpinning || !entries.length || event.button > 0) return;
            startDrag(event.clientX, event.clientY);
            const handleMove = moveEvent => moveDrag(moveEvent.clientX, moveEvent.clientY);
            const handleUp = () => {
                window.removeEventListener('mousemove', handleMove);
                finishDrag();
            };
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp, { once: true });
            event.preventDefault();
        };
        canvasWrap.onclick = event => {
            if (canvasWrap.dataset.suppressNextClick === '1') {
                delete canvasWrap.dataset.suppressNextClick;
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (!wheelSpinning) spinWheel();
        };
    }

    function renderStage() {
        const wheel = getCurrentWheel();
        const tagItemsStage = isTagItemsStage(wheel);
        renderSelector();
        document.querySelectorAll('#wheel-mode-tabs button').forEach(btn => btn.classList.toggle('active', btn.textContent.includes(wheel?.mode === 'tag' ? '标签' : '普通')));
        renderStageSummary(wheel);
        const entries = getStageEntries(wheel);
        drawWheelCanvas(entries);
        const actionWrap = document.querySelector('.wheel-actions');
        if (actionWrap) {
            actionWrap.innerHTML = `
                <button class="btn btn-primary" onclick="spinWheel()">${tagItemsStage ? '继续抽具体内容' : (wheel?.mode === 'tag' ? '先抽一个标签' : '开始抽取')}</button>
                ${tagItemsStage ? `<button class="btn btn-secondary" onclick="returnToTagWheel()">返回标签转盘</button>` : `<button class="btn btn-secondary" onclick="renderWheelPage()">刷新</button>`}
            `;
        }
        const stageHint = document.getElementById('wheel-stage-hint');
        if (stageHint) {
            if (tagItemsStage) {
                stageHint.textContent = `当前是第二段，正在从“${wheelStageState.tagName}”对应的内容池里继续抽取。`;
            } else if (wheel?.mode === 'tag') {
                stageHint.textContent = '标签转盘会先定标签，再抽具体内容；也可以直接点某个标签单独转。';
            } else {
                stageHint.textContent = '点击转盘或按钮都可以开始，普通转盘会直接给出最终结果。';
            }
        }
        attachWheelPointerGestures(entries);
        renderResult();
    }

    function renderItemsPanel(wheel) {
        if (!wheel) return '<div class="empty-state">暂无转盘</div>';
        if (wheel.mode === 'tag') {
            const selected = new Set(wheel.tagIds || []);
            const tagCards = data.wheelTags.map(tag => {
                const items = getTagItemPool(tag.id);
                return `
                    <article class="wheel-tag-card ${selected.has(tag.id) ? 'selected' : ''}" data-wheel-tag-id="${safeHtml(tag.id)}">
                        <label class="wheel-tag-toggle">
                            <input type="checkbox" ${selected.has(tag.id) ? 'checked' : ''} onchange="toggleWheelTag(${safeJsArg(wheel.id)},${safeJsArg(tag.id)},this.checked)">
                            <span class="wheel-color-dot" style="background:${safeColor(tag.color)}"></span>
                            <span class="wheel-tag-title">${safeHtml(tag.name)}</span>
                        </label>
                        <div class="wheel-tag-meta">
                            <span>权重 ${tag.weight}</span>
                            <span>${items.length} 个可抽公共项</span>
                        </div>
                    </article>
                `;
            }).join('');
            return `
                <div class="wheel-panel-head">
                    <div>
                        <div class="card-title">标签转盘配置</div>
                        <div class="wheel-hint">勾选参与方向抽取的标签。想单独转某个标签，去“标签管理”。</div>
                    </div>
                    <div class="wheel-head-actions">
                        <button class="btn btn-secondary" onclick="renameWheel(${safeJsArg(wheel.id)})">改名</button>
                        <button class="btn btn-danger" onclick="deleteWheel(${safeJsArg(wheel.id)})">删除转盘</button>
                    </div>
                </div>
                <div class="wheel-tag-grid">
                    ${tagCards || '<div class="empty-state">暂无标签，先去“标签”面板新增。</div>'}
                </div>
            `;
        }
        const filteredLibraryItems = getFilteredLibraryItemsForCopy();
        return `
            <div class="wheel-panel-head">
                <div>
                    <div class="card-title">当前转盘项</div>
                    <div class="wheel-hint">名称不能重复，权重越高越容易抽中。</div>
                </div>
                <div class="wheel-head-actions">
                    <button class="btn btn-secondary" onclick="openWheelBatchImport()">批量导入</button>
                    <button class="btn btn-secondary" onclick="renameWheel(${safeJsArg(wheel.id)})">改名</button>
                    <button class="btn btn-danger" onclick="deleteWheel(${safeJsArg(wheel.id)})">删除转盘</button>
                </div>
            </div>
            <div class="wheel-inline-form">
                <input id="wheel-item-name" placeholder="新增选项，例如：散步">
                <input id="wheel-item-weight" type="number" min="1" value="1" title="权重">
                <button class="btn btn-primary" onclick="addWheelItem(${safeJsArg(wheel.id)})">添加</button>
            </div>
            <div class="tag-filter-strip inline wheel-copy-filter">
                <button type="button" class="${!wheelLibraryCopyTagFilter ? 'active' : ''}" onclick="setWheelLibraryCopyFilter('')">全部公共项</button>
                ${data.wheelTags.map(tag => `
                    <button type="button" class="${wheelLibraryCopyTagFilter === tag.id ? 'active' : ''}" onclick="setWheelLibraryCopyFilter(${safeJsArg(tag.id)})">
                        <span class="wheel-color-dot" style="background:${safeColor(tag.color)}"></span>${safeHtml(tag.name)}
                    </button>
                `).join('')}
            </div>
            <div class="wheel-inline-form wide">
                <select id="wheel-library-copy-select">
                    <option value="">从公共项复制到当前转盘</option>
                    ${filteredLibraryItems.map(item => `<option value="${safeHtml(item.id)}">${safeHtml(item.name)}</option>`).join('')}
                </select>
                <button class="btn btn-secondary" onclick="copyLibraryItemToWheel(${safeJsArg(wheel.id)})">复制</button>
            </div>
            <div class="wheel-list">
                ${(wheel.items || []).map(item => `
                    <div class="wheel-row">
                        <span class="wheel-row-main"><strong>${safeHtml(item.name)}</strong><small>权重 ${item.weight}${item.note ? ` · ${safeHtml(item.note)}` : ''}</small></span>
                        <button class="wheel-mini-btn" onclick="editWheelItem(${safeJsArg(wheel.id)},${safeJsArg(item.id)})">修改</button>
                        <button class="wheel-mini-btn danger" onclick="deleteWheelItem(${safeJsArg(wheel.id)},${safeJsArg(item.id)})">删除</button>
                    </div>
                `).join('') || '<div class="empty-state">暂无转盘项，可以添加或从公共项复制。</div>'}
            </div>
        `;
    }

    function renderWheelLibraryAiSuggestions() {
        if (!wheelLibraryAiSuggestions.length) {
            return wheelLibraryAiStatus
                ? `<div class="wheel-library-ai-status">${safeHtml(wheelLibraryAiStatus)}</div>`
                : '<div class="wheel-hint compact">输入公共项后点“AI 推荐标签”，结果可勾选修改再添加。</div>';
        }
        const options = wheelLibraryAiSuggestions.map((item, index) => {
            const tag = getTagById(item.tagId);
            if (!tag) return '';
            return `
                <label class="wheel-library-ai-tag ${item.selected ? 'selected' : ''}">
                    <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="toggleWheelLibraryAiSuggestion(${index}, this.checked)">
                    <span class="wheel-color-dot" style="background:${safeColor(tag.color)}"></span>
                    <span class="wheel-library-ai-tag-main">
                        <strong>${safeHtml(tag.name)}</strong>
                        ${item.reason ? `<small>${safeHtml(item.reason)}</small>` : ''}
                    </span>
                </label>
            `;
        }).join('');
        return `
            <div class="wheel-library-ai-result">
                <div class="wheel-library-ai-result-head">
                    <span>AI 推荐（可改）</span>
                    <small>${safeHtml(wheelLibraryAiStatus || '勾选你要的标签，再点添加')}</small>
                </div>
                <div class="wheel-library-ai-tags">${options}</div>
            </div>
        `;
    }

    function renderLibraryPanel() {
        const filteredItems = getFilteredLibraryItemsForManage();
        const selectedIds = new Set(getSelectedLibraryItemIds());
        const selectedVisibleCount = filteredItems.filter(item => selectedIds.has(item.id)).length;
        const selectedTotalCount = selectedIds.size;
        const allVisibleSelected = Boolean(filteredItems.length && selectedVisibleCount === filteredItems.length);
        const selectionCountText = formatLibrarySelectionCount(selectedTotalCount, selectedVisibleCount, filteredItems.length);
        const validQuickTagIds = new Set(data.wheelTags.map(tag => tag.id));
        Array.from(wheelLibraryQuickTagIds).forEach(tagId => {
            if (!validQuickTagIds.has(tagId)) wheelLibraryQuickTagIds.delete(tagId);
        });
        wheelLibraryAiSuggestions = wheelLibraryAiSuggestions.filter(item => validQuickTagIds.has(item.tagId));
        const batchTagPicker = data.wheelTags.map(tag => `
            <label class="wheel-library-batch-tag">
                <input type="checkbox" value="${safeHtml(tag.id)}" ${wheelLibraryQuickTagIds.has(tag.id) ? 'checked' : ''} onchange="toggleWheelLibraryQuickTag(${safeJsArg(tag.id)}, this.checked)">
                <span class="wheel-color-dot" style="background:${safeColor(tag.color)}"></span>
                <span>${safeHtml(tag.name)}</span>
            </label>
        `).join('');
        return `
            <div class="wheel-panel-head">
                <div>
                    <div class="card-title">公共项库</div>
                    <div class="wheel-hint">公共项可被普通转盘复制，也会被标签转盘用于二段抽取。</div>
                </div>
                <button class="btn btn-secondary" onclick="focusWheelLibraryBatchImport()">批量公共项</button>
            </div>
            <div class="wheel-inline-form library-form">
                <input id="wheel-library-name" placeholder="公共项名称">
                <input id="wheel-library-weight" type="number" min="1" value="1">
                <button class="btn btn-secondary" id="wheel-library-ai-btn" ${wheelLibraryAiRunning ? 'disabled' : ''} onclick="suggestWheelLibraryTagsByAi()">${wheelLibraryAiRunning ? '推荐中…' : 'AI 推荐标签'}</button>
                <button class="btn btn-primary" onclick="addWheelLibraryItem()">添加</button>
            </div>
            <div class="wheel-library-ai-box" id="wheel-library-ai-box">
                ${renderWheelLibraryAiSuggestions()}
            </div>
            <div class="wheel-library-batch-box">
                <textarea id="wheel-library-batch-text" rows="4" placeholder="每行一个公共项：名称 或 名称,权重&#10;咖啡店学习&#10;周末晨跑,2&#10;麦当劳,肯德基,3"></textarea>
                <div class="wheel-library-batch-side">
                    <button class="btn btn-secondary" onclick="importWheelLibraryBatchFromTextarea()">导入多行公共项</button>
                    <div class="wheel-hint">批量只认末尾纯数字权重；标签请用下方勾选，不要写在行里。</div>
                </div>
            </div>
            <div class="wheel-library-batch-tag-panel">
                <div class="wheel-library-batch-tag-head">
                    <span>快速选择标签</span>
                    <small>单个添加、AI 推荐和批量导入共用；也可手动改勾选</small>
                </div>
                <div class="wheel-library-batch-tags">
                    ${batchTagPicker || '<div class="empty-state compact">还没有标签，先在标签面板新增。</div>'}
                </div>
            </div>
            <div class="wheel-library-toolbar">
                <label class="wheel-library-filter">
                    <span>标签筛选</span>
                    <select id="wheel-library-tag-filter" onchange="setWheelLibraryTagFilter(this.value)">
                        <option value="">全部标签</option>
                        ${data.wheelTags.map(tag => `<option value="${safeHtml(tag.id)}" ${wheelLibraryTagFilter === tag.id ? 'selected' : ''}>${safeHtml(tag.name)}</option>`).join('')}
                    </select>
                </label>
                <div class="wheel-library-bulk-actions">
                    <label class="wheel-check-row wheel-select-all-row">
                        <input type="checkbox" id="wheel-library-select-all" ${allVisibleSelected ? 'checked' : ''} ${filteredItems.length ? '' : 'disabled'} onchange="toggleAllWheelLibrarySelection(this.checked)">
                        <span id="wheel-library-selected-count">${safeHtml(selectionCountText)}</span>
                    </label>
                    <button class="wheel-mini-btn" data-library-bulk="clear" ${selectedTotalCount ? '' : 'disabled'} onclick="clearWheelLibrarySelection()">清空勾选</button>
                    <button class="wheel-mini-btn primary" data-library-bulk="tag-add" ${selectedTotalCount && data.wheelTags.length ? '' : 'disabled'} onclick="applyWheelLibraryBatchTag('add')">加标签</button>
                    <button class="wheel-mini-btn" data-library-bulk="tag-remove" ${selectedTotalCount && data.wheelTags.length ? '' : 'disabled'} onclick="applyWheelLibraryBatchTag('remove')">去标签</button>
                    <button class="wheel-mini-btn" data-library-bulk="enable" ${selectedTotalCount ? '' : 'disabled'} onclick="batchToggleWheelLibraryItems(true)">批量启用</button>
                    <button class="wheel-mini-btn" data-library-bulk="disable" ${selectedTotalCount ? '' : 'disabled'} onclick="batchToggleWheelLibraryItems(false)">批量停用</button>
                    <button class="wheel-mini-btn danger" data-library-bulk="delete" ${selectedTotalCount ? '' : 'disabled'} onclick="batchDeleteWheelLibraryItems()">批量删除</button>
                </div>
            </div>
            <div class="wheel-hint compact">批量操作按全部勾选项计数（跨筛选保留）；全选/取消全选只作用于当前筛选列表。</div>
            <div class="wheel-list" id="wheel-library-list">
                ${filteredItems.map(item => `
                    <div class="wheel-row library ${selectedIds.has(item.id) ? 'selected' : ''}" data-library-item-id="${safeHtml(item.id)}">
                        <label class="wheel-library-select">
                            <input type="checkbox" aria-label="选择${safeHtml(item.name)}" ${selectedIds.has(item.id) ? 'checked' : ''} onchange="toggleWheelLibrarySelection(${safeJsArg(item.id)}, this.checked)">
                        </label>
                        <span class="wheel-row-main"><strong>${safeHtml(item.name)}</strong><small>权重 ${item.weight} · ${item.enabled === false ? '已停用' : '启用中'}</small><span class="wheel-chip-row">${tagChips(item.tagIds)}</span></span>
                        <button class="wheel-mini-btn" onclick="editWheelLibraryItem(${safeJsArg(item.id)})">修改</button>
                        <button class="wheel-mini-btn" onclick="toggleWheelLibraryItem(${safeJsArg(item.id)})">${item.enabled === false ? '启用' : '停用'}</button>
                        <button class="wheel-mini-btn danger" onclick="deleteWheelLibraryItem(${safeJsArg(item.id)})">删除</button>
                    </div>
                `).join('') || '<div class="empty-state">当前筛选下没有公共项。</div>'}
            </div>
        `;
    }

    function renderTagsPanel() {
        const editingTag = editingWheelTagId
            ? data.wheelTags.find(tag => tag.id === editingWheelTagId)
            : null;
        if (editingWheelTagId && !editingTag) editingWheelTagId = null;
        const formColor = editingTag?.color
            || pickRandomTagColor(data.wheelTags.map(tag => tag.color));
        return `
            <div class="wheel-panel-head">
                <div>
                    <div class="card-title">标签管理</div>
                    <div class="wheel-hint">新建标签会随机给颜色，也可手动改。右侧会显示颜色块。</div>
                </div>
            </div>
            <div class="wheel-inline-form tags-form">
                <input id="wheel-tag-name" placeholder="标签名称" value="${safeHtml(editingTag?.name || '')}">
                <input id="wheel-tag-weight" type="number" min="1" value="${safeHtml(editingTag?.weight ?? 1)}">
                <label class="wheel-tag-color-field" title="标签颜色">
                    <input id="wheel-tag-color" type="color" value="${safeHtml(formColor)}" oninput="document.getElementById('wheel-tag-color-label').textContent = this.value">
                    <span id="wheel-tag-color-label">${safeHtml(formColor)}</span>
                </label>
                <button class="btn btn-primary" onclick="saveWheelTagForm()">${editingTag ? '保存修改' : '添加'}</button>
                ${editingTag ? '<button class="btn btn-secondary" onclick="cancelEditWheelTag()">取消</button>' : ''}
            </div>
            ${editingTag ? `<div class="wheel-hint">正在修改：${safeHtml(editingTag.name)}</div>` : ''}
            <div class="wheel-list">
                ${data.wheelTags.map(tag => {
                    const items = getTagItemPool(tag.id);
                    const color = safeColor(tag.color);
                    return `
                        <div class="wheel-row ${editingWheelTagId === tag.id ? 'selected' : ''}" data-wheel-tag-id="${safeHtml(tag.id)}">
                            <span class="wheel-color-dot" style="background:${color}"></span>
                            <span class="wheel-row-main"><strong>${safeHtml(tag.name)}</strong><small>权重 ${tag.weight} · ${items.length} 个公共项 · ${tag.enabled === false ? '已停用' : '启用中'}</small></span>
                            <span class="wheel-tag-color-chip" style="--tag-color:${color}" title="${safeHtml(color)}">
                                <i style="background:${color}"></i>
                                <em>${safeHtml(color)}</em>
                            </span>
                            <button class="wheel-mini-btn primary" ${items.length && tag.enabled !== false ? '' : 'disabled'} onclick="spinDirectTag(${safeJsArg(tag.id)})">只转这个标签</button>
                            <button class="wheel-mini-btn" ${items.length && tag.enabled !== false ? '' : 'disabled'} onclick="previewTagStage(${safeJsArg(tag.id)})">先看这个标签池</button>
                            <button class="wheel-mini-btn" onclick="editWheelTag(${safeJsArg(tag.id)})">${editingWheelTagId === tag.id ? '编辑中' : '修改'}</button>
                            <button class="wheel-mini-btn" onclick="toggleWheelTagEnabled(${safeJsArg(tag.id)})">${tag.enabled === false ? '启用' : '停用'}</button>
                            <button class="wheel-mini-btn danger" onclick="deleteWheelTag(${safeJsArg(tag.id)})">删除</button>
                        </div>
                    `;
                }).join('') || '<div class="empty-state">暂无标签。</div>'}
            </div>
        `;
    }

    function renderHistoryPanel() {
        const history = [...data.wheelHistory].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return `
            <div class="wheel-panel-head">
                <div>
                    <div class="card-title">抽取记录</div>
                    <div class="wheel-hint">记录每次抽取，结果仍然由你决定是否转待办。</div>
                </div>
                <div class="wheel-head-actions">
                    <button class="btn btn-secondary" onclick="exportWheelHistoryCsv()">导出记录</button>
                    <button class="btn btn-secondary" onclick="exportWheelBackupJson()">导出JSON</button>
                    <button class="btn btn-secondary" onclick="importWheelBackupJson()">恢复JSON</button>
                    <button class="btn btn-danger" onclick="clearWheelHistory()">清空记录</button>
                </div>
            </div>
            <div class="wheel-list history">
                ${history.map(item => `
                    <div class="wheel-row">
                        <span class="wheel-row-main"><strong>${safeHtml(item.resultName)}</strong><small>${formatStoredDateTime(item.createdAt)} · ${item.mode === 'tag' ? `标签 ${safeHtml(item.tagName || '-')}` : '普通转盘'}${item.convertedTodoId ? ' · 已转待办' : ''}</small></span>
                        ${item.convertedTodoId ? '' : `<button class="wheel-mini-btn" onclick="convertWheelResultToTodo(${safeJsArg(item.id)})">转待办</button>`}
                        <button class="wheel-mini-btn danger" onclick="deleteWheelHistory(${safeJsArg(item.id)})">删除</button>
                    </div>
                `).join('') || '<div class="empty-state">暂无抽取记录。</div>'}
            </div>
        `;
    }

    window.renderWheelPage = function renderWheelPage() {
        if (!document.getElementById('page-wheel')) return;
        ensureSeedData();
        const wheel = getCurrentWheel();
        renderStage();
        renderWheelActionMenu();
        renderActiveWheelModalBody();
        const panel = document.getElementById('wheel-panel');
        const content = document.getElementById('wheel-panel-content');
        const summary = document.getElementById('wheel-panel-summary');
        const toggle = document.getElementById('wheel-panel-toggle');
        if (panel) {
            panel.classList.toggle('collapsed', wheelPanelCollapsed);
            panel.classList.toggle('expanded', !wheelPanelCollapsed);
        }
        if (content) content.hidden = wheelPanelCollapsed;
        if (summary) summary.innerHTML = getWheelPanelSummaryMarkup(wheel);
        if (toggle) {
            toggle.textContent = wheelPanelCollapsed ? '展开管理' : '收起管理';
            toggle.setAttribute('aria-expanded', String(!wheelPanelCollapsed));
            toggle.setAttribute('aria-controls', 'wheel-panel-content');
        }
        const body = document.getElementById('wheel-panel-body');
        if (!body) return;
        document.querySelectorAll('#wheel-panel-tabs button').forEach(btn => {
            const map = { items: '转盘项', library: '公共项', tags: '标签', history: '记录' };
            btn.classList.toggle('active', btn.textContent.includes(map[currentWheelPanel]));
        });
        if (currentWheelPanel === 'library') body.innerHTML = renderLibraryPanel();
        else if (currentWheelPanel === 'tags') body.innerHTML = renderTagsPanel();
        else if (currentWheelPanel === 'history') body.innerHTML = renderHistoryPanel();
        else body.innerHTML = renderItemsPanel(wheel);
    };

    window.setWheelMode = function setWheelMode(mode) {
        currentWheelMode = mode === 'tag' ? 'tag' : 'normal';
        const wheel = data.wheels.find(item => item.mode === currentWheelMode);
        if (wheel) currentWheelId = wheel.id;
        resetWheelStageState();
        renderWheelPage();
    };

    window.setWheelPanel = function setWheelPanel(panel) {
        openWheelPanelModal(panel);
    };

    function resetWheelLibraryAiState() {
        wheelLibraryAiSuggestions = [];
        wheelLibraryAiStatus = '';
        wheelLibraryAiRunning = false;
    }

    function resetWheelPanelTransientState(panel = '') {
        if (panel === 'library' || !panel) {
            resetWheelLibraryAiState();
        }
        if (panel === 'tags' || !panel) {
            editingWheelTagId = null;
        }
    }

    window.closeWheelPanelModal = function closeWheelPanelModal(panel) {
        document.getElementById(`wheel-${panel}-modal`)?.classList.remove('active');
        resetWheelPanelTransientState(panel);
    };

    window.openWheelListModal = function openWheelListModal() {
        wheelListModeFilter = currentWheelMode === 'tag' ? 'tag' : 'normal';
        closeWheelActionMenu();
        renderWheelListModalBody();
        document.getElementById('wheel-list-modal')?.classList.add('active');
    };

    window.closeWheelListModal = function closeWheelListModal() {
        document.getElementById('wheel-list-modal')?.classList.remove('active');
        // Keep filter aligned with current stage mode next time the list opens.
        wheelListModeFilter = currentWheelMode === 'tag' ? 'tag' : 'normal';
    };

    window.setWheelListModeFilter = function setWheelListModeFilter(mode = 'normal') {
        wheelListModeFilter = mode === 'tag' ? 'tag' : 'normal';
        renderWheelListModalBody();
    };

    window.openWheelCreateModalFromList = function openWheelCreateModalFromList() {
        closeWheelListModal();
        openWheelCreateModal(wheelListModeFilter);
    };

    window.openWheelFromList = function openWheelFromList(wheelId) {
        const wheel = data.wheels.find(item => item.id === wheelId);
        if (!wheel) return;
        window.selectWheel(wheelId);
        closeWheelListModal();
    };

    window.editWheelFromList = function editWheelFromList(wheelId) {
        const wheel = data.wheels.find(item => item.id === wheelId);
        if (!wheel) return;
        window.selectWheel(wheelId);
        closeWheelListModal();
        setWheelPanel('items');
    };

    window.renameWheelFromList = function renameWheelFromList(wheelId) {
        window.renameWheel(wheelId);
        if (document.getElementById('wheel-list-modal')?.classList.contains('active')) {
            renderWheelListModalBody();
        }
    };

    window.deleteWheelFromList = function deleteWheelFromList(wheelId) {
        window.deleteWheel(wheelId);
        if (document.getElementById('wheel-list-modal')?.classList.contains('active')) {
            renderWheelListModalBody();
        }
    };

    window.toggleWheelActionMenu = function toggleWheelActionMenu(event) {
        event?.stopPropagation();
        wheelActionMenuOpen = !wheelActionMenuOpen;
        renderWheelActionMenu();
    };

    window.closeWheelActionMenu = function closeWheelActionMenu() {
        wheelActionMenuOpen = false;
        renderWheelActionMenu();
    };

    window.setWheelLibraryCopyFilter = function setWheelLibraryCopyFilter(tagId = '') {
        wheelLibraryCopyTagFilter = String(tagId || '');
        renderWheelPage();
    };

    window.setWheelLibraryTagFilter = function setWheelLibraryTagFilter(tagId = '') {
        wheelLibraryTagFilter = String(tagId || '');
        renderWheelPage();
    };

    window.toggleWheelPanelCollapse = function toggleWheelPanelCollapse() {
        wheelPanelCollapsed = !wheelPanelCollapsed;
        renderWheelPage();
    };

    window.selectWheel = function selectWheel(wheelId) {
        currentWheelId = wheelId;
        currentWheelResultId = null;
        resetWheelStageState();
        const wheel = data.wheels.find(item => item.id === wheelId);
        if (wheel) currentWheelMode = wheel.mode || 'normal';
        renderWheelPage();
    };

    function createWheelItemPayload(item = {}, stamp = now()) {
        const name = String(item.name || '').trim();
        if (!name) return null;
        return {
            id: id(),
            name,
            note: '',
            weight: ensureWheelWeight(item.weight),
            enabled: true,
            createdAt: stamp,
            updatedAt: stamp
        };
    }

    function normalizeWheelCreateDraft(items = wheelCreateItemsDraft) {
        const source = Array.isArray(items) && items.length ? items : [{ name: '', weight: 1 }];
        return source.map(item => ({
            name: String(item?.name || ''),
            weight: ensureWheelWeight(item?.weight)
        }));
    }

    function getValidWheelCreateItems() {
        const seen = new Set();
        const skipped = [];
        const items = [];
        normalizeWheelCreateDraft().forEach(item => {
            const name = String(item.name || '').trim();
            const key = normalizeName(name);
            if (!key) return;
            if (seen.has(key)) {
                skipped.push(name);
                return;
            }
            seen.add(key);
            items.push({ name, weight: ensureWheelWeight(item.weight) });
        });
        return { items, skipped };
    }

    function renderWheelCreateItemsEditor() {
        const editor = document.getElementById('wheel-create-items-editor');
        const countEl = document.getElementById('wheel-create-items-count');
        if (!editor) return;
        wheelCreateItemsDraft = normalizeWheelCreateDraft();
        editor.innerHTML = wheelCreateItemsDraft.map((item, index) => `
            <div class="wheel-create-item-row">
                <input class="wheel-create-item-name" value="${safeHtml(item.name)}" placeholder="选项" oninput="updateWheelCreateItem(${index}, 'name', this.value)">
                <input class="wheel-create-item-weight" type="number" min="1" value="${safeHtml(item.weight)}" placeholder="权重" oninput="updateWheelCreateItem(${index}, 'weight', this.value)">
                <button type="button" class="wheel-create-item-remove" onclick="removeWheelCreateItemRow(${index})" title="删除选项">×</button>
            </div>
        `).join('');
        if (countEl) {
            const validCount = getValidWheelCreateItems().items.length;
            countEl.textContent = `${validCount || wheelCreateItemsDraft.length} 个选项`;
        }
    }

    function updateWheelCreateModeUi() {
        document.getElementById('wheel-create-mode-normal')?.classList.toggle('active', wheelCreateMode === 'normal');
        document.getElementById('wheel-create-mode-tag')?.classList.toggle('active', wheelCreateMode === 'tag');
        const itemsGroup = document.getElementById('wheel-create-items-group');
        const tagGroup = document.getElementById('wheel-create-tag-group');
        const tagOptions = document.getElementById('wheel-create-tag-options');
        const tagHelp = document.getElementById('wheel-create-tag-help');
        if (itemsGroup) itemsGroup.style.display = wheelCreateMode === 'tag' ? 'none' : '';
        if (tagGroup) tagGroup.style.display = wheelCreateMode === 'tag' ? '' : 'none';
        if (wheelCreateMode === 'normal') renderWheelCreateItemsEditor();
        if (tagOptions && wheelCreateMode === 'tag') {
            tagOptions.innerHTML = data.wheelTags.map(tag => `
                <label class="wheel-create-tag-option">
                    <input type="checkbox" value="${safeHtml(tag.id)}" checked>
                    <span class="wheel-color-dot" style="background:${safeColor(tag.color)}"></span>
                    <span>${safeHtml(tag.name)}</span>
                </label>
            `).join('') || '<div class="empty-state">还没有标签，请先在“标签”菜单里新增。</div>';
        }
        if (tagHelp) tagHelp.style.display = wheelCreateMode === 'tag' ? '' : 'none';
    }

    function createWheelFromForm({ mode, name, items: inputItems = [], tagIds = [] }) {
        const trimmed = String(name || '').trim() || (mode === 'tag' ? '新的标签转盘' : '新的普通转盘');
        const stamp = now();
        const items = [];
        let selectedTagIds;
        if (mode !== 'tag') {
            const seen = new Set();
            inputItems.forEach(item => {
                const payload = createWheelItemPayload(item, stamp);
                const key = normalizeName(payload?.name);
                if (!payload || seen.has(key)) return;
                seen.add(key);
                items.push(payload);
            });
            if (!items.length) return alert('普通转盘至少需要 1 个转盘项');
        } else {
            selectedTagIds = uniqueTagIds(tagIds);
            if (!selectedTagIds.length) return alert('标签转盘至少需要选择一个标签');
        }
        const wheel = { id: id(), name: trimmed, mode, items, tagIds: mode === 'tag' ? selectedTagIds : undefined, createdAt: stamp, updatedAt: stamp };
        data.wheels.unshift(wheel);
        currentWheelId = wheel.id;
        currentWheelMode = mode;
        persist();
        renderWheelPage();
        return wheel;
    }

    window.openWheelCreateModal = function openWheelCreateModal(mode = currentWheelMode) {
        wheelCreateMode = mode === 'tag' ? 'tag' : 'normal';
        wheelCreateItemsDraft = [{ name: '', weight: 1 }];
        const nameInput = document.getElementById('wheel-create-name');
        if (nameInput) nameInput.value = wheelCreateMode === 'tag' ? '新的标签转盘' : '新的普通转盘';
        updateWheelCreateModeUi();
        document.getElementById('wheel-create-modal')?.classList.add('active');
    };

    window.closeWheelCreateModal = function closeWheelCreateModal() {
        document.getElementById('wheel-create-modal')?.classList.remove('active');
        wheelCreateItemsDraft = [{ name: '', weight: 1 }];
        wheelCreateMode = currentWheelMode === 'tag' ? 'tag' : 'normal';
        const nameInput = document.getElementById('wheel-create-name');
        if (nameInput) nameInput.value = '';
    };

    window.setWheelCreateMode = function setWheelCreateMode(mode) {
        wheelCreateMode = mode === 'tag' ? 'tag' : 'normal';
        const nameInput = document.getElementById('wheel-create-name');
        if (nameInput && (!nameInput.value.trim() || ['新的普通转盘', '新的标签转盘'].includes(nameInput.value.trim()))) {
            nameInput.value = wheelCreateMode === 'tag' ? '新的标签转盘' : '新的普通转盘';
        }
        if (wheelCreateMode === 'normal' && !wheelCreateItemsDraft.length) wheelCreateItemsDraft = [{ name: '', weight: 1 }];
        updateWheelCreateModeUi();
    };

    window.updateWheelCreateItem = function updateWheelCreateItem(index, field, value) {
        if (!wheelCreateItemsDraft[index]) return;
        if (field === 'name') wheelCreateItemsDraft[index].name = value;
        if (field === 'weight') wheelCreateItemsDraft[index].weight = ensureWheelWeight(value);
        const countEl = document.getElementById('wheel-create-items-count');
        if (countEl) countEl.textContent = `${getValidWheelCreateItems().items.length || wheelCreateItemsDraft.length} 个选项`;
    };

    window.addWheelCreateItemRow = function addWheelCreateItemRow() {
        wheelCreateItemsDraft = normalizeWheelCreateDraft();
        wheelCreateItemsDraft.push({ name: '', weight: 1 });
        renderWheelCreateItemsEditor();
        const inputs = document.querySelectorAll('#wheel-create-items-editor .wheel-create-item-name');
        inputs[inputs.length - 1]?.focus();
    };

    window.removeWheelCreateItemRow = function removeWheelCreateItemRow(index) {
        wheelCreateItemsDraft = normalizeWheelCreateDraft();
        wheelCreateItemsDraft.splice(index, 1);
        if (!wheelCreateItemsDraft.length) wheelCreateItemsDraft.push({ name: '', weight: 1 });
        renderWheelCreateItemsEditor();
    };

    window.saveWheelCreateModal = function saveWheelCreateModal() {
        const name = document.getElementById('wheel-create-name')?.value || '';
        const tagIds = Array.from(document.querySelectorAll('#wheel-create-tag-options input:checked')).map(input => input.value);
        const { items, skipped } = getValidWheelCreateItems();
        const wheel = createWheelFromForm({ mode: wheelCreateMode, name, items, tagIds });
        if (!wheel) return;
        closeWheelCreateModal();
        renderWheelPage();
        if (skipped.length) alert(`已创建，跳过重复：${skipped.join('、')}`);
    };

    window.createWheel = function createWheel() {
        openWheelCreateModal(currentWheelMode);
    };

    window.renameWheel = function renameWheel(wheelId) {
        const wheel = data.wheels.find(item => item.id === wheelId);
        if (!wheel) return;
        const name = prompt('修改转盘名称', wheel.name);
        if (name === null) return;
        wheel.name = name.trim() || wheel.name;
        wheel.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.deleteWheel = function deleteWheel(wheelId) {
        const wheel = data.wheels.find(item => item.id === wheelId);
        if (!wheel) return;
        if (data.wheels.length <= 1) return alert('至少保留一个转盘');
        if (!confirm(`删除转盘“${wheel.name}”吗？抽取历史不会删除。`)) return;
        data.wheels = data.wheels.filter(item => item.id !== wheelId);
        if (typeof markDeletedItem === 'function') markDeletedItem('wheels', wheelId, { name: wheel.name });
        const next = data.wheels.find(item => item.mode === currentWheelMode) || data.wheels[0];
        currentWheelId = next?.id || null;
        if (next) currentWheelMode = next.mode || 'normal';
        currentWheelResultId = null;
        persist();
        renderWheelPage();
    };

    window.clearWheelCurrentResult = function clearWheelCurrentResult() {
        currentWheelResultId = null;
        renderWheelPage();
    };

    window.addWheelItem = function addWheelItem(wheelId) {
        const wheel = data.wheels.find(item => item.id === wheelId);
        const name = document.getElementById('wheel-item-name')?.value.trim();
        const weight = Math.max(1, Number(document.getElementById('wheel-item-weight')?.value) || 1);
        if (!wheel || !name) return alert('请输入选项名称');
        if ((wheel.items || []).some(item => normalizeName(item.name) === normalizeName(name))) return alert('当前转盘里已经有同名选项');
        wheel.items.push({ id: id(), name, note: '', weight, enabled: true, createdAt: now(), updatedAt: now() });
        wheel.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.editWheelItem = function editWheelItem(wheelId, itemId) {
        const wheel = data.wheels.find(item => item.id === wheelId);
        const item = wheel?.items?.find(entry => entry.id === itemId);
        if (!item) return;
        const name = prompt('选项名称', item.name);
        if (name === null) return;
        const trimmed = name.trim();
        if (!trimmed) return alert('名称不能为空');
        if (wheel.items.some(entry => entry.id !== item.id && normalizeName(entry.name) === normalizeName(trimmed))) return alert('当前转盘里已经有同名选项');
        const weight = prompt('权重', item.weight);
        if (weight === null) return;
        item.name = trimmed;
        item.weight = Math.max(1, Number(weight) || 1);
        item.updatedAt = now();
        wheel.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.deleteWheelItem = function deleteWheelItem(wheelId, itemId) {
        if (!confirm('删除这个转盘项吗？')) return;
        const wheel = data.wheels.find(item => item.id === wheelId);
        if (!wheel) return;
        const item = (wheel.items || []).find(entry => entry.id === itemId);
        wheel.items = (wheel.items || []).filter(item => item.id !== itemId);
        if (typeof markDeletedItem === 'function') {
            markDeletedItem('wheelItems', itemId, { reason: 'manual-delete', wheelId, name: item?.name || '' });
        }
        wheel.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.copyLibraryItemToWheel = function copyLibraryItemToWheel(wheelId) {
        const wheel = data.wheels.find(item => item.id === wheelId);
        const libraryId = document.getElementById('wheel-library-copy-select')?.value;
        const library = data.wheelLibraryItems.find(item => item.id === libraryId);
        if (!wheel || !library) return alert('请选择公共项');
        if (wheel.mode !== 'normal') return alert('只有普通转盘可以复制公共项');
        if (wheelLibraryCopyTagFilter && !library.tagIds?.includes(wheelLibraryCopyTagFilter)) return alert('请选择当前标签筛选下的公共项');
        if ((wheel.items || []).some(item => normalizeName(item.name) === normalizeName(library.name))) return alert('当前转盘里已经有同名选项');
        wheel.items.push({ id: id(), name: library.name, note: library.note || '', weight: library.weight || 1, enabled: true, sourceLibraryItemId: library.id, createdAt: now(), updatedAt: now() });
        wheel.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.openWheelBatchImport = function openWheelBatchImport() {
        const wheel = getCurrentWheel();
        if (!wheel || wheel.mode !== 'normal') return alert('批量导入转盘项只适用于普通转盘');
        wheelBatchTarget = 'panel';
        const title = document.getElementById('wheel-batch-modal-title');
        const textarea = document.getElementById('wheel-batch-text');
        if (title) title.textContent = '批量添加到当前转盘';
        if (textarea) textarea.value = '';
        document.getElementById('wheel-batch-modal')?.classList.add('active');
        setTimeout(() => textarea?.focus(), 0);
    };

    window.openWheelCreateBatchModal = function openWheelCreateBatchModal() {
        wheelBatchTarget = 'create';
        const title = document.getElementById('wheel-batch-modal-title');
        const textarea = document.getElementById('wheel-batch-text');
        if (title) title.textContent = '批量添加新转盘选项';
        if (textarea) textarea.value = '';
        document.getElementById('wheel-batch-modal')?.classList.add('active');
        setTimeout(() => textarea?.focus(), 0);
    };

    window.closeWheelBatchModal = function closeWheelBatchModal() {
        document.getElementById('wheel-batch-modal')?.classList.remove('active');
        const textarea = document.getElementById('wheel-batch-text');
        if (textarea) textarea.value = '';
        wheelBatchTarget = 'panel';
    };

    window.applyWheelBatchText = function applyWheelBatchText() {
        const textarea = document.getElementById('wheel-batch-text');
        const items = parseWeightedLines(textarea?.value || '');
        if (!items.length) return alert('请先输入至少一个选项');
        if (wheelBatchTarget === 'create') {
            const seen = new Set(wheelCreateItemsDraft.map(item => normalizeName(item.name)).filter(Boolean));
            const skipped = [];
            items.forEach(item => {
                const key = normalizeName(item.name);
                if (seen.has(key)) {
                    skipped.push(item.name);
                    return;
                }
                seen.add(key);
                wheelCreateItemsDraft.push({ name: item.name, weight: item.weight });
            });
            closeWheelBatchModal();
            renderWheelCreateItemsEditor();
            if (skipped.length) alert(`已添加，跳过重复：${skipped.join('、')}`);
            return;
        }

        const wheel = getCurrentWheel();
        if (!wheel || wheel.mode !== 'normal') return alert('批量导入转盘项只适用于普通转盘');
        const seen = new Set((wheel.items || []).map(item => normalizeName(item.name)));
        const skipped = [];
        let added = 0;
        const stamp = now();
        items.forEach(item => {
            const key = normalizeName(item.name);
            if (seen.has(key)) {
                skipped.push(item.name);
                return;
            }
            seen.add(key);
            wheel.items.push({ id: id(), name: item.name, note: '', weight: item.weight, enabled: true, createdAt: stamp, updatedAt: stamp });
            added++;
        });
        wheel.updatedAt = now();
        persist();
        closeWheelBatchModal();
        renderWheelPage();
        alert(`已导入 ${added} 项${skipped.length ? `，跳过重复：${skipped.join('、')}` : ''}`);
    };

    function ensureTagsByText(tagText) {
        const seen = new Set();
        const names = String(tagText || '').split(/[,，、;；/]/)
            .map(item => item.trim())
            .filter(Boolean)
            .filter(name => {
                const key = normalizeName(name);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        return names.map(name => {
            let tag = data.wheelTags.find(item => normalizeName(item.name) === normalizeName(name));
            if (!tag) {
                tag = { id: id(), name, color: palette[data.wheelTags.length % palette.length], weight: 1, enabled: true, createdAt: now(), updatedAt: now() };
                data.wheelTags.push(tag);
            }
            return tag.id;
        });
    }

    window.addWheelLibraryItem = function addWheelLibraryItem() {
        const name = document.getElementById('wheel-library-name')?.value.trim();
        const weight = Math.max(1, Number(document.getElementById('wheel-library-weight')?.value) || 1);
        if (!name) return alert('请输入公共项名称');
        if (data.wheelLibraryItems.some(item => normalizeName(item.name) === normalizeName(name))) return alert('公共项里已经有同名内容');
        const tagIds = getWheelLibraryBatchSelectedTagIds();
        if (!tagIds.length) return alert('请先在下方勾选至少一个标签（可先 AI 推荐再改）');
        data.wheelLibraryItems.push({ id: id(), name, note: '', weight, enabled: true, tagIds, createdAt: now(), updatedAt: now() });
        const nameInput = document.getElementById('wheel-library-name');
        if (nameInput) nameInput.value = '';
        wheelLibraryAiSuggestions = [];
        wheelLibraryAiStatus = '';
        persist();
        renderWheelPage();
    };

    function getWheelLibraryBatchSelectedTagIds() {
        const fromDom = Array.from(document.querySelectorAll('.wheel-library-batch-tag input:checked')).map(input => input.value);
        if (fromDom.length) {
            wheelLibraryQuickTagIds.clear();
            fromDom.forEach(tagId => wheelLibraryQuickTagIds.add(tagId));
        }
        return uniqueTagIds(Array.from(wheelLibraryQuickTagIds));
    }

    function captureWheelLibraryFormDraft() {
        return {
            name: document.getElementById('wheel-library-name')?.value || '',
            weight: document.getElementById('wheel-library-weight')?.value || '1',
            batchText: document.getElementById('wheel-library-batch-text')?.value || ''
        };
    }

    function restoreWheelLibraryFormDraft(draft = {}) {
        const nameInput = document.getElementById('wheel-library-name');
        const weightInput = document.getElementById('wheel-library-weight');
        const batchInput = document.getElementById('wheel-library-batch-text');
        if (nameInput) nameInput.value = draft.name || '';
        if (weightInput) weightInput.value = draft.weight || '1';
        if (batchInput) batchInput.value = draft.batchText || '';
    }

    function refreshWheelLibraryPanelPreservingDraft() {
        const draft = captureWheelLibraryFormDraft();
        renderWheelPage();
        restoreWheelLibraryFormDraft(draft);
    }

    function applyWheelLibraryAiSuggestionsToQuickTags() {
        const selected = wheelLibraryAiSuggestions.filter(item => item.selected).map(item => item.tagId);
        if (!selected.length) return;
        selected.forEach(tagId => wheelLibraryQuickTagIds.add(tagId));
    }

    function mapAiTagsToExistingSuggestions(aiResult = {}) {
        const byName = new Map(data.wheelTags.map(tag => [normalizeName(tag.name), tag]));
        const seen = new Set();
        const tags = Array.isArray(aiResult.tags) ? aiResult.tags : [];
        return tags
            .map(tag => {
                const name = String(tag?.name || tag || '').trim();
                const existing = byName.get(normalizeName(name));
                if (!existing || seen.has(existing.id)) return null;
                seen.add(existing.id);
                return {
                    tagId: existing.id,
                    name: existing.name,
                    reason: String(tag?.reason || '').trim(),
                    selected: true
                };
            })
            .filter(Boolean)
            .slice(0, 5);
    }

    function buildWheelLibraryAiPayload(itemText = '') {
        return {
            mode: 'wheelTagSuggest',
            title: '公共项标签推荐',
            today: today(),
            userInput: itemText,
            context: {
                itemText,
                existingTags: data.wheelTags.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    enabled: tag.enabled !== false
                })),
                sampleLibraryItems: data.wheelLibraryItems.slice(0, 20).map(item => ({
                    name: item.name,
                    tags: tagNames(item.tagIds || [])
                }))
            },
            instruction: [
                '根据 itemText / userInput 从 existingTags 里推荐 1-5 个标签。',
                '只能使用 existingTags 里已有的 name，禁止新建标签名。',
                '返回 tags 数组，每项 {name, reason}；items 可为空数组。',
                'reason 用很短的中文说明为什么相关。'
            ].join('\n')
        };
    }

    window.toggleWheelLibraryAiSuggestion = function toggleWheelLibraryAiSuggestion(index, checked) {
        const item = wheelLibraryAiSuggestions[index];
        if (!item) return;
        item.selected = !!checked;
        if (item.selected) wheelLibraryQuickTagIds.add(item.tagId);
        else wheelLibraryQuickTagIds.delete(item.tagId);
        // Keep quick-tag checkboxes in sync without wiping the form draft.
        document.querySelectorAll('.wheel-library-batch-tag input').forEach(input => {
            input.checked = wheelLibraryQuickTagIds.has(input.value);
        });
        const labels = document.querySelectorAll('.wheel-library-ai-tag');
        const label = labels[index];
        if (label) label.classList.toggle('selected', item.selected);
    };

    window.suggestWheelLibraryTagsByAi = async function suggestWheelLibraryTagsByAi() {
        if (wheelLibraryAiRunning) return;
        const itemText = document.getElementById('wheel-library-name')?.value.trim() || '';
        if (!itemText) return alert('请先输入公共项名称');
        if (!data.wheelTags.length) return alert('还没有标签，请先在标签管理里新增');
        const bridge = window.LifePlanAiBridge;
        if (!bridge) return alert('AI 服务未就绪，请刷新页面后再试');

        wheelLibraryAiRunning = true;
        wheelLibraryAiStatus = '正在根据现有标签推荐…';
        refreshWheelLibraryPanelPreservingDraft();
        try {
            const payload = buildWheelLibraryAiPayload(itemText);
            const useRemote = typeof bridge.isRemoteReady === 'function' && bridge.isRemoteReady();
            let result;
            try {
                result = useRemote
                    ? await bridge.requestRemote(payload)
                    : bridge.generateLocal(payload);
            } catch (err) {
                result = bridge.generateLocal(payload);
                wheelLibraryAiStatus = `远程 AI 失败，已用本地规则：${err.message || '请求失败'}`;
            }
            const suggestions = mapAiTagsToExistingSuggestions(result || {});
            wheelLibraryAiSuggestions = suggestions;
            if (!wheelLibraryAiStatus.startsWith('远程 AI 失败')) {
                wheelLibraryAiStatus = useRemote
                    ? (result?.summary || `远程 AI 推荐了 ${suggestions.length} 个标签，可修改后添加`)
                    : (result?.summary || `本地规则推荐了 ${suggestions.length} 个标签，可修改后添加`);
            }
            if (!suggestions.length) {
                wheelLibraryAiStatus = '没有匹配到现有标签，请手动勾选下方标签';
            } else {
                applyWheelLibraryAiSuggestionsToQuickTags();
            }
        } catch (err) {
            wheelLibraryAiSuggestions = [];
            wheelLibraryAiStatus = err.message || 'AI 推荐失败';
        } finally {
            wheelLibraryAiRunning = false;
            refreshWheelLibraryPanelPreservingDraft();
        }
    };

    window.toggleWheelLibraryQuickTag = function toggleWheelLibraryQuickTag(tagId = '', checked = false) {
        if (!tagId) return;
        if (checked) wheelLibraryQuickTagIds.add(tagId);
        else wheelLibraryQuickTagIds.delete(tagId);
        // Keep AI suggestion chips aligned with manual quick-tag edits.
        wheelLibraryAiSuggestions.forEach(item => {
            if (item.tagId === tagId) item.selected = !!checked;
        });
        document.querySelectorAll('.wheel-library-ai-tag').forEach((label, index) => {
            const item = wheelLibraryAiSuggestions[index];
            if (!item) return;
            label.classList.toggle('selected', item.selected);
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = item.selected;
        });
    };

    function importWheelLibraryItemsFromText(text, extraTagIds = []) {
        const seen = new Set(data.wheelLibraryItems.map(item => normalizeName(item.name)));
        const tagIds = uniqueTagIds(extraTagIds);
        let added = 0;
        const skipped = [];
        if (!tagIds.length) {
            return { added: 0, skipped: ['请先勾选至少一个标签'] };
        }
        parseWeightedLines(text).forEach(item => {
            const key = normalizeName(item.name);
            if (seen.has(key)) {
                skipped.push(item.name);
                return;
            }
            seen.add(key);
            data.wheelLibraryItems.push({ id: id(), name: item.name, note: '', weight: item.weight, enabled: true, tagIds: [...tagIds], createdAt: now(), updatedAt: now() });
            added++;
        });
        return { added, skipped };
    }

    window.focusWheelLibraryBatchImport = function focusWheelLibraryBatchImport() {
        const textarea = document.getElementById('wheel-library-batch-text');
        textarea?.focus();
    };

    window.openWheelLibraryBatchImport = function openWheelLibraryBatchImport() {
        window.focusWheelLibraryBatchImport();
    };

    window.importWheelLibraryBatchFromTextarea = function importWheelLibraryBatchFromTextarea() {
        const textarea = document.getElementById('wheel-library-batch-text');
        const text = textarea?.value.trim() || '';
        if (!text) return alert('请先在多行文本框里输入公共项');
        const selectedTagIds = getWheelLibraryBatchSelectedTagIds();
        if (!selectedTagIds.length) return alert('请先在下方勾选至少一个标签');
        const { added, skipped } = importWheelLibraryItemsFromText(text, selectedTagIds);
        if (!added && skipped.length === 1 && skipped[0] === '请先勾选至少一个标签') {
            return alert(skipped[0]);
        }
        persist();
        if (textarea) textarea.value = '';
        renderWheelPage();
        if (!added) {
            alert(skipped.length ? `没有导入成功：${skipped.join('、')}` : '没有导入成功');
            return;
        }
        alert(`已导入公共项 ${added} 项${skipped.length ? `，跳过：${skipped.join('、')}` : ''}`);
    };

    function updateWheelLibrarySelectionUi() {
        const filteredItems = getFilteredLibraryItemsForManage();
        const selectedIds = new Set(getSelectedLibraryItemIds());
        const selectedVisibleCount = filteredItems.filter(item => selectedIds.has(item.id)).length;
        const selectedTotalCount = selectedIds.size;
        const allVisibleSelected = Boolean(filteredItems.length && selectedVisibleCount === filteredItems.length);
        const countEl = document.getElementById('wheel-library-selected-count');
        if (countEl) countEl.textContent = formatLibrarySelectionCount(selectedTotalCount, selectedVisibleCount, filteredItems.length);
        const selectAll = document.getElementById('wheel-library-select-all');
        if (selectAll) {
            selectAll.disabled = !filteredItems.length;
            selectAll.checked = allVisibleSelected;
            selectAll.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
        }
        document.querySelectorAll('#wheel-library-list .wheel-row.library').forEach(row => {
            const itemId = row.getAttribute('data-library-item-id');
            const checked = selectedIds.has(itemId);
            row.classList.toggle('selected', checked);
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = checked;
        });
        const hasTags = data.wheelTags.length > 0;
        document.querySelectorAll('[data-library-bulk]').forEach(btn => {
            const action = btn.getAttribute('data-library-bulk');
            const needsTags = action === 'tag-add' || action === 'tag-remove';
            btn.disabled = !selectedTotalCount || (needsTags && !hasTags);
        });
    }

    window.toggleWheelLibrarySelection = function toggleWheelLibrarySelection(itemId, checked) {
        if (checked) wheelSelectedLibraryItemIds.add(itemId);
        else wheelSelectedLibraryItemIds.delete(itemId);
        updateWheelLibrarySelectionUi();
    };

    window.toggleAllWheelLibrarySelection = function toggleAllWheelLibrarySelection(checked) {
        getFilteredLibraryItemsForManage().forEach(item => {
            if (checked) wheelSelectedLibraryItemIds.add(item.id);
            else wheelSelectedLibraryItemIds.delete(item.id);
        });
        updateWheelLibrarySelectionUi();
    };

    window.clearWheelLibrarySelection = function clearWheelLibrarySelection() {
        wheelSelectedLibraryItemIds.clear();
        updateWheelLibrarySelectionUi();
    };

    window.applyWheelLibraryBatchTag = function applyWheelLibraryBatchTag(action = 'add') {
        const tagIds = getWheelLibraryBatchSelectedTagIds();
        const selectedIds = getSelectedLibraryItemIds();
        if (!selectedIds.length) return alert('请先勾选公共项');
        if (!tagIds.length) return alert('请先在上方“快速选择标签”里勾选至少一个标签');
        let changed = 0;
        let blockedOnlyTag = 0;
        selectedIds.forEach(itemId => {
            const item = data.wheelLibraryItems.find(entry => entry.id === itemId);
            if (!item) return;
            const set = new Set(item.tagIds || []);
            let itemChanged = false;
            tagIds.forEach(tagId => {
                if (action === 'remove') {
                    if (!set.has(tagId)) return;
                    if (set.size <= 1) {
                        blockedOnlyTag += 1;
                        return;
                    }
                    set.delete(tagId);
                    itemChanged = true;
                    return;
                }
                if (set.has(tagId)) return;
                set.add(tagId);
                itemChanged = true;
            });
            if (!itemChanged) return;
            item.tagIds = uniqueTagIds(Array.from(set));
            item.updatedAt = now();
            changed += 1;
        });
        if (!changed && action === 'remove') {
            return alert(blockedOnlyTag
                ? '没有可移除的标签；公共项至少要保留一个标签'
                : '选中的公共项都不包含这些标签');
        }
        if (!changed) return alert('选中的公共项已经包含这些标签');
        persist();
        renderWheelPage();
    };

    window.batchToggleWheelLibraryItems = function batchToggleWheelLibraryItems(enabled = true) {
        const selectedIds = getSelectedLibraryItemIds();
        if (!selectedIds.length) return alert('请先勾选公共项');
        let changed = 0;
        selectedIds.forEach(itemId => {
            const item = data.wheelLibraryItems.find(entry => entry.id === itemId);
            if (!item) return;
            const nextEnabled = enabled !== false;
            if ((item.enabled !== false) === nextEnabled) return;
            item.enabled = nextEnabled;
            item.updatedAt = now();
            changed++;
        });
        if (!changed) return alert(enabled ? '选中的公共项已经是启用状态' : '选中的公共项已经是停用状态');
        persist();
        renderWheelPage();
    };

    window.batchDeleteWheelLibraryItems = function batchDeleteWheelLibraryItems() {
        const selectedIds = getSelectedLibraryItemIds();
        if (!selectedIds.length) return alert('请先勾选公共项');
        const removeSet = new Set(selectedIds);
        const removed = data.wheelLibraryItems.filter(item => removeSet.has(item.id));
        if (!removed.length) {
            selectedIds.forEach(itemId => wheelSelectedLibraryItemIds.delete(itemId));
            updateWheelLibrarySelectionUi();
            return alert('勾选的公共项已不存在，已清空无效勾选');
        }
        if (!confirm(`确定删除选中的 ${removed.length} 个公共项吗？普通转盘里已复制的私有项不会受影响。`)) return;
        data.wheelLibraryItems = data.wheelLibraryItems.filter(item => !removeSet.has(item.id));
        selectedIds.forEach(itemId => wheelSelectedLibraryItemIds.delete(itemId));
        if (typeof markDeletedItem === 'function') {
            removed.forEach(item => markDeletedItem('wheelLibraryItems', item.id, { name: item?.name || '' }));
        }
        persist();
        renderWheelPage();
    };

    window.editWheelLibraryItem = function editWheelLibraryItem(itemId) {
        const item = data.wheelLibraryItems.find(entry => entry.id === itemId);
        if (!item) return;
        const name = prompt('公共项名称', item.name);
        if (name === null) return;
        const trimmed = name.trim();
        if (!trimmed) return alert('名称不能为空');
        if (data.wheelLibraryItems.some(entry => entry.id !== item.id && normalizeName(entry.name) === normalizeName(trimmed))) return alert('公共项里已经有同名内容');
        const tagText = prompt('标签，用逗号分隔', tagNames(item.tagIds).join(','));
        if (tagText === null) return;
        const weight = prompt('权重', item.weight);
        if (weight === null) return;
        const tagIds = uniqueTagIds(ensureTagsByText(tagText));
        if (!tagIds.length) return alert('公共项至少需要绑定一个标签');
        item.name = trimmed;
        item.tagIds = tagIds;
        item.weight = Math.max(1, Number(weight) || 1);
        item.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.toggleWheelLibraryItem = function toggleWheelLibraryItem(itemId) {
        const item = data.wheelLibraryItems.find(entry => entry.id === itemId);
        if (!item) return;
        item.enabled = item.enabled === false;
        item.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.deleteWheelLibraryItem = function deleteWheelLibraryItem(itemId) {
        const item = data.wheelLibraryItems.find(entry => entry.id === itemId);
        if (!confirm('删除这个公共项吗？普通转盘里已复制的私有项不会受影响。')) return;
        data.wheelLibraryItems = data.wheelLibraryItems.filter(item => item.id !== itemId);
        wheelSelectedLibraryItemIds.delete(itemId);
        if (typeof markDeletedItem === 'function') markDeletedItem('wheelLibraryItems', itemId, { name: item?.name || '' });
        persist();
        renderWheelPage();
    };

    window.saveWheelTagForm = function saveWheelTagForm() {
        const name = document.getElementById('wheel-tag-name')?.value.trim();
        const weight = Math.max(1, Number(document.getElementById('wheel-tag-weight')?.value) || 1);
        const randomColor = pickRandomTagColor(data.wheelTags.map(tag => tag.color));
        const color = document.getElementById('wheel-tag-color')?.value || randomColor;
        if (!name) return alert('请输入标签名称');
        if (editingWheelTagId) {
            const tag = data.wheelTags.find(item => item.id === editingWheelTagId);
            if (!tag) {
                editingWheelTagId = null;
                return alert('找不到要修改的标签');
            }
            if (data.wheelTags.some(item => item.id !== tag.id && normalizeName(item.name) === normalizeName(name))) {
                return alert('已经有同名标签');
            }
            tag.name = name;
            tag.weight = weight;
            tag.color = safeColor(color, tag.color || randomColor);
            tag.updatedAt = now();
            editingWheelTagId = null;
            persist();
            renderWheelPage();
            document.getElementById('wheel-tags-modal')?.classList.add('active');
            return;
        }
        if (data.wheelTags.some(tag => normalizeName(tag.name) === normalizeName(name))) return alert('已经有同名标签');
        data.wheelTags.push({
            id: id(),
            name,
            color: safeColor(color, randomColor),
            weight,
            enabled: true,
            createdAt: now(),
            updatedAt: now()
        });
        persist();
        renderWheelPage();
        document.getElementById('wheel-tags-modal')?.classList.add('active');
    };

    window.addWheelTag = function addWheelTag() {
        window.saveWheelTagForm();
    };

    window.editWheelTag = function editWheelTag(tagId) {
        const tag = data.wheelTags.find(item => item.id === tagId);
        if (!tag) return;
        editingWheelTagId = tag.id;
        renderWheelPage();
        document.getElementById('wheel-tags-modal')?.classList.add('active');
        document.getElementById('wheel-tag-name')?.focus();
    };

    window.cancelEditWheelTag = function cancelEditWheelTag() {
        editingWheelTagId = null;
        renderWheelPage();
        document.getElementById('wheel-tags-modal')?.classList.add('active');
    };

    window.toggleWheelTagEnabled = function toggleWheelTagEnabled(tagId) {
        const tag = data.wheelTags.find(item => item.id === tagId);
        if (!tag) return;
        tag.enabled = tag.enabled === false;
        tag.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.deleteWheelTag = function deleteWheelTag(tagId) {
        const tag = data.wheelTags.find(item => item.id === tagId);
        if (!tag || !confirm(`删除标签“${tag.name}”吗？会从公共项和标签转盘配置里移除。`)) return;
        const orphanedItems = data.wheelLibraryItems.filter(item => item.tagIds?.includes(tagId) && (item.tagIds || []).length === 1);
        if (orphanedItems.length) return alert(`不能删除：${orphanedItems.length} 个公共项只绑定了这个标签，请先给它们添加其他标签或删除公共项。`);
        data.wheelTags = data.wheelTags.filter(item => item.id !== tagId);
        data.wheelLibraryItems.forEach(item => item.tagIds = (item.tagIds || []).filter(id => id !== tagId));
        data.wheels.forEach(wheel => {
            if (wheel.mode === 'tag') {
                wheel.tagIds = (wheel.tagIds || []).filter(id => id !== tagId);
            } else delete wheel.tagIds;
        });
        if (editingWheelTagId === tagId) editingWheelTagId = null;
        if (typeof markDeletedItem === 'function') markDeletedItem('wheelTags', tagId, { name: tag.name });
        persist();
        renderWheelPage();
    };

    window.toggleWheelTag = function toggleWheelTag(wheelId, tagId, checked) {
        const wheel = data.wheels.find(item => item.id === wheelId);
        if (!wheel) return;
        const set = new Set(wheel.tagIds || []);
        if (checked) set.add(tagId);
        else set.delete(tagId);
        if (!set.size) {
            alert('标签转盘至少需要选择一个标签');
            renderWheelPage();
            return;
        }
        wheel.tagIds = uniqueTagIds(Array.from(set));
        wheel.updatedAt = now();
        currentWheelResultId = null;
        resetWheelStageState();
        persist();
        renderWheelPage();
    };

    function saveHistory(payload) {
        const stamp = now();
        const history = { id: id(), createdAt: stamp, updatedAt: stamp, convertedTodoId: '', ...payload };
        data.wheelHistory.unshift(history);
        currentWheelResultId = history.id;
        persist();
        return history;
    }

    window.exportWheelBackupJson = function exportWheelBackupJson() {
        downloadTextFile(`大转盘完整备份_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(getWheelBackupSnapshot(), null, 2));
    };

    window.importWheelBackupJson = function importWheelBackupJson() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const imported = JSON.parse(String(reader.result || '{}'));
                    if (!imported || typeof imported !== 'object') throw new Error('invalid');
                    const summary = [
                        `转盘 ${Array.isArray(imported.wheels) ? imported.wheels.length : 0} 个`,
                        `标签 ${Array.isArray(imported.wheelTags) ? imported.wheelTags.length : 0} 个`,
                        `公共项 ${Array.isArray(imported.wheelLibraryItems) ? imported.wheelLibraryItems.length : 0} 个`,
                        `历史 ${Array.isArray(imported.wheelHistory) ? imported.wheelHistory.length : 0} 条`
                    ].join('，');
                    if (!confirm(`恢复大转盘 JSON 会覆盖当前转盘、标签、公共项和抽取记录。\n\n备份内容：${summary}\n\n继续恢复吗？`)) return;
                    const beforeSnapshot = typeof createLocalSnapshot === 'function'
                        ? createLocalSnapshot('大转盘恢复前自动快照', data, {
                            source: 'wheel-backup-import',
                            action: 'before-restore',
                            mergedWith: { label: file?.name || '大转盘备份' }
                        })
                        : null;
                    if (!beforeSnapshot && !confirm('恢复前快照创建失败。继续恢复会缺少回滚点，确定继续吗？')) return;
                    const previousWheelData = {
                        wheels: data.wheels,
                        wheelTags: data.wheelTags,
                        wheelLibraryItems: data.wheelLibraryItems,
                        wheelHistory: data.wheelHistory
                    };
                    const previousState = { currentWheelId, currentWheelMode, currentWheelResultId };
                    data.wheels = Array.isArray(imported.wheels) ? imported.wheels : [];
                    data.wheelTags = Array.isArray(imported.wheelTags) ? imported.wheelTags : [];
                    data.wheelLibraryItems = Array.isArray(imported.wheelLibraryItems) ? imported.wheelLibraryItems : [];
                    data.wheelHistory = Array.isArray(imported.wheelHistory) ? imported.wheelHistory : [];
                    normalizeWheelDataShape();
                    currentWheelId = data.wheels[0]?.id || null;
                    currentWheelMode = data.wheels[0]?.mode || 'normal';
                    currentWheelResultId = null;
                    resetWheelStageState();
                    if (typeof saveData === 'function' && !saveData()) {
                        Object.assign(data, previousWheelData);
                        currentWheelId = previousState.currentWheelId;
                        currentWheelMode = previousState.currentWheelMode;
                        currentWheelResultId = previousState.currentWheelResultId;
                        if (typeof recordCriticalFailure === 'function') {
                            recordCriticalFailure('大转盘恢复失败', null, { action: 'wheel-backup-import', message: '恢复后的数据未能写入本地存储' });
                        }
                        renderWheelPage();
                        alert('恢复失败：本地存储写入失败，当前转盘数据已保持不变。请先导出备份或清理存储空间。');
                        return;
                    }
                    renderWheelPage();
                    alert('已恢复大转盘完整 JSON 备份');
                } catch (err) {
                    alert('备份文件不是有效的大转盘 JSON');
                }
            };
            reader.readAsText(file, 'utf-8');
        };
        input.click();
    };

    window.exportWheelHistoryCsv = function exportWheelHistoryCsv() {
        const header = ['时间', '转盘', '模式', '标签', '结果', '备注', '是否已转待办'];
        const rows = data.wheelHistory.map(item => [
            item.createdAt || '',
            item.wheelName || '',
            item.mode === 'tag' ? '标签转盘' : '普通转盘',
            item.tagName || '',
            item.resultName || '',
            item.note || '',
            item.convertedTodoId ? '是' : '否'
        ]);
        const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
        downloadTextFile(`大转盘抽取记录_${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
    };

    function animateSpin(entries, selectedIndex, done) {
        if (wheelSpinning) return;
        wheelSpinning = true;
        // Warm cache once before the animation loop.
        buildWheelRenderCache(entries);
        const start = wheelRotation;
        const slice = 360 / Math.max(1, entries.length);
        const desired = 270 - (selectedIndex * slice + slice / 2);
        const normalizedStart = ((start % 360) + 360) % 360;
        const delta = ((desired - normalizedStart) + 360) % 360;
        // Dense wheels still look lively with fewer full turns and slightly shorter spin.
        const extraTurns = entries.length >= 80 ? 1080 : entries.length >= 36 ? 1440 : 1800;
        const target = start + extraTurns + delta;
        const startTime = performance.now();
        const baseDuration = Number(window.__wheelSpinDurationMs) || 3600;
        const duration = Number(window.__wheelSpinDurationMs)
            ? baseDuration
            : (entries.length >= 80 ? 2600 : entries.length >= 36 ? 3000 : baseDuration);
        function tick(time) {
            const progress = Math.min(1, (time - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 2.4);
            wheelRotation = start + (target - start) * eased;
            drawWheelCanvas(entries, progress === 1 ? selectedIndex : -1);
            if (progress < 1) requestAnimationFrame(tick);
            else {
                wheelRotation = ((wheelRotation % 360) + 360) % 360;
                wheelSpinning = false;
                done();
            }
        }
        requestAnimationFrame(tick);
    }

    window.spinWheel = function spinWheel() {
        const wheel = getCurrentWheel();
        if (!wheel) return alert('请先创建转盘');
        currentWheelResultId = null;
        if (isTagItemsStage(wheel)) {
            const items = getStageEntries(wheel);
            if (!items.length) return alert('这个标签下没有可抽公共项');
            const result = weightedPick(items);
            const resultIndex = items.findIndex(item => item.id === result.id);
            animateSpin(items, Math.max(0, resultIndex), () => {
                saveHistory({
                    mode: 'tag',
                    wheelId: wheel.id,
                    wheelName: wheel.name,
                    tagId: wheelStageState.tagId,
                    tagName: wheelStageState.tagName,
                    resultId: result.id,
                    resultName: result.name,
                    note: result.note || ''
                });
                renderWheelPage();
            });
            return;
        }
        if (wheel.mode === 'tag') {
            const tags = getEnabledEntries(wheel);
            if (!tags.length) return alert('这个标签转盘没有可抽标签，或标签下没有启用的公共项');
            const tag = weightedPick(tags);
            const items = getTagItemPool(tag.id);
            if (!items.length) return alert('这个标签下没有可抽公共项');
            const tagIndex = tags.findIndex(item => item.id === tag.id);
            const entries = tags.map((item, index) => ({ ...item, color: item.color || palette[index % palette.length] }));
            animateSpin(entries, Math.max(0, tagIndex), () => {
                wheelStageState = {
                    type: 'tag-items',
                    tagWheelId: wheel.id,
                    tagId: tag.id,
                    tagName: tag.name,
                    tagColor: tag.color || palette[tagIndex % palette.length],
                    itemCount: items.length
                };
                renderWheelPage();
            });
            return;
        }
        const entries = getEnabledEntries(wheel);
        if (!entries.length) return alert('这个普通转盘还没有可抽选项');
        const result = weightedPick(entries);
        const resultIndex = entries.findIndex(item => item.id === result.id);
        animateSpin(entries.map((item, index) => ({ ...item, color: palette[index % palette.length] })), Math.max(0, resultIndex), () => {
            saveHistory({ mode: 'normal', wheelId: wheel.id, wheelName: wheel.name, resultId: result.id, resultName: result.name, note: result.note || '' });
            renderWheelPage();
        });
    };

    function ensureTagWheelContext() {
        if (currentWheelMode !== 'tag') {
            currentWheelMode = 'tag';
            const tagWheel = data.wheels.find(item => item.mode === 'tag');
            if (tagWheel) currentWheelId = tagWheel.id;
        }
        const wheel = getCurrentWheel();
        if (!wheel || wheel.mode !== 'tag') {
            alert('请先创建一个标签转盘');
            return null;
        }
        return wheel;
    }

    window.spinDirectTag = function spinDirectTag(tagId) {
        const wheel = ensureTagWheelContext();
        if (!wheel) return;
        const tag = data.wheelTags.find(item => item.id === tagId);
        const items = setTagItemsStage(tag, wheel.id);
        if (!tag || !items?.length) return alert('这个标签下没有可抽公共项');
        currentWheelResultId = null;
        closeWheelPanelModal('tags');
        closeWheelPanelModal('items');
        renderWheelPage();
        const stageItems = getStageEntries(wheel);
        const result = weightedPick(stageItems);
        const resultIndex = stageItems.findIndex(item => item.id === result.id);
        requestAnimationFrame(() => {
            animateSpin(stageItems, Math.max(0, resultIndex), () => {
                saveHistory({
                    mode: 'tag',
                    wheelId: wheel.id,
                    wheelName: wheel.name || '标签转盘',
                    tagId: tag.id,
                    tagName: tag.name,
                    resultId: result.id,
                    resultName: result.name,
                    note: result.note || ''
                });
                renderWheelPage();
            });
        });
    };

    window.previewTagStage = function previewTagStage(tagId) {
        const wheel = ensureTagWheelContext();
        if (!wheel) return;
        const tag = data.wheelTags.find(item => item.id === tagId);
        const items = setTagItemsStage(tag, wheel.id);
        if (!tag || !items?.length) return alert('这个标签下没有可抽公共项');
        currentWheelResultId = null;
        closeWheelPanelModal('tags');
        closeWheelPanelModal('items');
        renderWheelPage();
    };

    window.returnToTagWheel = function returnToTagWheel() {
        resetWheelStageState();
        currentWheelResultId = null;
        renderWheelPage();
    };

    window.convertWheelResultToTodo = function convertWheelResultToTodo(historyId) {
        const history = data.wheelHistory.find(item => item.id === historyId);
        if (!history) return;
        if (history.convertedTodoId && data.todos.some(todo => todo.id === history.convertedTodoId)) return alert('这个结果已经转入待办了');
        const stamp = now();
        const todo = {
            id: id(),
            text: history.resultName,
            done: false,
            group: '其他',
            dueDate: '',
            planStartDate: today(),
            planEndDate: today(),
            urgency: 'medium',
            isExclusive: false,
            subTodos: [],
            sessions: [],
            sourceType: 'wheel',
            sourceId: history.id,
            sourceMeta: history.tagName ? `大转盘：${history.tagName}` : '大转盘',
            createdAt: stamp,
            updatedAt: stamp,
            completedAt: ''
        };
        data.todos.push(todo);
        history.convertedTodoId = todo.id;
        history.updatedAt = stamp;
        persist();
        refreshApp();
        alert('已转入今日待办，你可以在待办详情里继续改时间和紧急程度。');
    };

    window.clearWheelHistory = function clearWheelHistory() {
        if (!confirm('清空全部转盘抽取记录吗？')) return;
        if (typeof markDeletedItem === 'function') {
            data.wheelHistory.forEach(item => markDeletedItem('wheelHistory', item.id));
        }
        data.wheelHistory = [];
        currentWheelResultId = null;
        persist();
        renderWheelPage();
    };

    window.deleteWheelHistory = function deleteWheelHistory(historyId) {
        data.wheelHistory = data.wheelHistory.filter(item => item.id !== historyId);
        if (typeof markDeletedItem === 'function') markDeletedItem('wheelHistory', historyId);
        if (currentWheelResultId === historyId) currentWheelResultId = null;
        persist();
        renderWheelPage();
    };

    document.addEventListener('click', event => {
        if (!wheelActionMenuOpen) return;
        if (event.target.closest?.('.wheel-action-menu-wrap')) return;
        window.closeWheelActionMenu();
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && wheelActionMenuOpen) window.closeWheelActionMenu();
    });

    if (location.hash === '#wheel' && typeof switchPage === 'function') {
        const nav = Array.from(document.querySelectorAll('.nav-item')).find(item => item.textContent.includes('工具转盘'));
        switchPage('wheel', nav);
    }
})();
