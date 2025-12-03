<template>
  <div class="ai-chat-page app-container">
    <el-row :gutter="20">
      <el-col :span="17">
        <el-card class="dialog-card" v-loading="loading && !history.length">
          <template #header>
            <div class="card-header">
              <div>
                <div class="title">灵犀智能助手</div>
              </div>
              <el-button size="small" @click="clearHistory" :disabled="!history.length">清空记录</el-button>
            </div>
          </template>
          <div ref="historyWrap" class="messages">
            <div v-if="!history.length && !loading" class="empty-state">
              <p>还没有消息，输入内容后点击 “发送” 或使用 Ctrl + Enter。</p>
            </div>
            <div
              v-for="item in history"
              :key="item.id"
              class="message"
              :class="item.role"
            >
              <div class="meta">
                <span class="role">{{ item.role === 'user' ? '我' : '灵犀' }}</span>
                <span class="time">{{ item.time }}</span>
              </div>
              <div class="content">{{ item.content }}</div>
            </div>
          </div>
        </el-card>
        <el-card class="input-card">
          <el-alert
            v-if="error"
            type="error"
            :closable="false"
            show-icon
            class="error-tip"
          >
            {{ error }}
          </el-alert>
          <el-input
            v-model="message"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 10 }"
            placeholder="请输入要发送给灵犀助手的内容"
            @keydown.enter="handleEnter"
          />
          <div class="actions">
            <span class="hint">Ctrl + Enter 快速发送</span>
            <el-button type="primary" :loading="loading" @click="sendMessage">发送</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :span="7">
        <el-card class="tips-card">
          <template #header>
            <div class="title">使用提示</div>
          </template>
          <ul>
            <li>前端通过 axios 请求后端 `/api/ai/chat` 接口。</li>
            <li>接口需要登录态，确保已获取 token。</li>
            <li>支持多轮对话，暂存在本页内存中。</li>
          </ul>
        </el-card>
        <el-card class="preset-card">
          <template #header>
            <div class="title">快捷问题</div>
          </template>
          <el-tag
            v-for="item in presets"
            :key="item"
            @click="usePreset(item)"
            class="preset-tag"
          >
            {{ item }}
          </el-tag>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { chatWithQwen } from '@/api/ai';

const message = ref('');
const history = ref([]);
const loading = ref(false);
const error = ref('');
const historyWrap = ref(null);
const presets = [
  '今天哪些设备需要维修？',
  '写一段关于无人零售的宣传文案',
  '今天那些商品卖的比较好？',
  '给出优化设备运营的建议'
];

const scrollToBottom = () => {
  nextTick(() => {
    const wrap = historyWrap.value;
    if (wrap) {
      wrap.scrollTop = wrap.scrollHeight;
    }
  });
};

const appendMessage = (role, content) => {
  history.value.push({
    id: `${role}-${Date.now()}-${Math.random()}`,
    role,
    content,
    time: dayjs().format('HH:mm:ss')
  });
  scrollToBottom();
};

const sendMessage = async () => {
    const content = message.value.trim();
    if (!content) {
      ElMessage.warning('请输入内容');
      return;
    }
    if (loading.value) {
      return;
    }
    error.value = '';
    loading.value = true;
    appendMessage('user', content);
    try {
      const reply = await chatWithQwen(content);
      appendMessage('assistant', reply);
      message.value = '';
    } catch (err) {
      error.value = err?.msg || err?.message || '发送失败，请稍后重试';
      history.value.pop();
    } finally {
      loading.value = false;
    }
};

const handleEnter = (event) => {
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault();
    sendMessage();
  }
};

const usePreset = (text) => {
  message.value = text;
  nextTick(() => {
    const textarea = document.querySelector('.input-card textarea');
    textarea && textarea.focus();
  });
};

const clearHistory = () => {
  history.value = [];
};
</script>

<style scoped lang="scss">
.ai-chat-page {
  .dialog-card,
  .input-card,
  .tips-card,
  .preset-card {
    margin-bottom: 20px;
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .title {
      font-size: 18px;
      font-weight: 600;
    }
    .desc {
      font-size: 12px;
      color: #999;
    }
  }
  .messages {
    height: 480px;
    overflow-y: auto;
    padding-right: 12px;
  }
  .empty-state {
    color: #999;
    text-align: center;
    padding-top: 80px;
  }
  .message {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 12px;
    background: #f8f8f8;
    &.assistant {
      background: #f0f9eb;
    }
    &.user {
      background: #ecf5ff;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
      color: #666;
      .role {
        font-weight: 600;
      }
    }
    .content {
      white-space: pre-wrap;
      line-height: 1.6;
      color: #333;
    }
  }
  .input-card {
    .error-tip {
      margin-bottom: 10px;
    }
    .actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      .hint {
        color: #909399;
      }
    }
  }
  .tips-card ul {
    padding-left: 18px;
    li {
      margin-bottom: 8px;
    }
  }
  .preset-card {
    .preset-tag {
      margin: 0 8px 8px 0;
      cursor: pointer;
    }
  }
}
</style>

