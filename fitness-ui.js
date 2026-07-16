(function () {
    let currentBodyMetricId = null;
    let fitnessService = null;

    function ensureService() {
        if (fitnessService) return fitnessService;
        if (!window.LifePlanFitnessService?.create) {
            console.warn('Fitness service is not available');
            return null;
        }
        fitnessService = window.LifePlanFitnessService.create({
            getTodayStr: () => (typeof getTodayStr === 'function' ? getTodayStr() : new Date().toISOString().slice(0, 10)),
            getNowLocal: () => (typeof getLocalDateTimeStr === 'function' ? getLocalDateTimeStr() : new Date().toISOString()),
            genId: () => (typeof genId === 'function' ? genId() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`)
        });
        return fitnessService;
    }

    function safeHtml(value = '') {
        if (typeof escapeHtml === 'function') return escapeHtml(value);
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeJs(value = '') {
        if (typeof escapeJsArg === 'function') return escapeJsArg(value);
        return JSON.stringify(String(value || '')).replace(/"/g, '&quot;');
    }

    function formatDateLabel(dateStr = '') {
        if (typeof formatDate === 'function') return formatDate(dateStr);
        return dateStr || '';
    }

    function getMetrics() {
        if (!Array.isArray(data.bodyMetrics)) data.bodyMetrics = [];
        return data.bodyMetrics;
    }

    function renderSparkline(series = []) {
        if (!series.length) {
            return '<div class="fitness-empty compact">暂无趋势数据</div>';
        }
        const values = series.map(item => item.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = max - min || 1;
        const points = series.map((item, index) => {
            const x = series.length === 1 ? 50 : (index / (series.length - 1)) * 100;
            const y = 100 - ((item.value - min) / span) * 100;
            return `${x},${y}`;
        }).join(' ');
        const latest = series[series.length - 1];
        const first = series[0];
        return `
            <div class="fitness-sparkline-wrap">
                <svg class="fitness-sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polyline fill="none" stroke="currentColor" stroke-width="3" points="${points}"></polyline>
                </svg>
                <div class="fitness-sparkline-meta">
                    <span>${safeHtml(first.date)}</span>
                    <strong>${safeHtml(String(latest.value))}</strong>
                    <span>${safeHtml(latest.date)}</span>
                </div>
            </div>
        `;
    }

    function renderMetricChips(metric) {
        const service = ensureService();
        if (!service || !metric) return '';
        const chips = service.METRIC_FIELDS
            .filter(field => service.parseMetricNumber(metric[field.key]) !== null)
            .map(field => `
                <span class="fitness-chip">
                    ${safeHtml(field.label)}
                    <strong>${safeHtml(service.formatMetricValue(metric[field.key], field.unit))}</strong>
                </span>
            `).join('');
        return chips || '<span class="fitness-chip">暂无指标</span>';
    }

    function renderSummary() {
        const service = ensureService();
        const container = document.getElementById('fitness-summary');
        if (!service || !container) return;
        const summary = service.buildBodyMetricSummary(getMetrics());
        const latest = summary.latest;
        container.innerHTML = `
            <div class="fitness-summary-grid">
                <div class="fitness-stat-card">
                    <div class="fitness-stat-label">当前体重</div>
                    <div class="fitness-stat-value">${safeHtml(service.formatMetricValue(latest?.weight, 'kg'))}</div>
                    <div class="fitness-stat-sub">${latest ? safeHtml(formatDateLabel(latest.date)) : '还没有身材记录'}</div>
                </div>
                <div class="fitness-stat-card">
                    <div class="fitness-stat-label">近 30 天体重变化</div>
                    <div class="fitness-stat-value">${safeHtml(service.formatSignedChange(summary.weightChange.delta, 'kg'))}</div>
                    <div class="fitness-stat-sub">${summary.weightChange.previous ? `对比 ${safeHtml(summary.weightChange.previous.date)}` : '记录不足'}</div>
                </div>
                <div class="fitness-stat-card">
                    <div class="fitness-stat-label">当前腰围</div>
                    <div class="fitness-stat-value">${safeHtml(service.formatMetricValue(latest?.waist, 'cm'))}</div>
                    <div class="fitness-stat-sub">变化 ${safeHtml(service.formatSignedChange(summary.waistChange.delta, 'cm'))}</div>
                </div>
                <div class="fitness-stat-card">
                    <div class="fitness-stat-label">当前体脂</div>
                    <div class="fitness-stat-value">${safeHtml(service.formatMetricValue(latest?.bodyFat, '%'))}</div>
                    <div class="fitness-stat-sub">变化 ${safeHtml(service.formatSignedChange(summary.bodyFatChange.delta, '%'))}</div>
                </div>
            </div>
            <div class="fitness-trend-grid">
                <div class="card fitness-trend-card">
                    <div class="section-title">体重趋势</div>
                    ${renderSparkline(summary.weightSeries)}
                </div>
                <div class="card fitness-trend-card">
                    <div class="section-title">腰围趋势</div>
                    ${renderSparkline(summary.waistSeries)}
                </div>
            </div>
        `;
    }

    function renderBodyMetricList() {
        const service = ensureService();
        const container = document.getElementById('fitness-body-metric-list');
        if (!service || !container) return;
        const metrics = service.normalizeBodyMetrics(getMetrics());
        if (!metrics.length) {
            container.innerHTML = `
                <div class="empty-state">
                    还没有身材记录。先记下今天的体重或三围，后面就能看到变化趋势。
                </div>
            `;
            return;
        }
        container.innerHTML = metrics.map(metric => `
            <article class="fitness-metric-card" onclick="openBodyMetricModal(${safeJs(metric.id)})">
                <div class="fitness-metric-head">
                    <div>
                        <div class="fitness-metric-date">${safeHtml(formatDateLabel(metric.date))}</div>
                        <div class="fitness-metric-condition">${safeHtml(service.getConditionLabel(metric.condition))}</div>
                    </div>
                    <div class="fitness-metric-primary">
                        <strong>${safeHtml(service.formatMetricValue(metric.weight, 'kg'))}</strong>
                        <span>体重</span>
                    </div>
                </div>
                <div class="fitness-chip-row">${renderMetricChips(metric)}</div>
                ${metric.note ? `<div class="fitness-metric-note">${safeHtml(metric.note)}</div>` : ''}
            </article>
        `).join('');
    }

    function renderFitnessComingSoon() {
        const planBox = document.getElementById('fitness-plan-placeholder');
        const workoutBox = document.getElementById('fitness-workout-placeholder');
        if (planBox) {
            planBox.innerHTML = `
                <div class="fitness-placeholder-card">
                    <strong>训练计划</strong>
                    <p>下一期会支持训练计划、训练日和动作模板。这一期先把身材记录做稳。</p>
                </div>
            `;
        }
        if (workoutBox) {
            workoutBox.innerHTML = `
                <div class="fitness-placeholder-card">
                    <strong>训练日志</strong>
                    <p>再下一期会支持从计划生成今日训练，并记录每组重量和次数。</p>
                </div>
            `;
        }
    }

    window.renderFitnessPage = function renderFitnessPage() {
        const service = ensureService();
        if (!service) return;
        if (!Array.isArray(data.bodyMetrics)) data.bodyMetrics = [];
        if (!Array.isArray(data.fitnessPlans)) data.fitnessPlans = [];
        if (!Array.isArray(data.fitnessWorkouts)) data.fitnessWorkouts = [];
        data.bodyMetrics = service.normalizeBodyMetrics(data.bodyMetrics);
        renderSummary();
        renderBodyMetricList();
        renderFitnessComingSoon();
    };

    function fillBodyMetricForm(metric = null) {
        const service = ensureService();
        if (!service) return;
        const draft = metric || service.createBodyMetricDraft();
        document.getElementById('body-metric-modal-title').textContent = metric ? '编辑身材记录' : '记录身材';
        document.getElementById('body-metric-date').value = draft.date || (typeof getTodayStr === 'function' ? getTodayStr() : '');
        document.getElementById('body-metric-condition').value = draft.condition || 'unknown';
        document.getElementById('body-metric-note').value = draft.note || '';
        service.METRIC_FIELDS.forEach(field => {
            const el = document.getElementById(`body-metric-${field.key}`);
            if (!el) return;
            el.value = draft[field.key] ?? '';
        });
        const deleteBtn = document.getElementById('delete-body-metric-btn');
        if (deleteBtn) deleteBtn.style.display = metric ? '' : 'none';
    }

    function readBodyMetricForm() {
        const service = ensureService();
        if (!service) return {};
        const input = {
            date: document.getElementById('body-metric-date')?.value || '',
            condition: document.getElementById('body-metric-condition')?.value || 'unknown',
            note: document.getElementById('body-metric-note')?.value || ''
        };
        service.METRIC_FIELDS.forEach(field => {
            const el = document.getElementById(`body-metric-${field.key}`);
            if (el) input[field.key] = el.value;
        });
        return input;
    }

    window.openBodyMetricModal = function openBodyMetricModal(metricId = '') {
        const service = ensureService();
        if (!service) return;
        currentBodyMetricId = metricId || null;
        const metric = currentBodyMetricId
            ? service.normalizeBodyMetrics(getMetrics()).find(item => item.id === currentBodyMetricId)
            : null;
        fillBodyMetricForm(metric || null);
        document.getElementById('body-metric-modal')?.classList.add('active');
        document.getElementById('body-metric-weight')?.focus();
    };

    window.closeBodyMetricModal = function closeBodyMetricModal() {
        document.getElementById('body-metric-modal')?.classList.remove('active');
        currentBodyMetricId = null;
    };

    window.saveBodyMetric = function saveBodyMetric() {
        const service = ensureService();
        if (!service) return;
        const input = readBodyMetricForm();
        const sameDay = service.findSameDayMetrics(getMetrics(), input.date, currentBodyMetricId || '');
        if (!currentBodyMetricId && sameDay.length) {
            const shouldContinue = confirm(`当天已有 ${sameDay.length} 条身材记录。继续新增一条吗？\n选“取消”可先去编辑已有记录。`);
            if (!shouldContinue) return;
        }
        const result = service.upsertBodyMetric(getMetrics(), input, currentBodyMetricId || '');
        if (!result.ok) {
            alert(result.message || '保存失败');
            return;
        }
        data.bodyMetrics = result.metrics;
        if (typeof saveData === 'function' && !saveData()) return;
        closeBodyMetricModal();
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
    };

    window.deleteCurrentBodyMetric = function deleteCurrentBodyMetric() {
        const service = ensureService();
        if (!service || !currentBodyMetricId) return;
        if (!confirm('确定删除这条身材记录吗？')) return;
        if (typeof markDeletedItem === 'function') {
            markDeletedItem('bodyMetrics', currentBodyMetricId, { reason: 'manual-delete' });
        }
        data.bodyMetrics = service.removeBodyMetric(getMetrics(), currentBodyMetricId);
        if (typeof saveData === 'function' && !saveData()) return;
        closeBodyMetricModal();
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
    };
})();
