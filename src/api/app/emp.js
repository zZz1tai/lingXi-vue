import request from '@/utils/request'

// 获取员工信息
export function getEmpInfo(id) {
  return request({
    url: `/user-service/user/${id}`,
    method: 'get'
  })
}
