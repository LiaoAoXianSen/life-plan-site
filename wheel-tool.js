(function () {
    const palette = ['#2f7d6d', '#e86c52', '#3e65b0', '#ebb050', '#755b9c', '#3697a4', '#c64b6e', '#5b8457'];
    let wheelRotation = 0;
    let wheelSpinning = false;
    let wheelStageState = createWheelStageState();

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

    function now() {
        return typeof getLocalDateTimeStr === 'function' ? getLocalDateTimeStr() : new Date().toISOString();
    }

    function today() {
        return typeof getTodayStr === 'function' ? getTodayStr() : new Date().toISOString().slice(0, 10);
    }

    function id() {
        return typeof genId === 'function' ? genId() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
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

    function getTagById(tagId) {
        return data.wheelTags.find(tag => tag.id === tagId) || null;
    }

    function getTagItemPool(tagId) {
        return data.wheelLibraryItems.filter(item => item.enabled !== false && item.tagIds?.includes(tagId));
    }

    function getTagChipMarkup(name, color = '#216e4e') {
        return `<span class="wheel-chip" style="--chip-color:${safeHtml(color)}">${safeHtml(name || '未命名标签')}</span>`;
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

    function ensureSeedData() {
        ensureWheelCollections();
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
            items: seedItems.map(item => ({ id: id(), name: item.name, note: item.note, weight: item.weight, enabled: true, sourceLibraryItemId: item.id })),
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

    function getEnabledEntries(wheel) {
        if (!wheel) return [];
        if (wheel.mode === 'tag') {
            const selected = Array.isArray(wheel.tagIds) && wheel.tagIds.length ? new Set(wheel.tagIds) : null;
            return data.wheelTags
                .filter(tag => tag.enabled !== false && (!selected || selected.has(tag.id)))
                .filter(tag => data.wheelLibraryItems.some(item => item.enabled !== false && item.tagIds?.includes(tag.id)));
        }
        return (wheel.items || []).filter(item => item.enabled !== false);
    }

    function tagNames(tagIds = []) {
        return tagIds.map(tagId => data.wheelTags.find(tag => tag.id === tagId)?.name).filter(Boolean);
    }

    function tagChips(tagIds = []) {
        const tags = tagIds.map(tagId => data.wheelTags.find(tag => tag.id === tagId)).filter(Boolean);
        if (!tags.length) return '<span class="wheel-chip muted">无标签</span>';
        return tags.map(tag => `<span class="wheel-chip" style="--chip-color:${safeHtml(tag.color || '#216e4e')}">${safeHtml(tag.name)}</span>`).join('');
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

    function isTagItemsStage(wheel) {
        return Boolean(wheel && wheelStageState.type === 'tag-items' && wheelStageState.tagId && wheel.id === wheelStageState.tagWheelId);
    }

    function getTagCandidatesForWheel(wheel) {
        if (!wheel || wheel.mode !== 'tag') return [];
        const selected = Array.isArray(wheel.tagIds) && wheel.tagIds.length ? new Set(wheel.tagIds) : null;
        return data.wheelTags
            .filter(tag => tag.enabled !== false && (!selected || selected.has(tag.id)))
            .map(tag => ({ tag, items: getTagItemPool(tag.id) }))
            .filter(entry => entry.items.length > 0);
    }

    function drawWheelCanvas(entries = [], selectedIndex = -1) {
        const canvas = document.getElementById('wheel-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) / 2 - 16;
        ctx.clearRect(0, 0, width, height);

        if (!entries.length) {
            ctx.beginPath();
            ctx.fillStyle = '#dfe7e1';
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#647269';
            ctx.font = '700 18px Microsoft YaHei, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无可抽内容', cx, cy);
            return;
        }

        const slice = Math.PI * 2 / entries.length;
        const rotation = wheelRotation * Math.PI / 180;
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = '#f6f9f6';
        ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        entries.forEach((entry, index) => {
            const start = rotation + index * slice;
            const end = start + slice;
            const mid = start + slice / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, start, end);
            ctx.closePath();
            ctx.fillStyle = selectedIndex === index ? '#c45532' : (entry.color || palette[index % palette.length]);
            ctx.fill();

            const lines = splitWheelLabel(entry.name, entries.length <= 4 ? 4 : 5, 2);
            const labelRadius = entries.length <= 4 ? radius * 0.62 : entries.length <= 8 ? radius * 0.68 : radius * 0.73;
            const labelX = cx + Math.cos(mid) * labelRadius;
            const labelY = cy + Math.sin(mid) * labelRadius;
            ctx.save();
            ctx.translate(labelX, labelY);
            if (entries.length > 6) {
                let textAngle = mid;
                if (textAngle > Math.PI / 2 && textAngle < Math.PI * 1.5) textAngle += Math.PI;
                ctx.rotate(textAngle);
            }
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(16, 23, 19, .18)';
            ctx.shadowBlur = 8;
            ctx.font = entries.length <= 4 ? '800 17px Microsoft YaHei, sans-serif' : '800 14px Microsoft YaHei, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lineOffset = lines.length > 1 ? 9 : 0;
            lines.forEach((line, lineIndex) => {
                ctx.fillText(line, 0, lineIndex * 18 - lineOffset);
            });
            ctx.restore();
        });

        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(cx, cy, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(23,33,27,.12)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function renderSelector() {
        const selector = document.getElementById('wheel-selector');
        if (!selector) return;
        selector.innerHTML = data.wheels.map(wheel => `<option value="${wheel.id}" ${wheel.id === currentWheelId ? 'selected' : ''}>${safeHtml(wheel.name)} · ${wheel.mode === 'tag' ? '标签' : '普通'}</option>`).join('');
    }

    function renderStageSummary(wheel) {
        const container = document.getElementById('wheel-stage-summary');
        if (!container) return;
        if (isTagItemsStage(wheel)) {
            const tag = getTagById(wheelStageState.tagId);
            const tagColor = wheelStageState.tagColor || tag?.color || '#216e4e';
            container.innerHTML = `
                <div class="wheel-stage-card active">
                    <div class="wheel-stage-card-top">
                        <span class="wheel-stage-badge">第二段</span>
                        <span class="wheel-stage-badge muted">已锁定标签</span>
                    </div>
                    <div class="wheel-stage-title">先抽到了 ${getTagChipMarkup(wheelStageState.tagName, tagColor)}</div>
                    <div class="wheel-stage-copy">现在继续从这个标签下的 ${Number(wheelStageState.itemCount) || 0} 个候选内容里抽具体结果。</div>
                </div>
            `;
            return;
        }
        if (wheel?.mode === 'tag') {
            const tagCandidates = getTagCandidatesForWheel(wheel).slice(0, 6);
            container.innerHTML = `
                <div class="wheel-stage-card">
                    <div class="wheel-stage-card-top">
                        <span class="wheel-stage-badge">第一段</span>
                        <span class="wheel-stage-badge muted">标签转盘</span>
                    </div>
                    <div class="wheel-stage-title">先抽标签，再继续抽具体内容</div>
                    <div class="wheel-stage-copy">第一轮只会在标签之间转动，抽中后会自动切到该标签对应的内容池。</div>
                    <div class="wheel-stage-stats">
                        <div class="wheel-stage-stat">
                            <strong>${tagCandidates.length}</strong>
                            <span>当前可抽标签</span>
                        </div>
                        <div class="wheel-stage-stat">
                            <strong>${tagCandidates.reduce((sum, entry) => sum + entry.items.length, 0)}</strong>
                            <span>候选公共项</span>
                        </div>
                    </div>
                    ${tagCandidates.length ? `
                        <div class="wheel-stage-quick-tags">
                            ${tagCandidates.map(entry => `
                                <button type="button" class="wheel-stage-quick-tag" onclick="spinDirectTag('${entry.tag.id}')">
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
            <div class="wheel-stage-card">
                <div class="wheel-stage-card-top">
                    <span class="wheel-stage-badge">普通模式</span>
                </div>
                <div class="wheel-stage-title">一次抽出最终结果</div>
                <div class="wheel-stage-copy">点击转盘或下方按钮都可以直接开始，不会再进入第二段。</div>
            </div>
        `;
    }

    function renderResult() {
        const container = document.getElementById('wheel-result');
        if (!container) return;
        const wheel = getCurrentWheel();
        const history = data.wheelHistory.find(item => item.id === currentWheelResultId);
        if (!history) {
            container.innerHTML = isTagItemsStage(wheel)
                ? '<div class="wheel-result-empty">再转一次就会得到最终内容，结果卡片也会显示在这里。</div>'
                : '<div class="wheel-result-empty">抽取后会在这里显示结果，你可以选择是否转入待办。</div>';
            return;
        }
        const converted = history.convertedTodoId && data.todos.some(todo => todo.id === history.convertedTodoId);
        container.innerHTML = `
            <div class="wheel-result-card">
                <div class="wheel-result-kicker">${history.mode === 'tag' ? `最终结果 · 来自标签 ${safeHtml(history.tagName || '-')}` : '最终结果 · 普通转盘'}</div>
                <div class="wheel-result-title">${safeHtml(history.resultName || '未命名结果')}</div>
                ${history.note ? `<div class="wheel-result-note">${safeHtml(history.note)}</div>` : ''}
                <div class="wheel-result-actions">
                    <button class="btn btn-primary" ${converted ? 'disabled' : ''} onclick="convertWheelResultToTodo('${history.id}')">${converted ? '已转入待办' : '转入待办'}</button>
                    <button class="btn btn-secondary" onclick="clearWheelCurrentResult()">只保留记录</button>
                </div>
            </div>
        `;
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
                stageHint.textContent = '标签转盘会先定标签，再自动进入第二段抽内容；如果你已经想好标签，也可以直接点“只转这个标签”。';
            } else {
                stageHint.textContent = '点击转盘或按钮都可以开始，普通转盘会直接给出最终结果。';
            }
        }
        const canvas = document.getElementById('wheel-canvas');
        const canvasWrap = document.querySelector('.wheel-canvas-wrap');
        const spinFromCanvas = () => {
            if (!wheelSpinning) spinWheel();
        };
        if (canvas) canvas.onclick = spinFromCanvas;
        if (canvasWrap) canvasWrap.onclick = spinFromCanvas;
        renderResult();
    }

    function renderItemsPanel(wheel) {
        if (!wheel) return '<div class="empty-state">暂无转盘</div>';
        if (wheel.mode === 'tag') {
            const selected = new Set(wheel.tagIds || []);
            const tagCards = data.wheelTags.map(tag => {
                const items = getTagItemPool(tag.id);
                const selectedClass = selected.has(tag.id) ? 'selected' : '';
                return `
                    <article class="wheel-tag-card ${selectedClass}">
                        <label class="wheel-tag-toggle">
                            <input type="checkbox" ${selected.has(tag.id) ? 'checked' : ''} onchange="toggleWheelTag('${wheel.id}','${tag.id}',this.checked)">
                            <span class="wheel-color-dot" style="background:${safeHtml(tag.color)}"></span>
                            <span class="wheel-tag-title">${safeHtml(tag.name)}</span>
                        </label>
                        <div class="wheel-tag-meta">
                            <span>权重 ${tag.weight}</span>
                            <span>${items.length} 个可抽公共项</span>
                        </div>
                        <div class="wheel-tag-actions">
                            <button type="button" class="wheel-mini-btn primary" ${items.length ? '' : 'disabled'} onclick="spinDirectTag('${tag.id}')">只转这个标签</button>
                            <button type="button" class="wheel-mini-btn" ${items.length ? '' : 'disabled'} onclick="previewTagStage('${tag.id}')">先看这个标签池</button>
                        </div>
                    </article>
                `;
            }).join('');
            return `
                <div class="wheel-panel-head">
                    <div>
                        <div class="card-title">标签转盘配置</div>
                        <div class="wheel-hint">勾选标签后可以走正常两段抽取；如果你已经想好了标签，也可以直接点“只转这个标签”。</div>
                    </div>
                    <div class="wheel-head-actions">
                        <button class="btn btn-secondary" onclick="renameWheel('${wheel.id}')">改名</button>
                        <button class="btn btn-danger" onclick="deleteWheel('${wheel.id}')">删除转盘</button>
                    </div>
                </div>
                <div class="wheel-tag-grid">
                    ${tagCards || '<div class="empty-state">暂无标签，先去“标签”面板新增。</div>'}
                </div>
            `;
        }
        return `
            <div class="wheel-panel-head">
                <div>
                    <div class="card-title">当前转盘项</div>
                    <div class="wheel-hint">名称不能重复，权重越高越容易抽中。</div>
                </div>
                <div class="wheel-head-actions">
                    <button class="btn btn-secondary" onclick="renameWheel('${wheel.id}')">改名</button>
                    <button class="btn btn-danger" onclick="deleteWheel('${wheel.id}')">删除转盘</button>
                </div>
            </div>
            <div class="wheel-inline-form">
                <input id="wheel-item-name" placeholder="新增选项，例如：散步">
                <input id="wheel-item-weight" type="number" min="1" value="1" title="权重">
                <button class="btn btn-primary" onclick="addWheelItem('${wheel.id}')">添加</button>
            </div>
            <div class="wheel-inline-form wide">
                <select id="wheel-library-copy-select">
                    <option value="">从公共项复制到当前转盘</option>
                    ${data.wheelLibraryItems.map(item => `<option value="${item.id}">${safeHtml(item.name)} · ${tagNames(item.tagIds).join('/') || '无标签'}</option>`).join('')}
                </select>
                <button class="btn btn-secondary" onclick="copyLibraryItemToWheel('${wheel.id}')">复制</button>
            </div>
            <div class="wheel-list">
                ${(wheel.items || []).map(item => `
                    <div class="wheel-row">
                        <span class="wheel-row-main"><strong>${safeHtml(item.name)}</strong><small>权重 ${item.weight}${item.note ? ` · ${safeHtml(item.note)}` : ''}</small></span>
                        <button class="wheel-mini-btn" onclick="editWheelItem('${wheel.id}','${item.id}')">修改</button>
                        <button class="wheel-mini-btn danger" onclick="deleteWheelItem('${wheel.id}','${item.id}')">删除</button>
                    </div>
                `).join('') || '<div class="empty-state">暂无转盘项，可以添加或从公共项复制。</div>'}
            </div>
        `;
    }

    function renderLibraryPanel() {
        return `
            <div class="wheel-panel-head">
                <div>
                    <div class="card-title">公共项库</div>
                    <div class="wheel-hint">公共项可被普通转盘复制，也会被标签转盘用于二段抽取。</div>
                </div>
                <button class="btn btn-secondary" onclick="openWheelLibraryBatchImport()">批量公共项</button>
            </div>
            <div class="wheel-inline-form library-form">
                <input id="wheel-library-name" placeholder="公共项名称">
                <input id="wheel-library-tags" placeholder="标签，用逗号分隔">
                <input id="wheel-library-weight" type="number" min="1" value="1">
                <button class="btn btn-primary" onclick="addWheelLibraryItem()">添加</button>
            </div>
            <div class="wheel-list">
                ${data.wheelLibraryItems.map(item => `
                    <div class="wheel-row library">
                        <span class="wheel-row-main"><strong>${safeHtml(item.name)}</strong><small>权重 ${item.weight} · ${item.enabled === false ? '已停用' : '启用中'}</small><span class="wheel-chip-row">${tagChips(item.tagIds)}</span></span>
                        <button class="wheel-mini-btn" onclick="editWheelLibraryItem('${item.id}')">修改</button>
                        <button class="wheel-mini-btn" onclick="toggleWheelLibraryItem('${item.id}')">${item.enabled === false ? '启用' : '停用'}</button>
                        <button class="wheel-mini-btn danger" onclick="deleteWheelLibraryItem('${item.id}')">删除</button>
                    </div>
                `).join('') || '<div class="empty-state">暂无公共项。</div>'}
            </div>
        `;
    }

    function renderTagsPanel() {
        return `
            <div class="wheel-panel-head">
                <div>
                    <div class="card-title">标签管理</div>
                    <div class="wheel-hint">标签有颜色和权重，标签转盘会按权重抽标签。</div>
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
                        <span class="wheel-color-dot" style="background:${safeHtml(tag.color)}"></span>
                        <span class="wheel-row-main"><strong>${safeHtml(tag.name)}</strong><small>权重 ${tag.weight} · ${tag.enabled === false ? '已停用' : '启用中'}</small></span>
                        <button class="wheel-mini-btn" onclick="editWheelTag('${tag.id}')">修改</button>
                        <button class="wheel-mini-btn" onclick="toggleWheelTagEnabled('${tag.id}')">${tag.enabled === false ? '启用' : '停用'}</button>
                        <button class="wheel-mini-btn danger" onclick="deleteWheelTag('${tag.id}')">删除</button>
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
                <button class="btn btn-danger" onclick="clearWheelHistory()">清空记录</button>
            </div>
            <div class="wheel-list history">
                ${history.map(item => `
                    <div class="wheel-row">
                        <span class="wheel-row-main"><strong>${safeHtml(item.resultName)}</strong><small>${formatStoredDateTime(item.createdAt)} · ${item.mode === 'tag' ? `标签 ${safeHtml(item.tagName || '-')}` : '普通转盘'}${item.convertedTodoId ? ' · 已转待办' : ''}</small></span>
                        ${item.convertedTodoId ? '' : `<button class="wheel-mini-btn" onclick="convertWheelResultToTodo('${item.id}')">转待办</button>`}
                        <button class="wheel-mini-btn danger" onclick="deleteWheelHistory('${item.id}')">删除</button>
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
        currentWheelPanel = panel;
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

    window.createWheel = function createWheel() {
        const name = prompt('转盘名称', currentWheelMode === 'tag' ? '新的标签转盘' : '新的普通转盘');
        if (name === null) return;
        const trimmed = name.trim() || '未命名转盘';
        const stamp = now();
        const items = [];
        if (currentWheelMode !== 'tag') {
            const firstItem = prompt('第一个转盘项（普通转盘至少需要 1 项）', '');
            if (firstItem === null) return;
            const firstName = firstItem.trim();
            if (!firstName) return alert('普通转盘至少需要 1 个转盘项');
            items.push({ id: id(), name: firstName, note: '', weight: 1, enabled: true, createdAt: stamp, updatedAt: stamp });
        }
        const wheel = { id: id(), name: trimmed, mode: currentWheelMode, items, tagIds: currentWheelMode === 'tag' ? data.wheelTags.map(tag => tag.id) : [], createdAt: stamp, updatedAt: stamp };
        data.wheels.unshift(wheel);
        currentWheelId = wheel.id;
        persist();
        renderWheelPage();
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
        wheel.items = (wheel.items || []).filter(item => item.id !== itemId);
        wheel.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.copyLibraryItemToWheel = function copyLibraryItemToWheel(wheelId) {
        const wheel = data.wheels.find(item => item.id === wheelId);
        const libraryId = document.getElementById('wheel-library-copy-select')?.value;
        const library = data.wheelLibraryItems.find(item => item.id === libraryId);
        if (!wheel || !library) return alert('请选择公共项');
        if ((wheel.items || []).some(item => normalizeName(item.name) === normalizeName(library.name))) return alert('当前转盘里已经有同名选项');
        wheel.items.push({ id: id(), name: library.name, note: library.note || '', weight: library.weight || 1, enabled: true, sourceLibraryItemId: library.id, createdAt: now(), updatedAt: now() });
        wheel.updatedAt = now();
        persist();
        renderWheelPage();
    };

    window.openWheelBatchImport = function openWheelBatchImport() {
        const wheel = getCurrentWheel();
        if (!wheel || wheel.mode !== 'normal') return alert('批量导入转盘项只适用于普通转盘');
        const text = prompt('每行一个选项，格式：名称,权重', '火锅,10\n烧烤,5\n麻辣烫');
        if (text === null) return;
        const seen = new Set((wheel.items || []).map(item => normalizeName(item.name)));
        const skipped = [];
        let added = 0;
        parseWeightedLines(text).forEach(item => {
            const key = normalizeName(item.name);
            if (seen.has(key)) {
                skipped.push(item.name);
                return;
            }
            seen.add(key);
            wheel.items.push({ id: id(), name: item.name, note: '', weight: item.weight, enabled: true, createdAt: now(), updatedAt: now() });
            added++;
        });
        wheel.updatedAt = now();
        persist();
        renderWheelPage();
        alert(`已导入 ${added} 项${skipped.length ? `，跳过重复：${skipped.join('、')}` : ''}`);
    };

    function ensureTagsByText(tagText) {
        const names = String(tagText || '').split(/[,，、;；/]/).map(item => item.trim()).filter(Boolean);
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
        data.wheelLibraryItems.push({ id: id(), name, note: '', weight, enabled: true, tagIds: ensureTagsByText(tagText), createdAt: now(), updatedAt: now() });
        persist();
        renderWheelPage();
    };

    window.openWheelLibraryBatchImport = function openWheelLibraryBatchImport() {
        const text = prompt('每行一个公共项。格式：名称,权重,标签1/标签2', '咖啡店学习,1,出门/学习/美食');
        if (text === null) return;
        const seen = new Set(data.wheelLibraryItems.map(item => normalizeName(item.name)));
        let added = 0;
        const skipped = [];
        parseWeightedLines(text).forEach(item => {
            const key = normalizeName(item.name);
            if (seen.has(key)) {
                skipped.push(item.name);
                return;
            }
            seen.add(key);
            data.wheelLibraryItems.push({ id: id(), name: item.name, note: '', weight: item.weight, enabled: true, tagIds: ensureTagsByText(item.tagText), createdAt: now(), updatedAt: now() });
            added++;
        });
        persist();
        renderWheelPage();
        alert(`已导入公共项 ${added} 项${skipped.length ? `，跳过重复：${skipped.join('、')}` : ''}`);
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
        item.name = trimmed;
        item.tagIds = ensureTagsByText(tagText);
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
        data.wheelTags = data.wheelTags.filter(item => item.id !== tagId);
        data.wheelLibraryItems.forEach(item => item.tagIds = (item.tagIds || []).filter(id => id !== tagId));
        data.wheels.forEach(wheel => wheel.tagIds = (wheel.tagIds || []).filter(id => id !== tagId));
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
        wheel.tagIds = Array.from(set);
        wheel.updatedAt = now();
        persist();
        renderWheelPage();
    };

    function saveHistory(payload) {
        const history = { id: id(), createdAt: now(), convertedTodoId: '', ...payload };
        data.wheelHistory.unshift(history);
        currentWheelResultId = history.id;
        persist();
        return history;
    }

    function animateSpin(entries, selectedIndex, done) {
        if (wheelSpinning) return;
        wheelSpinning = true;
        const start = wheelRotation;
        const slice = 360 / Math.max(1, entries.length);
        const desired = 270 - (selectedIndex * slice + slice / 2);
        const normalizedStart = ((start % 360) + 360) % 360;
        const delta = ((desired - normalizedStart) + 360) % 360;
        const target = start + 1440 + delta;
        const startTime = performance.now();
        const duration = 1700;
        function tick(time) {
            const progress = Math.min(1, (time - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
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
            const items = data.wheelLibraryItems.filter(item => item.enabled !== false && item.tagIds?.includes(tag.id));
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

    window.spinDirectTag = function spinDirectTag(tagId) {
        const tag = data.wheelTags.find(item => item.id === tagId);
        const items = setTagItemsStage(tag, currentWheelId || '');
        if (!tag || !items?.length) return alert('这个标签下没有可抽公共项');
        currentWheelResultId = null;
        renderWheelPage();
        const wheel = getCurrentWheel();
        const stageItems = getStageEntries(wheel);
        const result = weightedPick(stageItems);
        const resultIndex = stageItems.findIndex(item => item.id === result.id);
        requestAnimationFrame(() => {
            animateSpin(stageItems, Math.max(0, resultIndex), () => {
                saveHistory({
                    mode: 'tag',
                    wheelId: wheel?.id || currentWheelId || '',
                    wheelName: wheel?.name || '标签转盘',
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
        const tag = data.wheelTags.find(item => item.id === tagId);
        const items = setTagItemsStage(tag, currentWheelId || '');
        if (!tag || !items?.length) return alert('这个标签下没有可抽公共项');
        currentWheelResultId = null;
        renderWheelPage();
    };

    window.returnToTagWheel = function returnToTagWheel() {
        resetWheelStageState();
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

    if (location.hash === '#wheel' && typeof switchPage === 'function') {
        const nav = Array.from(document.querySelectorAll('.nav-item')).find(item => item.textContent.includes('工具转盘'));
        switchPage('wheel', nav);
    }
})();
