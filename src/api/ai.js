import request from '@/utils/request';

/**
 * 调用灵犀智能助手接口
 * @param {string} message
 * @returns {Promise<string>}
 */
export function chatWithQwen(message) {
  return request({
    url: '/api/ai/chat',
    method: 'post',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
    },
    data: message,
    timeout: 60000, // 增加超时时间到60秒
  });
}

/**
 * 基于数据看板分析用户问题
 * @param {string} question 用户问题
 * @param {string} start 开始时间（可选）
 * @param {string} end 结束时间（可选）
 * @returns {Promise<string>}
 */
export function analyzeDashboard(question, start, end) {
  const params = { question };
  if (start) params.start = start;
  if (end) params.end = end;
  return request({
    url: '/api/ai/analyze',
    method: 'post',
    params: params,
    timeout: 60000, // 增加超时时间到60秒
  }).then(res => {
    // 后端返回的是 AjaxResult { code: 200, msg: 'success', data: 'answer' }
    // 响应拦截器已经返回了 res.data，所以这里 res 就是 AjaxResult 对象
    return res.data || res.msg || '分析完成';
  });
}

