<script setup>
import { computed } from 'vue'
import { useImageUrl } from '../composables/useImageUrl.js'

const props = defineProps({ product: { type: Object, required: true }, index: { type: Number, required: true } })
const emit = defineEmits(['open'])
const imageUrl = useImageUrl(computed(() => props.product.imageReference))
</script>

<template>
  <button class="group-product-row" type="button" :aria-label="`查看 ${product.name} 的商品詳情`" @click="emit('open', product.id)">
    <span class="group-product-number">{{ index + 1 }}</span>
    <span class="group-product-image"><img v-if="imageUrl" :src="imageUrl" :alt="product.name" /><span v-else aria-hidden="true">✦</span></span>
    <span class="group-product-copy"><strong>{{ product.name }}</strong><small>{{ [product.brand, product.category].filter(Boolean).join(' · ') || '未分類' }}</small></span>
    <span class="group-product-arrow" aria-hidden="true">›</span>
  </button>
</template>
