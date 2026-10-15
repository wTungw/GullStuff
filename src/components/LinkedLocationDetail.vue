<script setup>
import { onMounted, ref } from 'vue'

defineProps({
  location: { type: Object, required: true },
  busy: Boolean,
  error: String
})
const emit = defineEmits(['close', 'unlink', 'edit'])
const closeButton = ref(null)
onMounted(() => closeButton.value?.focus())
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section class="dialog linked-location-detail" role="dialog" aria-modal="true" aria-labelledby="linked-location-detail-title">
      <div class="linked-location-detail-header">
        <div><p class="eyebrow">PLACE DETAILS</p><h2 id="linked-location-detail-title">{{ location.name }}</h2></div>
        <button ref="closeButton" class="location-link-close" type="button" aria-label="關閉地點詳情" :disabled="busy" @click="emit('close')">×</button>
      </div>
      <dl class="linked-location-detail-fields">
        <div v-if="location.city || location.country || location.area"><dt>地區</dt><dd>{{ [location.country, location.city, location.area].filter(Boolean).join(' · ') }}</dd></div>
        <div v-if="location.address"><dt>地址</dt><dd>{{ location.address }}</dd></div>
        <div v-if="location.notes"><dt>備註</dt><dd class="notes">{{ location.notes }}</dd></div>
      </dl>
      <p v-if="!location.city && !location.country && !location.area && !location.address && !location.notes" class="linked-location-detail-empty">尚未填寫位置資訊。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="linked-location-detail-actions">
        <button class="danger-button" type="button" :disabled="busy" @click="emit('unlink')">{{ busy ? '取消連結中…' : '取消連結' }}</button>
        <button class="primary-button" type="button" :disabled="busy" @click="emit('edit')">編輯地點</button>
      </div>
    </section>
  </div>
</template>
