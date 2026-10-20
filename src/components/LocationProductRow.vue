<script setup>
import { computed } from 'vue'
import { useImageUrl } from '../composables/useImageUrl.js'
import { formatPurchasePrice } from '../utils/purchase.js'

const props = defineProps({ product: { type: Object, required: true } })
const emit = defineEmits(['select'])
const imageUrl = useImageUrl(computed(() => props.product.imageReference))
</script>

<template>
  <button class="location-product-row" type="button" :aria-label="`查看 ${product.name} 的商品詳情`" @click="emit('select', product.id)">
    <div class="location-product-image">
      <img v-if="imageUrl" :src="imageUrl" :alt="product.name" loading="lazy" />
      <span v-else aria-hidden="true">✦</span>
    </div>
    <div class="location-product-copy">
      <strong>{{ product.name }}</strong>
      <small v-if="product.brand || product.category">{{ [product.brand, product.category].filter(Boolean).join(' · ') }}</small>
    </div>
    <div v-if="formatPurchasePrice(product.purchase) || product.purchase?.notes" class="location-product-purchase">
      <span v-if="formatPurchasePrice(product.purchase)" class="location-product-price">{{ formatPurchasePrice(product.purchase) }}</span>
      <p v-if="product.purchase?.notes" class="location-product-notes">{{ product.purchase.notes }}</p>
    </div>
  </button>
</template>
