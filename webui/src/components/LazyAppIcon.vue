<template>
  <div class="lazy-app-icon" :style="{ width: size + 'px', height: size + 'px' }">
    <!-- 占位符 -->
    <div v-if="!loaded" class="icon-placeholder" :style="placeholderStyle">
      <span class="placeholder-text">{{ initial }}</span>
    </div>
    <!-- 实际图标 -->
    <img
      v-show="loaded"
      :src="src"
      :alt="alt"
      @load="onLoad"
      @error="onError"
      class="app-icon-img"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 52
  },
  packageName: {
    type: String,
    default: ''
  }
})

const loaded = ref(false)
const error = ref(false)

// 从应用名称获取首字母
const initial = computed(() => {
  if (props.alt) {
    return props.alt.charAt(0).toUpperCase()
  }
  if (props.packageName) {
    // 从包名提取首字母（通常是最后一个点后的单词首字母）
    const parts = props.packageName.split('.')
    const lastPart = parts[parts.length - 1]
    return lastPart.charAt(0).toUpperCase()
  }
  return '?'
})

// 根据包名生成固定的背景色
const placeholderStyle = computed(() => {
  const colors = [
    '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6'
  ]
  // 使用包名的哈希值选择颜色
  let hash = 0
  const str = props.packageName || props.alt || ''
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colorIndex = Math.abs(hash) % colors.length

  return {
    width: props.size + 'px',
    height: props.size + 'px',
    backgroundColor: colors[colorIndex],
    borderRadius: '14px'
  }
})

const onLoad = () => {
  loaded.value = true
  error.value = false
}

const onError = () => {
  error.value = true
  loaded.value = true // 显示占位符
}

// 当 src 改变时重置加载状态
watch(() => props.src, () => {
  loaded.value = false
  error.value = false
})
</script>

<style scoped>
.lazy-app-icon {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: #f5f6fa;
  flex-shrink: 0;
}

.icon-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 1.5s ease-in-out infinite;
}

.placeholder-text {
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.app-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: fadeIn 0.3s ease;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
