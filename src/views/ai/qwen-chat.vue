<template>
  <div class="ai-chat-page app-container">
    <el-row :gutter="20" class="chat-container">
      <!-- 左侧会话列表 -->
      <el-col :span="6" class="session-column">
        <div class="session-list-container">
          <div class="session-list-header">
          <el-button type="default" size="default" style="width: 100%; border-radius: 8px; padding: 20px 20px; font-size: 16px; margin-bottom: 10px; background-color: #f5f7fa; border-color: #e4e7ed; color: #606266;" @click="createNewSession">新建对话</el-button>
        </div>
          <div class="session-list">
            <div 
              v-for="session in sessions" 
              :key="session.id" 
              class="session-item" 
              :class="{ active: session.sessionId === currentSessionId }"
              @click="switchSession(session)"
            >
              <div class="session-info">
                <div class="session-name">
                  {{ session.sessionName }}
                </div>
                <div class="session-time">{{ formatTime(session.createTime) }}</div>
              </div>
              <div class="session-actions">
                <el-dropdown @command="(command) => handleSessionAction(command, session)" trigger="click" placement="top-end">
                  <el-button type="default" size="small" plain>
                    <el-icon class="el-icon-more"><More /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="rename">
                        <el-icon><Edit /></el-icon> 重命名
                      </el-dropdown-item>
                      <el-dropdown-item command="delete">
                        <el-icon><Delete /></el-icon> 删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>
        </div>
      </el-col>
      
      <!-- 右侧聊天内容 -->
      <el-col :span="18" class="chat-column">
        <div class="dialog-card-wrapper">
          <el-card class="dialog-card" v-loading="loading && !history.length" :body-style="{ padding: '0' }">
            <div ref="historyWrap" class="messages">
              <div v-if="!history.length && !loading" class="empty-state">
                <h2 class="welcome-title">你好，我是灵犀OwO</h2>
              </div>
              <div
                v-for="item in history"
                :key="item.id"
                class="message"
                :class="item.isUser ? 'user' : 'assistant'"
              >
                <div class="meta">
                  <span class="role">{{ item.isUser ? userStore.name : '灵犀' }}</span>
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
                style="overflow-y: auto; resize: none;"
              />
              <div class="input-actions">
                <div class="analysis-switch-wrapper">
                  <el-button 
                    type="default" 
                    size="small" 
                    plain
                    :class="{ 'active': enableDataAnalysis }"
                    @click="enableDataAnalysis = !enableDataAnalysis"
                  >
                    {{ enableDataAnalysis ? '数据分析' : '数据分析' }}
                  </el-button>
                </div>
                <el-dropdown @command="usePreset" trigger="click" placement="top-start">
                  <el-button type="default" plain size="small" class="quick-question-btn">
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
                <el-button type="default" :loading="loading" :disabled="loading" @click="sendMessage" class="send-btn">
                  提问
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <!-- 重命名对话框 -->
    <el-dialog
      v-model="renameDialogVisible"
      title="重命名会话"
      width="30%"
      top="80%"
    >
      <el-input v-model="newSessionName" placeholder="请输入新的会话名称" />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="renameDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmRename">确认</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { ArrowDown, More, Edit, Delete } from '@element-plus/icons-vue';
import { chatWithQwen, analyzeDashboard, getChatHistory, saveChatHistory, getSessions, createSession, updateSession, deleteSessionById } from '@/api/ai';
import useUserStore from '@/store/modules/user';

// 聊天相关状态
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

// 会话管理相关状态
const sessions = ref([]);
const currentSessionId = ref('');
const renameDialogVisible = ref(false);
const newSessionName = ref('');
const currentEditingSession = ref(null);

// 获取当前用户信息
const userStore = useUserStore();

const scrollToBottom = () => {
  nextTick(() => {
    const wrap = historyWrap.value;
    if (wrap) {
      wrap.scrollTop = wrap.scrollHeight;
    }
  });
};

const appendMessage = (isUser, content) => {
  history.value.push({
    id: `${isUser ? 'user' : 'assistant'}-${Date.now()}-${Math.random()}`,
    isUser,
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
      ElMessage.warning('数据正在处理，请勿重复提交');
      return;
    }
    error.value = '';
    loading.value = true;
    appendMessage(true, content);
    // 点击发送后立即清空输入框
    message.value = '';
    try {
      let reply;
      if (enableDataAnalysis.value) {
        // 使用数据分析接口
        const start = dateRange.value ? dateRange.value[0] : null;
        const end = dateRange.value ? dateRange.value[1] : null;
        reply = await analyzeDashboard(content, start, end, userStore.id, userStore.name);
      } else {
        // 使用普通对话接口
        reply = await chatWithQwen(content, userStore.id, userStore.name);
      }
      appendMessage(false, reply);
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

// 格式化时间
const formatTime = (time) => {
  if (!time) return '';
  return dayjs(time).format('MM-DD HH:mm');
};

// 加载会话列表
const loadSessions = async () => {
  try {
    const res = await getSessions(userStore.id);
    sessions.value = res.data || [];
    // 如果没有会话，创建一个新会话
    if (sessions.value.length === 0) {
      await createNewSession();
    } else if (!currentSessionId.value) {
      // 如果没有当前会话，使用第一个会话
      switchSession(sessions.value[0]);
    }
  } catch (err) {
    console.error('加载会话列表失败:', err);
    ElMessage.error('加载会话列表失败: ' + (err?.msg || err?.message || '未知错误'));
  }
};

// 加载对话历史记录
const loadChatHistory = async () => {
  if (!currentSessionId.value) return;
  
  try {
    const res = await getChatHistory(currentSessionId.value);
    // 后端返回的是AjaxResult对象，历史记录在data字段中
    const data = res.data || [];
    if (data && data.length > 0) {
      // 为每条记录添加isUser字段，区分用户和助手消息
      const formattedHistory = data.map(item => ({
        ...item,
        isUser: item.messageType === 'user' // 根据messageType字段区分，user为用户消息，model为系统消息
      }));
      history.value = formattedHistory;
      scrollToBottom();
    } else {
      history.value = [];
    }
  } catch (err) {
    console.error('加载对话历史失败:', err);
    ElMessage.error('加载对话历史失败: ' + (err?.msg || err?.message || '未知错误'));
  }
};

// 创建新会话
const createNewSession = async () => {
  try {
    const res = await createSession(userStore.id);
    const newSession = res.data;
    sessions.value.unshift(newSession);
    switchSession(newSession);
    ElMessage.success('新会话已创建');
  } catch (err) {
    console.error('创建会话失败:', err);
    ElMessage.error('创建会话失败: ' + (err?.msg || err?.message || '未知错误'));
  }
};

// 切换会话
const switchSession = async (session) => {
  currentSessionId.value = session.sessionId;
  localStorage.setItem('ai_chat_session_id', session.sessionId);
  await loadChatHistory();
};

// 显示重命名对话框
const showRenameDialog = (session) => {
  currentEditingSession.value = session;
  newSessionName.value = session.sessionName;
  renameDialogVisible.value = true;
};

// 确认重命名
const confirmRename = async () => {
  if (!newSessionName.value.trim()) {
    ElMessage.warning('会话名称不能为空');
    return;
  }
  
  try {
    await updateSession({
      id: currentEditingSession.value.id,
      sessionName: newSessionName.value.trim()
    });
    // 更新本地会话列表
    const index = sessions.value.findIndex(s => s.id === currentEditingSession.value.id);
    if (index !== -1) {
      sessions.value[index].sessionName = newSessionName.value.trim();
    }
    renameDialogVisible.value = false;
    ElMessage.success('会话名称已更新');
  } catch (err) {
    console.error('更新会话名称失败:', err);
    ElMessage.error('更新会话名称失败: ' + (err?.msg || err?.message || '未知错误'));
  }
};

// 删除会话
const deleteSession = async (session) => {
  try {
    await deleteSessionById(session.sessionId);
    // 从本地会话列表中移除
    const index = sessions.value.findIndex(s => s.id === session.id);
    if (index !== -1) {
      sessions.value.splice(index, 1);
    }
    // 如果删除的是当前会话，切换到第一个会话或创建新会话
    if (session.sessionId === currentSessionId.value) {
      if (sessions.value.length > 0) {
        switchSession(sessions.value[0]);
      } else {
        await createNewSession();
      }
    }
    ElMessage.success('会话已删除');
  } catch (err) {
    console.error('删除会话失败:', err);
    ElMessage.error('删除会话失败: ' + (err?.msg || err?.message || '未知错误'));
  }
};

// 处理会话操作命令
const handleSessionAction = (command, session) => {
  switch (command) {
    case 'rename':
      showRenameDialog(session);
      break;
    case 'delete':
      deleteSession(session);
      break;
    default:
      break;
  }
};

// 组件挂载时加载会话列表
onMounted(async () => {
  // 获取当前会话ID
  const savedSessionId = localStorage.getItem('ai_chat_session_id');
  if (savedSessionId) {
    currentSessionId.value = savedSessionId;
  }
  await loadSessions();
});
</script>

<style scoped lang="scss">
.ai-chat-page {
  .chat-container {
    height: calc(100vh - 120px);
  }
  
  .session-column {
    height: 100%;
    background: #f5f7fa;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  }
  
  .chat-column {
    height: 100%;
  }
  
  .session-list-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .session-list-header {
    margin-bottom: 10px;
    padding: 0 10px;
  }
  
  .session-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
  }
  
  .session-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    margin-bottom: 8px;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    
    &:hover {
      background: #ecf5ff;
    }
    
    &.active {
      background: #409eff;
      color: white;
    }
    
    .session-info {
      flex: 1;
      min-width: 0;
    }
    
    .session-name {
      font-weight: 500;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }
    
    .session-time {
      font-size: 12px;
      color: #909399;
    }
    
    &.active .session-time {
      color: rgba(255, 255, 255, 0.8);
    }
    
    .session-actions {
            margin-left: 10px;
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        &:hover .session-actions {
            opacity: 1;
        }
  }
  
  .dialog-card-wrapper {
    margin-bottom: 20px;
    display: flex;
    justify-content: center;
    height: calc(80vh - 120px);
  }
  
  .dialog-card {
    background: transparent;
    border: none;
    box-shadow: none;
    width: 100%;
    height: 100%;
    
    :deep(.el-card__body) {
      background: transparent;
      height: 100%;
    }
  }
  
  .messages {
    height: 100%;
    overflow-y: auto;
    padding-right: 12px;
    background: transparent;
    display: flex;
    flex-direction: column;
  }
  
  .empty-state {
    color: #333;
    text-align: center;
    padding-top: 120px;
    background: transparent;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
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
  
  .input-wrapper {
    margin-bottom: 20px;
    display: flex;
    justify-content: center;
  }
  
  .input-container {
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    padding: 0;
    width: 100%;
    overflow: hidden;
  }
  
  .input-area {
    display: flex;
    flex-direction: column;
    gap: 0;
    background: #ffffff;
    border-radius: 0;
    border: none;
    padding: 12px 16px;
    transition: all 0.3s ease;
    
    :deep(.el-textarea) {
      margin-bottom: 0;
      border: none;
      background: transparent;
      height: auto;
      
      :deep(.el-textarea__inner) {
        border: none;
        resize: none;
        background: transparent;
        font-size: 14px;
        line-height: 1.5;
        border-radius: 0;
        padding: 8px 0;
        min-height: 58px; /* 2行高度：14px字体 * 1.5行高 * 2行 + 16px内边距 = 58px */
        max-height: 58px; /* 固定2行高度 */
        overflow-y: auto;
        color: #333;
        outline: none;
        
        &:focus {
          box-shadow: none;
          background: transparent;
          outline: none;
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
    flex-wrap: nowrap;
    margin-top: 8px;
  }
  
  .analysis-switch-wrapper {
    margin-right: auto;
    
    .el-button.active {
      background-color: #f5f7fa;
      border-color: #dcdfe6;
      color: #606266;
      
      &:hover {
        background-color: #e9ecef;
        border-color: #c6e2ff;
        color: #409eff;
      }
    }
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

