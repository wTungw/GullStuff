<script setup>
import { onMounted, ref, watch } from 'vue'
import { formatPurchasePrice } from '../utils/purchase.js'

const props = defineProps({
  location: { type: Object, required: true },
  busy: Boolean,
  error: String,
  purchaseSaving: Boolean,
  purchaseError: String,
  purchaseSavedKey: Number
})
const emit = defineEmits(['close', 'unlink', 'edit', 'save-purchase', 'clear-purchase-error'])
const closeButton = ref(null)
const priceInput = ref(null)
const editingPurchase = ref(false)
const priceDraft = ref('')
const currencyDraft = ref('TWD')
const customCurrencyDraft = ref('')
const notesDraft = ref('')
const currencyOptions = [
  ['TWD', '新臺幣 TWD'], ['JPY', '日圓 JPY'], ['USD', '美元 USD'],
  ['KRW', '韓元 KRW'], ['CNY', '人民幣 CNY'], ['HKD', '港幣 HKD'],
  ['EUR', '歐元 EUR'], ['GBP', '英鎊 GBP'], ['SGD', '新加坡幣 SGD'],
  ['THB', '泰銖 THB'], ['AUD', '澳幣 AUD'], ['CAD', '加幣 CAD']
]
function openPurchaseEditor() {
  emit('clear-purchase-error')
  priceDraft.value = props.location.purchase?.price == null ? '' : String(props.location.purchase.price)
  const savedCurrency = props.location.purchase?.currency || 'TWD'
  currencyDraft.value = currencyOptions.some(([code]) => code === savedCurrency) ? savedCurrency : 'other'
  customCurrencyDraft.value = currencyDraft.value === 'other' ? savedCurrency : ''
  notesDraft.value = props.location.purchase?.notes || ''
  editingPurchase.value = true
  requestAnimationFrame(() => priceInput.value?.focus())
}
function cancelPurchaseEditor() {
  editingPurchase.value = false
  emit('clear-purchase-error')
}
function submitPurchase() {
  emit('save-purchase', {
    price: priceDraft.value,
    currency: currencyDraft.value === 'other' ? customCurrencyDraft.value : currencyDraft.value,
    notes: notesDraft.value
  })
}
watch(() => props.purchaseSavedKey, () => { editingPurchase.value = false })
onMounted(() => closeButton.value?.focus())
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section class="dialog linked-location-detail" role="dialog" aria-modal="true" aria-labelledby="linked-location-detail-title">
      <div class="linked-location-detail-header">
        <div><p class="eyebrow">PLACE DETAILS</p><h2 id="linked-location-detail-title">{{ location.name }}</h2></div>
        <button ref="closeButton" class="location-link-close" type="button" aria-label="關閉地點詳情" :disabled="busy || purchaseSaving" @click="emit('close')">×</button>
      </div>
      <dl class="linked-location-detail-fields">
        <div v-if="location.city || location.country || location.area"><dt>地區</dt><dd>{{ [location.country, location.city, location.area].filter(Boolean).join(' · ') }}</dd></div>
        <div v-if="location.address"><dt>地址</dt><dd>{{ location.address }}</dd></div>
        <div v-if="location.notes"><dt>備註</dt><dd class="notes">{{ location.notes }}</dd></div>
      </dl>
      <p v-if="!location.city && !location.country && !location.area && !location.address && !location.notes" class="linked-location-detail-empty">尚未填寫位置資訊。</p>
      <div class="purchase-detail">
        <div class="purchase-detail-heading"><h3>購買資訊</h3><button v-if="!editingPurchase" class="text-button" type="button" :disabled="busy" @click="openPurchaseEditor">編輯</button></div>
        <form v-if="editingPurchase" class="purchase-form" @submit.prevent="submitPurchase">
          <div class="purchase-form-row">
            <label class="field"><span>價格</span><input ref="priceInput" v-model="priceDraft" type="text" inputmode="decimal" placeholder="例如 250" :disabled="purchaseSaving" /></label>
            <label class="field"><span>幣別</span><select v-model="currencyDraft" :disabled="purchaseSaving"><option v-for="[code, label] in currencyOptions" :key="code" :value="code">{{ label }}</option><option value="other">其他幣別…</option></select></label>
          </div>
          <label v-if="currencyDraft === 'other'" class="field"><span>幣別代碼</span><input v-model="customCurrencyDraft" type="text" maxlength="3" autocapitalize="characters" placeholder="例如 CHF" :disabled="purchaseSaving" /></label>
          <label class="field"><span>購買備註</span><textarea v-model="notesDraft" maxlength="500" rows="3" placeholder="例如：二樓有販售、限時折扣" :disabled="purchaseSaving"></textarea></label>
          <p v-if="purchaseError" class="form-error" role="alert">{{ purchaseError }}</p>
          <div class="purchase-form-actions"><button class="text-button" type="button" :disabled="purchaseSaving || busy" @click="cancelPurchaseEditor">取消</button><button class="primary-button" type="submit" :disabled="purchaseSaving || busy">{{ purchaseSaving ? '儲存中…' : '儲存購買資訊' }}</button></div>
        </form>
        <template v-else>
          <strong v-if="formatPurchasePrice(location.purchase)" class="purchase-price">{{ formatPurchasePrice(location.purchase) }}</strong>
          <p v-if="location.purchase?.notes" class="purchase-notes">{{ location.purchase.notes }}</p>
          <p v-if="!formatPurchasePrice(location.purchase) && !location.purchase?.notes" class="purchase-empty">尚未記錄價格或購買備註。</p>
        </template>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div v-if="!editingPurchase" class="linked-location-detail-actions">
        <button class="danger-button" type="button" :disabled="busy || purchaseSaving" @click="emit('unlink')">{{ busy ? '取消連結中…' : '取消連結' }}</button>
        <button class="primary-button" type="button" :disabled="busy || purchaseSaving" @click="emit('edit')">編輯地點</button>
      </div>
    </section>
  </div>
</template>
