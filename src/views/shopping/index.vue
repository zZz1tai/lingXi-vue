<template>
  <div class="shopping-page">
    <!-- 顶部导航栏 -->
    <div class="shopping-header">
      <div class="header-left">
        <h1 class="page-title">客户购物</h1>
      </div>
      <div class="header-right">
        <el-dropdown @command="handleUserAction">
          <span class="user-info">
            {{ userStore.name }}
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人中心</el-dropdown-item>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="shopping-content">
      <!-- 售货机选择 -->
      <div class="vm-selector">
        <el-form label-position="left" label-width="100px">
          <el-form-item label="选择售货机：">
            <el-select v-model="selectedVmId" @change="handleVmChange" placeholder="请选择售货机" style="width: 300px">
              <el-option
                v-for="vm in vendingMachines"
                :key="vm.id"
                :label="vm.innerCode"
                :value="vm.id"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <!-- 策略显示区域 -->
      <div v-if="selectedVmStrategy" class="strategy-container">
        <h2 class="strategy-title">售货机策略</h2>
        <div class="strategy-content">
          <div class="strategy-item">
            <span class="strategy-label">策略名称：</span>
            <span class="strategy-value">{{ selectedVmStrategy.policyName || '无' }}</span>
          </div>
          <div class="strategy-item">
            <span class="strategy-label">策略方案：</span>
            <span class="strategy-value">{{ selectedVmStrategy.discount ? (selectedVmStrategy.discount / 10) + '折' : '无' }}</span>
          </div>
        </div>
      </div>

      <!-- 商品展示区域 -->
      <div class="products-container">
        <div v-if="loading" class="loading-container">
          <p>加载中...</p>
        </div>
        <div v-else-if="!channels.length" class="empty-container">
          <el-empty description="暂无商品" />
        </div>
        <div v-else class="channels-grid">
          <div
            v-for="channel in channels"
            :key="channel.id"
            class="channel-item"
            :class="{ 'sold-out': channel.currentCapacity === 0 }"
            @click="addToCart(channel)"
            :disabled="channel.currentCapacity === 0"
          >
            <div class="channel-position">{{ channel.channelCode }}</div>
            <div class="channel-product">
              <img
                :src="channel.sku?.skuImage || '/src/assets/vm/default_sku.png'"
                :alt="channel.sku?.skuName"
                class="product-image"
              />
              <div class="product-info">
                <h3 class="product-name">{{ channel.sku?.skuName || '无商品' }}</h3>
                <p class="product-price">¥{{ calculatePrice(channel.sku?.price) || 0 }}</p>
                <p class="product-stock" v-if="channel.sku">库存: {{ channel.currentCapacity || 0 }}</p>
              </div>
              <div class="sold-out-overlay" v-if="channel.currentCapacity === 0">
                <span>售罄</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 购物车区域 -->
      <div class="cart-container">
        <h2 class="cart-title">购物车</h2>
        <div v-if="cart.length === 0" class="empty-cart">
          <el-empty description="购物车为空" />
        </div>
        <div v-else class="cart-items">
          <div
            v-for="(item, index) in cart"
            :key="index"
            class="cart-item"
          >
            <div class="cart-item-info">
              <span class="cart-item-name">{{ item.sku.skuName }}</span>
              <span class="cart-item-price">¥{{ calculatePrice(item.sku.price) }}</span>
            </div>
            <div class="cart-item-quantity">
              <el-button
                size="small"
                @click="decreaseQuantity(index)"
                :disabled="item.quantity <= 1"
              >
                -</el-button>
              <span class="quantity">{{ item.quantity }}</span>
              <el-button size="small" @click="increaseQuantity(index)">
                +</el-button>
            </div>
            <el-button
              type="danger"
              size="small"
              @click="removeFromCart(index)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <div class="cart-total">
            <span class="total-label">总计：</span>
            <span class="total-amount">¥{{ totalAmount }}</span>
          </div>
          <el-button
            type="primary"
            class="checkout-btn"
            @click="processPayment"
            :disabled="cart.length === 0"
          >
            结算
          </el-button>
        </div>
      </div>
    </div>



    <!-- 支付成功提示 -->
    <el-dialog
      v-model="paymentSuccessVisible"
      title="支付成功"
      width="300px"
      align-center
      :close-on-click-modal="false"
    >
      <div class="success-content">
        <el-icon class="success-icon"><CircleCheck /></el-icon>
        <p>支付成功！</p>
        <p>商品即将出货，请稍候...</p>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="resetShopping">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElDialog, ElButton, ElInput, ElIcon, ElDropdown, ElDropdownMenu, ElDropdownItem, ElSelect, ElOption, ElForm, ElFormItem, ElRadio, ElEmpty } from 'element-plus';
import { ArrowDown, Delete, CircleCheck } from '@element-plus/icons-vue';
import useUserStore from '@/store/modules/user';
import { getVendingMachines, getChannelsByVmId } from '@/api/manage/vm';
import { getPolicy } from '@/api/manage/policy';
import { addOrder } from '@/api/manage/order';

// 状态管理
const userStore = useUserStore();
const vendingMachines = ref([]);
const selectedVmId = ref('');
const channels = ref([]);
const cart = ref([]);
const loading = ref(false);
const paymentSuccessVisible = ref(false);
const selectedVmStrategy = ref(null);

// 计算属性
const totalAmount = computed(() => {
  const discount = selectedVmStrategy?.discount ? selectedVmStrategy.discount / 100 : 1;
  return (cart.value.reduce((total, item) => {
    return total + (item.sku.price * item.quantity * discount);
  }, 0) / 100).toFixed(2);
});

// 生命周期
onMounted(async () => {
  // 检查登录状态
  if (!userStore.token) {
    // 重定向到登录页面
    window.location.href = '/login';
    return;
  }
  
  // 加载售货机列表
  await loadVendingMachines();
});

// 加载售货机列表
const loadVendingMachines = async () => {
  try {
    const res = await getVendingMachines();
    vendingMachines.value = res.data || [];
    if (vendingMachines.value.length > 0) {
      selectedVmId.value = vendingMachines.value[0].id;
      await loadChannels();
      await loadVmStrategy(selectedVmId.value);
    }
  } catch (error) {
    ElMessage.error('加载售货机列表失败');
    console.error('加载售货机列表失败:', error);
  }
};

// 加载货道信息
const loadChannels = async () => {
  if (!selectedVmId.value) return;
  
  loading.value = true;
  try {
    const res = await getChannelsByVmId(selectedVmId.value);
    channels.value = res.data || [];
  } catch (error) {
    ElMessage.error('加载货道信息失败');
    console.error('加载货道信息失败:', error);
  } finally {
    loading.value = false;
  }
};

// 处理售货机切换
const handleVmChange = async () => {
  await loadChannels();
  await loadVmStrategy(selectedVmId.value);
  // 切换售货机时清空购物车
  cart.value = [];
};

// 添加商品到购物车
const addToCart = (channel) => {
  if (!channel.sku) {
    ElMessage.warning('该货道暂无商品');
    return;
  }
  
  if (channel.currentCapacity === 0) {
    ElMessage.warning('该商品已售罄');
    return;
  }
  
  const existingItem = cart.value.find(item => item.channelId === channel.id);
  if (existingItem) {
    if (existingItem.quantity >= channel.currentCapacity) {
      ElMessage.warning('已达到库存上限');
      return;
    }
    existingItem.quantity++;
  } else {
    cart.value.push({
      channelId: channel.id,
      sku: channel.sku,
      quantity: 1
    });
  }
  ElMessage.success('商品已添加到购物车');
};

// 减少商品数量
const decreaseQuantity = (index) => {
  if (cart.value[index].quantity > 1) {
    cart.value[index].quantity--;
  }
};

// 增加商品数量
const increaseQuantity = (index) => {
  const item = cart.value[index];
  const channel = channels.value.find(c => c.id === item.channelId);
  if (channel && item.quantity >= channel.currentCapacity) {
    ElMessage.warning('已达到库存上限');
    return;
  }
  item.quantity++;
};

// 从购物车移除商品
const removeFromCart = (index) => {
  cart.value.splice(index, 1);
  ElMessage.success('商品已从购物车移除');
};

// 处理支付
const processPayment = async () => {
  if (cart.length === 0) {
    ElMessage.warning('购物车为空');
    return;
  }
  
  try {
    // 模拟支付过程
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 为每个商品创建单独的订单
    for (const item of cart.value) {
      // 构建订单数据
      const orderData = {
        id: item.channelId, // 货道ID
        skuId: item.sku.id,
        skuName: item.sku.skuName,
        amount: item.sku.price * item.quantity, // 商品金额
        price: item.sku.price, // 单价
        payType: '2', // 固定使用微信支付
        status: 1, // 支付完成
        payStatus: 1, // 支付完成
        innerCode: selectedVmId.value, // 售货机编号
        regionId: selectedVmStrategy.value?.regionId, // 区域ID
        regionName: selectedVmStrategy.value?.regionName // 区域名称
      };
      
      // 调用订单创建 API
      await addOrder(orderData);
    }
    
    paymentSuccessVisible.value = true;
  } catch (error) {
    ElMessage.error('支付失败，请重试');
    console.error('支付失败:', error);
  }
};

// 重置购物状态
const resetShopping = async () => {
  paymentSuccessVisible.value = false;
  cart.value = [];
  // 重新加载货道信息，更新库存状态
  await loadChannels();
  ElMessage.success('购物已完成');
};

// 计算价格
const calculatePrice = (price) => {
  if (!price) return 0;
  const discount = selectedVmStrategy?.discount ? selectedVmStrategy.discount / 100 : 1;
  return ((price * discount) / 100).toFixed(2);
};

// 加载售货机策略
const loadVmStrategy = async (vmId) => {
  try {
    // 首先获取售货机详情，获取policyId
    const vm = vendingMachines.value.find(item => item.id === vmId);
    if (!vm || !vm.policyId || vm.policyId === 'all') {
      selectedVmStrategy.value = {
        policyName: '无',
        discount: null,
        promotionRules: '无',
        discountActivities: '无',
        purchaseLimits: '无',
        priceMultiplier: 1
      };
      return;
    }
    
    // 确保policyId是有效的数字
    const policyId = Number(vm.policyId);
    if (isNaN(policyId)) {
      selectedVmStrategy.value = {
        policyName: '无',
        discount: null,
        promotionRules: '无',
        discountActivities: '无',
        purchaseLimits: '无',
        priceMultiplier: 1
      };
      return;
    }
    
    // 根据policyId获取策略详情
    const res = await getPolicy(policyId);
    const policy = res.data;
    
    // 转换策略信息
    selectedVmStrategy.value = {
      policyName: policy.policyName || '无',
      discount: policy.discount || null,
      promotionRules: policy.promotionRules || '无',
      discountActivities: policy.discountActivities || '无',
      purchaseLimits: policy.purchaseLimits || '无',
      priceMultiplier: policy.priceMultiplier || 1
    };
  } catch (error) {
    ElMessage.error('加载策略信息失败');
    console.error('加载策略信息失败:', error);
    // 加载失败时使用默认策略
    selectedVmStrategy.value = {
      policyName: '无',
      discount: null,
      promotionRules: '无',
      discountActivities: '无',
      purchaseLimits: '无',
      priceMultiplier: 1
    };
  }
};

// 处理用户操作
const handleUserAction = (command) => {
  switch (command) {
    case 'profile':
      // 跳转到个人中心
      break;
    case 'logout':
      // 退出登录
      userStore.logout();
      window.location.href = '/login';
      break;
    default:
      break;
  }
};
</script>

<style scoped lang="scss">
.shopping-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.shopping-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #475569;
    cursor: pointer;
  }
}

.shopping-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.vm-selector {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
}

.strategy-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;

  .strategy-title {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 16px 0;
  }

  .strategy-content {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;

    .strategy-item {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .strategy-label {
        font-size: 14px;
        color: #64748b;
        font-weight: 500;
      }

      .strategy-value {
        font-size: 14px;
        color: #1e293b;
      }
    }
  }
}

.products-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;

    p {
      margin-top: 16px;
      color: #64748b;
    }
  }

  .empty-container {
    padding: 60px 0;
  }

  .channels-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;

    .channel-item {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border-color: #667eea;
        }

        &.sold-out {
          opacity: 0.6;
          cursor: not-allowed;

          &:hover {
            transform: none;
            box-shadow: none;
            border-color: #e2e8f0;
          }
        }

      .channel-position {
        font-size: 12px;
        color: #94a3b8;
        margin-bottom: 8px;
      }

      .channel-product {
        display: flex;
        flex-direction: column;
        align-items: center;

        .product-image {
          width: 120px;
          height: 120px;
          object-fit: contain;
          margin-bottom: 12px;
        }

        .product-info {
          text-align: center;

          .product-name {
            font-size: 14px;
            font-weight: 500;
            color: #1e293b;
            margin: 0 0 8px 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .product-price {
            font-size: 16px;
            font-weight: 600;
            color: #ef4444;
            margin: 0 0 4px 0;
          }

          .product-stock {
            font-size: 12px;
            color: #64748b;
            margin: 0;
          }
        }

        .sold-out-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          z-index: 10;

          span {
            font-size: 24px;
            font-weight: 600;
            color: #ef4444;
            transform: rotate(-30deg);
          }
        }
      }
    }
  }
}

.cart-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;

  .cart-title {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 20px 0;
  }

  .empty-cart {
    padding: 40px 0;
  }

  .cart-items {
    .cart-item {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;

      &:last-child {
        border-bottom: none;
      }

      .cart-item-info {
        flex: 1;

        .cart-item-name {
          font-size: 14px;
          color: #1e293b;
          margin-right: 16px;
        }

        .cart-item-price {
          font-size: 14px;
          font-weight: 500;
          color: #ef4444;
        }
      }

      .cart-item-quantity {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 16px;

        .quantity {
          min-width: 30px;
          text-align: center;
        }
      }
    }

    .cart-total {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 20px 0;
      font-size: 16px;

      .total-label {
        margin-right: 8px;
        color: #475569;
      }

      .total-amount {
        font-weight: 600;
        color: #ef4444;
        font-size: 18px;
      }
    }

    .checkout-btn {
      width: 100%;
      margin-top: 20px;
    }
  }
}

.payment-content {
  .payment-amount {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 0;
    border-bottom: 1px solid #e2e8f0;

    .amount {
      font-size: 24px;
      font-weight: 600;
      color: #ef4444;
    }
  }

  .payment-method {
    padding: 20px 0;

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 16px 0;
    }

    .pay-method-item {
      display: flex;
      align-items: center;
      gap: 8px;

      .pay-icon {
        width: 24px;
        height: 24px;
      }
    }
  }
}

.success-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;

  .success-icon {
    font-size: 48px;
    color: #10b981;
    margin-bottom: 16px;
  }

  p {
    margin: 8px 0;
    color: #475569;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .shopping-content {
    padding: 0 12px;
  }

  .channels-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .channel-item {
    padding: 12px;

    .product-image {
      width: 100px;
      height: 100px;
    }
  }
}
</style>