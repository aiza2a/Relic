import { proxy } from 'valtio'
import {
  getGroups as apiGetGroups,
  addGroup as apiAddGroup,
  updateGroup as apiUpdateGroup,
  deleteGroup as apiDeleteGroup,
  reorderGroups as apiReorderGroups
} from '@shared/api/groups'

// 分组 Store
export const groupsStore = proxy({
  groups: [],
  currentGroup: '全部',
  isPinned: false,
  loading: false,
  error: null,

  setCurrentGroup(groupName) {
    this.currentGroup = groupName
  },

  togglePin() {
    this.isPinned = !this.isPinned
  },

  addGroup(group) {
    this.groups.push(group)
  },

  updateGroupInStore(id, updatedData) {
    const index = this.groups.findIndex(g => g.name === id)
    if (index !== -1) {
      this.groups[index] = { ...this.groups[index], ...updatedData }
    }
  },

  removeGroup(id) {
    this.groups = this.groups.filter(g => g.name !== id)
  },

  setGroups(groups) {
    this.groups = groups
  }
})

// 异步操作：加载分组列表
export async function loadGroups() {
  groupsStore.loading = true
  groupsStore.error = null

  try {
    let groups = await apiGetGroups()

    // 确保"全部"分组始终存在并排在最前面
    const allGroupIndex = groups.findIndex(g => g.name === '全部')
    if (allGroupIndex === -1) {
      groups.unshift({ name: '全部', icon: 'ti ti-list', color: '#dc2626', order: -1, item_count: 0 })
    } else if (allGroupIndex !== 0) {
      const allGroup = groups.splice(allGroupIndex, 1)[0]
      allGroup.order = -1
      allGroup.color = allGroup.color || '#dc2626';
      groups.unshift(allGroup)
    }

    groupsStore.groups = groups
  } catch (error) {
    groupsStore.groups = [{ name: '全部', icon: 'ti ti-list', color: '#dc2626', order: -1, item_count: 0 }] // 使用红色作为默认颜色
  } finally {
    groupsStore.loading = false
  }
}

// 添加分组
export async function addGroup(name, icon = 'ti ti-folder', color = '#ffffff') {
  try {
    const newGroup = await apiAddGroup(name, icon, color)
    await loadGroups()
    return newGroup
  } catch (error) {
    console.error('添加分组失败:', error)
    throw error
  }
}

// 更新分组
export async function updateGroup(oldName, newName, newIcon, newColor) {
  try {
    const updatedGroup = await apiUpdateGroup(oldName, newName, newIcon, newColor)
    await loadGroups()
    return updatedGroup
  } catch (error) {
    console.error('更新分组失败:', error)
    throw error
  }
}

// 删除分组
export async function deleteGroup(name) {
  try {
    await apiDeleteGroup(name)

    // 如果删除的是当前选中的分组，切换到全部
    if (groupsStore.currentGroup === name) {
      groupsStore.setCurrentGroup('全部')
    }

    await loadGroups()
    return true
  } catch (error) {
    console.error('删除分组失败:', error)
    throw error
  }
}

// 更新分组排序
export async function reorderGroups(newGroups) {
  try {
    const groupOrders = newGroups
      .filter(g => g.name !== '全部')
      .map((g, index) => [g.name, index + 1])
    
    await apiReorderGroups(groupOrders)
    groupsStore.setGroups(newGroups)
    
    return true
  } catch (error) {
    console.error('更新分组排序失败:', error)
    await loadGroups()
    throw error
  }
}

