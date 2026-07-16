(function () {
    let currentBodyMetricId = null;
    let currentFitnessPlanId = null;
    let fitnessPlanDraft = null;
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

    function getPlans() {
        if (!Array.isArray(data.fitnessPlans)) data.fitnessPlans = [];
        return data.fitnessPlans;
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
        const workoutBox = document.getElementById('fitness-workout-placeholder');
        if (workoutBox) {
            workoutBox.innerHTML = `
                <div class="fitness-placeholder-card">
                    <strong>训练日志</strong>
                    <p>下一期会支持从计划生成今日训练，并记录每组重量和次数。</p>
                </div>
            `;
        }
    }

    function renderPlanList() {
        const service = ensureService();
        const container = document.getElementById('fitness-plan-list');
        if (!service || !container) return;
        const plans = service.normalizeFitnessPlans(getPlans());
        if (!plans.length) {
            container.innerHTML = `
                <div class="empty-state">
                    还没有训练计划。可以先建一个「推拉腿」或「全身训练」计划，方便后面直接开练。
                </div>
            `;
            return;
        }
        container.innerHTML = plans.map(plan => {
            const weekdays = service.getWeekdayLabels(plan.weekdays).join(' / ') || '未设置训练日';
            const exerciseCount = service.countPlanExercises(plan);
            const dayCount = (plan.days || []).length;
            return `
                <article class="fitness-plan-card" onclick="openFitnessPlanModal(${safeJs(plan.id)})">
                    <div class="fitness-plan-head">
                        <div>
                            <div class="fitness-plan-name">${safeHtml(plan.name)}</div>
                            <div class="fitness-plan-meta">
                                ${safeHtml(service.getPlanGoalLabel(plan.goal))} · ${safeHtml(service.getPlanStatusLabel(plan.status))}
                            </div>
                        </div>
                        <div class="fitness-plan-primary">
                            <strong>${dayCount}</strong>
                            <span>训练日</span>
                        </div>
                    </div>
                    <div class="fitness-chip-row">
                        <span class="fitness-chip">${safeHtml(weekdays)}</span>
                        <span class="fitness-chip">动作 <strong>${exerciseCount}</strong></span>
                    </div>
                    ${plan.notes ? `<div class="fitness-metric-note">${safeHtml(plan.notes)}</div>` : ''}
                    <div class="fitness-plan-days">
                        ${(plan.days || []).map(day => `
                            <div class="fitness-plan-day-chip">
                                <strong>${safeHtml(day.name)}</strong>
                                <span>${(day.exercises || []).map(item => safeHtml(item.name)).join('、') || '暂无动作'}</span>
                            </div>
                        `).join('')}
                    </div>
                </article>
            `;
        }).join('');
    }

    function ensurePlanDraft() {
        const service = ensureService();
        if (!service) return null;
        if (!fitnessPlanDraft) fitnessPlanDraft = service.createFitnessPlanDraft();
        if (!Array.isArray(fitnessPlanDraft.days) || !fitnessPlanDraft.days.length) {
            fitnessPlanDraft.days = [{ id: (typeof genId === 'function' ? genId() : `day-${Date.now()}`), name: 'A 日', exercises: [] }];
        }
        fitnessPlanDraft.days.forEach(day => {
            if (!Array.isArray(day.exercises)) day.exercises = [];
        });
        if (!Array.isArray(fitnessPlanDraft.weekdays)) fitnessPlanDraft.weekdays = [];
        return fitnessPlanDraft;
    }

    function renderPlanEditor() {
        const service = ensureService();
        const daysBox = document.getElementById('fitness-plan-days-editor');
        if (!service || !daysBox) return;
        const draft = ensurePlanDraft();
        if (!draft) return;

        document.getElementById('fitness-plan-modal-title').textContent = currentFitnessPlanId ? '编辑训练计划' : '新建训练计划';
        document.getElementById('fitness-plan-name').value = draft.name || '';
        document.getElementById('fitness-plan-goal').value = draft.goal || 'general';
        document.getElementById('fitness-plan-status').value = draft.status || 'active';
        document.getElementById('fitness-plan-notes').value = draft.notes || '';

        const weekdayBox = document.getElementById('fitness-plan-weekdays');
        if (weekdayBox) {
            weekdayBox.innerHTML = service.WEEKDAY_OPTIONS.map(item => {
                const checked = draft.weekdays.includes(item.value) ? 'checked' : '';
                return `
                    <label class="fitness-check-chip">
                        <input type="checkbox" value="${item.value}" ${checked} onchange="toggleFitnessPlanWeekday(${item.value}, this.checked)">
                        <span>${safeHtml(item.label)}</span>
                    </label>
                `;
            }).join('');
        }

        daysBox.innerHTML = draft.days.map((day, dayIndex) => `
            <div class="fitness-plan-day-editor">
                <div class="fitness-plan-day-editor-head">
                    <div class="form-group" style="flex:1;margin:0;">
                        <label>训练日名称</label>
                        <input type="text" value="${safeHtml(day.name)}" oninput="updateFitnessPlanDayName(${dayIndex}, this.value)" placeholder="例如 A 日 / 推日">
                    </div>
                    <button type="button" class="btn btn-secondary todo-mini-btn" onclick="removeFitnessPlanDay(${dayIndex})" ${draft.days.length <= 1 ? 'disabled' : ''}>删除训练日</button>
                </div>
                <div class="fitness-plan-exercise-list">
                    ${(day.exercises || []).map((exercise, exerciseIndex) => `
                        <div class="fitness-plan-exercise-row">
                            <input type="text" value="${safeHtml(exercise.name)}" placeholder="动作名" oninput="updateFitnessPlanExercise(${dayIndex}, ${exerciseIndex}, 'name', this.value)">
                            <input type="number" min="1" step="1" value="${exercise.targetSets ?? 3}" placeholder="组数" oninput="updateFitnessPlanExercise(${dayIndex}, ${exerciseIndex}, 'targetSets', this.value)">
                            <input type="text" value="${safeHtml(exercise.targetReps || '')}" placeholder="次数" oninput="updateFitnessPlanExercise(${dayIndex}, ${exerciseIndex}, 'targetReps', this.value)">
                            <input type="number" min="0" step="0.5" value="${exercise.targetWeight ?? ''}" placeholder="目标重量" oninput="updateFitnessPlanExercise(${dayIndex}, ${exerciseIndex}, 'targetWeight', this.value)">
                            <button type="button" class="btn btn-secondary todo-mini-btn" onclick="removeFitnessPlanExercise(${dayIndex}, ${exerciseIndex})">删</button>
                        </div>
                    `).join('') || '<div class="fitness-empty compact">还没有动作，先加一个。</div>'}
                </div>
                <div class="fitness-plan-day-actions">
                    <button type="button" class="btn btn-secondary todo-mini-btn" onclick="addFitnessPlanExercise(${dayIndex})">+ 添加动作</button>
                </div>
            </div>
        `).join('');

        const deleteBtn = document.getElementById('delete-fitness-plan-btn');
        if (deleteBtn) deleteBtn.style.display = currentFitnessPlanId ? '' : 'none';
    }

    window.renderFitnessPage = function renderFitnessPage() {
        const service = ensureService();
        if (!service) return;
        if (!Array.isArray(data.bodyMetrics)) data.bodyMetrics = [];
        if (!Array.isArray(data.fitnessPlans)) data.fitnessPlans = [];
        if (!Array.isArray(data.fitnessWorkouts)) data.fitnessWorkouts = [];
        data.bodyMetrics = service.normalizeBodyMetrics(data.bodyMetrics);
        data.fitnessPlans = service.normalizeFitnessPlans(data.fitnessPlans);
        renderSummary();
        renderBodyMetricList();
        renderPlanList();
        renderFitnessComingSoon();
    };

    window.openFitnessPlanModal = function openFitnessPlanModal(planId = '') {
        const service = ensureService();
        if (!service) return;
        currentFitnessPlanId = planId || null;
        const existing = currentFitnessPlanId
            ? service.findFitnessPlan(getPlans(), currentFitnessPlanId)
            : null;
        fitnessPlanDraft = existing
            ? service.normalizeFitnessPlan(JSON.parse(JSON.stringify(existing)))
            : service.createFitnessPlanDraft();
        renderPlanEditor();
        document.getElementById('fitness-plan-modal')?.classList.add('active');
        document.getElementById('fitness-plan-name')?.focus();
    };

    window.closeFitnessPlanModal = function closeFitnessPlanModal() {
        document.getElementById('fitness-plan-modal')?.classList.remove('active');
        currentFitnessPlanId = null;
        fitnessPlanDraft = null;
    };

    window.toggleFitnessPlanWeekday = function toggleFitnessPlanWeekday(value, checked) {
        const draft = ensurePlanDraft();
        if (!draft) return;
        const day = Number(value);
        const set = new Set(draft.weekdays || []);
        if (checked) set.add(day);
        else set.delete(day);
        draft.weekdays = Array.from(set);
    };

    window.addFitnessPlanDay = function addFitnessPlanDay() {
        const service = ensureService();
        const draft = ensurePlanDraft();
        if (!service || !draft) return;
        const index = draft.days.length + 1;
        draft.days.push(service.normalizePlanDay({
            name: String.fromCharCode(64 + Math.min(index, 26)) + ' 日',
            exercises: [{ name: '', targetSets: 3, targetReps: '8-12' }]
        }, {}, draft.days.length));
        renderPlanEditor();
    };

    window.removeFitnessPlanDay = function removeFitnessPlanDay(dayIndex) {
        const draft = ensurePlanDraft();
        if (!draft || draft.days.length <= 1) return;
        draft.days.splice(dayIndex, 1);
        renderPlanEditor();
    };

    window.updateFitnessPlanDayName = function updateFitnessPlanDayName(dayIndex, value) {
        const draft = ensurePlanDraft();
        if (!draft?.days?.[dayIndex]) return;
        draft.days[dayIndex].name = value;
    };

    window.addFitnessPlanExercise = function addFitnessPlanExercise(dayIndex) {
        const service = ensureService();
        const draft = ensurePlanDraft();
        if (!service || !draft?.days?.[dayIndex]) return;
        if (!Array.isArray(draft.days[dayIndex].exercises)) draft.days[dayIndex].exercises = [];
        draft.days[dayIndex].exercises.push(service.normalizeExercise({
            name: '',
            targetSets: 3,
            targetReps: '8-12'
        }));
        renderPlanEditor();
    };

    window.removeFitnessPlanExercise = function removeFitnessPlanExercise(dayIndex, exerciseIndex) {
        const draft = ensurePlanDraft();
        if (!draft?.days?.[dayIndex]?.exercises) return;
        draft.days[dayIndex].exercises.splice(exerciseIndex, 1);
        renderPlanEditor();
    };

    window.updateFitnessPlanExercise = function updateFitnessPlanExercise(dayIndex, exerciseIndex, field, value) {
        const draft = ensurePlanDraft();
        if (!draft?.days?.[dayIndex]?.exercises?.[exerciseIndex]) return;
        draft.days[dayIndex].exercises[exerciseIndex][field] = value;
    };

    window.saveFitnessPlan = function saveFitnessPlan() {
        const service = ensureService();
        const draft = ensurePlanDraft();
        if (!service || !draft) return;
        const input = {
            ...draft,
            name: document.getElementById('fitness-plan-name')?.value || '',
            goal: document.getElementById('fitness-plan-goal')?.value || 'general',
            status: document.getElementById('fitness-plan-status')?.value || 'active',
            notes: document.getElementById('fitness-plan-notes')?.value || ''
        };
        const result = service.upsertFitnessPlan(getPlans(), input, currentFitnessPlanId || '');
        if (!result.ok) {
            alert(result.message || '保存失败');
            return;
        }
        data.fitnessPlans = result.plans;
        if (typeof saveData === 'function' && !saveData()) return;
        closeFitnessPlanModal();
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
    };

    window.deleteCurrentFitnessPlan = function deleteCurrentFitnessPlan() {
        const service = ensureService();
        if (!service || !currentFitnessPlanId) return;
        if (!confirm('确定删除这个训练计划吗？')) return;
        if (typeof markDeletedItem === 'function') {
            markDeletedItem('fitnessPlans', currentFitnessPlanId, { reason: 'manual-delete' });
        }
        data.fitnessPlans = service.removeFitnessPlan(getPlans(), currentFitnessPlanId);
        if (typeof saveData === 'function' && !saveData()) return;
        closeFitnessPlanModal();
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
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
