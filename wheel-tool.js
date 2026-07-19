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
    let wheelActionMenuOpen = false;
    const wheelSelectedLibraryItemIds = new Set();
    let wheelDragState = null;

    function createWheelStageState() {
        return {
            type: 'wheel'
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
        if (!text) return [''];
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

    function parseWeightedLines(text) {
        return String(text || '').split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const parts = line.split(/[,，\t]/);
                const name = (parts.shift() || '').trim();
                const weight = Math.max(1, Math.round(Number((parts.shift() || '').replace('%', '').trim()) || 1));
                const tagText = parts.join(',').trim();
                return { name, weight, tagText };
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
                normalized.filterMatchMode = wheel?.filterMatchMode === 'any' ? 'any' : 'all';
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

    function getWheelFilterMatchMode(wheel = {}) {
        return wheel?.filterMatchMode === 'any' ? 'any' : 'all';
    }

    function getTagCandidatesForSelection(wheel = {}) {
        const selectedTagIds = uniqueTagIds(Array.isArray(wheel.tagIds) ? wheel.tagIds : []);
        if (!selectedTagIds.length) return [];
        const matchMode = getWheelFilterMatchMode(wheel);
        return data.wheelLibraryItems.filter(item => {
            if (item.enabled === false) return false;
            const itemTags = new Set(item.tagIds || []);
            return matchMode === 'any'
                ? selectedTagIds.some(tagId => itemTags.has(tagId))
                : selectedTagIds.every(tagId => itemTags.has(tagId));
        });
    }

    function getEnabledEntries(wheel) {
        if (!wheel) return [];
        if (wheel.mode === 'tag') return getTagCandidatesForSelection(wheel);
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

    function getStageEntries(wheel) {
        if (!wheel) return [];
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
        if (wheel.name === '默认标签转盘') return '按标签抽一个';
        return wheel.name || '未命名转盘';
    }

    function getWheelPanelSummaryMarkup(wheel) {
        const activeWheelCount = getEnabledEntries(wheel).length;
        const activeLabel = wheel?.mode === 'tag' ? '候选公共项' : '当前选项';
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
        const radius = Math.min(width, height) / 2 - 20;
        const innerRadius = Math.max(52, radius * 0.28);
        ctx.clearRect(0, 0, width, height);

        if (!entries.length) {
            ctx.beginPath();
            ctx.fillStyle = '#eef2f7';
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.fillStyle = '#ffffff';
            ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#647269';
            ctx.font = '700 18px Microsoft YaHei, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('暂无可抽内容', cx, cy);
            return;
        }

        const slice = Math.PI * 2 / entries.length;
        const rotation = wheelRotation * Math.PI / 180;
        const labelRadius = innerRadius + (radius - innerRadius) * (entries.length <= 6 ? 0.5 : entries.length <= 12 ? 0.56 : 0.6);

        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = '#f7f9fc';
        ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
        ctx.fill();

        entries.forEach((entry, index) => {
            const start = rotation + index * slice;
            const end = start + slice;
            const mid = start + slice / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, start, end);
            ctx.arc(cx, cy, innerRadius, end, start, true);
            ctx.closePath();
            ctx.fillStyle = selectedIndex === index ? '#fb5d57' : (entry.color || palette[index % palette.length]);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,.92)';
            ctx.stroke();

            const lines = splitWheelLabel(entry.name, entries.length <= 4 ? 4 : entries.length <= 10 ? 5 : 6, 2);
            const labelX = cx + Math.cos(mid) * labelRadius;
            const labelY = cy + Math.sin(mid) * labelRadius;
            ctx.save();
            ctx.translate(labelX, labelY);
            let textAngle = mid;
            if (textAngle > Math.PI / 2 && textAngle < Math.PI * 1.5) textAngle += Math.PI;
            ctx.rotate(textAngle);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(16, 23, 19, .14)';
            ctx.shadowBlur = 10;
            ctx.font = entries.length <= 4 ? '800 17px Microsoft YaHei, sans-serif' : entries.length <= 10 ? '800 14px Microsoft YaHei, sans-serif' : '800 12px Microsoft YaHei, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lineHeight = entries.length <= 10 ? 18 : 16;
            const lineOffset = lines.length > 1 ? lineHeight / 2 : 0;
            lines.forEach((line, lineIndex) => {
                ctx.fillText(line, 0, lineIndex * lineHeight - lineOffset);
            });
            ctx.restore();
        });

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
        if (wheel?.mode === 'tag') {
            const selectedTags = uniqueTagIds(wheel.tagIds || []).map(getTagById).filter(Boolean);
            const candidates = getTagCandidatesForSelection(wheel);
            const matchLabel = getWheelFilterMatchMode(wheel) === 'any' ? '任意满足' : '全部满足';
            container.innerHTML = `
                <div class="wheel-stage-card hero compact">
                    <div class="wheel-stage-card-top">
                        <span class="wheel-stage-badge">标签转盘</span>
                        <span class="wheel-stage-badge muted">${safeHtml(matchLabel)}</span>
                    </div>
                    <div class="wheel-stage-title">${headline}</div>
                    <div class="wheel-stage-copy">选几个标签，直接从符合条件的公共项里抽一个。</div>
                    <div class="wheel-stage-quick-tags">
                        ${selectedTags.map(tag => `<span class="wheel-stage-quick-tag static">${getTagChipMarkup(tag.name, tag.color)}</span>`).join('') || '<span class="wheel-stage-quick-tag static"><span>还没选择标签</span></span>'}
                    </div>
                    <div class="wheel-stage-copy">当前候选 ${candidates.length} 项${candidates.length ? `：${safeHtml(candidates.slice(0, 5).map(item => item.name).join('、'))}${candidates.length > 5 ? '…' : ''}` : ''}</div>
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
            const itemCount = getStageEntries(wheel).length;
            container.innerHTML = `
                <div class="wheel-result-card pending compact">
                    <span class="wheel-result-kicker">准备开始</span>
                    <strong class="wheel-result-title">转一转</strong>
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
        renderSelector();
        document.querySelectorAll('#wheel-mode-tabs button').forEach(btn => btn.classList.toggle('active', btn.textContent.includes(wheel?.mode === 'tag' ? '标签' : '普通')));
        renderStageSummary(wheel);
        const entries = getStageEntries(wheel);
        drawWheelCanvas(entries);
        const actionWrap = document.querySelector('.wheel-actions');
        if (actionWrap) {
            actionWrap.innerHTML = `
                <button class="btn btn-primary" onclick="spinWheel()">${wheel?.mode === 'tag' ? '按标签抽一个' : '开始抽取'}</button>
                <button class="btn btn-secondary" onclick="renderWheelPage()">刷新</button>
            `;
        }
        const stageHint = document.getElementById('wheel-stage-hint');
        if (stageHint) {
            stageHint.textContent = wheel?.mode === 'tag'
                ? '选好标签后直接抽公共项，全部满足或任意满足都可以。'
                : '点击转盘或按钮都可以开始，普通转盘会直接给出最终结果。';
        }
        attachWheelPointerGestures(entries);
        renderResult();
    }

    function renderItemsPanel(wheel) {
        if (!wheel) return '<div class="empty-state">暂无转盘</div>';
        if (wheel.mode === 'tag') {
            const selected = new Set(wheel.tagIds || []);
            const matchMode = getWheelFilterMatchMode(wheel);
            const candidates = getTagCandidatesForSelection(wheel);
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
                            <span>${items.length} 项</span>
                        </div>
                    </article>
                `;
            }).join('');
            return `
                <div class="wheel-panel-head">
                    <div>
                        <div class="card-title">标签转盘配置</div>
                        <div class="wheel-hint">勾选标签后直接抽公共项。全部满足更精准，任意满足更宽。</div>
                    </div>
                    <div class="wheel-head-actions">
                        <button class="btn btn-secondary" onclick="renameWheel(${safeJsArg(wheel.id)})">改名</button>
                        <button class="btn btn-danger" onclick="deleteWheel(${safeJsArg(wheel.id)})">删除转盘</button>
                    </div>
                </div>
                <div class="wheel-filter-panel">
                    <div class="wheel-filter-toolbar">
                        <span>匹配方式</span>
                        <button type="button" class="wheel-mini-btn ${matchMode === 'all' ? 'primary' : ''}" onclick="setWheelFilterMatchMode(${safeJsArg(wheel.id)}, 'all')">全部满足</button>
                        <button type="button" class="wheel-mini-btn ${matchMode === 'any' ? 'primary' : ''}" onclick="setWheelFilterMatchMode(${safeJsArg(wheel.id)}, 'any')">任意满足</button>
                        <strong>候选 ${candidates.length} 项</strong>
                    </div>
                    <div class="wheel-filter-preview">${candidates.length ? safeHtml(candidates.slice(0, 8).map(item => item.name).join('、')) + (candidates.length > 8 ? '…' : '') : '没有符合条件的公共项，减少标签或切到“任意满足”。'}</div>
                </div>
                <div class="wheel-tag-grid compact">
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

    function renderLibraryPanel() {
        const filteredItems = getFilteredLibraryItemsForManage();
        const selectedIds = new Set(getSelectedLibraryItemIds());
        const selectedVisibleCount = filteredItems.filter(item => selectedIds.has(item.id)).length;
        const selectedTotalCount = selectedIds.size;
        const allVisibleSelected = Boolean(filteredItems.length && selectedVisibleCount === filteredItems.length);
        const tagOptions = data.wheelTags.map(tag => `<option value="${safeHtml(tag.id)}">${safeHtml(tag.name)}</option>`).join('');
        const batchTagPicker = data.wheelTags.map(tag => `
            <label class="wheel-library-batch-tag">
                <input type="checkbox" value="${safeHtml(tag.id)}">
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
                <input id="wheel-library-tags" placeholder="标签，用逗号分隔">
                <input id="wheel-library-weight" type="number" min="1" value="1">
                <button class="btn btn-primary" onclick="addWheelLibraryItem()">添加</button>
            </div>
            <div class="wheel-library-batch-box">
                <textarea id="wheel-library-batch-text" rows="4" placeholder="每行一个公共项：名称,权重，也可继续写行内标签&#10;咖啡店学习,1&#10;周末晨跑,2,运动/户外"></textarea>
                <div class="wheel-library-batch-side">
                    <button class="btn btn-secondary" onclick="importWheelLibraryBatchFromTextarea()">导入多行公共项</button>
                    <div class="wheel-hint">下方勾选的标签会自动加到本次导入的每个公共项。</div>
                </div>
            </div>
            <div class="wheel-library-batch-tag-panel">
                <div class="wheel-library-batch-tag-head">
                    <span>本次导入标签</span>
                    <small>可多选；也可以每行继续写标签</small>
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
                        <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} ${filteredItems.length ? '' : 'disabled'} onchange="toggleAllWheelLibrarySelection(this.checked)">
                        <span>选中当前筛选 ${selectedVisibleCount}/${filteredItems.length}</span>
                    </label>
                    <select id="wheel-library-batch-tag" ${data.wheelTags.length ? '' : 'disabled'}>
                        <option value="">选择标签</option>
                        ${tagOptions}
                    </select>
                    <button class="wheel-mini-btn primary" ${selectedTotalCount && data.wheelTags.length ? '' : 'disabled'} onclick="applyWheelLibraryBatchTag('add')">添加到选中</button>
                    <button class="wheel-mini-btn danger" ${selectedTotalCount && data.wheelTags.length ? '' : 'disabled'} onclick="applyWheelLibraryBatchTag('remove')">从选中移除</button>
                </div>
            </div>
            <div class="wheel-list">
                ${filteredItems.map(item => `
                    <div class="wheel-row library ${selectedIds.has(item.id) ? 'selected' : ''}">
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
        return `
            <div class="wheel-panel-head">
                <div>
                    <div class="card-title">标签管理</div>
                    <div class="wheel-hint">标签只有名称、颜色和权重。公共项可以挂多个标签。</div>
                </div>
            </div>
            <div class="wheel-inline-form tags-form">
                <input id="wheel-tag-name" placeholder="标签名称">
                <input id="wheel-tag-weight" type="number" min="1" value="1">
                <input id="wheel-tag-color" type="color" value="#216e4e">
                <button class="btn btn-primary" onclick="addWheelTag()">添加</button>
            </div>
            <div class="wheel-list">
                ${data.wheelTags.map(tag => `
                    <div class="wheel-row" data-wheel-tag-id="${safeHtml(tag.id)}">
                        <span class="wheel-color-dot" style="background:${safeColor(tag.color)}"></span>
                        <span class="wheel-row-main"><strong>${safeHtml(tag.name)}</strong><small>权重 ${tag.weight} · ${tag.enabled === false ? '已停用' : '启用中'}</small></span>
                        <button class="wheel-mini-btn" onclick="editWheelTag(${safeJsArg(tag.id)})">修改</button>
                        <button class="wheel-mini-btn" onclick="toggleWheelTagEnabled(${safeJsArg(tag.id)})">${tag.enabled === false ? '启用' : '停用'}</button>
                        <button class="wheel-mini-btn danger" onclick="deleteWheelTag(${safeJsArg(tag.id)})">删除</button>
                    </div>
                `).join('') || '<div class="empty-state">暂无标签。</div>'}
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

    window.closeWheelPanelModal = function closeWheelPanelModal(panel) {
        document.getElementById(`wheel-${panel}-modal`)?.classList.remove('active');
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
        const tagText = document.getElementById('wheel-library-tags')?.value.trim();
        const weight = Math.max(1, Number(document.getElementById('wheel-library-weight')?.value) || 1);
        if (!name) return alert('请输入公共项名称');
        if (data.wheelLibraryItems.some(item => normalizeName(item.name) === normalizeName(name))) return alert('公共项里已经有同名内容');
        const tagIds = uniqueTagIds(ensureTagsByText(tagText));
        if (!tagIds.length) return alert('公共项至少需要绑定一个标签');
        data.wheelLibraryItems.push({ id: id(), name, note: '', weight, enabled: true, tagIds, createdAt: now(), updatedAt: now() });
        persist();
        renderWheelPage();
    };

    function getWheelLibraryBatchSelectedTagIds() {
        return uniqueTagIds(Array.from(document.querySelectorAll('.wheel-library-batch-tag input:checked')).map(input => input.value));
    }

    function importWheelLibraryItemsFromText(text, extraTagIds = []) {
        const seen = new Set(data.wheelLibraryItems.map(item => normalizeName(item.name)));
        const extra = uniqueTagIds(extraTagIds);
        let added = 0;
        const skipped = [];
        parseWeightedLines(text).forEach(item => {
            const key = normalizeName(item.name);
            if (seen.has(key)) {
                skipped.push(item.name);
                return;
            }
            const tagIds = uniqueTagIds([...extra, ...ensureTagsByText(item.tagText)]);
            if (!tagIds.length) {
                skipped.push(`${item.name}(缺少标签)`);
                return;
            }
            seen.add(key);
            data.wheelLibraryItems.push({ id: id(), name: item.name, note: '', weight: item.weight, enabled: true, tagIds, createdAt: now(), updatedAt: now() });
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
        const { added, skipped } = importWheelLibraryItemsFromText(text, getWheelLibraryBatchSelectedTagIds());
        persist();
        if (textarea) textarea.value = '';
        renderWheelPage();
        alert(`已导入公共项 ${added} 项${skipped.length ? `，跳过重复：${skipped.join('、')}` : ''}`);
    };

    window.toggleWheelLibrarySelection = function toggleWheelLibrarySelection(itemId, checked) {
        if (checked) wheelSelectedLibraryItemIds.add(itemId);
        else wheelSelectedLibraryItemIds.delete(itemId);
        renderWheelPage();
    };

    window.toggleAllWheelLibrarySelection = function toggleAllWheelLibrarySelection(checked) {
        getFilteredLibraryItemsForManage().forEach(item => {
            if (checked) wheelSelectedLibraryItemIds.add(item.id);
            else wheelSelectedLibraryItemIds.delete(item.id);
        });
        renderWheelPage();
    };

    window.applyWheelLibraryBatchTag = function applyWheelLibraryBatchTag(action = 'add') {
        const tagId = document.getElementById('wheel-library-batch-tag')?.value || '';
        const tag = data.wheelTags.find(item => item.id === tagId);
        const selectedIds = getSelectedLibraryItemIds();
        if (!tag) return alert('请选择要批量处理的标签');
        if (!selectedIds.length) return alert('请先勾选公共项');
        let changed = 0;
        selectedIds.forEach(itemId => {
            const item = data.wheelLibraryItems.find(entry => entry.id === itemId);
            if (!item) return;
            const set = new Set(item.tagIds || []);
            if (action === 'remove') {
                if (!set.has(tagId)) return;
                if (set.size <= 1) return;
                set.delete(tagId);
            } else {
                if (set.has(tagId)) return;
                set.add(tagId);
            }
            item.tagIds = uniqueTagIds(Array.from(set));
            item.updatedAt = now();
            changed++;
        });
        if (!changed && action === 'remove') return alert('没有可移除的标签；公共项至少要保留一个标签');
        if (!changed) return alert('选中的公共项已经包含这个标签');
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

    window.addWheelTag = function addWheelTag() {
        const name = document.getElementById('wheel-tag-name')?.value.trim();
        const weight = Math.max(1, Number(document.getElementById('wheel-tag-weight')?.value) || 1);
        const color = document.getElementById('wheel-tag-color')?.value || palette[data.wheelTags.length % palette.length];
        if (!name) return alert('请输入标签名称');
        if (data.wheelTags.some(tag => normalizeName(tag.name) === normalizeName(name))) return alert('已经有同名标签');
        data.wheelTags.push({ id: id(), name, color, weight, enabled: true, createdAt: now(), updatedAt: now() });
        persist();
        renderWheelPage();
    };

    window.editWheelTag = function editWheelTag(tagId) {
        const tag = data.wheelTags.find(item => item.id === tagId);
        if (!tag) return;
        const name = prompt('标签名称', tag.name);
        if (name === null) return;
        const trimmed = name.trim();
        if (!trimmed) return alert('名称不能为空');
        if (data.wheelTags.some(item => item.id !== tag.id && normalizeName(item.name) === normalizeName(trimmed))) return alert('已经有同名标签');
        const weight = prompt('标签权重', tag.weight);
        if (weight === null) return;
        tag.name = trimmed;
        tag.weight = Math.max(1, Number(weight) || 1);
        tag.updatedAt = now();
        persist();
        renderWheelPage();
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
        if (typeof markDeletedItem === 'function') markDeletedItem('wheelTags', tagId, { name: tag.name });
        persist();
        renderWheelPage();
    };

    window.setWheelFilterMatchMode = function setWheelFilterMatchMode(wheelId, mode = 'all') {
        const wheel = data.wheels.find(item => item.id === wheelId);
        if (!wheel || wheel.mode !== 'tag') return;
        wheel.filterMatchMode = mode === 'any' ? 'any' : 'all';
        wheel.updatedAt = now();
        currentWheelResultId = null;
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
        const start = wheelRotation;
        const slice = 360 / Math.max(1, entries.length);
        const desired = 270 - (selectedIndex * slice + slice / 2);
        const normalizedStart = ((start % 360) + 360) % 360;
        const delta = ((desired - normalizedStart) + 360) % 360;
        const target = start + 1800 + delta;
        const startTime = performance.now();
        const duration = Number(window.__wheelSpinDurationMs) || 3600;
        function tick(time) {
            const progress = Math.min(1, (time - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 2.4);
            wheelRotation = start + (target - start) * eased;
            drawWheelCanvas(entries, progress === 1 ? selectedIndex : -1);
            if (progress < 1) requestAnimationFrame(tick);
            else {
                wheelRotation %= 360;
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
        if (wheel.mode === 'tag') {
            const selectedTagIds = uniqueTagIds(wheel.tagIds || []);
            if (!selectedTagIds.length) return alert('请先选择至少一个标签');
            const items = getTagCandidatesForSelection(wheel);
            if (!items.length) return alert('没有符合条件的公共项，试试减少标签或改成任意满足');
            const result = weightedPick(items);
            const entries = items.map((item, index) => ({ ...item, color: palette[index % palette.length] }));
            const resultIndex = entries.findIndex(item => item.id === result.id);
            animateSpin(entries, Math.max(0, resultIndex), () => {
                const selectedTags = tagNames(selectedTagIds).join(' + ');
                saveHistory({
                    mode: 'tag',
                    wheelId: wheel.id,
                    wheelName: wheel.name,
                    tagId: '',
                    tagName: selectedTags,
                    resultId: result.id,
                    resultName: result.name,
                    note: result.note || ''
                });
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
