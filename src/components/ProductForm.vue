<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { getImage } from '../data/products.js'
import { prepareImage } from '../data/image.js'

const props = defineProps({ product: Object, saving: Boolean })
const emit = defineEmits(['save', 'cancel'])
const fields = reactive({ name: '', brand: '', category: '', model: '', notes: '' })
const error = ref('')
const busyImage = ref(false)
const imageUrl = ref('')
const fileInput = ref(null)
let localUrl = ''
let imageChange
let generation = 0
const title = computed(() => props.product ? '編輯商品' : '新增商品')

function setUrl(blob) {
  if (localUrl) URL.revokeObjectURL(localUrl)
  localUrl = blob ? URL.createObjectURL(blob) : ''
  imageUrl.value = localUrl
}
watch(() => props.product, async product => {
  const current = ++generation
  for (const key of Object.keys(fields)) fields[key] = product?.[key] ?? ''
  imageChange = undefined
  error.value = ''
  setUrl(null)
  if (product?.imageReference) {
    try {
      const blob = await getImage(product.imageReference)
      if (current === generation && blob) setUrl(blob)
    } catch { /* image placeholder remains visible */ }
  }
}, { immediate: true })
onUnmounted(() => { generation++; if (localUrl) URL.revokeObjectURL(localUrl) })

async function selectImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  busyImage.value = true
  error.value = ''
  try {
    imageChange = await prepareImage(file)
    setUrl(imageChange)
  } catch (cause) { error.value = cause.message }
  finally { busyImage.value = false; event.target.value = '' }
}
function removeImage() { imageChange = null; setUrl(null) }
function submit() {
  error.value = ''
  if (busyImage.value || props.saving) return
  if (!fields.name.trim()) { error.value = '請填寫商品名稱。'; return }
  emit('save', { ...fields }, imageChange)
}
</script>

<template>
  <div class="editor-shell product-editor">
    <div class="page-heading editor-heading">
      <div>
        <button class="back-link" type="button" @click="emit('cancel')">← 返回</button>
        <p class="eyebrow">MY COLLECTION / {{ product ? 'EDIT' : 'NEW' }}</p>
        <h1>{{ title }}</h1>
        <p class="subtext">先記下想買的東西，其他資訊之後再補上也可以。</p>
      </div>
    </div>
    <form id="product-form" class="editor-grid" @submit.prevent="submit">
      <div class="form-main panel">
        <div class="section-title"><span class="step">01</span><div><h2>基本資料</h2><p>只有名稱是必填，其餘依你手邊的資訊填寫。</p></div></div>
        <label class="field"><span>商品名稱 <em>必填</em></span><input v-model="fields.name" maxlength="150" required placeholder="例如：喜歡的咖啡杯" autocomplete="off" /></label>
        <div class="field-row">
          <label class="field"><span>品牌</span><input v-model="fields.brand" placeholder="選填" /></label>
          <label class="field"><span>分類</span><input v-model="fields.category" placeholder="例如：生活用品" /></label>
        </div>
        <label class="field"><span>型號 / 規格</span><input v-model="fields.model" placeholder="顏色、尺寸或型號" /></label>
        <label class="field"><span>備註</span><textarea v-model="fields.notes" rows="5" placeholder="記下喜歡它的原因、看到的資訊……"></textarea></label>
      </div>
      <div class="form-side">
        <div class="panel image-panel">
          <div class="section-title"><span class="step">02</span><div><h2>商品照片</h2><p>照片只會保存在此裝置。</p></div></div>
          <input ref="fileInput" class="sr-only" type="file" accept="image/*" @change="selectImage" />
          <div class="photo-picker">
            <div class="upload-preview" :class="{ 'has-image': imageUrl }"><img v-if="imageUrl" :src="imageUrl" alt="商品照片預覽" /><span v-else aria-hidden="true">✦</span></div>
            <button class="secondary-button upload-button" type="button" :disabled="busyImage || saving" @click="fileInput.click()"><span class="camera-symbol" aria-hidden="true">▣</span>{{ busyImage ? '處理照片中…' : imageUrl ? '更換照片' : '新增照片' }}</button>
          </div>
          <button v-if="imageUrl" class="text-button full" type="button" :disabled="saving" @click="removeImage">移除照片</button>
          <p class="hint">支援圖片檔，最大 15 MB。加入時會縮放，方便保存在裝置中。</p>
        </div>
        <div class="form-actions"><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="primary-button full" type="submit" :disabled="saving || busyImage">{{ saving ? '儲存中…' : '儲存' }} <span aria-hidden="true">↗</span></button><button class="text-button full" type="button" @click="emit('cancel')">取消</button></div>
      </div>
    </form>
  </div>
</template>
