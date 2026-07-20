(function () {
    function create(options = {}) {
        const {
            todoUrgencyMeta = {},
            getTodayStr = () => new Date().toISOString().slice(0, 10),
            addDays = (date, days) => date,
            getNowLocal = () => new Date().toISOString(),
            fetchImpl = (...args) => fetch(...args)
        } = options;

        function normalizeConfig(config = {}) {
            return {
                endpointUrl: String(config.endpointUrl || '').trim(),
                apiKey: String(config.apiKey || ''),
                model: String(config.model || 'gpt-4.1-mini').trim() || 'gpt-4.1-mini',
                remoteEnabled: !!config.remoteEnabled,
                userStyle: String(config.userStyle || '')
            };
        }

        function isRemoteReady(config = {}) {
            const normalized = normalizeConfig(config);
            return !!(normalized.remoteEnabled && normalized.endpointUrl && normalized.apiKey && normalized.model);
        }

        function getChatCompletionsUrl(endpointUrl = '') {
            const clean = String(endpointUrl || '').trim().replace(/\/+$/, '');
            if (!clean) return '';
            if (/\/chat\/completions$/i.test(clean)) return clean;
            if (/\/v\d+$/i.test(clean)) return `${clean}/chat/completions`;
            return `${clean}/v1/chat/completions`;
        }

        function normalizeAiResult(result) {
            const normalizeText = value => String(value || '').trim();
            const normalized = {
                title: normalizeText(result?.title || 'AI 建议') || 'AI 建议',
                summary: normalizeText(result?.summary),
                items: Array.isArray(result?.items) ? result.items : []
            };
            const captureSource = result?.capture || result?.placement || result?.placements || {};
            normalized.capture = {
                cleanText: normalizeText(captureSource.cleanText || captureSource.cleanedText || result?.cleanText || result?.correctedText),
                diaryText: normalizeText(captureSource.diaryText || captureSource.diary || result?.diaryText),
                workText: normalizeText(captureSource.workText || captureSource.work || result?.workText),
                planText: normalizeText(captureSource.planText || captureSource.plan || result?.planText),
                ideaText: normalizeText(captureSource.ideaText || captureSource.idea || result?.ideaText),
                suggestedTargets: Array.isArray(captureSource.suggestedTargets || captureSource.targets || result?.suggestedTargets)
                    ? (captureSource.suggestedTargets || captureSource.targets || result?.suggestedTargets)
                        .map(target => normalizeText(target))
                        .filter(Boolean)
                    : []
            };
            normalized.diary = {
                oneLine: normalizeText(result?.diary?.oneLine || result?.oneLine),
                review: normalizeText(result?.diary?.review || result?.review),
                tomorrow: normalizeText(result?.diary?.tomorrow || result?.tomorrow || result?.tomorrowFocus),
                improve: normalizeText(result?.diary?.improve || result?.improve),
                thinking: normalizeText(result?.diary?.thinking || result?.thinking),
                smallJoy: normalizeText(result?.diary?.smallJoy || result?.smallJoy)
            };
            const tagSource = Array.isArray(result?.tags)
                ? result.tags
                : Array.isArray(result?.suggestedTags)
                    ? result.suggestedTags
                    : [];
            normalized.tags = tagSource
                .map(tag => {
                    if (typeof tag === 'string') {
                        return { name: normalizeText(tag), reason: '', weight: 1 };
                    }
                    return {
                        name: normalizeText(tag?.name || tag?.tag || tag?.text || tag?.title),
                        reason: normalizeText(tag?.reason || tag?.note || tag?.why),
                        weight: Math.max(1, Math.round(Number(tag?.weight) || 1))
                    };
                })
                .filter(tag => tag.name);
            normalized.items = normalized.items
                .map(item => ({
                    text: normalizeText(item?.text || item?.title),
                    note: normalizeText(item?.note || item?.reason),
                    urgency: todoUrgencyMeta[item?.urgency] ? item.urgency : 'medium',
                    group: normalizeText(item?.group || '其他') || '其他',
                    dueDate: normalizeText(item?.dueDate),
                    planStartDate: normalizeText(item?.planStartDate),
                    planEndDate: normalizeText(item?.planEndDate),
                    reason: normalizeText(item?.reason),
                    subTodos: Array.isArray(item?.subTodos)
                        ? item.subTodos.map(sub => ({ text: normalizeText(sub?.text || sub), done: !!sub?.done })).filter(sub => sub.text)
                        : []
                }))
                .filter(item => item.text);
            return normalized;
        }

        function parseAiJson(content) {
            if (typeof content === 'object' && content) return normalizeAiResult(content);
            const text = String(content || '').trim();
            try {
                return normalizeAiResult(JSON.parse(text));
            } catch (err) {
                const match = text.match(/\{[\s\S]*\}/);
                if (!match) throw new Error('AI 返回内容无法解析为 JSON');
                return normalizeAiResult(JSON.parse(match[0]));
            }
        }

        async function requestRemoteAi(config, payload) {
            const normalizedConfig = normalizeConfig(config);
            if (!isRemoteReady(normalizedConfig)) throw new Error('AI 接口未配置完整');
            const targetUrl = getChatCompletionsUrl(normalizedConfig.endpointUrl);
            const body = {
                model: normalizedConfig.model,
                temperature: 0.2,
                messages: [
                    {
                        role: 'system',
                        content: [
                            '你是一个个人规划应用里的 AI 助手。',
                            '请只返回严格 JSON，不要 Markdown。',
                            'JSON 字段：title 字符串，summary 字符串，items 数组，可选 diary 对象，可选 capture 对象，可选 tags 数组。',
                            'items 每项字段：text 字符串，note 字符串，可选 urgency/group/dueDate/planStartDate/planEndDate/subTodos/reason。',
                            'diary 可选字段：oneLine/review/tomorrow/improve/thinking/smallJoy，均为字符串。',
                            'capture 可选字段：cleanText、diaryText、workText、planText、ideaText、suggestedTargets。',
                            '当 mode 为 wheelTagSuggest 时：items 可为空；tags 返回 1-5 个推荐标签，字段 name/reason；name 必须来自 context.existingTags，禁止自造标签。',
                            '建议必须具体、短、可执行。'
                        ].join('\n')
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            ...payload,
                            userStyle: normalizedConfig.userStyle || ''
                        })
                    }
                ]
            };
            const response = await fetchImpl(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${normalizedConfig.apiKey}`
                },
                body: JSON.stringify(body)
            });
            const raw = await response.text();
            if (!response.ok) {
                throw new Error(`AI 请求失败：${response.status}${raw ? ` ${raw.slice(0, 160)}` : ''}`);
            }
            let data;
            try {
                data = JSON.parse(raw);
            } catch (err) {
                throw new Error('AI 返回不是合法 JSON');
            }
            const content = data?.choices?.[0]?.message?.content || data?.output_text || data?.content || '';
            if (!content) throw new Error('AI 返回为空');
            return parseAiJson(content);
        }

        function cleanCaptureText(text = '') {
            return String(text || '')
                .replace(/\r\n/g, '\n')
                .replace(/[ \t]+/g, ' ')
                .replace(/项把/g, '想把')
                .replace(/错别子/g, '错别字')
                .replace(/在AI/g, '再 AI')
                .replace(/AI在/g, 'AI 再')
                .replace(/\s+([，。；：！？])/g, '$1')
                .trim();
        }

        function getCaptureSentences(text = '') {
            return cleanCaptureText(text)
                .split(/[。；;！!？?\n]+/)
                .map(part => part.trim())
                .filter(Boolean);
        }

        function extractCaptureTodoItems(cleanText, today) {
            const items = [];
            const addItem = text => {
                const clean = cleanCaptureText(text).replace(/^[:：,，、\s]+/, '').slice(0, 80);
                if (clean && !items.some(item => item.text === clean)) {
                    items.push({
                        text: clean,
                        note: `来自 AI 对话整理：${cleanText.slice(0, 160)}`,
                        group: '其他',
                        urgency: 'medium',
                        dueDate: today,
                        planStartDate: today,
                        planEndDate: today
                    });
                }
            };
            const todoPattern = /(?:待办|任务|todo)[：:\s]+([^。；;！!？?\n]+)/ig;
            let match;
            while ((match = todoPattern.exec(cleanText))) addItem(match[1]);
            getCaptureSentences(cleanText)
                .filter(sentence => /(检查|处理|完成|推进|整理|修复|提交|上传|复盘)/.test(sentence) && sentence.length <= 90)
                .slice(0, 3)
                .forEach(sentence => addItem(sentence.replace(/^(还要|需要|记一个|顺手记个|明天|今天)/, '').trim()));
            return items.slice(0, 5);
        }

        function generateLocalCaptureResult(payload) {
            const today = payload.today || getTodayStr();
            const cleanText = cleanCaptureText(payload.userInput);
            if (!cleanText) {
                return normalizeAiResult({
                    title: '先说一点内容',
                    summary: '输入一段话后，我会帮你纠错、整理，并给出可确认的写入位置。',
                    capture: { cleanText: '', suggestedTargets: [] },
                    items: []
                });
            }
            const sentences = getCaptureSentences(cleanText);
            const items = extractCaptureTodoItems(cleanText, today);
            const hasWork = /(工作|项目|会议|客户|上线|提交|需求|代码|页面|AI)/i.test(cleanText);
            const hasPlan = /(今天|明天|计划|重点|安排|接下来|下周|下午|上午)/.test(cleanText);
            const hasIdea = /(想法|灵感|试试|可以|也许|可能|先放灵感|脑洞)/.test(cleanText);
            const targets = [
                items.length ? '待办' : '',
                hasWork ? '工作记录' : '',
                hasPlan ? '日计划' : '',
                '日记',
                hasIdea ? '灵感碎片' : ''
            ].filter(Boolean);
            return normalizeAiResult({
                title: '对话整理建议',
                summary: `已整理为 ${targets.join('、') || '日记'} 的候选内容，写入前仍需你确认。`,
                capture: {
                    cleanText,
                    diaryText: cleanText,
                    workText: hasWork ? cleanText : '',
                    planText: hasPlan ? sentences.filter(sentence => /(今天|明天|计划|重点|安排|接下来|下周|下午|上午)/.test(sentence)).join('\n') || cleanText : '',
                    ideaText: hasIdea ? sentences.filter(sentence => /(想法|灵感|试试|可以|也许|可能|先放灵感|脑洞)/.test(sentence)).join('\n') || cleanText : '',
                    suggestedTargets: targets
                },
                items
            });
        }

        function normalizeNameKey(value = '') {
            return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
        }

        function scoreWheelTagMatch(itemText = '', tagName = '') {
            const text = normalizeNameKey(itemText);
            const tag = normalizeNameKey(tagName);
            if (!text || !tag) return 0;
            if (text === tag) return 100;
            if (text.includes(tag)) return 80 + Math.min(tag.length, 10);
            if (tag.includes(text) && text.length >= 2) return 50;
            // Chinese/short keyword overlap without spaces.
            let overlap = 0;
            const units = tag.length <= 8 ? Array.from(tag) : tag.split(/[\s/、,，]+/).filter(Boolean);
            units.forEach(unit => {
                if (unit.length >= 2 && text.includes(unit)) overlap += unit.length >= 3 ? 12 : 8;
            });
            return overlap;
        }

        function generateLocalWheelTagSuggest(payload = {}) {
            const itemText = String(payload.userInput || payload.context?.itemText || '').trim();
            const existingTags = Array.isArray(payload.context?.existingTags) ? payload.context.existingTags : [];
            if (!itemText) {
                return normalizeAiResult({
                    title: '先填写公共项',
                    summary: '输入一条公共项内容后，再根据现有标签推荐。',
                    tags: [],
                    items: []
                });
            }
            if (!existingTags.length) {
                return normalizeAiResult({
                    title: '还没有标签',
                    summary: '请先在标签管理里新增标签，再使用 AI 推荐。',
                    tags: [],
                    items: []
                });
            }
            const ranked = existingTags
                .map(tag => {
                    const name = String(tag?.name || tag || '').trim();
                    const score = scoreWheelTagMatch(itemText, name);
                    return {
                        name,
                        reason: score >= 80
                            ? '名称直接相关'
                            : score >= 12
                                ? '关键词相近'
                                : '可选手动勾选',
                        weight: 1,
                        score
                    };
                })
                .filter(tag => tag.name)
                .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'));
            const strong = ranked.filter(tag => tag.score >= 12).slice(0, 5);
            const tags = (strong.length ? strong : ranked.slice(0, 3)).map(({ name, reason, weight }) => ({ name, reason, weight }));
            return normalizeAiResult({
                title: '公共项标签推荐',
                summary: strong.length
                    ? `本地规则从现有标签里挑了 ${tags.length} 个候选，可勾选修改后再添加。`
                    : '未找到强相关标签，先给出前几个现有标签供你挑选。',
                tags,
                items: []
            });
        }

        function generateLocalAiResult(payload) {
            const today = payload.today || getTodayStr();
            if (payload.mode === 'wheelTagSuggest') return generateLocalWheelTagSuggest(payload);
            if (payload.mode === 'chatCapture') return generateLocalCaptureResult(payload);
            if (payload.mode === 'diaryReview') {
                const diary = payload.context.selectedDiary;
                if (!diary?.content) {
                    return normalizeAiResult({ title: '暂无可分析日记', summary: '先写一点日记内容，再让 AI 做复盘和明日重点。', diary: {}, items: [] });
                }
                const tomorrow = addDays(diary.startDate || today, 1);
                const fields = diary.fields || {};
                const plain = String(diary.content || '').replace(/^#\s+/gm, '').replace(/\n{2,}/g, '\n').trim();
                const firstLine = fields.oneLine || plain.split('\n').map(line => line.trim()).find(Boolean) || diary.title || '今天值得被认真复盘';
                const review = [
                    fields.review || `今天的核心线索是：${firstLine}`,
                    fields.improve ? `可改进处：${fields.improve}` : '可以把今天最卡的一点拆小，明天先做一个能完成的版本。',
                    payload.userInput ? `你的补充要求：${payload.userInput}` : ''
                ].filter(Boolean).join('\n');
                const tomorrowFocus = fields.tomorrow || `明天先推进：${firstLine.slice(0, 42)}`;
                return normalizeAiResult({
                    title: `日记分析：${diary.title || diary.startDate || '未命名日记'}`,
                    summary: '本地规则已整理出可确认写入的复盘、明日重点和一个行动建议。',
                    diary: {
                        oneLine: fields.oneLine || firstLine.slice(0, 60),
                        review,
                        tomorrow: tomorrowFocus,
                        improve: fields.improve || '把最重要的动作缩小到明天可以直接开始。',
                        thinking: fields.thinking || ''
                    },
                    items: [{
                        text: tomorrowFocus.replace(/^明天先推进[:：]\s*/, '').slice(0, 60) || '推进明日重点',
                        note: `来自日记「${diary.title || diary.startDate || ''}」的 AI 分析`,
                        group: '其他',
                        urgency: 'medium',
                        dueDate: tomorrow,
                        planStartDate: tomorrow,
                        planEndDate: tomorrow
                    }]
                });
            }
            if (payload.mode === 'todoBreakdown') {
                const todo = payload.context.selectedTodo;
                if (!todo?.text) return { title: '暂无可拆解待办', summary: '先创建一个待办，再让 AI 拆解。', items: [] };
                const existing = (todo.subTodos || []).filter(sub => sub.text && !sub.done).map(sub => sub.text);
                const seeds = existing.length ? existing : [
                    `明确 ${todo.text} 的完成标准`,
                    `准备 ${todo.text} 需要的材料或入口`,
                    `推进 ${todo.text} 的第一步`,
                    '检查结果并记录下一步'
                ];
                return normalizeAiResult({
                    title: `拆解：${todo.text}`,
                    summary: '本地规则已把这个待办拆成可以勾选的小步。',
                    items: seeds.slice(0, 6).map(text => ({ text, note: todo.note || '来自 AI 本地规则拆解', group: todo.group || '其他', urgency: todo.urgency || 'medium' }))
                });
            }
            if (payload.mode === 'ideaNext') {
                const idea = payload.context.selectedIdea;
                if (!idea?.title && !idea?.content) return { title: '暂无可转化灵感', summary: '先记录一条灵感，再让 AI 转成行动。', items: [] };
                const name = idea.title || String(idea.content || '').slice(0, 24);
                return normalizeAiResult({
                    title: `灵感下一步：${name}`,
                    summary: '建议先做一个最小验证，避免灵感停在收藏状态。',
                    items: [{
                        text: `验证灵感：${name}`,
                        note: [idea.content, payload.userInput].filter(Boolean).join('\n\n'),
                        group: '学习',
                        urgency: 'medium',
                        dueDate: today,
                        planStartDate: today,
                        planEndDate: today,
                        subTodos: [{ text: '写下要验证的问题' }, { text: '找一个最小场景试一次' }, { text: '记录结果和是否继续' }]
                    }]
                });
            }
            const sourceTodos = [...(payload.context.overdueTodos || []), ...(payload.context.todayTodos || []), ...(payload.context.floatingTodos || [])];
            const seen = new Set();
            const picked = sourceTodos.filter(todo => {
                if (!todo?.text || seen.has(todo.id || todo.text)) return false;
                seen.add(todo.id || todo.text);
                return true;
            }).slice(0, payload.mode === 'backlogTriage' ? 5 : 4);
            if (!picked.length) {
                return normalizeAiResult({
                    title: '今日轻量计划',
                    summary: '当前没有明显待办压力，可以创建一个很小的推进动作。',
                    items: [{ text: '写下今天最重要的一件小事', note: payload.userInput || '来自 AI 本地规则建议', group: '其他', urgency: 'medium', dueDate: today, planStartDate: today, planEndDate: today }]
                });
            }
            return normalizeAiResult({
                title: payload.mode === 'backlogTriage' ? '待办整理建议' : '今日计划建议',
                summary: '本地规则按超期、紧急度和今日相关性挑选了下一步。',
                items: picked.map(todo => ({
                    text: todo.dueDate && todo.dueDate < today ? `补上：${todo.text}` : `推进：${todo.text}`,
                    note: [todo.note, payload.userInput, todo.overdueDays ? `已超期 ${todo.overdueDays} 天` : ''].filter(Boolean).join('\n'),
                    group: todo.group || '其他',
                    urgency: todo.urgency || 'medium',
                    dueDate: todo.dueDate || today,
                    planStartDate: today,
                    planEndDate: today
                }))
            });
        }

        return {
            normalizeConfig,
            isRemoteReady,
            getChatCompletionsUrl,
            requestRemoteAi,
            parseAiJson,
            normalizeAiResult,
            cleanCaptureText,
            getCaptureSentences,
            extractCaptureTodoItems,
            generateLocalCaptureResult,
            generateLocalWheelTagSuggest,
            generateLocalAiResult
        };
    }

    window.LifePlanAiService = { create };
})();
