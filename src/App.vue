<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import ProductForm from './components/ProductForm.vue'
import { deleteProduct, filterProducts, listProducts, saveProduct } from './data/products.js'
import { useImageUrl } from './composables/useImageUrl.js'

const products = ref([])
const loading = ref(true)
const error = ref('')
const feedback = ref('')
let feedbackTimer
const saving = ref(false)
const deleting = ref(false)
const view = ref('library')
const selected = ref(null)
const query = ref('')
const category = ref('')
const showDelete = ref(false)
const showImagePreview = ref(false)
const imageTrigger = ref(null)
const imageCloseButton = ref(null)
const categories = computed(() => [...new Set(products.value.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-TW')))
const visible = computed(() => filterProducts(products.value, query.value, category.value))
const detailImage = useImageUrl(computed(() => view.value === 'detail' ? selected.value?.imageReference : null))

async function refresh() {
  loading.value = true
  error.value = ''
  try { products.value = await listProducts() }
  catch { error.value = '無法讀取本機資料，請重新整理頁面。' }
  finally { loading.value = false }
}
onMounted(refresh)
watch(feedback, message => {
  window.clearTimeout(feedbackTimer)
  if (message) feedbackTimer = window.setTimeout(() => { feedback.value = '' }, 3000)
})
function onKeyDown(event) {
  if (event.key === 'Escape') showImagePreview.value = false
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.clearTimeout(feedbackTimer)
})
watch(view, () => { showImagePreview.value = false })
watch(showImagePreview, async isOpen => {
  await nextTick()
  if (isOpen) imageCloseButton.value?.focus()
  else if (view.value === 'detail') imageTrigger.value?.focus()
})
function openProduct(id) {
  selected.value = products.value.find(p => p.id === id) ?? null
  view.value = selected.value ? 'detail' : 'library'
  window.scrollTo(0, 0)
}
function startCreate() { selected.value = null; view.value = 'form'; window.scrollTo(0, 0) }
function startEdit() { view.value = 'form'; window.scrollTo(0, 0) }
function goBack() { view.value = selected.value ? 'detail' : 'library'; window.scrollTo(0, 0) }
async function handleSave(fields, imageChange) {
  saving.value = true
  error.value = ''
  try {
    const saved = await saveProduct(fields, imageChange, selected.value?.id)
    await refresh()
    selected.value = saved
    view.value = 'detail'
    feedback.value = '商品已儲存。'
    window.scrollTo(0, 0)
  } catch (cause) { error.value = cause.message || '儲存失敗，請再試一次。' }
  finally { saving.value = false }
}
async function confirmDelete() {
  if (!selected.value) return
  deleting.value = true
  error.value = ''
  try {
    await deleteProduct(selected.value.id)
    await refresh()
    selected.value = null
    showDelete.value = false
    view.value = 'library'
    feedback.value = '商品已刪除。'
  } catch { error.value = '刪除失敗，請再試一次。'; showDelete.value = false }
  finally { deleting.value = false }
}
function navigate(target) { view.value = target; selected.value = null; feedback.value = ''; window.scrollTo(0, 0) }
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="navigate('library')"><span class="brand-mark" aria-hidden="true">✦</span><span>GullStuff<small>把喜歡的，好好收著。</small></span></a>
      <div class="nav-label">WORKSPACE</div>
      <nav aria-label="主要導覽">
        <button class="nav-item" :class="{ active: ['library','detail','form'].includes(view) }" @click="navigate('library')"><span aria-hidden="true">▦</span> 商品收藏 <span class="nav-count">{{ products.length }}</span></button>
        <button class="nav-item" :class="{ active: view === 'locations' }" @click="navigate('locations')"><span aria-hidden="true">⌖</span> 地點清單 <span class="soon-dot"></span></button>
        <button class="nav-item" :class="{ active: view === 'overview' }" @click="navigate('overview')"><span aria-hidden="true">◫</span> 總覽 <span class="soon-dot"></span></button>
      </nav>
      <div class="sidebar-bottom"><div class="privacy-note"><span aria-hidden="true">✳</span><strong>你的收藏，只屬於你。</strong><p>資料與照片保存在這台裝置，不需註冊帳號。</p></div><button class="nav-item settings-item" :class="{ active: view === 'settings' }" @click="navigate('settings')"><span aria-hidden="true">⚙</span> 設定</button></div>
    </aside>

    <main class="main-content">
      <div class="mobile-bar">
        <button v-if="view === 'form'" class="mobile-back" type="button" aria-label="返回" @click="goBack">‹</button>
        <button v-else-if="view !== 'library'" class="mobile-back" type="button" aria-label="返回商品收藏" @click="navigate('library')">‹</button>
        <span class="mobile-title"><small class="mobile-wordmark">GullStuff</small><span>{{ view === 'form' ? selected ? '編輯商品' : '新增商品' : view === 'detail' ? selected?.name : { library: '商品', locations: '地點', overview: '總覽', settings: '設定' }[view] }}</span></span>
        <button v-if="view === 'library'" class="mobile-add" type="button" @click="startCreate" aria-label="新增商品">＋</button>
        <button v-else-if="view === 'form'" class="mobile-save" type="submit" form="product-form" :disabled="saving">{{ saving ? '儲存中' : '儲存' }}</button>
        <button v-else-if="view === 'detail'" class="mobile-edit" type="button" @click="startEdit" aria-label="編輯商品">✎</button>
        <span v-else class="mobile-bar-spacer"></span>
      </div>
      <div v-if="feedback" class="toast" role="status">{{ feedback }} <button @click="feedback = ''" aria-label="關閉訊息">×</button></div>
      <div v-if="error" class="global-error" role="alert">{{ error }} <button @click="error = ''" aria-label="關閉錯誤">×</button></div>

      <template v-if="view === 'library'">
        <header class="page-heading library-heading"><div><p class="eyebrow">YOUR PERSONAL COLLECTION</p><h1>商品收藏<span class="heading-spark">✦</span></h1><p class="subtext">把旅途中想找、日常中喜歡的東西，收藏在這裡。</p></div><button class="primary-button desktop-add" @click="startCreate">＋ 新增商品</button></header>
        <section class="library-panel">
          <div class="section-top"><div><h2>所有商品 <span>{{ products.length }}</span></h2><p>一眼找到你記下的每件好物</p></div></div>
          <div class="toolbar"><label class="search-wrap"><span aria-hidden="true">⌕</span><span class="sr-only">搜尋商品名稱</span><input v-model="query" type="search" placeholder="搜尋商品名稱…" /></label><label class="filter-wrap"><span class="sr-only">依分類篩選</span><select v-model="category"><option value="">所有分類</option><option v-for="item in categories" :key="item" :value="item">{{ item }}</option></select></label></div>
          <div class="category-chips" aria-label="依分類篩選商品"><button type="button" :class="{ active: !category }" @click="category = ''">全部</button><button v-for="item in categories" :key="item" type="button" :class="{ active: category === item }" @click="category = item">{{ item }}</button></div>
          <div v-if="loading" class="state-box" role="status"><span class="state-symbol">◌</span><h3>正在載入收藏…</h3></div>
          <div v-else-if="error" class="state-box"><span class="state-symbol">!</span><h3>無法顯示商品</h3><button class="secondary-button" @click="refresh">重試</button></div>
          <div v-else-if="!products.length" class="state-box empty-state"><span class="empty-illustration" aria-hidden="true">✦</span><p class="eyebrow">START YOUR COLLECTION</p><h3>從第一件喜歡的東西開始</h3><p>看到想買的商品，先記下來。照片、品牌、備註都可以慢慢補。</p><button class="primary-button" @click="startCreate">＋ 新增第一件商品</button></div>
          <div v-else-if="!visible.length" class="state-box"><span class="state-symbol">⌕</span><h3>沒有找到符合的商品</h3><p>試試其他名稱，或切換分類。</p><button class="text-button" @click="query = ''; category = ''">清除搜尋與篩選</button></div>
          <div v-else class="product-grid"><ProductCard v-for="product in visible" :key="product.id" :product="product" @open="openProduct" /></div>
        </section>
      </template>

      <template v-else-if="view === 'detail' && selected">
        <header class="page-heading detail-heading"><div><button class="back-link" @click="navigate('library')">← 返回商品收藏</button><p class="eyebrow">PRODUCT DETAILS</p><h1>{{ selected.name }}</h1><p class="subtext">收藏於 {{ new Date(selected.createdAt).toLocaleDateString('zh-TW') }}</p></div><div class="heading-actions"><button class="secondary-button" @click="startEdit">編輯商品</button><button class="danger-button" @click="showDelete = true">刪除</button></div></header>
        <div class="detail-grid"><button ref="imageTrigger" class="detail-photo" type="button" :disabled="!detailImage" :aria-label="detailImage ? `放大檢視 ${selected.name} 的照片` : '尚無商品照片'" @click="showImagePreview = true"><img v-if="detailImage" :src="detailImage" :alt="selected.name" /><span v-else aria-hidden="true">✦</span></button><div class="detail-info panel"><div class="detail-summary"><p class="eyebrow">SAVED ITEM</p><h2>{{ selected.name }}</h2><p class="detail-date">收藏於 {{ new Date(selected.createdAt).toLocaleDateString('zh-TW') }}</p></div><div class="detail-fields"><div v-if="selected.brand"><small>品牌</small><span>{{ selected.brand }}</span></div><div v-if="selected.category"><small>分類</small><span>{{ selected.category }}</span></div><div v-if="selected.model"><small>型號 / 規格</small><span>{{ selected.model }}</span></div><div v-if="selected.notes"><small>備註</small><p class="notes">{{ selected.notes }}</p></div></div><div v-if="![selected.brand, selected.category, selected.model, selected.notes].some(Boolean)" class="detail-empty">還沒有其他資料，隨時可以編輯補上。</div><button class="mobile-detail-delete" type="button" @click="showDelete = true">刪除商品</button></div></div>
      </template>

      <ProductForm v-else-if="view === 'form'" :product="selected" :saving="saving" @save="handleSave" @cancel="goBack" />
      <div v-else class="coming-soon"><button class="back-link" @click="navigate('library')">← 返回商品收藏</button><span class="coming-icon">✦</span><p class="eyebrow">COMING SOON</p><h1>{{ { locations: '地點清單', overview: '收藏總覽', settings: '設定' }[view] }}</h1><p>這個功能正在規劃中。現在先把想買的商品收藏起來吧。</p><button class="primary-button" @click="navigate('library')">查看商品收藏</button></div>
    </main>
    <nav v-if="view !== 'form' && view !== 'detail'" class="mobile-nav" aria-label="行動版導覽"><button :class="{ active: view === 'library' }" @click="navigate('library')"><span>▦</span>商品</button><button :class="{ active: view === 'locations' }" @click="navigate('locations')"><span>⌖</span>地點</button><button :class="{ active: view === 'overview' }" @click="navigate('overview')"><span>◫</span>總覽</button><button :class="{ active: view === 'settings' }" @click="navigate('settings')"><span>⚙</span>設定</button></nav>
    <div v-if="showDelete" class="dialog-backdrop" @click.self="showDelete = false"><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-desc"><span class="dialog-icon">!</span><h2 id="delete-title">刪除這件商品？</h2><p id="delete-desc">「{{ selected?.name }}」與它的照片會從這台裝置永久刪除，無法復原。</p><div class="dialog-actions"><button class="secondary-button" :disabled="deleting" @click="showDelete = false">取消</button><button class="danger-fill" :disabled="deleting" @click="confirmDelete">{{ deleting ? '刪除中…' : '確認刪除' }}</button></div></div></div>
    <div v-if="showImagePreview && detailImage" class="image-preview" role="dialog" aria-modal="true" :aria-label="`${selected?.name} 的照片`" @click.self="showImagePreview = false"><button ref="imageCloseButton" class="image-preview-close" type="button" aria-label="關閉照片" @click="showImagePreview = false">×</button><img :src="detailImage" :alt="selected?.name" /></div>
  </div>
</template>
