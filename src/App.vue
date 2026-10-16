<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import ProductForm from './components/ProductForm.vue'
import ProductPickerOption from './components/ProductPickerOption.vue'
import LocationLinkPicker from './components/LocationLinkPicker.vue'
import LinkedLocationDetail from './components/LinkedLocationDetail.vue'
import LocationDetail from './components/LocationDetail.vue'
import { deleteProduct, filterProducts, listProducts, saveProduct } from './data/products.js'
import { deleteLocation, linkProductToLocation, listLocations, listLocationsForProduct, listProductIdsForLocation, listProductsForLocation, saveLocation, saveLocationPurchase, unlinkProductFromLocation } from './data/locations.js'
import { useImageUrl } from './composables/useImageUrl.js'
import { formatPurchasePrice } from './utils/purchase.js'

const products = ref([])
const loading = ref(true)
const error = ref('')
const feedback = ref('')
let feedbackTimer
let locationFormRequest = 0
let linkedLocationsRequest = 0
let locationDetailRequest = 0
let locationPickerRequest = 0
const saving = ref(false)
const deleting = ref(false)
const view = ref('library')
const mainContent = ref(null)
const selected = ref(null)
const query = ref('')
const category = ref('')
const showDelete = ref(false)
const showImagePreview = ref(false)
const imageTrigger = ref(null)
const imageCloseButton = ref(null)
const locations = ref([])
const locationDetail = ref(null)
const locationDetailProducts = ref([])
const locationDetailLoading = ref(false)
const locationDetailError = ref(false)
const linkedLocations = ref([])
const linkedLocationsLoading = ref(false)
const linkedLocationsError = ref(false)
const locationPickerOpen = ref(false)
const locationPickerLocations = ref([])
const locationPickerLinkedIds = ref([])
const locationPickerLoading = ref(false)
const locationPickerError = ref('')
const linkingLocationId = ref('')
const locationPickerTrigger = ref(null)
const linkedLocationDetail = ref(null)
const unlinkingLocation = ref(false)
const unlinkLocationError = ref('')
const purchaseSaving = ref(false)
const purchaseError = ref('')
const purchaseSavedKey = ref(0)
let linkedLocationTrigger = null
const locationQuery = ref('')
const locationCity = ref('')
const locationsLoading = ref(false)
const locationError = ref('')
const locationFormOpen = ref(false)
const locationSaving = ref(false)
const locationDeleting = ref(false)
const showLocationDelete = ref(false)
const selectedLocation = ref(null)
const locationNameInput = ref(null)
const locationDraft = ref({ name: '', country: '', city: '', area: '', address: '', notes: '' })
const locationExtraOpen = ref(false)
const selectedProductIds = ref([])
const locationProductQuery = ref('')
const locationLinksLoading = ref(false)
const locationLinksFailed = ref(false)
const creatingProductForLocation = ref(false)
const locationProductsSection = ref(null)
const categories = computed(() => [...new Set(products.value.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-TW')))
const visible = computed(() => filterProducts(products.value, query.value, category.value))
const productChoices = computed(() => {
  const needle = locationProductQuery.value.trim().toLocaleLowerCase('zh-TW')
  return needle ? products.value.filter(product => [product.name, product.brand, product.category].some(value => value?.toLocaleLowerCase('zh-TW').includes(needle))) : products.value
})
const locationCities = computed(() => [...new Set(locations.value.map(location => location.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-TW')))
const visibleLocations = computed(() => {
  const needle = locationQuery.value.trim().toLocaleLowerCase('zh-TW')
  return locations.value.filter(location =>
    (!needle || [location.name, location.country, location.city, location.area, location.address].some(value => value?.toLocaleLowerCase('zh-TW').includes(needle))) &&
    (!locationCity.value || location.city === locationCity.value)
  )
})
const detailImage = useImageUrl(computed(() => view.value === 'detail' ? selected.value?.imageReference : null))

async function refresh() {
  loading.value = true
  error.value = ''
  try { products.value = await listProducts() }
  catch { error.value = '無法讀取本機資料，請重新整理頁面。' }
  finally { loading.value = false }
}
onMounted(refresh)
async function refreshLocations() {
  locationsLoading.value = true
  locationError.value = ''
  try { locations.value = await listLocations() }
  catch { locationError.value = '無法讀取地點，請重試。' }
  finally { locationsLoading.value = false }
}
async function refreshLocationDetailProducts() {
  const locationId = view.value === 'location-detail' ? locationDetail.value?.id : null
  const requestId = ++locationDetailRequest
  if (!locationId) { locationDetailProducts.value = []; locationDetailLoading.value = false; locationDetailError.value = false; return }
  locationDetailLoading.value = true
  locationDetailError.value = false
  try {
    const result = await listProductsForLocation(locationId)
    if (requestId === locationDetailRequest) locationDetailProducts.value = result
  } catch {
    if (requestId === locationDetailRequest) locationDetailError.value = true
  } finally {
    if (requestId === locationDetailRequest) locationDetailLoading.value = false
  }
}
function openLocationDetail(location) {
  locationDetail.value = location
  view.value = 'location-detail'
  refreshLocationDetailProducts()
  scrollToTop()
}
async function refreshLinkedLocations() {
  const requestId = ++linkedLocationsRequest
  const productId = view.value === 'detail' ? selected.value?.id : null
  if (!productId) { linkedLocations.value = []; linkedLocationsLoading.value = false; linkedLocationsError.value = false; return }
  linkedLocationsLoading.value = true
  linkedLocationsError.value = false
  try {
    const result = await listLocationsForProduct(productId)
    if (requestId === linkedLocationsRequest) linkedLocations.value = result
  } catch {
    if (requestId === linkedLocationsRequest) linkedLocationsError.value = true
  } finally {
    if (requestId === linkedLocationsRequest) linkedLocationsLoading.value = false
  }
}
watch(() => view.value === 'detail' ? selected.value?.id : null, refreshLinkedLocations)
async function loadLocationPicker() {
  const productId = selected.value?.id
  if (!productId) return
  const requestId = ++locationPickerRequest
  locationPickerLoading.value = true
  locationPickerError.value = ''
  try {
    const [allLocations, linked] = await Promise.all([listLocations(), listLocationsForProduct(productId)])
    if (requestId !== locationPickerRequest || !locationPickerOpen.value || selected.value?.id !== productId) return
    locationPickerLocations.value = allLocations
    locationPickerLinkedIds.value = linked.map(location => location.id)
  } catch { if (requestId === locationPickerRequest) locationPickerError.value = '無法讀取地點，請重試。' }
  finally { if (requestId === locationPickerRequest) locationPickerLoading.value = false }
}
function openLocationPicker() {
  locationPickerLocations.value = []
  locationPickerLinkedIds.value = []
  locationPickerOpen.value = true
  loadLocationPicker()
}
function closeLocationPicker() {
  if (linkingLocationId.value) return
  locationPickerRequest += 1
  locationPickerOpen.value = false
  locationPickerError.value = ''
  nextTick(() => locationPickerTrigger.value?.focus())
}
async function selectLocationForProduct(locationId) {
  if (linkingLocationId.value || !selected.value?.id) return
  linkingLocationId.value = locationId
  locationPickerError.value = ''
  try {
    await linkProductToLocation(selected.value.id, locationId)
    await refreshLinkedLocations()
    locationPickerRequest += 1
    locationPickerOpen.value = false
    feedback.value = '商品已連結地點。'
    nextTick(() => locationPickerTrigger.value?.focus())
  } catch (cause) { locationPickerError.value = cause.message || '連結失敗，請重試。' }
  finally { linkingLocationId.value = '' }
}
function createLocationFromPicker(name) {
  if (linkingLocationId.value) return
  closeLocationPicker()
  openLocationForm(null, selected.value?.id, name)
}
function openLinkedLocationDetail(location, event) {
  linkedLocationTrigger = event.currentTarget
  unlinkLocationError.value = ''
  purchaseError.value = ''
  linkedLocationDetail.value = location
}
function closeLinkedLocationDetail() {
  if (!linkedLocationDetail.value || unlinkingLocation.value || purchaseSaving.value) return
  linkedLocationDetail.value = null
  unlinkLocationError.value = ''
  purchaseError.value = ''
  nextTick(() => (linkedLocationTrigger?.isConnected ? linkedLocationTrigger : locationPickerTrigger.value)?.focus())
}
async function saveLinkedLocationPurchase(fields) {
  const productId = selected.value?.id
  const locationId = linkedLocationDetail.value?.id
  if (!productId || !locationId || purchaseSaving.value || unlinkingLocation.value) return
  purchaseSaving.value = true
  purchaseError.value = ''
  try {
    const purchase = await saveLocationPurchase(productId, locationId, fields)
    linkedLocationDetail.value = { ...linkedLocationDetail.value, purchase }
    await refreshLinkedLocations()
    linkedLocationDetail.value = linkedLocations.value.find(location => location.id === locationId) ?? linkedLocationDetail.value
    purchaseSavedKey.value += 1
    feedback.value = '購買資訊已更新。'
  } catch (cause) { purchaseError.value = cause.message || '儲存購買資訊失敗，請重試。' }
  finally { purchaseSaving.value = false }
}
function editLinkedLocation() {
  const location = linkedLocationDetail.value
  closeLinkedLocationDetail()
  if (location) openLocationForm(location)
}
async function unlinkLinkedLocation() {
  const productId = selected.value?.id
  const locationId = linkedLocationDetail.value?.id
  if (!productId || !locationId || unlinkingLocation.value || purchaseSaving.value) return
  unlinkingLocation.value = true
  unlinkLocationError.value = ''
  try {
    await unlinkProductFromLocation(productId, locationId)
    await refreshLinkedLocations()
    linkedLocationDetail.value = null
    feedback.value = '已取消商品與地點的連結。'
    nextTick(() => locationPickerTrigger.value?.focus())
  } catch (cause) { unlinkLocationError.value = cause.message || '取消連結失敗，請重試。' }
  finally { unlinkingLocation.value = false }
}
async function openLocationForm(location = null, preselectedProductId = null, initialName = '') {
  const requestId = ++locationFormRequest
  selectedLocation.value = location
  locationDraft.value = Object.fromEntries(['name', 'country', 'city', 'area', 'address', 'notes'].map(key => [key, location?.[key] ?? '']))
  if (!location) locationDraft.value.name = initialName
  locationExtraOpen.value = Boolean(location?.country || location?.area)
  selectedProductIds.value = preselectedProductId ? [preselectedProductId] : []
  locationProductQuery.value = ''
  locationLinksLoading.value = Boolean(location)
  locationLinksFailed.value = false
  locationError.value = ''
  locationFormOpen.value = true
  await nextTick()
  locationNameInput.value?.focus()
  if (location) {
    try {
      const ids = await listProductIdsForLocation(location.id)
      if (requestId === locationFormRequest) selectedProductIds.value = ids
    } catch { if (requestId === locationFormRequest) { locationLinksFailed.value = true; locationError.value = '無法讀取已連結商品，請關閉後重試。' } }
    finally { if (requestId === locationFormRequest) locationLinksLoading.value = false }
  }
}
function toggleProductSelection(productId, checked) {
  const ids = new Set(selectedProductIds.value)
  if (checked) ids.add(productId)
  else ids.delete(productId)
  selectedProductIds.value = [...ids]
}
function closeLocationForm() {
  if (locationSaving.value) return
  locationFormRequest += 1
  locationFormOpen.value = false
  selectedLocation.value = null
  locationError.value = ''
}
async function handleLocationSave() {
  if (locationLinksLoading.value || locationLinksFailed.value || loading.value || error.value) return
  locationSaving.value = true
  locationError.value = ''
  try {
    const saved = await saveLocation(locationDraft.value, selectedLocation.value?.id, selectedProductIds.value)
    await refreshLocations()
    if (view.value === 'detail') await refreshLinkedLocations()
    if (view.value === 'location-detail' && locationDetail.value?.id === saved.id) {
      locationDetail.value = { ...saved, productCount: selectedProductIds.value.length }
      await refreshLocationDetailProducts()
    }
    locationFormOpen.value = false
    feedback.value = selectedLocation.value ? '地點已更新。' : '地點已新增。'
    selectedLocation.value = null
  } catch (cause) { locationError.value = cause.message || '儲存地點失敗，請再試一次。' }
  finally { locationSaving.value = false }
}
function requestLocationDelete() {
  locationFormOpen.value = false
  showLocationDelete.value = true
}
async function confirmLocationDelete() {
  if (!selectedLocation.value) return
  locationDeleting.value = true
  locationError.value = ''
  try {
    const deleted = await deleteLocation(selectedLocation.value.id)
    if (!deleted) throw new Error('找不到這個地點，可能已被刪除。')
    await refreshLocations()
    if (view.value === 'detail') await refreshLinkedLocations()
    if (view.value === 'location-detail' && locationDetail.value?.id === selectedLocation.value.id) {
      locationDetailRequest += 1
      locationDetail.value = null
      locationDetailProducts.value = []
      view.value = 'locations'
    }
    showLocationDelete.value = false
    selectedLocation.value = null
    feedback.value = '地點已刪除。'
  } catch (cause) { locationError.value = cause.message || '刪除地點失敗，請再試一次。'; showLocationDelete.value = false }
  finally { locationDeleting.value = false }
}
watch(feedback, message => {
  window.clearTimeout(feedbackTimer)
  if (message) feedbackTimer = window.setTimeout(() => { feedback.value = '' }, 3000)
})
function onKeyDown(event) {
  if (event.key === 'Escape') {
    showImagePreview.value = false
    if (locationFormOpen.value && !locationSaving.value) closeLocationForm()
    if (showLocationDelete.value && !locationDeleting.value) showLocationDelete.value = false
    if (locationPickerOpen.value) closeLocationPicker()
    if (linkedLocationDetail.value) closeLinkedLocationDetail()
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.clearTimeout(feedbackTimer)
})
watch(view, async () => {
  showImagePreview.value = false
  await nextTick()
  scrollToTop()
})
watch(showImagePreview, async isOpen => {
  await nextTick()
  if (isOpen) imageCloseButton.value?.focus()
  else if (view.value === 'detail') imageTrigger.value?.focus()
})
function scrollToTop() {
  mainContent.value?.scrollTo(0, 0)
  window.scrollTo(0, 0)
}
function openProduct(id) {
  selected.value = products.value.find(p => p.id === id) ?? null
  view.value = selected.value ? 'detail' : 'library'
  scrollToTop()
}
function startCreate() { selected.value = null; view.value = 'form'; scrollToTop() }
function startEdit() { view.value = 'form'; scrollToTop() }
function startProductForLocation() {
  if (locationSaving.value || locationLinksLoading.value || locationLinksFailed.value) return
  creatingProductForLocation.value = true
  locationFormOpen.value = false
  selected.value = null
  view.value = 'form'
  scrollToTop()
}
async function returnToLocationForm(productId) {
  if (!productId) await refresh()
  if (productId) {
    toggleProductSelection(productId, true)
    locationProductQuery.value = ''
  }
  creatingProductForLocation.value = false
  view.value = 'locations'
  locationFormOpen.value = true
  scrollToTop()
  await nextTick()
  if (productId) locationProductsSection.value?.focus()
  else locationNameInput.value?.focus()
}
function goBack() {
  if (creatingProductForLocation.value) { returnToLocationForm(); return }
  view.value = selected.value ? 'detail' : 'library'
  scrollToTop()
}
async function handleSave(fields, imageChange) {
  saving.value = true
  error.value = ''
  try {
    const saved = await saveProduct(fields, imageChange, selected.value?.id)
    await refresh()
    if (creatingProductForLocation.value) {
      if (!products.value.some(product => product.id === saved.id)) products.value = [saved, ...products.value]
      error.value = ''
      feedback.value = '商品已新增並勾選，儲存地點後完成連結。'
      await returnToLocationForm(saved.id)
      return
    }
    selected.value = saved
    view.value = 'detail'
    feedback.value = '商品已儲存。'
    scrollToTop()
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
function navigate(target) {
  if (unlinkingLocation.value || purchaseSaving.value) return
  creatingProductForLocation.value = false
  closeLocationPicker()
  closeLinkedLocationDetail()
  locationDetailRequest += 1
  locationDetail.value = null
  locationDetailProducts.value = []
  view.value = target
  selected.value = null
  feedback.value = ''
  closeLocationForm()
  showLocationDelete.value = false
  if (target === 'locations') refreshLocations()
  scrollToTop()
}
</script>

<template>
  <div class="app-shell" :class="{ 'collection-shell': view === 'library' || view === 'locations' }">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="navigate('library')"><span class="brand-mark" aria-hidden="true"><img src="/icon.svg" alt="" /></span><span>GullStuff<small>把喜歡的，好好收著。</small></span></a>
      <div class="nav-label">WORKSPACE</div>
      <nav aria-label="主要導覽">
        <button class="nav-item" :class="{ active: ['library','detail','form'].includes(view) }" @click="navigate('library')"><span aria-hidden="true">▦</span> 商品收藏 <span class="nav-count">{{ products.length }}</span></button>
        <button class="nav-item" :class="{ active: view === 'locations' || view === 'location-detail' }" @click="navigate('locations')"><span aria-hidden="true">⌖</span> 地點列表</button>
        <button class="nav-item" :class="{ active: view === 'overview' }" @click="navigate('overview')"><span aria-hidden="true">◫</span> 總覽 <span class="soon-dot"></span></button>
      </nav>
      <div class="sidebar-bottom"><div class="privacy-note"><span aria-hidden="true">✳</span><strong>你的收藏，只屬於你。</strong><p>資料與照片保存在這台裝置，不需註冊帳號。</p></div><button class="nav-item settings-item" :class="{ active: view === 'settings' }" @click="navigate('settings')"><span aria-hidden="true">⚙</span> 設定</button></div>
    </aside>

    <main ref="mainContent" class="main-content">
      <div class="mobile-bar" :class="{ 'is-collection': view === 'library' || view === 'locations', 'is-detail': view === 'detail' || view === 'location-detail' }">
        <button v-if="view === 'form'" class="mobile-back" type="button" aria-label="返回" @click="goBack">‹</button>
        <button v-else-if="view === 'location-detail'" class="mobile-back" type="button" aria-label="返回地點列表" @click="navigate('locations')">‹</button>
        <button v-else-if="view !== 'library' && view !== 'locations'" class="mobile-back" type="button" aria-label="返回商品收藏" @click="navigate('library')">‹</button>
        <span class="mobile-title"><small class="mobile-wordmark"><span class="brand-mark" aria-hidden="true"><img src="/icon.svg" alt="" /></span>GullStuff</small><span v-if="view !== 'detail' && view !== 'location-detail'">{{ view === 'form' ? selected ? '編輯商品' : '新增商品' : { library: '商品', locations: '地點列表', overview: '總覽', settings: '設定' }[view] }}</span></span>
        <span v-if="view === 'library' || view === 'locations'" class="mobile-bar-spacer"></span>
        <button v-else-if="view === 'form'" class="mobile-save" type="submit" form="product-form" :disabled="saving">{{ saving ? '儲存中' : '儲存' }}</button>
        <button v-else-if="view === 'detail'" class="mobile-edit" type="button" @click="startEdit" aria-label="編輯商品">✎</button>
        <button v-else-if="view === 'location-detail'" class="mobile-edit" type="button" @click="openLocationForm(locationDetail)" aria-label="編輯地點">✎</button>
        <span v-else class="mobile-bar-spacer"></span>
      </div>
      <div v-if="feedback" class="toast" role="status">{{ feedback }} <button @click="feedback = ''" aria-label="關閉訊息">×</button></div>
      <div v-if="error" class="global-error" role="alert">{{ error }} <button @click="error = ''" aria-label="關閉錯誤">×</button></div>

      <template v-if="view === 'library'">
        <header class="page-heading library-heading"><div><p class="eyebrow">YOUR PERSONAL COLLECTION</p><h1>商品收藏<span class="heading-spark">✦</span></h1><p class="subtext">把想買的、喜歡的，先記在這裡。</p></div><button class="primary-button desktop-add" @click="startCreate">＋ 新增商品</button></header>
        <section class="library-panel">
          <div class="section-top"><div><h2>所有商品 <span>{{ products.length }}</span></h2><p>一眼找到你記下的每件好物</p></div></div>
          <div class="toolbar"><label class="search-wrap"><span aria-hidden="true">⌕</span><span class="sr-only">搜尋商品名稱</span><input v-model="query" type="search" placeholder="搜尋商品名稱…" /></label><label class="filter-wrap"><span class="sr-only">依分類篩選</span><select v-model="category"><option value="">所有分類</option><option v-for="item in categories" :key="item" :value="item">{{ item }}</option></select></label></div>
          <div class="category-chips" aria-label="依分類篩選商品"><button type="button" :class="{ active: !category }" @click="category = ''">全部</button><button v-for="item in categories" :key="item" type="button" :class="{ active: category === item }" @click="category = item">{{ item }}</button></div>
          <div class="collection-results" aria-label="商品列表">
            <div v-if="!loading && products.length" class="collection-caption"><span>{{ query || category ? `找到 ${visible.length} 件` : `已收藏 ${products.length} 件` }}</span><i aria-hidden="true"></i></div>
            <div v-if="loading" class="state-box" role="status"><span class="state-symbol">◌</span><h3>正在載入收藏…</h3></div>
            <div v-else-if="error" class="state-box"><span class="state-symbol">!</span><h3>無法顯示商品</h3><button class="secondary-button" @click="refresh">重試</button></div>
            <div v-else-if="!products.length" class="state-box empty-state"><span class="empty-illustration" aria-hidden="true">✦</span><p class="eyebrow">START YOUR COLLECTION</p><h3>從第一件喜歡的東西開始</h3><p>點右上角「新增商品」，記下第一件喜歡的東西。</p></div>
            <div v-else-if="!visible.length" class="state-box"><span class="state-symbol">⌕</span><h3>沒有找到符合的商品</h3><p>試試其他名稱，或切換分類。</p><button class="text-button" @click="query = ''; category = ''">清除搜尋與篩選</button></div>
            <div v-else class="product-grid"><ProductCard v-for="product in visible" :key="product.id" :product="product" @open="openProduct" /></div>
          </div>
        </section>
      </template>

      <template v-else-if="view === 'locations'">
        <header class="page-heading locations-heading"><div><p class="eyebrow">PLACES TO REMEMBER</p><h1>地點列表<span class="heading-spark">✦</span></h1><p class="subtext">把想逛的店和去過的地方，收在一起。</p></div><button class="primary-button" type="button" @click="openLocationForm()">＋ 新增地點</button></header>
        <section class="library-panel locations-panel">
          <div class="section-top"><div><h2>所有地點 <span>{{ locations.length }}</span></h2><p>記下想逛的店與喜歡的地方</p></div></div>
          <div class="toolbar"><label class="search-wrap"><span aria-hidden="true">⌕</span><span class="sr-only">搜尋地點</span><input v-model="locationQuery" type="search" placeholder="搜尋地點名稱、地區或地址…" /></label><label class="filter-wrap"><span class="sr-only">依地區篩選</span><select v-model="locationCity"><option value="">所有地區</option><option v-for="city in locationCities" :key="city" :value="city">{{ city }}</option></select></label></div>
          <div class="category-chips" aria-label="依地區篩選地點"><button type="button" :class="{ active: !locationCity }" @click="locationCity = ''">全部</button><button v-for="city in locationCities" :key="city" type="button" :class="{ active: locationCity === city }" @click="locationCity = city">{{ city }}</button></div>
          <div class="collection-results" aria-label="地點列表">
            <div v-if="!locationsLoading && locations.length" class="collection-caption"><span>{{ locationQuery || locationCity ? `找到 ${visibleLocations.length} 個` : `已收藏 ${locations.length} 個` }}地點</span><i aria-hidden="true"></i></div>
            <div v-if="locationsLoading" class="state-box" role="status"><span class="state-symbol">◌</span><h3>正在載入地點…</h3></div>
            <div v-else-if="locationError && !locationFormOpen" class="state-box"><span class="state-symbol">!</span><h3>無法顯示地點</h3><p>{{ locationError }}</p><button class="secondary-button" type="button" @click="refreshLocations">重試</button></div>
            <div v-else-if="!locations.length" class="state-box locations-empty"><span class="location-empty-icon" aria-hidden="true">⌖</span><h2>還沒有地點</h2><p>點右上角「新增地點」，開始收藏想逛的店與喜歡的地方。</p></div>
            <div v-else-if="!visibleLocations.length" class="state-box"><span class="state-symbol">⌕</span><h3>沒有找到符合的地點</h3><p>試試其他名稱，或切換地區。</p><button class="text-button" type="button" @click="locationQuery = ''; locationCity = ''">清除搜尋與篩選</button></div>
            <div v-else class="locations-list"><button v-for="location in visibleLocations" :key="location.id" class="location-row" type="button" :aria-label="`查看 ${location.name}${location.address ? `，${location.address}` : ''} 的地點詳情，已連結 ${location.productCount} 件商品`" @click="openLocationDetail(location)"><span class="location-pin" aria-hidden="true">⌖</span><span class="location-row-main"><strong>{{ location.name }}</strong><small v-if="location.city || location.country">{{ [location.city, location.country].filter(Boolean).join(' · ') }}</small><small v-if="location.address" class="location-row-address">{{ location.address }}</small><small class="location-product-count">{{ location.productCount ? `已連結 ${location.productCount} 件商品` : '尚未連結商品' }}</small></span><span class="location-row-action" aria-hidden="true">›</span></button></div>
          </div>
        </section>
      </template>

      <template v-else-if="view === 'location-detail' && locationDetail">
        <header class="page-heading detail-heading"><button class="back-link" type="button" @click="navigate('locations')">← 返回地點列表</button><div class="heading-actions"><button class="secondary-button" type="button" @click="openLocationForm(locationDetail)">編輯地點</button></div></header>
        <LocationDetail :location="locationDetail" :products="locationDetailProducts" :loading="locationDetailLoading" :error="locationDetailError" @retry="refreshLocationDetailProducts" />
      </template>

      <template v-else-if="view === 'detail' && selected">
        <header class="page-heading detail-heading"><button class="back-link" @click="navigate('library')">← 返回商品收藏</button><div class="heading-actions"><button class="secondary-button" @click="startEdit">編輯商品</button><button class="danger-button" @click="showDelete = true">刪除</button></div></header>
        <div class="detail-grid"><button ref="imageTrigger" class="detail-photo" type="button" :disabled="!detailImage" :aria-label="detailImage ? `放大檢視 ${selected.name} 的照片` : '尚無商品照片'" @click="showImagePreview = true"><img v-if="detailImage" :src="detailImage" :alt="selected.name" /><span v-else aria-hidden="true">✦</span></button><div class="detail-info panel"><div class="detail-summary"><p class="eyebrow">SAVED ITEM</p><h2>{{ selected.name }}</h2><p class="detail-date">收藏於 {{ new Date(selected.createdAt).toLocaleDateString('zh-TW') }}</p></div><div class="detail-fields"><div v-if="selected.brand"><small>品牌</small><span>{{ selected.brand }}</span></div><div v-if="selected.category"><small>分類</small><span>{{ selected.category }}</span></div><div v-if="selected.model"><small>型號 / 規格</small><span>{{ selected.model }}</span></div><div v-if="selected.notes"><small>備註</small><p class="notes">{{ selected.notes }}</p></div></div><div v-if="![selected.brand, selected.category, selected.model, selected.notes].some(Boolean)" class="detail-empty">還沒有其他資料，隨時可以編輯補上。</div><button class="mobile-detail-delete" type="button" @click="showDelete = true">刪除商品</button></div></div>
        <section class="product-locations panel" aria-labelledby="product-locations-title">
          <div class="product-locations-heading"><div><p class="eyebrow">WHERE TO FIND IT</p><h3 id="product-locations-title">可購買地點 <span v-if="!linkedLocationsLoading && !linkedLocationsError">{{ linkedLocations.length }}</span></h3></div><button ref="locationPickerTrigger" class="product-location-add" type="button" @click="openLocationPicker">＋ 連結地點</button></div>
          <p v-if="linkedLocationsLoading" class="product-location-message" role="status">正在載入地點…</p>
          <div v-else-if="linkedLocationsError" class="product-location-message" role="alert">無法讀取可購買地點。<button class="text-button" type="button" @click="refreshLinkedLocations">重試</button></div>
          <p v-else-if="!linkedLocations.length" class="product-location-message">還沒有連結地點。先從既有地點選取；找不到時再新增。</p>
          <div v-else class="linked-location-list"><button v-for="location in linkedLocations" :key="location.id" class="location-row" type="button" :aria-label="`查看 ${[location.name, location.city, location.country, location.address].filter(Boolean).join('，')} 的地點詳情`" @click="openLinkedLocationDetail(location, $event)"><span class="location-pin" aria-hidden="true">⌖</span><span class="location-row-main"><strong>{{ location.name }}</strong><small v-if="location.city || location.country">{{ [location.city, location.country].filter(Boolean).join(' · ') }}</small><small v-if="location.address" class="location-row-address">{{ location.address }}</small><small v-if="formatPurchasePrice(location.purchase)" class="location-row-price">{{ formatPurchasePrice(location.purchase) }}</small></span><span class="location-row-action" aria-hidden="true">›</span></button></div>
        </section>
      </template>

      <ProductForm v-else-if="view === 'form'" :product="selected" :saving="saving" @save="handleSave" @cancel="goBack" />
      <div v-else class="coming-soon"><button class="back-link" @click="navigate('library')">← 返回商品收藏</button><span class="coming-icon">✦</span><p class="eyebrow">COMING SOON</p><h1>{{ { locations: '地點清單', overview: '收藏總覽', settings: '設定' }[view] }}</h1><p>這個功能正在規劃中。現在先把想買的商品收藏起來吧。</p><button class="primary-button" @click="navigate('library')">查看商品收藏</button></div>
    </main>
    <nav v-if="view !== 'form' && view !== 'detail' && view !== 'location-detail'" class="mobile-nav" aria-label="行動版導覽"><button :class="{ active: view === 'library' }" @click="navigate('library')"><span class="nav-icon" aria-hidden="true">▦</span><span class="nav-text">商品</span></button><button :class="{ active: view === 'locations' }" @click="navigate('locations')"><span class="nav-icon" aria-hidden="true">⌖</span><span class="nav-text">地點</span></button><button :class="{ active: view === 'overview' }" @click="navigate('overview')"><span class="nav-icon" aria-hidden="true">◫</span><span class="nav-text">總覽</span></button><button :class="{ active: view === 'settings' }" @click="navigate('settings')"><span class="nav-icon" aria-hidden="true">⚙</span><span class="nav-text">設定</span></button></nav>
    <div v-if="showDelete" class="dialog-backdrop" @click.self="showDelete = false"><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-desc"><span class="dialog-icon">!</span><h2 id="delete-title">刪除這件商品？</h2><p id="delete-desc">「{{ selected?.name }}」與它的照片會從這台裝置永久刪除，無法復原。</p><div class="dialog-actions"><button class="secondary-button" :disabled="deleting" @click="showDelete = false">取消</button><button class="danger-fill" :disabled="deleting" @click="confirmDelete">{{ deleting ? '刪除中…' : '確認刪除' }}</button></div></div></div>
    <LocationLinkPicker v-if="locationPickerOpen" :locations="locationPickerLocations" :linked-ids="locationPickerLinkedIds" :loading="locationPickerLoading" :error="locationPickerError" :busy-id="linkingLocationId" @close="closeLocationPicker" @retry="loadLocationPicker" @select="selectLocationForProduct" @create="createLocationFromPicker" />
    <LinkedLocationDetail v-if="linkedLocationDetail" :location="linkedLocationDetail" :busy="unlinkingLocation" :error="unlinkLocationError" :purchase-saving="purchaseSaving" :purchase-error="purchaseError" :purchase-saved-key="purchaseSavedKey" @close="closeLinkedLocationDetail" @unlink="unlinkLinkedLocation" @edit="editLinkedLocation" @save-purchase="saveLinkedLocationPurchase" @clear-purchase-error="purchaseError = ''" />
    <div v-if="locationFormOpen" class="dialog-backdrop" @click.self="closeLocationForm">
      <form class="dialog location-dialog" role="dialog" aria-modal="true" aria-labelledby="location-form-title" @submit.prevent="handleLocationSave">
        <h2 id="location-form-title">{{ selectedLocation ? '編輯地點' : '新增地點' }}</h2>
        <label class="field"><span>地點名稱 <em>*</em></span><input ref="locationNameInput" v-model="locationDraft.name" type="text" required maxlength="150" placeholder="例如：松本清 新宿東口店" /></label>
        <label class="field">城市／地區（選填）<input v-model="locationDraft.city" type="text" maxlength="100" placeholder="例如：東京、新宿或台北" /></label>
        <label class="field">地址<input v-model="locationDraft.address" type="text" maxlength="300" placeholder="例如：新宿 3-24-1" /></label>
        <button class="location-extra-toggle" type="button" :aria-expanded="locationExtraOpen" aria-controls="location-extra-fields" @click="locationExtraOpen = !locationExtraOpen">{{ locationExtraOpen ? '收起位置資訊' : '更多位置資訊（選填）' }}<span aria-hidden="true">{{ locationExtraOpen ? '⌃' : '⌄' }}</span></button>
        <div v-show="locationExtraOpen" id="location-extra-fields" class="location-field-row"><label class="field">國家<input v-model="locationDraft.country" type="text" maxlength="100" placeholder="例如：日本" /></label><label class="field">區域<input v-model="locationDraft.area" type="text" maxlength="100" placeholder="例如：新宿區" /></label></div>
        <label class="field">備註<textarea v-model="locationDraft.notes" maxlength="1000" rows="3" placeholder="營業時間、想買的東西…"></textarea></label>
        <section ref="locationProductsSection" class="location-product-picker" aria-labelledby="location-products-title" tabindex="-1">
          <div class="location-products-heading"><h3 id="location-products-title">可購買的商品</h3><span>已選 {{ selectedProductIds.length }} 件</span></div>
          <p>勾選已建立的商品，儲存時一併連結到這個地點。</p>
          <label v-if="products.length" class="location-product-search"><span class="sr-only">搜尋已建立的商品</span><input v-model="locationProductQuery" type="search" placeholder="搜尋商品名稱、品牌或分類…" /></label>
          <div v-if="loading || locationLinksLoading" class="product-picker-message" role="status">正在載入商品…</div>
          <div v-else-if="error" class="product-picker-message" role="alert">商品列表讀取失敗，請關閉表單後重試。</div>
          <div v-else-if="!products.length" class="product-picker-message">目前沒有商品。新增後會自動回到這個地點並勾選商品。</div>
          <div v-else-if="!productChoices.length" class="product-picker-message">找不到符合的商品。</div>
          <div v-else class="product-picker-list"><ProductPickerOption v-for="product in productChoices" :key="product.id" :product="product" :checked="selectedProductIds.includes(product.id)" @toggle="toggleProductSelection" /></div>
          <button class="location-create-product" type="button" :disabled="locationSaving || locationLinksLoading || locationLinksFailed" @click="startProductForLocation"><span aria-hidden="true">＋</span> 新增商品並連結</button>
        </section>
        <p v-if="locationError" class="form-error" role="alert">{{ locationError }}</p>
        <div class="location-dialog-footer"><button v-if="selectedLocation" class="location-delete-link" type="button" @click="requestLocationDelete">刪除地點</button><div class="dialog-actions"><button class="secondary-button" type="button" @click="closeLocationForm">取消</button><button class="primary-button" type="submit" :disabled="locationSaving || locationLinksLoading || locationLinksFailed || loading || Boolean(error)">{{ locationSaving ? '儲存中…' : '儲存地點' }}</button></div></div>
      </form>
    </div>
    <div v-if="showLocationDelete" class="dialog-backdrop" @click.self="showLocationDelete = false"><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="location-delete-title" aria-describedby="location-delete-desc"><span class="dialog-icon">!</span><h2 id="location-delete-title">刪除這個地點？</h2><p id="location-delete-desc">「{{ selectedLocation?.name }}」及其商品關聯會從這台裝置永久刪除，無法復原。商品本身會保留。</p><div class="dialog-actions"><button class="secondary-button" type="button" :disabled="locationDeleting" @click="showLocationDelete = false">取消</button><button class="danger-fill" type="button" :disabled="locationDeleting" @click="confirmLocationDelete">{{ locationDeleting ? '刪除中…' : '確認刪除' }}</button></div></div></div>
    <div v-if="showImagePreview && detailImage" class="image-preview" role="dialog" aria-modal="true" :aria-label="`${selected?.name} 的照片`" @click.self="showImagePreview = false"><button ref="imageCloseButton" class="image-preview-close" type="button" aria-label="關閉照片" @click="showImagePreview = false">×</button><img :src="detailImage" :alt="selected?.name" /></div>
  </div>
</template>
