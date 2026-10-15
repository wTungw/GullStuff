<script setup>
import { computed } from 'vue'
import { useImageUrl } from '../composables/useImageUrl.js'

const props = defineProps({
  product: { type: Object, required: true },
  checked: { type: Boolean, default: false }
})
const emit = defineEmits(['toggle'])
const imageUrl = useImageUrl(computed(() => props.product.imageReference))
</script>

<template>
  <label class="product-picker-option" :class="{ selected: checked }">
    <input type="checkbox" :checked="checked" @change="emit('toggle', product.id, $event.target.checked)" />
    <span class="product-picker-image"><img v-if="imageUrl" :src="imageUrl" alt="" /><span v-else aria-hidden="true">✦</span></span>
    <span class="product-picker-copy"><strong>{{ product.name }}</strong><small>{{ [product.brand, product.category].filter(Boolean).join(' · ') || '未分類' }}</small></span>
  </label>
</template>
