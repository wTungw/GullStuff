<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  locations: { type: Array, required: true },
  linkedIds: { type: Array, required: true },
  loading: Boolean,
  error: String,
  busyId: String
})
const emit = defineEmits(['close', 'retry', 'select', 'create'])
const query = ref('')
const searchInput = ref(null)
const linkedSet = computed(() => new Set(props.linkedIds))
const matches = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('zh-TW')
  return needle
    ? props.locations.filter(location => [location.name, location.city, location.country, location.area, location.address]
      .some(value => value?.toLocaleLowerCase('zh-TW').includes(needle)))
    : props.locations
})
onMounted(() => searchInput.value?.focus())
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section class="dialog location-link-dialog" role="dialog" aria-modal="true" aria-labelledby="location-link-title">
      <div class="location-link-header"><div><h2 id="location-link-title">連結既有地點</h2><p>先找找收藏過的地點，點選後即可連結這件商品。</p></div><button class="location-link-close" type="button" aria-label="關閉地點列表" :disabled="Boolean(busyId)" @click="emit('close')">×</button></div>
      <label class="location-link-search"><span class="sr-only">搜尋地點名稱、地區或地址</span><input ref="searchInput" v-model="query" type="search" placeholder="搜尋地點名稱、地區或地址…" /></label>
      <p v-if="loading" class="product-picker-message" role="status">正在載入地點…</p>
      <div v-else-if="error" class="product-picker-message" role="alert">{{ error }} <button class="text-button" type="button" @click="emit('retry')">重試</button></div>
      <template v-else>
        <div v-if="matches.length" class="location-link-list"><button v-for="location in matches" :key="location.id" class="location-row" type="button" :disabled="linkedSet.has(location.id) || Boolean(busyId)" :aria-label="`${[location.name, location.city, location.country, location.address].filter(Boolean).join('，')}，${linkedSet.has(location.id) ? '已連結' : '點擊連結'}`" @click="emit('select', location.id)"><span class="location-pin" aria-hidden="true">⌖</span><span class="location-row-main"><strong>{{ location.name }}</strong><small v-if="location.city || location.country">{{ [location.city, location.country].filter(Boolean).join(' · ') }}</small><small v-if="location.address" class="location-row-address">{{ location.address }}</small></span><span class="location-link-status">{{ linkedSet.has(location.id) ? '已連結' : busyId === location.id ? '連結中…' : '連結' }}</span></button></div>
        <div v-else class="location-link-empty"><p>{{ locations.length ? '沒有找到符合的地點。' : '目前還沒有地點。' }}</p><button class="location-create-product" type="button" @click="emit('create', query.trim())">＋ 新增地點並連結</button></div>
      </template>
    </section>
  </div>
</template>
