<template>
  <div class="ai-chat-page app-container">
    <el-row :gutter="20">
      <el-col :span="24">
        <div class="dialog-card-wrapper">
          <el-card class="dialog-card" v-loading="loading && !history.length" :body-style="{ padding: '0' }">
            <template #header>
              <div class="card-header">
                <div>
                  <!-- 删除左边的灵犀智能助手标题 -->
                </div>
                <el-button size="small" @click="clearHistory" :disabled="!history.length">清空记录</el-button>
              </div>
            </template>
            <div ref="historyWrap" class="messages">
              <div v-if="!history.length && !loading" class="empty-state">
                <h2 class="welcome-title">你好，我是灵犀</h2>
              </div>
              <div
                v-for="item in history"
                :key="item.id"
                class="message"
                :class="item.role"
              >
                <div class="meta">
                  <span class="role">{{ item.role === 'user' ? '' : '灵犀' }}</span>
                  <span class="time">{{ item.time }}</span>
                </div>
                <div class="content">{{ item.content }}</div>
              </div>
            </div>
          </el-card>
        </div>
        <div class="input-wrapper">
          <div class="input-container">
            <div class="input-area">
              <el-input
                v-model="message"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                :placeholder="enableDataAnalysis ? '请输入要分析的问题，将基于数据看板进行智能分析' : '向灵犀助手提问'"
                @keydown.enter="handleEnter"
              />
              <div class="input-actions">
                <div class="analysis-switch-wrapper">
                  <el-radio-group v-model="enableDataAnalysis" size="small">
                    <el-radio-button :label="false">普通对话</el-radio-button>
                    <el-radio-button :label="true">数据分析</el-radio-button>
                  </el-radio-group>
                </div>
                <el-dropdown @command="usePreset" trigger="click" placement="top-start">
                  <el-button plain size="small" class="quick-question-btn">
                    快捷提问<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="item in presets"
                        :key="item"
                        :command="item"
                      >
                        {{ item }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-button type="primary" :loading="loading" @click="sendMessage" class="send-btn">
                  发送
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import { chatWithQwen, analyzeDashboard } from '@/api/ai';

const message = ref('');
const history = ref([]);
const loading = ref(false);
const error = ref('');
const historyWrap = ref(null);
const enableDataAnalysis = ref(false);
const dateRange = ref(null);
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
    // 点击发送后立即清空输入框
    message.value = '';
    try {
      let reply;
      if (enableDataAnalysis.value) {
        // 使用数据分析接口
        const start = dateRange.value ? dateRange.value[0] : null;
        const end = dateRange.value ? dateRange.value[1] : null;
        reply = await analyzeDashboard(content, start, end);
      } else {
        // 使用普通对话接口
        reply = await chatWithQwen(content);
      }
      appendMessage('assistant', reply);
    } catch (err) {
      error.value = err?.msg || err?.message || '发送失败，请稍后重试';
      history.value.pop();
    } finally {
      loading.value = false;
    }
};

const handleEnter = (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendMessage();
  }
};

const usePreset = (text) => {
  message.value = text;
  nextTick(() => {
    const textarea = document.querySelector('.input-area textarea');
    textarea && textarea.focus();
  });
};

const clearHistory = () => {
  history.value = [];
};
</script>

<style scoped lang="scss">
.ai-chat-page {
  .dialog-card-wrapper {
    margin-bottom: 20px;
    display: flex;
    justify-content: center;
  }
  
  .dialog-card {
    background: transparent;
    border: none;
    box-shadow: none;
    width: 80%;
    
    :deep(.el-card__header) {
      border-bottom: none;
      background: transparent;
    }
    
    :deep(.el-card__body) {
      background: transparent;
    }
  }
  
  .card-header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 8px 12px;
  }
  
  .messages {
    height: 480px;
    overflow-y: auto;
    padding-right: 12px;
    background: transparent;
  }
  
  .empty-state {
    color: #333;
    text-align: center;
    padding-top: 120px;
    background: transparent;
  }
  
  .welcome-title {
    font-size: 40px;
    font-weight: 500;
    color: #333;
    margin: 0;
  }
  
  .message {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 12px;
    max-width: 60%;
    word-wrap: break-word;
    word-break: break-word;
    
    &.assistant {
      background: #f0f9eb;
      align-self: flex-start;
      margin-right: 40%;
    }
    
    &.user {
      background: #ecf5ff;
      align-self: flex-end;
      margin-left: 50%;
      max-width: 50%;
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
      word-wrap: break-word;
      word-break: break-word;
    }
  }
  
  .messages {
    display: flex;
    flex-direction: column;
    height: 480px;
    overflow-y: auto;
    padding-right: 12px;
  }
  
  .input-wrapper {
    margin-bottom: 20px;
    display: flex;
    justify-content: center;
  }
  
  .input-container {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.08);
    padding: 12px;
    width: 80%;
  }
  
  .input-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #ffffff;
    border-radius: 8px;
    border: 1px solid #dcdfe6;
    padding: 8px;
    transition: all 0.3s ease;
    
    :deep(.el-textarea) {
      flex: 1;
      margin-bottom: 0;
      
      :deep(.el-textarea__inner) {
        border: none;
        resize: none;
        background: transparent;
        font-size: 14px;
        line-height: 1.5;
        border-radius: 6px;
        padding: 8px 10px;
        min-height: 60px;
        max-height: 120px;
        overflow-y: auto;
        
        &:focus {
          box-shadow: none;
        }
      }
      
      :deep(.el-textarea__resize) {
        display: none;
      }
    }
  }
  
  .input-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .analysis-switch-wrapper {
    margin-right: auto;
  }
  
  .quick-question-btn {
    border-radius: 6px;
    font-size: 12px;
  }
  
  .send-btn {
    border-radius: 6px;
    font-size: 12px;
    padding: 6px 12px;
  }
}
</style>

