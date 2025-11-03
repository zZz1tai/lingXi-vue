<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="设备编号" prop="innerCode">
        <el-input v-model="queryParams.innerCode" placeholder="请输入设备编号" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>


    <el-table v-loading="loading" :data="vmList" @selection-change="handleSelectionChange">
      <el-table-column label="序号" type="index" width="80" align="center" />
      <el-table-column label="设备编号" align="center" prop="innerCode" />
      <el-table-column label="设备型号" align="center" prop="vmTypeId">
        <template #default="scope">
          <div v-for="item in vmTypeList" :key="item.id">
            <span v-if="item.id === scope.row.vmTypeId">{{ item.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="详细地址" align="center" prop="addr" show-overflow-tooltip />
      <el-table-column label="合作商" align="center" prop="partnerId">
        <template #default="scope">
          <div v-for="item in partnerList" :key="item.id">
            <span v-if="item.id === scope.row.partnerId">{{ item.partnerName }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="运营状态" align="center" prop="vmStatus">
        <template #default="scope">
          <dict-tag :options="vm_status" :value="scope.row.vmStatus" />
        </template>
      </el-table-column>
      <el-table-column label="设备状态" align="center" prop="vmStatus">
        <template #default="scope">
          <span v-if="scope.row.runningStatus != null">
            {{ JSON.parse(scope.row.runningStatus).status == true ? '正常' : '异常' }}
          </span>
          <span v-else>异常</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" @click="handleUpdate(scope.row)"
            v-hasPermi="['manage:vm:edit']">查看详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 查看设备详情对话框 -->
    <el-dialog :title="title" v-model="open" width="500px" append-to-body>
      <el-form :model="form" label-width="80px">
        <el-form-item label="销售量">
          {{ form.salesVolume }}
        </el-form-item>
        <el-form-item label="销售额">
          {{ form.salesAmount }}
        </el-form-item>
        <el-form-item label="补货次数">
          {{ form.replenishmentTimes }}
        </el-form-item>
        <el-form-item label="维修次数">
          {{ form.maintenanceTimes }}
        </el-form-item>
        <el-form-item label="商品销量（月）">
          <el-table :data="form.monthlySales" border style="width: 100%">
            <for each="item" in="form.monthlySales">
              <el-table-column prop="month" label="月份" />
              <el-table-column prop="coke" label="可乐" />
              <el-table-column prop="icedTea" label="冰红茶" />
              <el-table-column prop="mineralWater" label="矿泉水" />
            </for>
          </el-table>
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancel">取消</el-button>
          <el-button type="primary" @click="submitForm">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Vm">
import { listVm, getVm, delVm, addVm, updateVm } from "@/api/manage/vm";
import { listVmType } from "@/api/manage/vmType";
import { listPartner } from "@/api/manage/partner";
import { loadAllParams } from "@/api/page";
import { listNode } from "@/api/manage/node";
import { listRegion } from "@/api/manage/region";
import { ref } from "vue";

const { proxy } = getCurrentInstance();
const { vm_status } = proxy.useDict('vm_status');

const vmList = ref([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref("");

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    innerCode: null,
    nodeId: null,
    businessType: null,
    regionId: null,
    partnerId: null,
    vmTypeId: null,
    vmStatus: null,
    runningStatus: null,
    policyId: null,
  },
  rules: {
    nodeId: [
      { required: true, message: "点位Id不能为空", trigger: "blur" }
    ],
    vmTypeId: [
      { required: true, message: "设备型号不能为空", trigger: "blur" }
    ],
  }
});

const { queryParams, form, rules } = toRefs(data);

/** 查询设备管理列表 */
function getList() {
  loading.value = true;
  listVm(queryParams.value).then(response => {
    vmList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}

// 取消按钮
function cancel() {
  open.value = false;
  reset();
}

// 表单重置
function reset() {
  form.value = {
    id: null,
    innerCode: null,
    channelMaxCapacity: null,
    nodeId: null,
    addr: null,
    lastSupplyTime: null,
    businessType: null,
    regionId: null,
    partnerId: null,
    vmTypeId: null,
    vmStatus: null,
    runningStatus: null,
    longitudes: null,
    latitude: null,
    clientId: null,
    policyId: null,
    createTime: null,
    updateTime: null
  };
  proxy.resetForm("vmRef");
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm("queryRef");
  handleQuery();
}

// 多选框选中数据
function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.id);
  single.value = selection.length != 1;
  multiple.value = !selection.length;
}

/** 新增按钮操作 */
function handleAdd() {
  reset();
  open.value = true;
  title.value = "添加设备管理";
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset();
  const _id = row.id || ids.value
  getVm(_id).then(response => {
    form.value = response.data;
    open.value = true;
    title.value = "查看设备详情";
  });
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs["vmRef"].validate(valid => {
    if (valid) {
      if (form.value.id != null) {
        updateVm(form.value).then(response => {
          proxy.$modal.msgSuccess("修改成功");
          open.value = false;
          getList();
        });
      } else {
        addVm(form.value).then(response => {
          proxy.$modal.msgSuccess("新增成功");
          open.value = false;
          getList();
        });
      }
    }
  });
}

/** 删除按钮操作 */
function handleDelete(row) {
  const _ids = row.id || ids.value;
  proxy.$modal.confirm('是否确认删除设备管理编号为"' + _ids + '"的数据项？').then(function () {
    return delVm(_ids);
  }).then(() => {
    getList();
    proxy.$modal.msgSuccess("删除成功");
  }).catch(() => { });
}

/** 导出按钮操作 */
function handleExport() {
  proxy.download('manage/vm/export', {
    ...queryParams.value
  }, `vm_${new Date().getTime()}.xlsx`)
}

//查询设备类型表
const vmTypeList = ref([]);
function getVmTypeList() {
  listVmType(loadAllParams).then(response => {
    vmTypeList.value = response.rows;
  });
}

//查询合作商列表
const partnerList = ref([]);
function getPartnerList() {
  listPartner(loadAllParams).then(response => {
    partnerList.value = response.rows;
  });
}
//查询点位列表
const nodeList = ref([]);
function getNodeList() {
  listNode(loadAllParams).then(response => {
    nodeList.value = response.rows;
  });
}

//查询区域列表
const regionList = ref([]);
function getRegionList() {
  listRegion(loadAllParams).then(response => {
    regionList.value = response.rows;
  });
}



getRegionList();
getNodeList();
getVmTypeList();
getPartnerList();
getList();
</script>
