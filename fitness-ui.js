(function () {
    let currentBodyMetricId = null;
    let currentFitnessPlanId = null;
    let currentFitnessWorkoutId = null;
    let currentExerciseLibraryId = null;
    let fitnessPlanDraft = null;
    let fitnessWorkoutDraft = null;
    let liveWorkoutDraft = null;
    let liveWorkoutId = null;
    let libraryPicker = null;
    let fitnessService = null;
    let restTimer = {
        remaining: 0,
        total: 0,
        intervalId: null,
        exerciseName: ''
    };

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

    function getWorkouts() {
        if (!Array.isArray(data.fitnessWorkouts)) data.fitnessWorkouts = [];
        return data.fitnessWorkouts;
    }

    function getLibrary(options = {}) {
        const service = ensureService();
        if (!Array.isArray(data.exerciseLibrary)) data.exerciseLibrary = [];
        if (!service) return data.exerciseLibrary;
        const seedDefaults = options.seedDefaults !== false;
        const before = JSON.stringify(data.exerciseLibrary);
        data.exerciseLibrary = seedDefaults
            ? service.ensureExerciseLibrary(data.exerciseLibrary, getWorkouts())
            : service.normalizeExerciseLibrary(data.exerciseLibrary);
        if (options.persist && before !== JSON.stringify(data.exerciseLibrary) && typeof saveData === 'function') {
            saveData();
        }
        return data.exerciseLibrary;
    }

    function persistWorkouts(workouts) {
        data.fitnessWorkouts = workouts;
        return typeof saveData === 'function' ? saveData() : true;
    }

    function persistLibrary(library) {
        data.exerciseLibrary = library;
        return typeof saveData === 'function' ? saveData() : true;
    }

    function formatClock(totalSec = 0) {
        const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return `${m}:${s}`;
    }

    function stopRestTimer(clearUi = true) {
        if (restTimer.intervalId) {
            clearInterval(restTimer.intervalId);
            restTimer.intervalId = null;
        }
        restTimer.remaining = 0;
        restTimer.total = 0;
        restTimer.exerciseName = '';
        if (clearUi) renderRestTimerBar();
    }

    function renderRestTimerBar() {
        const bar = document.getElementById('fitness-rest-timer');
        if (!bar) return;
        if (!restTimer.remaining && !restTimer.intervalId) {
            bar.classList.remove('active');
            bar.innerHTML = '';
            return;
        }
        const progress = restTimer.total > 0
            ? Math.max(0, Math.min(100, (restTimer.remaining / restTimer.total) * 100))
            : 0;
        bar.classList.add('active');
        bar.innerHTML = `
            <div class="fitness-rest-timer-main">
                <div>
                    <div class="fitness-rest-timer-kicker">组间休息${restTimer.exerciseName ? ` · ${safeHtml(restTimer.exerciseName)}` : ''}</div>
                    <div class="fitness-rest-timer-clock">${formatClock(restTimer.remaining)}</div>
                </div>
                <div class="fitness-rest-timer-actions">
                    <button type="button" class="btn btn-secondary todo-mini-btn" onclick="adjustFitnessRestTimer(-15)">-15s</button>
                    <button type="button" class="btn btn-secondary todo-mini-btn" onclick="adjustFitnessRestTimer(15)">+15s</button>
                    <button type="button" class="btn btn-primary todo-mini-btn" onclick="skipFitnessRestTimer()">跳过</button>
                </div>
            </div>
            <div class="fitness-rest-timer-track">
                <div class="fitness-rest-timer-fill" style="width:${progress}%"></div>
            </div>
        `;
    }

    function startRestTimer(seconds = 90, exerciseName = '') {
        stopRestTimer(false);
        const total = Math.max(0, Number(seconds) || 0);
        if (!total) {
            renderRestTimerBar();
            return;
        }
        restTimer.total = total;
        restTimer.remaining = total;
        restTimer.exerciseName = exerciseName || '';
        renderRestTimerBar();
        restTimer.intervalId = setInterval(() => {
            restTimer.remaining -= 1;
            if (restTimer.remaining <= 0) {
                stopRestTimer(false);
                restTimer.remaining = 0;
                renderRestTimerBar();
                return;
            }
            renderRestTimerBar();
        }, 1000);
    }

    window.adjustFitnessRestTimer = function adjustFitnessRestTimer(delta = 0) {
        if (!restTimer.total && !restTimer.remaining) return;
        restTimer.remaining = Math.max(0, restTimer.remaining + Number(delta || 0));
        restTimer.total = Math.max(restTimer.total, restTimer.remaining);
        if (restTimer.remaining <= 0) stopRestTimer();
        else renderRestTimerBar();
    };

    window.skipFitnessRestTimer = function skipFitnessRestTimer() {
        stopRestTimer();
    };

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

    function renderOverviewPanel() {
        const service = ensureService();
        const container = document.getElementById('fitness-overview');
        if (!service || !container) return;
        const overview = service.buildFitnessOverview({
            bodyMetrics: getMetrics(),
            fitnessPlans: getPlans(),
            fitnessWorkouts: getWorkouts()
        });
        const suggestion = overview.suggestion;
        const latestWorkout = overview.latestWorkout;
        const activeWorkout = service.findActiveWorkout(getWorkouts());
        let actionHtml = '';
        if (activeWorkout) {
            actionHtml = `<button class="btn btn-primary" onclick="resumeLiveWorkout(${safeJs(activeWorkout.id)})">继续训练：${safeHtml(service.getWorkoutTitle(activeWorkout))}</button>`;
        } else if (suggestion) {
            actionHtml = `<button class="btn btn-primary" onclick="startLiveWorkoutFromPlan(${safeJs(suggestion.plan.id)})">按计划开练：${safeHtml(suggestion.plan.name)}</button>`;
        } else {
            actionHtml = `<button class="btn btn-primary" onclick="startFreeLiveWorkout()">自由开练</button>`;
        }
        container.innerHTML = `
            <div class="fitness-overview-card">
                <div class="fitness-overview-copy">
                    <div class="fitness-overview-kicker">今日状态</div>
                    <div class="fitness-overview-title">
                        ${activeWorkout
                            ? `训练进行中：${safeHtml(service.getWorkoutTitle(activeWorkout))} · ${service.countCompletedSets(activeWorkout)}/${service.countTotalSets(activeWorkout)} 组`
                            : (overview.workoutSummary.todayCount
                                ? `今天已有 ${overview.workoutSummary.todayCount} 条训练记录`
                                : (suggestion ? '今天还没开练，可以直接按计划开始' : '还没有训练安排，先建计划或自由开练'))}
                    </div>
                    <div class="fitness-overview-meta">
                        <span class="fitness-meta-pill">近 30 天 ${overview.workoutSummary.doneCount} 次</span>
                        <span class="fitness-meta-pill">连续 ${overview.workoutSummary.streak} 天</span>
                        <span class="fitness-meta-pill">计划 ${overview.activePlanCount}</span>
                        <span class="fitness-meta-pill">体重 ${safeHtml(service.formatMetricValue(overview.latestMetric?.weight, 'kg'))}</span>
                    </div>
                    ${latestWorkout ? `<div class="fitness-overview-note">最近：${safeHtml(formatDateLabel(latestWorkout.date))} · ${safeHtml(service.getWorkoutTitle(latestWorkout))}</div>` : ''}
                </div>
                <div class="fitness-overview-actions">
                    ${actionHtml}
                    <div class="fitness-overview-secondary">
                        <button class="btn btn-secondary" onclick="openBodyMetricModal()">记录身材</button>
                        <button class="btn btn-secondary" onclick="openFitnessPlanModal()">管理计划</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderSummary() {
        const service = ensureService();
        const container = document.getElementById('fitness-summary');
        if (!service || !container) return;
        const overview = service.buildFitnessOverview({
            bodyMetrics: getMetrics(),
            fitnessPlans: getPlans(),
            fitnessWorkouts: getWorkouts()
        });
        const summary = overview.metricSummary;
        const workoutSummary = overview.workoutSummary;
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
                    <div class="fitness-stat-label">近 30 天训练</div>
                    <div class="fitness-stat-value">${workoutSummary.doneCount}</div>
                    <div class="fitness-stat-sub">计划中 ${workoutSummary.plannedCount} · 连续 ${workoutSummary.streak} 天</div>
                </div>
                <div class="fitness-stat-card">
                    <div class="fitness-stat-label">进行中计划</div>
                    <div class="fitness-stat-value">${overview.activePlanCount}</div>
                    <div class="fitness-stat-sub">全部计划 ${overview.planCount}</div>
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

    function renderWorkoutList() {
        const service = ensureService();
        const container = document.getElementById('fitness-workout-list');
        if (!service || !container) return;
        const workouts = service.normalizeFitnessWorkouts(getWorkouts());
        if (!workouts.length) {
            container.innerHTML = `
                <div class="empty-state">
                    还没有训练日志。可以从训练计划一键开练，也可以直接自由开练。
                </div>
            `;
            return;
        }
        container.innerHTML = workouts.map(workout => {
            const doneSets = service.countCompletedSets(workout);
            const totalSets = service.countTotalSets(workout);
            const exerciseNames = (workout.exercises || []).map(item => item.name).filter(Boolean).slice(0, 4).join('、');
            const isLive = workout.status === 'inProgress';
            const openAction = isLive
                ? `resumeLiveWorkout(${safeJs(workout.id)})`
                : `openFitnessWorkoutModal(${safeJs(workout.id)})`;
            return `
                <article class="fitness-workout-card ${isLive ? 'is-live' : ''}" onclick="${openAction}">
                    <div class="fitness-plan-head">
                        <div>
                            <div class="fitness-plan-name">${safeHtml(service.getWorkoutTitle(workout))}</div>
                            <div class="fitness-plan-meta">
                                ${safeHtml(formatDateLabel(workout.date))} · ${safeHtml(service.getWorkoutStatusLabel(workout.status))}
                            </div>
                        </div>
                        <div class="fitness-plan-primary">
                            <strong>${doneSets}/${totalSets}</strong>
                            <span>完成组数</span>
                        </div>
                    </div>
                    <div class="fitness-chip-row">
                        <span class="fitness-chip">动作 <strong>${(workout.exercises || []).length}</strong></span>
                        ${workout.durationMin ? `<span class="fitness-chip">时长 <strong>${workout.durationMin} 分</strong></span>` : ''}
                        ${isLive ? '<span class="fitness-chip fitness-chip-live">训练中</span>' : ''}
                    </div>
                    ${exerciseNames ? `<div class="fitness-metric-note">${safeHtml(exerciseNames)}${(workout.exercises || []).length > 4 ? '…' : ''}</div>` : ''}
                    ${workout.notes ? `<div class="fitness-metric-note">${safeHtml(workout.notes)}</div>` : ''}
                    ${isLive ? `<div class="fitness-plan-day-actions"><button type="button" class="btn btn-primary todo-mini-btn" onclick="event.stopPropagation(); resumeLiveWorkout(${safeJs(workout.id)})">继续训练</button></div>` : ''}
                </article>
            `;
        }).join('');
    }

    function renderExerciseLibraryInto(container) {
        const service = ensureService();
        if (!service || !container) return;
        const library = getLibrary({ seedDefaults: true, persist: true });
        const pickerMode = libraryPicker?.mode || 'manage';
        if (!library.length) {
            container.innerHTML = `
                <div class="empty-state">
                    动作库还是空的，先新建几个常用动作。
                    <div style="margin-top:10px;">
                        <button type="button" class="btn btn-secondary todo-mini-btn" onclick="openExerciseLibraryItemModal()">+ 新建动作</button>
                    </div>
                </div>
            `;
            return;
        }
        container.innerHTML = library.map(item => {
            const action = pickerMode === 'manage'
                ? `openExerciseLibraryItemModal(${safeJs(item.id)})`
                : `pickExerciseFromLibrary(${safeJs(item.id)})`;
            const actionLabel = pickerMode === 'manage' ? '编辑' : '添加';
            return `
                <article class="fitness-library-card" onclick="${action}">
                    <div class="fitness-plan-head">
                        <div>
                            <div class="fitness-plan-name">${safeHtml(item.name)}</div>
                            <div class="fitness-plan-meta">${safeHtml(service.getMuscleLabel(item.muscle))}</div>
                        </div>
                        <div class="fitness-plan-primary">
                            <strong>${item.defaultSets}</strong>
                            <span>默认组</span>
                        </div>
                    </div>
                    <div class="fitness-chip-row">
                        <span class="fitness-chip">次数 <strong>${safeHtml(item.defaultReps || '—')}</strong></span>
                        <span class="fitness-chip">休息 <strong>${item.restSec || 0}s</strong></span>
                        ${item.defaultWeight != null ? `<span class="fitness-chip">重量 <strong>${item.defaultWeight}kg</strong></span>` : ''}
                        <span class="fitness-chip fitness-chip-live">${actionLabel}</span>
                    </div>
                </article>
            `;
        }).join('');
    }

    function renderExerciseLibraryList() {
        renderExerciseLibraryInto(document.getElementById('fitness-modal-library-list'));
        const titleEl = document.getElementById('fitness-library-modal-title');
        const hintEl = document.getElementById('fitness-library-modal-hint');
        const createBtn = document.getElementById('fitness-library-create-btn');
        const mode = libraryPicker?.mode || 'manage';
        if (titleEl) {
            titleEl.textContent = mode === 'manage'
                ? '动作库'
                : (mode === 'plan' ? '从动作库加入计划' : '从动作库加入本场训练');
        }
        if (hintEl) {
            hintEl.textContent = mode === 'manage'
                ? '管理常用动作，计划与开练时都可以直接选用。'
                : '点选动作即可加入，也可先新建动作。';
        }
        if (createBtn) createBtn.style.display = '';
    }

    function renderPlanList() {
        const service = ensureService();
        const container = document.getElementById('fitness-plan-list');
        if (!service || !container) return;
        const plans = service.normalizeFitnessPlans(getPlans());
        if (!plans.length) {
            container.innerHTML = `
                <div class="empty-state">
                    还没有训练计划。建一个「推拉腿」或「全身训练」，开练时直接选计划即可。
                </div>
            `;
            return;
        }
        container.innerHTML = plans.map(plan => {
            const exercises = service.getPlanExercises(plan);
            const exerciseCount = exercises.length;
            const tags = exercises.slice(0, 5).map(item => `
                <span class="fitness-exercise-tag">${safeHtml(item.name)}</span>
            `).join('');
            const moreCount = Math.max(0, exerciseCount - 5);
            return `
                <article class="fitness-plan-card">
                    <div class="fitness-plan-head" onclick="openFitnessPlanModal(${safeJs(plan.id)})">
                        <div>
                            <div class="fitness-plan-name-row">
                                <div class="fitness-plan-name">${safeHtml(plan.name)}</div>
                                <span class="fitness-status-badge status-${safeHtml(plan.status || 'active')}">${safeHtml(service.getPlanStatusLabel(plan.status))}</span>
                            </div>
                            <div class="fitness-plan-meta">${safeHtml(service.getPlanGoalLabel(plan.goal))} · ${exerciseCount} 个动作</div>
                        </div>
                        <div class="fitness-plan-primary">
                            <strong>${exerciseCount}</strong>
                            <span>动作</span>
                        </div>
                    </div>
                    <div class="fitness-exercise-tag-row" onclick="openFitnessPlanModal(${safeJs(plan.id)})">
                        ${tags || '<span class="fitness-exercise-tag is-empty">暂无动作</span>'}
                        ${moreCount ? `<span class="fitness-exercise-tag is-more">+${moreCount}</span>` : ''}
                    </div>
                    ${plan.notes ? `<div class="fitness-metric-note" onclick="openFitnessPlanModal(${safeJs(plan.id)})">${safeHtml(plan.notes)}</div>` : ''}
                    <div class="fitness-plan-card-actions">
                        <button type="button" class="btn btn-primary" onclick="event.stopPropagation(); startLiveWorkoutFromPlan(${safeJs(plan.id)})">开练</button>
                        <button type="button" class="btn btn-secondary" onclick="event.stopPropagation(); openFitnessPlanModal(${safeJs(plan.id)})">编辑</button>
                    </div>
                </article>
            `;
        }).join('');
    }

    function ensurePlanDraft() {
        const service = ensureService();
        if (!service) return null;
        if (!fitnessPlanDraft) fitnessPlanDraft = service.createFitnessPlanDraft();
        if (!Array.isArray(fitnessPlanDraft.exercises)) {
            fitnessPlanDraft.exercises = service.getPlanExercises(fitnessPlanDraft);
        }
        if (!fitnessPlanDraft.exercises.length) {
            fitnessPlanDraft.exercises = [{
                id: (typeof genId === 'function' ? genId() : `ex-${Date.now()}`),
                name: '',
                targetSets: 3,
                targetReps: '8-12'
            }];
        }
        fitnessPlanDraft.weekdays = [];
        return fitnessPlanDraft;
    }

    function syncPlanDraftFromForm() {
        const draft = ensurePlanDraft();
        if (!draft) return null;
        const nameEl = document.getElementById('fitness-plan-name');
        const goalEl = document.getElementById('fitness-plan-goal');
        const statusEl = document.getElementById('fitness-plan-status');
        const notesEl = document.getElementById('fitness-plan-notes');
        if (nameEl) draft.name = nameEl.value || '';
        if (goalEl) draft.goal = goalEl.value || draft.goal || 'general';
        if (statusEl) draft.status = statusEl.value || draft.status || 'active';
        if (notesEl) draft.notes = notesEl.value || '';
        return draft;
    }

    function renderPlanEditor() {
        const service = ensureService();
        const editorBox = document.getElementById('fitness-plan-exercises-editor')
            || document.getElementById('fitness-plan-days-editor');
        if (!service || !editorBox) return;
        const draft = ensurePlanDraft();
        if (!draft) return;

        document.getElementById('fitness-plan-modal-title').textContent = currentFitnessPlanId ? '编辑训练计划' : '新建训练计划';
        document.getElementById('fitness-plan-name').value = draft.name || '';
        document.getElementById('fitness-plan-goal').value = draft.goal || 'general';
        document.getElementById('fitness-plan-status').value = draft.status || 'active';
        document.getElementById('fitness-plan-notes').value = draft.notes || '';

const exerciseRows = (draft.exercises || []).map((exercise, exerciseIndex) => {
            const weightValue = exercise.targetWeight == null ? '' : exercise.targetWeight;
            return `
                <div class="fitness-plan-exercise-row">
                    <input type="text" list="fitness-exercise-datalist" value="${safeHtml(exercise.name)}" placeholder="动作名称" oninput="updateFitnessPlanExercise(${exerciseIndex}, 'name', this.value)" onchange="applyLibraryDefaultsToPlanExercise(${exerciseIndex}, this.value)">
                    <input type="number" min="1" step="1" value="${exercise.targetSets || 3}" placeholder="3" oninput="updateFitnessPlanExercise(${exerciseIndex}, 'targetSets', this.value)">
                    <input type="text" value="${safeHtml(exercise.targetReps || '')}" placeholder="8-12" oninput="updateFitnessPlanExercise(${exerciseIndex}, 'targetReps', this.value)">
                    <input type="number" min="0" step="0.5" value="${weightValue}" placeholder="kg" oninput="updateFitnessPlanExercise(${exerciseIndex}, 'targetWeight', this.value)">
                    <button type="button" class="btn btn-secondary fitness-icon-btn" onclick="removeFitnessPlanExercise(${exerciseIndex})" title="删除动作">&times;</button>
                </div>
            `;
        }).join('');

        editorBox.innerHTML = `
            <div class="fitness-plan-simple-editor">
                <div class="fitness-plan-exercise-list">
                    <div class="fitness-plan-exercise-head">
                        <span>动作</span>
                        <span>组</span>
                        <span>次数</span>
                        <span>目标重量</span>
                        <span></span>
                    </div>
                    ${exerciseRows || '<div class="fitness-empty compact">还没有动作，可从动作库选择，也可以手动添加。</div>'}
                </div>
                <div class="fitness-plan-day-actions">
                    <button type="button" class="btn btn-primary" onclick="openExerciseLibraryPickerForPlan()">从动作库选择</button>
                    <button type="button" class="btn btn-secondary" onclick="addFitnessPlanExercise()">手动添加</button>
                </div>
            </div>
        `;

        ensureExerciseDatalist();
        const deleteBtn = document.getElementById('delete-fitness-plan-btn');
        if (deleteBtn) deleteBtn.style.display = currentFitnessPlanId ? '' : 'none';
    }

    function ensureWorkoutDraft() {
        const service = ensureService();
        if (!service) return null;
        if (!fitnessWorkoutDraft) fitnessWorkoutDraft = service.createFitnessWorkoutDraft();
        if (!Array.isArray(fitnessWorkoutDraft.exercises) || !fitnessWorkoutDraft.exercises.length) {
            fitnessWorkoutDraft.exercises = [service.normalizeWorkoutExercise({
                name: '',
                targetSets: 3,
                targetReps: '8-12',
                sets: service.createDefaultSets(3)
            })];
        }
        fitnessWorkoutDraft.exercises.forEach(exercise => {
            if (!Array.isArray(exercise.sets) || !exercise.sets.length) {
                exercise.sets = service.createDefaultSets(exercise.targetSets || 3, exercise);
            }
        });
        return fitnessWorkoutDraft;
    }

    function renderWorkoutSourceOptions() {
        const service = ensureService();
        const planSelect = document.getElementById('fitness-workout-plan');
        const daySelect = document.getElementById('fitness-workout-day');
        if (!service || !planSelect) return;
        const plans = service.normalizeFitnessPlans(getPlans());
        const draft = ensureWorkoutDraft();
        planSelect.innerHTML = [
            '<option value="">自由训练 / 不关联计划</option>',
            ...plans.map(plan => `<option value="${safeHtml(plan.id)}">${safeHtml(plan.name)}</option>`)
        ].join('');
        planSelect.value = draft?.planId || '';
        if (daySelect) {
            daySelect.innerHTML = '<option value="">—</option>';
            daySelect.value = '';
            daySelect.disabled = true;
            const dayGroup = daySelect.closest('.form-group');
            if (dayGroup) dayGroup.style.display = 'none';
        }
        const selectedPlan = plans.find(item => item.id === planSelect.value) || null;
        if (selectedPlan && draft) {
            draft.dayId = selectedPlan.days?.[0]?.id || '';
            draft.dayName = '';
        } else if (draft) {
            draft.dayId = '';
            draft.dayName = '';
        }
    }

    function renderWorkoutEditor() {
        const service = ensureService();
        const listBox = document.getElementById('fitness-workout-exercises-editor');
        if (!service || !listBox) return;
        const draft = ensureWorkoutDraft();
        if (!draft) return;

        const statusSelect = document.getElementById('fitness-workout-status');
        if (statusSelect) {
            statusSelect.innerHTML = service.WORKOUT_STATUS_OPTIONS.map(item =>
                `<option value="${safeHtml(item.value)}">${safeHtml(item.label)}</option>`
            ).join('');
        }

        document.getElementById('fitness-workout-modal-title').textContent = currentFitnessWorkoutId ? '编辑训练日志' : '记录训练';
        document.getElementById('fitness-workout-date').value = draft.date || (typeof getTodayStr === 'function' ? getTodayStr() : '');
        document.getElementById('fitness-workout-status').value = draft.status || 'planned';
        document.getElementById('fitness-workout-title').value = draft.title || '';
        document.getElementById('fitness-workout-duration').value = draft.durationMin ?? '';
        document.getElementById('fitness-workout-notes').value = draft.notes || '';
        renderWorkoutSourceOptions();

        listBox.innerHTML = draft.exercises.map((exercise, exerciseIndex) => {
            const history = service.findLastExercisePerformance(getWorkouts(), exercise.name, currentFitnessWorkoutId || '');
            return `
            <div class="fitness-workout-exercise-editor">
                <div class="fitness-plan-day-editor-head">
                    <div class="form-group" style="flex:1;margin:0;">
                        <label>动作名称</label>
                        <input type="text" value="${safeHtml(exercise.name || '')}" placeholder="例如 深蹲" list="fitness-exercise-datalist" oninput="updateFitnessWorkoutExercise(${exerciseIndex}, 'name', this.value)">
                    </div>
                    <button type="button" class="btn btn-secondary todo-mini-btn" onclick="removeFitnessWorkoutExercise(${exerciseIndex})" ${draft.exercises.length <= 1 ? 'disabled' : ''}>删除动作</button>
                </div>
                ${history?.set ? `<div class="fitness-history-hint">上次：${safeHtml(history.workoutDate)} · ${history.set.weight ?? '—'}kg × ${history.set.reps ?? '—'}</div>` : ''}
                <div class="fitness-workout-set-list">
                    <div class="fitness-workout-set-head">
                        <span>组</span>
                        <span>重量</span>
                        <span>次数</span>
                        <span>完成</span>
                        <span></span>
                    </div>
                    ${(exercise.sets || []).map((set, setIndex) => `
                        <div class="fitness-workout-set-row">
                            <span class="fitness-set-index">${setIndex + 1}</span>
                            <input type="number" min="0" step="0.5" value="${set.weight ?? ''}" placeholder="kg" oninput="updateFitnessWorkoutSet(${exerciseIndex}, ${setIndex}, 'weight', this.value)">
                            <input type="number" min="0" step="1" value="${set.reps ?? ''}" placeholder="次" oninput="updateFitnessWorkoutSet(${exerciseIndex}, ${setIndex}, 'reps', this.value)">
                            <label class="fitness-check-chip compact">
                                <input type="checkbox" ${set.done ? 'checked' : ''} onchange="updateFitnessWorkoutSet(${exerciseIndex}, ${setIndex}, 'done', this.checked)">
                                <span>完成</span>
                            </label>
                            <button type="button" class="btn btn-secondary todo-mini-btn" onclick="removeFitnessWorkoutSet(${exerciseIndex}, ${setIndex})" ${(exercise.sets || []).length <= 1 ? 'disabled' : ''}>删</button>
                        </div>
                    `).join('')}
                </div>
                <div class="fitness-plan-day-actions">
                    <button type="button" class="btn btn-secondary todo-mini-btn" onclick="addFitnessWorkoutSet(${exerciseIndex})">+ 添加一组</button>
                    <button type="button" class="btn btn-secondary todo-mini-btn" onclick="copyLastPerformanceToExercise(${exerciseIndex})">复制上次</button>
                </div>
            </div>
        `;
        }).join('');

        ensureExerciseDatalist();
        const deleteBtn = document.getElementById('delete-fitness-workout-btn');
        if (deleteBtn) deleteBtn.style.display = currentFitnessWorkoutId ? '' : 'none';
    }

    function ensureExerciseDatalist() {
        let list = document.getElementById('fitness-exercise-datalist');
        if (!list) {
            list = document.createElement('datalist');
            list.id = 'fitness-exercise-datalist';
            document.body.appendChild(list);
        }
        list.innerHTML = getLibrary().map(item =>
            `<option value="${safeHtml(item.name)}"></option>`
        ).join('');
    }

    function ensureLiveDraft() {
        const service = ensureService();
        if (!service) return null;
        if (!liveWorkoutDraft) {
            const active = service.findActiveWorkout(getWorkouts());
            liveWorkoutDraft = active ? service.normalizeFitnessWorkout(JSON.parse(JSON.stringify(active))) : null;
            liveWorkoutId = active?.id || null;
        }
        if (!liveWorkoutDraft) return null;
        if (!Array.isArray(liveWorkoutDraft.exercises)) liveWorkoutDraft.exercises = [];
        liveWorkoutDraft.exercises.forEach(exercise => {
            if (!Array.isArray(exercise.sets) || !exercise.sets.length) {
                exercise.sets = service.createDefaultSets(exercise.targetSets || 3, exercise);
            }
        });
        return liveWorkoutDraft;
    }

    function renderLiveWorkoutSession() {
        const service = ensureService();
        const modal = document.getElementById('fitness-live-modal');
        const body = document.getElementById('fitness-live-body');
        if (!service || !modal || !body) return;
        const draft = ensureLiveDraft();
        if (!draft) {
            modal.classList.remove('active');
            return;
        }

        const doneSets = service.countCompletedSets(draft);
        const totalSets = service.countTotalSets(draft);
        const elapsed = draft.startedAt
            ? service.computeDurationMin(draft.startedAt, (typeof getLocalDateTimeStr === 'function' ? getLocalDateTimeStr() : new Date().toISOString()))
            : null;

        document.getElementById('fitness-live-modal-title').textContent = service.getWorkoutTitle(draft);
        document.getElementById('fitness-live-meta').textContent =
            `${formatDateLabel(draft.date)} · ${doneSets}/${totalSets} 组${elapsed ? ` · 已练 ${elapsed} 分` : ''}`;

        body.innerHTML = (draft.exercises || []).map((exercise, exerciseIndex) => {
            const history = service.findLastExercisePerformance(getWorkouts(), exercise.name, liveWorkoutId || '');
            const restSec = service.getExerciseRestSec(exercise, getLibrary());
            return `
                <section class="fitness-live-exercise">
                    <div class="fitness-live-exercise-head">
                        <div>
                            <div class="fitness-live-exercise-name">${safeHtml(exercise.name || '未命名动作')}</div>
                            <div class="fitness-live-exercise-meta">
                                目标 ${exercise.targetSets || (exercise.sets || []).length} 组
                                ${exercise.targetReps ? ` · ${safeHtml(exercise.targetReps)} 次` : ''}
                                ${exercise.targetWeight != null ? ` · ${exercise.targetWeight}kg` : ''}
                                · 休息 ${restSec}s
                            </div>
                            ${history?.set ? `<div class="fitness-history-hint">上次 ${safeHtml(history.workoutDate)} · ${history.set.weight ?? '—'}kg × ${history.set.reps ?? '—'}</div>` : ''}
                        </div>
                        <button type="button" class="btn btn-secondary todo-mini-btn" onclick="copyLastPerformanceToLiveExercise(${exerciseIndex})">复制上次</button>
                    </div>
                    <div class="fitness-live-set-list">
                        ${(exercise.sets || []).map((set, setIndex) => {
                            const suggestion = !set.done ? service.suggestSetValues(exercise, setIndex, history) : null;
                            return `
                                <div class="fitness-live-set-row ${set.done ? 'is-done' : ''}">
                                    <span class="fitness-set-index">${setIndex + 1}</span>
                                    <input type="number" min="0" step="0.5" value="${set.weight ?? ''}" placeholder="kg"
                                        oninput="updateLiveWorkoutSet(${exerciseIndex}, ${setIndex}, 'weight', this.value)">
                                    <input type="number" min="0" step="1" value="${set.reps ?? ''}" placeholder="次"
                                        oninput="updateLiveWorkoutSet(${exerciseIndex}, ${setIndex}, 'reps', this.value)">
                                    <button type="button" class="btn ${set.done ? 'btn-secondary' : 'btn-primary'} todo-mini-btn"
                                        onclick="toggleLiveWorkoutSetDone(${exerciseIndex}, ${setIndex})">
                                        ${set.done ? '撤销' : '完成'}
                                    </button>
                                    ${suggestion ? `<div class="fitness-set-suggestion">${safeHtml(suggestion.label)}</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="fitness-plan-day-actions">
                        <button type="button" class="btn btn-secondary todo-mini-btn" onclick="addLiveWorkoutSet(${exerciseIndex})">+ 加一组</button>
                    </div>
                </section>
            `;
        }).join('') || '<div class="empty-state">还没有动作，先从动作库加一个。</div>';

        modal.classList.add('active');
        renderRestTimerBar();
    }

    function openLiveWorkoutSession(workout, existingId = '') {
        const service = ensureService();
        if (!service || !workout) return;
        liveWorkoutDraft = service.normalizeFitnessWorkout(JSON.parse(JSON.stringify(workout)));
        liveWorkoutId = existingId || liveWorkoutDraft.id || null;
        if (!liveWorkoutDraft.startedAt) {
            liveWorkoutDraft = service.startLiveWorkout(liveWorkoutDraft);
        } else if (liveWorkoutDraft.status !== 'inProgress') {
            liveWorkoutDraft.status = 'inProgress';
        }
        renderLiveWorkoutSession();
    }

    function saveLiveWorkoutDraft(extra = {}) {
        const service = ensureService();
        const draft = ensureLiveDraft();
        if (!service || !draft) return { ok: false, message: '没有进行中的训练' };
        const payload = {
            ...draft,
            ...extra,
            status: extra.status || draft.status || 'inProgress'
        };
        const result = service.upsertFitnessWorkout(getWorkouts(), payload, liveWorkoutId || '');
        if (!result.ok) return result;
        data.fitnessWorkouts = result.workouts;
        liveWorkoutId = result.workout.id;
        liveWorkoutDraft = service.normalizeFitnessWorkout(JSON.parse(JSON.stringify(result.workout)));
        if (typeof saveData === 'function' && !saveData()) {
            return { ok: false, message: '保存失败' };
        }
        return { ok: true, workout: result.workout };
    }

    window.renderFitnessPage = function renderFitnessPage() {
        const service = ensureService();
        if (!service) return;
        if (!Array.isArray(data.bodyMetrics)) data.bodyMetrics = [];
        if (!Array.isArray(data.fitnessPlans)) data.fitnessPlans = [];
        if (!Array.isArray(data.fitnessWorkouts)) data.fitnessWorkouts = [];
        if (!Array.isArray(data.exerciseLibrary)) data.exerciseLibrary = [];
        data.bodyMetrics = service.normalizeBodyMetrics(data.bodyMetrics);
        data.fitnessPlans = service.normalizeFitnessPlans(data.fitnessPlans);
        data.fitnessWorkouts = service.normalizeFitnessWorkouts(data.fitnessWorkouts);
        getLibrary({ seedDefaults: true, persist: true });
        renderOverviewPanel();
        renderSummary();
        renderBodyMetricList();
        renderPlanList();
        renderWorkoutList();
        renderExerciseLibraryList();
        ensureExerciseDatalist();
    };

    window.getFitnessDashboardSnippet = function getFitnessDashboardSnippet() {
        const service = ensureService();
        if (!service) {
            return {
                weightText: '—',
                workoutText: '0',
                planText: '0',
                streakText: '0',
                latestText: '暂无训练记录',
                suggestion: null
            };
        }
        const overview = service.buildFitnessOverview({
            bodyMetrics: getMetrics(),
            fitnessPlans: getPlans(),
            fitnessWorkouts: getWorkouts()
        });
        return {
            weightText: service.formatMetricValue(overview.latestMetric?.weight, 'kg'),
            workoutText: String(overview.workoutSummary.doneCount),
            planText: String(overview.activePlanCount),
            streakText: String(overview.workoutSummary.streak),
            latestText: overview.latestWorkout
                ? `${formatDateLabel(overview.latestWorkout.date)} · ${service.getWorkoutTitle(overview.latestWorkout)}`
                : '暂无训练记录',
            suggestion: overview.suggestion
                ? {
                    planId: overview.suggestion.plan.id,
                    label: overview.suggestion.plan.name
                }
                : null
        };
    };

    window.openFitnessWorkoutModal = function openFitnessWorkoutModal(workoutId = '') {
        const service = ensureService();
        if (!service) return;
        currentFitnessWorkoutId = workoutId || null;
        const existing = currentFitnessWorkoutId
            ? service.findFitnessWorkout(getWorkouts(), currentFitnessWorkoutId)
            : null;
        fitnessWorkoutDraft = existing
            ? service.normalizeFitnessWorkout(JSON.parse(JSON.stringify(existing)))
            : service.createFitnessWorkoutDraft();
        renderWorkoutEditor();
        document.getElementById('fitness-workout-modal')?.classList.add('active');
        document.getElementById('fitness-workout-title')?.focus();
    };

    window.closeFitnessWorkoutModal = function closeFitnessWorkoutModal() {
        document.getElementById('fitness-workout-modal')?.classList.remove('active');
        currentFitnessWorkoutId = null;
        fitnessWorkoutDraft = null;
    };

    window.startWorkoutFromPlanDay = function startWorkoutFromPlanDay(planId = '', dayId = '') {
        startLiveWorkoutFromPlan(planId);
    };

    window.startLiveWorkoutFromPlanDay = function startLiveWorkoutFromPlanDay(planId = '', dayId = '') {
        startLiveWorkoutFromPlan(planId);
    };

    window.startLiveWorkoutFromPlan = function startLiveWorkoutFromPlan(planId = '') {
        const service = ensureService();
        if (!service) return;
        const active = service.findActiveWorkout(getWorkouts());
        if (active && !confirm(`已有进行中的训练「${service.getWorkoutTitle(active)}」。要先继续它，还是新开一场？\n确定=新开，取消=继续旧的`)) {
            resumeLiveWorkout(active.id);
            return;
        }
        const plan = service.findFitnessPlan(getPlans(), planId);
        if (!plan) {
            alert('找不到对应的训练计划');
            return;
        }
        if (!service.getPlanExercises(plan).length) {
            alert('这个计划还没有动作');
            return;
        }
        const workout = service.startLiveWorkout(service.createWorkoutFromPlan(plan));
        const result = service.upsertFitnessWorkout(getWorkouts(), workout, '');
        if (!result.ok) {
            alert(result.message || '开练失败');
            return;
        }
        if (!persistWorkouts(result.workouts)) return;
        openLiveWorkoutSession(result.workout, result.workout.id);
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
    };

    window.startFreeLiveWorkout = function startFreeLiveWorkout() {
        const service = ensureService();
        if (!service) return;
        const active = service.findActiveWorkout(getWorkouts());
        if (active && !confirm(`已有进行中的训练「${service.getWorkoutTitle(active)}」。要先继续它，还是新开一场？\n确定=新开，取消=继续旧的`)) {
            resumeLiveWorkout(active.id);
            return;
        }
        const library = getLibrary();
        const seedExercises = library.slice(0, 1).map(item => service.createWorkoutExerciseFromLibrary(item));
        const workout = service.startLiveWorkout(service.createFitnessWorkoutDraft({
            title: '自由训练',
            exercises: seedExercises.length
                ? seedExercises
                : [service.normalizeWorkoutExercise({ name: '', targetSets: 3, targetReps: '8-12', sets: service.createDefaultSets(3) })]
        }));
        const result = service.upsertFitnessWorkout(getWorkouts(), workout, '');
        if (!result.ok) {
            alert(result.message || '开练失败');
            return;
        }
        if (!persistWorkouts(result.workouts)) return;
        openLiveWorkoutSession(result.workout, result.workout.id);
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
    };

    window.resumeLiveWorkout = function resumeLiveWorkout(workoutId = '') {
        const service = ensureService();
        if (!service) return;
        const workout = service.findFitnessWorkout(getWorkouts(), workoutId)
            || service.findActiveWorkout(getWorkouts());
        if (!workout) {
            alert('没有找到进行中的训练');
            return;
        }
        const live = workout.status === 'inProgress'
            ? workout
            : service.startLiveWorkout(workout);
        if (live.status === 'inProgress' && workout.status !== 'inProgress') {
            const result = service.upsertFitnessWorkout(getWorkouts(), live, workout.id);
            if (!result.ok || !persistWorkouts(result.workouts)) return;
            openLiveWorkoutSession(result.workout, result.workout.id);
        } else {
            openLiveWorkoutSession(live, workout.id);
        }
        renderFitnessPage();
    };

    window.closeLiveWorkoutModal = function closeLiveWorkoutModal(force = false) {
        const draft = ensureLiveDraft();
        if (draft && !force) {
            const saved = saveLiveWorkoutDraft();
            if (!saved.ok) {
                alert(saved.message || '保存训练进度失败');
                return;
            }
        }
        document.getElementById('fitness-live-modal')?.classList.remove('active');
        stopRestTimer();
        liveWorkoutDraft = null;
        // keep liveWorkoutId? no — clear session UI state
        liveWorkoutId = null;
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
    };

    window.updateLiveWorkoutSet = function updateLiveWorkoutSet(exerciseIndex, setIndex, field, value) {
        const draft = ensureLiveDraft();
        if (!draft?.exercises?.[exerciseIndex]?.sets?.[setIndex]) return;
        draft.exercises[exerciseIndex].sets[setIndex][field] = value;
    };

    window.addLiveWorkoutSet = function addLiveWorkoutSet(exerciseIndex) {
        const service = ensureService();
        const draft = ensureLiveDraft();
        if (!service || !draft?.exercises?.[exerciseIndex]) return;
        const exercise = draft.exercises[exerciseIndex];
        if (!Array.isArray(exercise.sets)) exercise.sets = [];
        const last = exercise.sets[exercise.sets.length - 1] || {};
        exercise.sets.push(service.normalizeWorkoutSet({
            weight: last.weight,
            reps: last.reps,
            done: false
        }));
        renderLiveWorkoutSession();
    };

    window.toggleLiveWorkoutSetDone = function toggleLiveWorkoutSetDone(exerciseIndex, setIndex) {
        const service = ensureService();
        const draft = ensureLiveDraft();
        if (!service || !draft?.exercises?.[exerciseIndex]?.sets?.[setIndex]) return;
        const set = draft.exercises[exerciseIndex].sets[setIndex];
        if (set.done) {
            set.done = false;
            const saved = saveLiveWorkoutDraft();
            if (!saved.ok) {
                alert(saved.message || '保存失败');
                return;
            }
            renderLiveWorkoutSession();
            return;
        }
        const history = service.findLastExercisePerformance(getWorkouts(), draft.exercises[exerciseIndex].name, liveWorkoutId || '');
        const result = service.completeWorkoutSet(draft, exerciseIndex, setIndex, {
            history,
            library: getLibrary(),
            weight: document.querySelectorAll('.fitness-live-exercise')[exerciseIndex]
                ?.querySelectorAll('.fitness-live-set-row')[setIndex]
                ?.querySelector('input[type="number"]')?.value,
            reps: document.querySelectorAll('.fitness-live-exercise')[exerciseIndex]
                ?.querySelectorAll('.fitness-live-set-row')[setIndex]
                ?.querySelectorAll('input[type="number"]')[1]?.value
        });
        if (!result.ok) {
            alert(result.message || '完成组失败');
            return;
        }
        liveWorkoutDraft = result.workout;
        const saved = saveLiveWorkoutDraft();
        if (!saved.ok) {
            alert(saved.message || '保存失败');
            return;
        }
        if (result.restSec > 0) {
            startRestTimer(result.restSec, draft.exercises[exerciseIndex].name || '');
        }
        renderLiveWorkoutSession();
        renderFitnessPage();
    };

    window.copyLastPerformanceToLiveExercise = function copyLastPerformanceToLiveExercise(exerciseIndex) {
        const service = ensureService();
        const draft = ensureLiveDraft();
        if (!service || !draft?.exercises?.[exerciseIndex]) return;
        const exercise = draft.exercises[exerciseIndex];
        const history = service.findLastExercisePerformance(getWorkouts(), exercise.name, liveWorkoutId || '');
        if (!history?.set && history?.targetWeight == null) {
            alert('还没有这个动作的历史成绩');
            return;
        }
        exercise.sets = (exercise.sets || []).map((set, setIndex) => {
            if (set.done) return set;
            if (history.doneSets?.[setIndex]) {
                return service.normalizeWorkoutSet({
                    ...set,
                    weight: history.doneSets[setIndex].weight,
                    reps: history.doneSets[setIndex].reps,
                    done: false
                });
            }
            const suggestion = service.suggestSetValues(exercise, setIndex, history);
            return service.applySuggestionToSet(set, suggestion);
        });
        renderLiveWorkoutSession();
    };

    window.copyLastPerformanceToExercise = function copyLastPerformanceToExercise(exerciseIndex) {
        const service = ensureService();
        const draft = ensureWorkoutDraft();
        if (!service || !draft?.exercises?.[exerciseIndex]) return;
        const exercise = draft.exercises[exerciseIndex];
        const history = service.findLastExercisePerformance(getWorkouts(), exercise.name, currentFitnessWorkoutId || '');
        if (!history?.set && history?.targetWeight == null) {
            alert('还没有这个动作的历史成绩');
            return;
        }
        exercise.sets = (exercise.sets || []).map((set, setIndex) => {
            if (history.doneSets?.[setIndex]) {
                return service.normalizeWorkoutSet({
                    ...set,
                    weight: history.doneSets[setIndex].weight,
                    reps: history.doneSets[setIndex].reps
                });
            }
            const suggestion = service.suggestSetValues(exercise, setIndex, history);
            return service.applySuggestionToSet(set, suggestion);
        });
        renderWorkoutEditor();
    };

    window.addLiveExerciseFromLibrary = function addLiveExerciseFromLibrary() {
        openExerciseLibraryPickerForLive();
    };

    window.finishLiveWorkout = function finishLiveWorkout() {
        const service = ensureService();
        const draft = ensureLiveDraft();
        if (!service || !draft) return;
        const doneSets = service.countCompletedSets(draft);
        if (!doneSets && !confirm('还没有任何完成组，确定结束本场训练吗？')) return;
        const notes = document.getElementById('fitness-live-notes')?.value || draft.notes || '';
        const finished = service.finishLiveWorkout(draft, { notes });
        const result = service.upsertFitnessWorkout(getWorkouts(), finished, liveWorkoutId || '');
        if (!result.ok) {
            alert(result.message || '结束训练失败');
            return;
        }
        if (!persistWorkouts(result.workouts)) return;
        stopRestTimer();
        document.getElementById('fitness-live-modal')?.classList.remove('active');
        liveWorkoutDraft = null;
        liveWorkoutId = null;
        alert(`训练完成！共完成 ${service.countCompletedSets(result.workout)} 组${result.workout.durationMin ? `，用时 ${result.workout.durationMin} 分钟` : ''}`);
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
    };

    window.openExerciseLibraryModal = function openExerciseLibraryModal(options = {}) {
        const service = ensureService();
        if (!service) return;
        libraryPicker = {
            mode: options.mode || 'manage',
            dayIndex: Number.isInteger(options.dayIndex) ? options.dayIndex : null
        };
        getLibrary({ seedDefaults: true, persist: true });
        renderExerciseLibraryList();
        document.getElementById('fitness-library-modal')?.classList.add('active');
    };

    window.openExerciseLibraryPickerForLive = function openExerciseLibraryPickerForLive() {
        openExerciseLibraryModal({ mode: 'live' });
    };

    window.closeExerciseLibraryModal = function closeExerciseLibraryModal() {
        document.getElementById('fitness-library-modal')?.classList.remove('active');
        libraryPicker = null;
    };

    window.pickExerciseFromLibrary = function pickExerciseFromLibrary(exerciseId = '') {
        const service = ensureService();
        if (!service) return;
        const item = service.findExerciseLibraryItem(getLibrary({ seedDefaults: true }), exerciseId);
        if (!item) {
            alert('找不到这个动作');
            return;
        }
        const mode = libraryPicker?.mode || 'manage';
        if (mode === 'plan') {
            syncPlanDraftFromForm();
            const draft = ensurePlanDraft();
            if (!draft) return;
            if (!Array.isArray(draft.exercises)) draft.exercises = [];
            const nextExercise = service.normalizeExercise({
                name: item.name,
                targetSets: item.defaultSets,
                targetReps: item.defaultReps,
                targetWeight: item.defaultWeight,
                note: item.note,
                restSec: item.restSec
            });
            const emptyIndex = draft.exercises.findIndex(entry => !String(entry?.name || '').trim());
            if (emptyIndex >= 0) draft.exercises[emptyIndex] = nextExercise;
            else draft.exercises.push(nextExercise);
            closeExerciseLibraryModal();
            renderPlanEditor();
            return;
        }
        if (mode === 'live') {
            const draft = ensureLiveDraft();
            if (!draft) {
                alert('当前没有进行中的训练');
                return;
            }
            const nextExercise = service.createWorkoutExerciseFromLibrary(item);
            const emptyIndex = (draft.exercises || []).findIndex(entry => !String(entry?.name || '').trim());
            if (emptyIndex >= 0) draft.exercises[emptyIndex] = nextExercise;
            else draft.exercises.push(nextExercise);
            const saved = saveLiveWorkoutDraft();
            if (!saved.ok) {
                alert(saved.message || '保存失败');
                return;
            }
            closeExerciseLibraryModal();
            renderLiveWorkoutSession();
            return;
        }
        openExerciseLibraryItemModal(exerciseId);
    };

    window.applyLibraryDefaultsToPlanExercise = function applyLibraryDefaultsToPlanExercise(exerciseIndex, name = '') {
        const service = ensureService();
        const draft = ensurePlanDraft();
        if (!service || !draft?.exercises?.[exerciseIndex]) return;
        const exercise = draft.exercises[exerciseIndex];
        exercise.name = name;
        const item = service.findExerciseLibraryByName(getLibrary({ seedDefaults: false }), name);
        if (!item) return;
        if (!exercise.targetSets) exercise.targetSets = item.defaultSets;
        if (!exercise.targetReps) exercise.targetReps = item.defaultReps;
        if (exercise.targetWeight == null || exercise.targetWeight === '') {
            exercise.targetWeight = item.defaultWeight;
        }
        if (!exercise.note) exercise.note = item.note || '';
        if (exercise.restSec == null && item.restSec != null) exercise.restSec = item.restSec;
        renderPlanEditor();
    };

    window.openExerciseLibraryItemModal = function openExerciseLibraryItemModal(exerciseId = '') {
        const service = ensureService();
        if (!service) return;
        currentExerciseLibraryId = exerciseId || null;
        const existing = currentExerciseLibraryId
            ? service.findExerciseLibraryItem(getLibrary(), currentExerciseLibraryId)
            : null;
        document.getElementById('fitness-library-item-modal-title').textContent = existing ? '编辑动作' : '新建动作';
        document.getElementById('fitness-library-item-name').value = existing?.name || '';
        document.getElementById('fitness-library-item-muscle').value = existing?.muscle || 'other';
        document.getElementById('fitness-library-item-sets').value = existing?.defaultSets ?? 3;
        document.getElementById('fitness-library-item-reps').value = existing?.defaultReps || '8-12';
        document.getElementById('fitness-library-item-weight').value = existing?.defaultWeight ?? '';
        document.getElementById('fitness-library-item-rest').value = existing?.restSec ?? service.DEFAULT_REST_SEC;
        document.getElementById('fitness-library-item-note').value = existing?.note || '';
        const deleteBtn = document.getElementById('delete-fitness-library-item-btn');
        if (deleteBtn) deleteBtn.style.display = existing ? '' : 'none';
        document.getElementById('fitness-library-item-modal')?.classList.add('active');
        document.getElementById('fitness-library-item-name')?.focus();
    };

    window.closeExerciseLibraryItemModal = function closeExerciseLibraryItemModal() {
        document.getElementById('fitness-library-item-modal')?.classList.remove('active');
        currentExerciseLibraryId = null;
    };

    window.saveExerciseLibraryItem = function saveExerciseLibraryItem() {
        const service = ensureService();
        if (!service) return;
        const input = {
            name: document.getElementById('fitness-library-item-name')?.value || '',
            muscle: document.getElementById('fitness-library-item-muscle')?.value || 'other',
            defaultSets: document.getElementById('fitness-library-item-sets')?.value || 3,
            defaultReps: document.getElementById('fitness-library-item-reps')?.value || '8-12',
            defaultWeight: document.getElementById('fitness-library-item-weight')?.value || '',
            restSec: document.getElementById('fitness-library-item-rest')?.value || service.DEFAULT_REST_SEC,
            note: document.getElementById('fitness-library-item-note')?.value || ''
        };
        const result = service.upsertExerciseLibraryItem(getLibrary(), input, currentExerciseLibraryId || '');
        if (!result.ok) {
            alert(result.message || '保存失败');
            return;
        }
        if (!persistLibrary(result.library)) return;
        closeExerciseLibraryItemModal();
        renderExerciseLibraryList();
        ensureExerciseDatalist();
        renderFitnessPage();
    };

    window.deleteCurrentExerciseLibraryItem = function deleteCurrentExerciseLibraryItem() {
        const service = ensureService();
        if (!service || !currentExerciseLibraryId) return;
        if (!confirm('确定删除这个动作吗？')) return;
        if (typeof markDeletedItem === 'function') {
            markDeletedItem('exerciseLibrary', currentExerciseLibraryId, { reason: 'manual-delete' });
        }
        const next = service.removeExerciseLibraryItem(getLibrary(), currentExerciseLibraryId);
        if (!persistLibrary(next)) return;
        closeExerciseLibraryItemModal();
        renderExerciseLibraryList();
        ensureExerciseDatalist();
        renderFitnessPage();
    };

    window.onFitnessWorkoutPlanChange = function onFitnessWorkoutPlanChange() {
        const service = ensureService();
        const draft = ensureWorkoutDraft();
        if (!service || !draft) return;
        const planId = document.getElementById('fitness-workout-plan')?.value || '';
        draft.planId = planId;
        if (!planId) {
            draft.planName = '';
            draft.dayId = '';
            draft.dayName = '';
            renderWorkoutSourceOptions();
            return;
        }
        const plan = service.findFitnessPlan(getPlans(), planId);
        draft.planName = plan?.name || '';
        draft.dayId = plan?.days?.[0]?.id || '';
        draft.dayName = '';
        if (!draft.title || draft.title === '自由训练' || String(draft.title).includes('·')) {
            draft.title = plan?.name || '自由训练';
            document.getElementById('fitness-workout-title').value = draft.title;
        }
        if (plan && service.getPlanExercises(plan).length && confirm('要用该计划的动作覆盖当前编辑内容吗？')) {
            const generated = service.createWorkoutFromPlan(plan, {
                date: document.getElementById('fitness-workout-date')?.value || draft.date,
                status: document.getElementById('fitness-workout-status')?.value || draft.status,
                notes: document.getElementById('fitness-workout-notes')?.value || draft.notes,
                durationMin: document.getElementById('fitness-workout-duration')?.value || draft.durationMin
            });
            fitnessWorkoutDraft = generated;
            renderWorkoutEditor();
            return;
        }
        renderWorkoutSourceOptions();
    };

    window.onFitnessWorkoutDayChange = function onFitnessWorkoutDayChange() {
        // Training-day selector removed; keep no-op for old markup safety.
    };

    window.addFitnessWorkoutExercise = function addFitnessWorkoutExercise() {
        const service = ensureService();
        const draft = ensureWorkoutDraft();
        if (!service || !draft) return;
        draft.exercises.push(service.normalizeWorkoutExercise({
            name: '',
            targetSets: 3,
            targetReps: '8-12',
            sets: service.createDefaultSets(3)
        }));
        renderWorkoutEditor();
    };

    window.removeFitnessWorkoutExercise = function removeFitnessWorkoutExercise(exerciseIndex) {
        const draft = ensureWorkoutDraft();
        if (!draft || draft.exercises.length <= 1) return;
        draft.exercises.splice(exerciseIndex, 1);
        renderWorkoutEditor();
    };

    window.updateFitnessWorkoutExercise = function updateFitnessWorkoutExercise(exerciseIndex, field, value) {
        const draft = ensureWorkoutDraft();
        if (!draft?.exercises?.[exerciseIndex]) return;
        draft.exercises[exerciseIndex][field] = value;
    };

    window.addFitnessWorkoutSet = function addFitnessWorkoutSet(exerciseIndex) {
        const service = ensureService();
        const draft = ensureWorkoutDraft();
        if (!service || !draft?.exercises?.[exerciseIndex]) return;
        const exercise = draft.exercises[exerciseIndex];
        if (!Array.isArray(exercise.sets)) exercise.sets = [];
        const last = exercise.sets[exercise.sets.length - 1] || {};
        exercise.sets.push(service.normalizeWorkoutSet({
            weight: last.weight,
            reps: last.reps,
            done: false
        }));
        renderWorkoutEditor();
    };

    window.removeFitnessWorkoutSet = function removeFitnessWorkoutSet(exerciseIndex, setIndex) {
        const draft = ensureWorkoutDraft();
        if (!draft?.exercises?.[exerciseIndex]?.sets) return;
        if (draft.exercises[exerciseIndex].sets.length <= 1) return;
        draft.exercises[exerciseIndex].sets.splice(setIndex, 1);
        renderWorkoutEditor();
    };

    window.updateFitnessWorkoutSet = function updateFitnessWorkoutSet(exerciseIndex, setIndex, field, value) {
        const draft = ensureWorkoutDraft();
        if (!draft?.exercises?.[exerciseIndex]?.sets?.[setIndex]) return;
        draft.exercises[exerciseIndex].sets[setIndex][field] = value;
    };

    window.saveFitnessWorkout = function saveFitnessWorkout() {
        const service = ensureService();
        const draft = ensureWorkoutDraft();
        if (!service || !draft) return;
        const planId = document.getElementById('fitness-workout-plan')?.value || '';
        const plan = planId ? service.findFitnessPlan(getPlans(), planId) : null;
        const input = {
            ...draft,
            date: document.getElementById('fitness-workout-date')?.value || '',
            status: document.getElementById('fitness-workout-status')?.value || 'planned',
            title: document.getElementById('fitness-workout-title')?.value || '',
            durationMin: document.getElementById('fitness-workout-duration')?.value || '',
            notes: document.getElementById('fitness-workout-notes')?.value || '',
            planId: plan?.id || '',
            planName: plan?.name || '',
            dayId: plan?.days?.[0]?.id || '',
            dayName: ''
        };
        const result = service.upsertFitnessWorkout(getWorkouts(), input, currentFitnessWorkoutId || '');
        if (!result.ok) {
            alert(result.message || '保存失败');
            return;
        }
        data.fitnessWorkouts = result.workouts;
        if (typeof saveData === 'function' && !saveData()) return;
        closeFitnessWorkoutModal();
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
    };

    window.deleteCurrentFitnessWorkout = function deleteCurrentFitnessWorkout() {
        const service = ensureService();
        if (!service || !currentFitnessWorkoutId) return;
        if (!confirm('确定删除这条训练日志吗？')) return;
        if (typeof markDeletedItem === 'function') {
            markDeletedItem('fitnessWorkouts', currentFitnessWorkoutId, { reason: 'manual-delete' });
        }
        data.fitnessWorkouts = service.removeFitnessWorkout(getWorkouts(), currentFitnessWorkoutId);
        if (typeof saveData === 'function' && !saveData()) return;
        closeFitnessWorkoutModal();
        renderFitnessPage();
        if (typeof renderDashboard === 'function') renderDashboard();
    };

    window.openFitnessPlanModal = function openFitnessPlanModal(planId = '') {
        const service = ensureService();
        if (!service) return;
        currentFitnessPlanId = planId || null;
        const existing = currentFitnessPlanId
            ? service.findFitnessPlan(getPlans(), currentFitnessPlanId)
            : null;
        if (existing) {
            const normalized = service.normalizeFitnessPlan(JSON.parse(JSON.stringify(existing)));
            fitnessPlanDraft = {
                ...normalized,
                exercises: service.getPlanExercises(normalized).length
                    ? service.getPlanExercises(normalized)
                    : [{ id: (typeof genId === 'function' ? genId() : `ex-${Date.now()}`), name: '', targetSets: 3, targetReps: '8-12' }]
            };
        } else {
            fitnessPlanDraft = service.createFitnessPlanDraft();
        }
        renderPlanEditor();
        document.getElementById('fitness-plan-modal')?.classList.add('active');
        document.getElementById('fitness-plan-name')?.focus();
    };

    window.closeFitnessPlanModal = function closeFitnessPlanModal() {
        document.getElementById('fitness-plan-modal')?.classList.remove('active');
        currentFitnessPlanId = null;
        fitnessPlanDraft = null;
    };

    window.openExerciseLibraryPickerForPlan = function openExerciseLibraryPickerForPlan() {
        syncPlanDraftFromForm();
        openExerciseLibraryModal({ mode: 'plan' });
    };

    window.addFitnessPlanExercise = function addFitnessPlanExercise() {
        const service = ensureService();
        const draft = ensurePlanDraft();
        if (!service || !draft) return;
        if (!Array.isArray(draft.exercises)) draft.exercises = [];
        draft.exercises.push(service.normalizeExercise({
            name: '',
            targetSets: 3,
            targetReps: '8-12'
        }));
        renderPlanEditor();
    };

    window.removeFitnessPlanExercise = function removeFitnessPlanExercise(exerciseIndex) {
        const draft = ensurePlanDraft();
        if (!draft?.exercises) return;
        draft.exercises.splice(exerciseIndex, 1);
        if (!draft.exercises.length) {
            draft.exercises.push({
                id: (typeof genId === 'function' ? genId() : `ex-${Date.now()}`),
                name: '',
                targetSets: 3,
                targetReps: '8-12'
            });
        }
        renderPlanEditor();
    };

    window.updateFitnessPlanExercise = function updateFitnessPlanExercise(exerciseIndex, field, value) {
        const draft = ensurePlanDraft();
        if (!draft?.exercises?.[exerciseIndex]) return;
        draft.exercises[exerciseIndex][field] = value;
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
            notes: document.getElementById('fitness-plan-notes')?.value || '',
            weekdays: [],
            exercises: draft.exercises || []
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
