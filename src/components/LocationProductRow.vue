<script setup>
import { computed } from 'vue'
import { useImageUrl } from '../composables/useImageUrl.js'
import { formatPurchasePrice } from '../utils/purchase.js'

const props = defineProps({ product: { type: Object, required: true } })
const imageUrl = useImageUrl(computed(() => props.product.imageReference))
</script>

<template>
  <article class="location-product-row">
    <div class="location-product-image">
      <img v-if="imageUrl" :src="imageUrl" :alt="product.name" loading="lazy" />
      <span v-else aria-hidden="true">✦</span>
    </div>
    <div class="location-product-copy">
      <strong>{{ product.name }}</strong>
      <small v-if="product.brand || product.category">{{ [product.brand, product.category].filter(Boolean).join(' · ') }}</small>
      <span v-if="formatPurchasePrice(product.purchase)" class="location-product-price">{{ formatPurchasePrice(product.purchase) }}</span>
      <p v-if="product.purchase?.notes" class="location-product-notes">{{ product.purchase.notes }}</p>
    </div>
  </article>
</template>
