<template>
  <div class="app-task-index">
    <el-card shadow="hover" class="task-card">
      <template #header>
        <div class="card-header">
          <el-icon><Ticket /></el-icon>
          <span>工单处理</span>
        </div>
      </template>
      
      <!-- 搜索栏 -->
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="设备编号">
          <el-input v-model="searchForm.innerCode" placeholder="请输入设备编号" clearable />
        </el-form-item>
        <el-form-item label="工单编号">
          <el-input v-model="searchForm.taskCode" placeholder="请输入工单编号" clearable />
        </el-form-item>
        <el-form-item label="工单状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="待处理" value="0" />
            <el-option label="处理中" value="1" />
            <el-option label="已完成" value="2" />
            <el-option label="已取消" value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否维修">
          <el-select v-model="searchForm.isRepair" placeholder="请选择" clearable>
            <el-option label="是" value="true" />
            <el-option label="否" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetForm">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
      
      <!-- 排名卡片 -->
      <el-card class="rank-card" shadow="hover">
        <template #header>
          <div class="card-header-small">
            <el-icon><TrendCharts /></el-icon>
            <span>我的排名</span>
          </div>
        </template>
        <div class="rank-content" v-if="rankInfo">
          <div class="rank-number">{{ rankInfo.rank }}</div>
          <div class="rank-total">
            <span>共</span>
            <span class="total-number">{{ rankInfo.total }}</span>
            <span>人</span>
          </div>
        </div>
        <div v-else class="rank-loading">
          <el-skeleton :rows="1" animated />
        </div>
      </el-card>
      
      <!-- 工单列表 -->
      <el-table v-loading="loading" :data="taskList" style="width: 100%" border>
        <el-table-column prop="taskCode" label="工单编号" min-width="180" />
        <el-table-column prop="innerCode" label="设备编号" min-width="150" />
        <el-table-column prop="taskTypeName" label="工单类型" min-width="120" />
        <el-table-column label="状态" min-width="100">
          <template #default="scope">
            <el-tag
              :type="getStatusType(scope.row.status)"
              size="small"
            >
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" min-width="180" />
        <el-table-column prop="acceptTime" label="接受时间" min-width="180" />
        <el-table-column prop="completeTime" label="完成时间" min-width="180" />
        <el-table-column label="操作" min-width="200" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 0"
              type="primary"
              size="small"
              @click="handleAccept(scope.row.id)"
            >
              接受
            </el-button>
            <el-button
              v-if="scope.row.status === 1"
              type="success"
              size="small"
              @click="handleComplete(scope.row.id)"
            >
              完成
            </el-button>
            <el-button
              v-if="scope.row.status === 0 || scope.row.status === 1"
              type="danger"
              size="small"
              @click="handleCancel(scope.row.id)"
            >
              取消
            </el-button>
            <el-button
              type="info"
              size="small"
              @click="handleDetail(scope.row.id)"
            >
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.pageIndex"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
    
    <!-- 取消工单弹窗 -->
    <el-dialog
      v-model="cancelDialogVisible"
      title="取消工单"
      width="400px"
    >
      <el-form :model="cancelForm" label-width="80px">
        <el-form-item label="取消原因" required>
          <el-input
            v-model="cancelForm.reason"
            type="textarea"
            :rows="4"
            placeholder="请输入取消原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmCancel">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Ticket, Search, Refresh, TrendCharts 
} from '@element-plus/icons-vue'
import { 
  searchTasks, getUserRank, acceptTask, cancelTask, completeTask 
} from '@/api/app/task'
import useUserStore from '@/store/modules/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()

// 搜索表单
const searchForm = reactive({
  innerCode: '',
  taskCode: '',
  status: '',
  isRepair: '',
  start: '',
  end: ''
})

// 分页信息
const pagination = reactive({
  pageIndex: 1,
  pageSize: 10,
  total: 0
})

// 列表数据
const taskList = ref([])
const loading = ref(false)

// 排名信息
const rankInfo = ref(null)

// 取消工单弹窗
const cancelDialogVisible = ref(false)
const currentTaskId = ref(null)
const cancelForm = reactive({
  reason: ''
})

// 状态映射
const statusMap = {
  0: { text: '待处理', type: 'warning' },
  1: { text: '处理中', type: 'primary' },
  2: { text: '已完成', type: 'success' },
  3: { text: '已取消', type: 'danger' }
}

// 获取状态文本
const getStatusText = (status) => {
  return statusMap[status]?.text || '未知状态'
}

// 获取状态类型
const getStatusType = (status) => {
  return statusMap[status]?.type || 'info'
}

// 搜索工单
const handleSearch = () => {
  pagination.pageIndex = 1
  fetchTasks()
}

// 重置表单
const resetForm = () => {
  Object.assign(searchForm, {
    innerCode: '',
    taskCode: '',
    status: '',
    isRepair: '',
    start: '',
    end: ''
  })
  pagination.pageIndex = 1
  fetchTasks()
}

// 获取工单列表
const fetchTasks = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize
    }
    const response = await searchTasks(params)
    taskList.value = response.rows || []
    pagination.total = response.total || 0
  } catch (error) {
    console.error('获取工单列表失败:', error)
    ElMessage.error('获取工单列表失败')
  } finally {
    loading.value = false
  }
}

// 获取用户排名
const fetchUserRank = async () => {
  try {
    const userId = userStore.id
    if (!userId) {
      console.error('获取用户排名失败: 用户ID无效')
      return
    }
    const response = await getUserRank(userId)
    rankInfo.value = response
  } catch (error) {
    console.error('获取用户排名失败:', error)
  }
}

// 接受工单
const handleAccept = async (taskId) => {
  try {
    const result = await acceptTask(taskId)
    if (result) {
      ElMessage.success('接受工单成功')
      fetchTasks()
    } else {
      ElMessage.error('接受工单失败')
    }
  } catch (error) {
    console.error('接受工单失败:', error)
    ElMessage.error('接受工单失败')
  }
}

// 取消工单
const handleCancel = (taskId) => {
  currentTaskId.value = taskId
  cancelForm.reason = ''
  cancelDialogVisible.value = true
}

// 确认取消
const confirmCancel = async () => {
  if (!cancelForm.reason.trim()) {
    ElMessage.warning('请输入取消原因')
    return
  }
  
  try {
    const result = await cancelTask(currentTaskId.value, cancelForm)
    if (result) {
      ElMessage.success('取消工单成功')
      cancelDialogVisible.value = false
      fetchTasks()
    } else {
      ElMessage.error('取消工单失败')
    }
  } catch (error) {
    console.error('取消工单失败:', error)
    ElMessage.error('取消工单失败')
  }
}

// 完成工单
const handleComplete = async (taskId) => {
  try {
    const result = await completeTask(taskId)
    if (result) {
      ElMessage.success('完成工单成功')
      fetchTasks()
    } else {
      ElMessage.error('完成工单失败')
    }
  } catch (error) {
    console.error('完成工单失败:', error)
    ElMessage.error('完成工单失败')
  }
}

// 查看详情
const handleDetail = (taskId) => {
  router.push(`/app/task/detail/${taskId}`)
}

// 分页大小变化
const handleSizeChange = (size) => {
  pagination.pageSize = size
  fetchTasks()
}

// 当前页变化
const handleCurrentChange = (current) => {
  pagination.pageIndex = current
  fetchTasks()
}

// 初始化数据
onMounted(() => {
  fetchTasks()
  fetchUserRank()
})
</script>

<style scoped>
.app-task-index {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.task-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.card-header-small {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.search-form {
  margin-bottom: 20px;
  padding: 10px;
  background-color: #fafafa;
  border-radius: 4px;
}

.rank-card {
  margin-bottom: 20px;
  width: 200px;
}

.rank-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.rank-number {
  font-size: 48px;
  font-weight: bold;
  color: #409eff;
}

.rank-total {
  font-size: 14px;
  color: #606266;
  margin-top: 8px;
}

.total-number {
  font-weight: bold;
  color: #e6a23c;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
