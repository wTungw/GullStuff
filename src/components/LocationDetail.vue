<script setup>
import LocationProductRow from './LocationProductRow.vue'

defineProps({
  location: { type: Object, required: true },
  products: { type: Array, required: true },
  loading: Boolean,
  error: Boolean
})
const emit = defineEmits(['retry', 'select-product'])
</script>

<template>
  <div class="location-detail-page">
    <section class="location-detail-overview panel" aria-labelledby="location-detail-title">
      <div class="location-detail-icon" aria-hidden="true">⌖</div>
      <div class="location-detail-summary">
        <p class="eyebrow">SAVED PLACE</p>
        <h1 id="location-detail-title">{{ location.name }}</h1>
        <p v-if="location.city || location.country || location.area" class="location-detail-region">{{ [location.country, location.city, location.area].filter(Boolean).join(' · ') }}</p>
      </div>
    </section>
    <section v-if="location.address || location.notes" class="location-detail-fields panel" aria-label="地點資訊">
      <div v-if="location.address"><span>地址</span><p>{{ location.address }}</p></div>
      <div v-if="location.notes"><span>備註</span><p class="notes">{{ location.notes }}</p></div>
    </section>
    <section class="location-detail-products panel" aria-labelledby="location-detail-products-title">
      <div class="location-detail-products-heading"><div><p class="eyebrow">SAVED AT THIS PLACE</p><h2 id="location-detail-products-title">可購買商品 <span v-if="!loading && !error">{{ products.length }}</span></h2></div></div>
      <p v-if="loading" class="location-detail-message" role="status">正在載入商品…</p>
      <p v-else-if="error" class="location-detail-message" role="alert">無法讀取已連結商品。<button class="text-button" type="button" @click="emit('retry')">重試</button></p>
      <p v-else-if="!products.length" class="location-detail-message">這個地點還沒有連結商品。點選「編輯地點」即可加入。</p>
      <div v-else class="location-detail-product-list"><LocationProductRow v-for="product in products" :key="product.id" :product="product" @select="emit('select-product', $event)" /></div>
    </section>
  </div>
</template>
