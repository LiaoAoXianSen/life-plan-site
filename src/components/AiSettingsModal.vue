<script setup lang="ts">
import { reactive, ref } from 'vue';

import ModalShell from './common/ModalShell.vue';
import { createLegacyServices, getTodayStr } from '../services/legacyServices';

const ai = createLegacyServices().ai;
const emit = defineEmits<{ close: [] }>();
const model = defineModel<boolean>({ default: false });

function readPersistedAiConfig() {
  try {
    return JSON.parse(localStorage.getItem('lifePlanAiConfig') || '{}');
  } catch {
    return {};
  }
}

const config = reactive(ai.normalizeConfig(readPersistedAiConfig()));
const settingsNotice = ref('');
const apiKeyStored = ref(false);

function refreshApiKeyStored() {
  apiKeyStored.value = Boolean(String(config.apiKey || '').trim());
}

refreshApiKeyStored();

function saveConfig() {
  Object.assign(config, ai.normalizeConfig(config));
  localStorage.setItem('lifePlanAiConfig', JSON.stringify(config));
  refreshApiKeyStored();
  settingsNotice.value = 'AI 设置已保存';
}

function clearApiKey() {
  config.apiKey = '';
  Object.assign(config, ai.normalizeConfig(config));
  localStorage.setItem('lifePlanAiConfig', JSON.stringify(config));
  refreshApiKeyStored();
  settingsNotice.value = 'API Key 已清除';
}

async function testConfig() {
  if (!ai.isRemoteReady(config)) {
    settingsNotice.value = '请先填写完整的远程 AI 配置';
    return;
  }
  settingsNotice.value = '正在测试接口…';
  try {
    await ai.requestRemoteAi(config, { mode: 'chatCapture', userInput: '只回复测试成功', today: getTodayStr(), context: {} });
    settingsNotice.value = '接口测试成功';
  } catch (error) {
    settingsNotice.value = `接口测试失败：${error instanceof Error ? error.message : String(error)}`;
  }
}
</script>

<template>
  <ModalShell v-model="model" title="AI 设置" size="md" dialog-class="ai-settings-modal" @close="emit('close')">
    <div class="ai-settings-note">AI 配置只保存在当前浏览器本地，不会写入主数据或云同步。API Key 会保存在浏览器本地；共用设备请用完后清除。</div>
    <div class="form-group"><label><input v-model="config.remoteEnabled" type="checkbox" /> 启用远程 AI</label></div>
    <div class="form-group"><label for="ai-endpoint">接口地址</label><input id="ai-endpoint" v-model="config.endpointUrl" placeholder="https://.../v1" /></div>
    <div class="form-group"><label for="ai-key">API Key</label><input id="ai-key" v-model="config.apiKey" type="password" /><div class="ai-key-row"><span>{{ apiKeyStored ? '已保存 API Key' : '未保存 API Key' }}</span><button class="btn btn-secondary todo-mini-btn" type="button" @click="clearApiKey">清除 Key</button></div></div>
    <div class="form-group"><label for="ai-model">模型</label><input id="ai-model" v-model="config.model" /></div>
    <div class="form-group"><label for="ai-user-style">偏好说明</label><textarea id="ai-user-style" v-model="config.userStyle" rows="3" placeholder="例如：建议要短、具体、偏行动；不要鸡汤。" /></div>
    <p v-if="settingsNotice" class="sync-modal-status" role="status">{{ settingsNotice }}</p>
    <div class="modal-action-row"><span /><div class="modal-action-right"><button class="btn btn-secondary" type="button" @click="testConfig">测试接口</button><button class="btn btn-primary" type="button" @click="saveConfig">保存设置</button></div></div>
  </ModalShell>
</template>
