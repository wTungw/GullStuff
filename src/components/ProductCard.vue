<script setup>
import { computed } from 'vue'
import { useImageUrl } from '../composables/useImageUrl.js'
const props = defineProps({ product: { type: Object, required: true } })
const emit = defineEmits(['open'])
const imageUrl = useImageUrl(computed(() => props.product.imageReference))
</script>

<template>
  <button class="product-card" type="button" @click="emit('open', product.id)" :aria-label="`查看 ${product.name}`">
    <span class="card-image">
      <img v-if="imageUrl" :src="imageUrl" :alt="product.name" loading="lazy" />
      <span v-else class="image-placeholder" aria-hidden="true">✦</span>
    </span>
    <span class="card-body">
      <span class="card-eyebrow">{{ product.category || '未分類' }}</span>
      <strong>{{ product.name }}</strong>
      <span class="card-meta">{{ [product.brand, product.model].filter(Boolean).join(' · ') || '點擊查看商品資訊' }}</span>
    </span>
    <span class="card-arrow" aria-hidden="true">›</span>
  </button>
</template>
