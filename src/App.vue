<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ProductCard from './components/ProductCard.vue'
import ProductForm from './components/ProductForm.vue'
import ProductPickerOption from './components/ProductPickerOption.vue'
import LocationLinkPicker from './components/LocationLinkPicker.vue'
import LinkedLocationDetail from './components/LinkedLocationDetail.vue'
import LocationDetail from './components/LocationDetail.vue'
import GroupProductRow from './components/GroupProductRow.vue'
import GroupIcon from './components/GroupIcon.vue'
import brandLogo from './assets/gullstuff-logo-original.png'
import { useTheme } from './composables/useTheme.js'
import { deleteProduct, filterProducts, listProducts, saveProduct } from './data/products.js'
import { deleteLocation, linkProductToLocation, listLocations, listLocationsForProduct, listProductIdsForLocation, listProductsForLocation, saveLocation, saveLocationPurchase, unlinkProductFromLocation } from './data/locations.js'
import { GROUP_COLORS, GROUP_ICONS, addProductToGroup, deleteGroup, groupAppearance, listGroupIdsForProduct, listGroups, listProductsForGroup, removeProductFromGroup, saveGroup } from './data/groups.js'
import { useImageUrl } from './composables/useImageUrl.js'
import { formatPurchasePrice } from './utils/purchase.js'
import { exportBackup, validateBackup, restoreBackup } from './data/backup.js'
import { exportSpreadsheet } from './data/spreadsheetExport.js'
import { readBackupFile, saveBackupFile } from './platform/backupFile.js'

const products = ref([])
const { darkMode } = useTheme()
const loading = ref(true)
const error = ref('')
const feedback = ref('')
let feedbackTimer
let backupFeedbackTimer
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
const productReturnLocationId = ref(null)
const productReturnGroupId = ref(null)
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
const backupBusy = ref(false)
const backupFeedback = ref('')
const backupError = ref('')
const restoreConfirmOpen = ref(false)
const restoreWarnings = ref([])
const pendingRestoreBytes = ref(null)
const restoreCounts = ref(null)
const locationQuery = ref('')
const locationCity = ref('')
const locationsLoading = ref(false)
const locationError = ref('')
let locationFormReturnView = 'locations'
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
let locationProductReturnContext = null
const locationProductsSection = ref(null)
const groups = ref([])
const groupsLoading = ref(false)
const groupsError = ref('')
const groupQuery = ref('')
const groupDetail = ref(null)
const groupDetailProducts = ref([])
const groupDetailLoading = ref(false)
const groupDetailError = ref(false)
let groupDetailRequest = 0
let groupFormReturnView = 'groups'
const groupDraft = ref({ name: '', notes: '', icon: 'folder', color: 'ocean' })
const selectedGroup = ref(null)
const selectedGroupProductIds = ref([])
const groupProductQuery = ref('')
const groupSaving = ref(false)
const groupFormError = ref('')
const groupFormLinksFailed = ref(false)
const groupFormLinksLoading = ref(false)
let groupFormRequest = 0
const groupNameInput = ref(null)
const showGroupDelete = ref(false)
const groupDeleting = ref(false)
const groupPickerOpen = ref(false)
const groupPickerError = ref('')
const groupPickerBusy = ref(false)
const productGroupIds = ref([])
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
const visibleGroups = computed(() => {
  const needle = groupQuery.value.trim().toLocaleLowerCase('zh-TW')
  return groups.value.filter(group => !needle || [group.name, group.notes].some(value => value?.toLocaleLowerCase('zh-TW').includes(needle)))
})
const groupProductChoices = computed(() => {
  const needle = groupProductQuery.value.trim().toLocaleLowerCase('zh-TW')
  return products.value.filter(product => !needle || [product.name, product.brand, product.category].some(value => value?.toLocaleLowerCase('zh-TW').includes(needle)))
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
watch(() => view.value === 'detail' ? selected.value?.id : null, async productId => {
  if (!productId) { productGroupIds.value = []; return }
  try { productGroupIds.value = await listGroupIdsForProduct(productId); await refreshGroups() }
  catch { productGroupIds.value = [] }
})
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
  locationFormReturnView = view.value
  selectedLocation.value = location
  locationDraft.value = Object.fromEntries(['name', 'country', 'city', 'area', 'address', 'notes'].map(key => [key, location?.[key] ?? '']))
  if (!location) locationDraft.value.name = initialName
  locationExtraOpen.value = Boolean(location?.country || location?.area)
  selectedProductIds.value = preselectedProductId ? [preselectedProductId] : []
  locationProductQuery.value = ''
  locationLinksLoading.value = Boolean(location)
  locationLinksFailed.value = false
  locationError.value = ''
  view.value = 'location-form'
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
  view.value = locationFormReturnView
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
    const returnView = locationFormReturnView
    if (returnView === 'locations' || returnView === 'location-detail') {
      locationDetail.value = { ...saved, productCount: selectedProductIds.value.length }
      view.value = 'location-detail'
      await refreshLocationDetailProducts()
    } else {
      view.value = returnView
      if (returnView === 'detail') await refreshLinkedLocations()
    }
    feedback.value = selectedLocation.value ? '地點已更新。' : '地點已新增。'
    selectedLocation.value = null
  } catch (cause) { locationError.value = cause.message || '儲存地點失敗，請再試一次。' }
  finally { locationSaving.value = false }
}
function requestLocationDelete() {
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
    if (locationFormReturnView === 'location-detail' && locationDetail.value?.id === selectedLocation.value.id) {
      locationDetailRequest += 1
      locationDetail.value = null
      locationDetailProducts.value = []
    }
    view.value = locationFormReturnView === 'location-detail' ? 'locations' : locationFormReturnView
    if (view.value === 'detail') await refreshLinkedLocations()
    showLocationDelete.value = false
    selectedLocation.value = null
    feedback.value = '地點已刪除。'
  } catch (cause) { locationError.value = cause.message || '刪除地點失敗，請再試一次。'; showLocationDelete.value = false }
  finally { locationDeleting.value = false }
}
async function refreshGroups() {
  groupsLoading.value = true
  groupsError.value = ''
  try { groups.value = await listGroups() }
  catch { groupsError.value = '無法讀取群組，請重試。' }
  finally { groupsLoading.value = false }
}
async function refreshGroupDetailProducts() {
  const id = view.value === 'group-detail' ? groupDetail.value?.id : null
  const requestId = ++groupDetailRequest
  if (!id) return
  groupDetailLoading.value = true
  groupDetailError.value = false
  try {
    const result = await listProductsForGroup(id)
    if (requestId === groupDetailRequest) groupDetailProducts.value = result
  } catch { if (requestId === groupDetailRequest) groupDetailError.value = true }
  finally { if (requestId === groupDetailRequest) groupDetailLoading.value = false }
}
function openGroupDetail(group) {
  groupDetail.value = group
  view.value = 'group-detail'
  refreshGroupDetailProducts()
}
async function openGroupForm(group = null, productId = null) {
  const requestId = ++groupFormRequest
  groupFormReturnView = view.value
  selectedGroup.value = group
  groupDraft.value = { name: group?.name ?? '', notes: group?.notes ?? '', icon: group?.icon ?? 'folder', color: group ? group.color ?? 'forest' : 'ocean' }
  groupProductQuery.value = ''
  selectedGroupProductIds.value = productId ? [productId] : []
  groupFormError.value = ''
  groupFormLinksFailed.value = false
  groupFormLinksLoading.value = Boolean(group)
  groupPickerOpen.value = false
  view.value = 'group-form'
  await nextTick()
  groupNameInput.value?.focus()
  if (group) {
    try {
      const ids = (await listProductsForGroup(group.id)).map(product => product.id)
      if (requestId === groupFormRequest) selectedGroupProductIds.value = ids
    } catch {
      if (requestId === groupFormRequest) { groupFormLinksFailed.value = true; groupFormError.value = '無法讀取群組商品，請返回後重試。' }
    } finally { if (requestId === groupFormRequest) groupFormLinksLoading.value = false }
  }
}
function closeGroupForm() {
  if (groupSaving.value) return
  groupFormRequest += 1
  view.value = groupFormReturnView
  selectedGroup.value = null
  groupFormError.value = ''
}
function toggleGroupProduct(productId, checked) {
  if (checked && !selectedGroupProductIds.value.includes(productId)) selectedGroupProductIds.value = [...selectedGroupProductIds.value, productId]
  if (!checked) selectedGroupProductIds.value = selectedGroupProductIds.value.filter(id => id !== productId)
}
function groupProductName(productId) { return products.value.find(product => product.id === productId)?.name ?? '已移除的商品' }
function moveGroupProduct(productId, direction) {
  const ids = [...selectedGroupProductIds.value]
  const index = ids.indexOf(productId)
  const next = index + direction
  if (index < 0 || next < 0 || next >= ids.length) return
  const moved = ids[index]
  ids[index] = ids[next]
  ids[next] = moved
  selectedGroupProductIds.value = ids
}
async function handleGroupSave() {
  if (groupSaving.value || loading.value || error.value || groupFormLinksLoading.value || groupFormLinksFailed.value) return
  groupSaving.value = true
  groupFormError.value = ''
  try {
    const saved = await saveGroup(groupDraft.value, selectedGroup.value?.id, selectedGroupProductIds.value)
    await refreshGroups()
    if (groupFormReturnView === 'detail') {
      view.value = 'detail'
      productGroupIds.value = await listGroupIdsForProduct(selected.value.id)
    } else {
      groupDetail.value = { ...saved, productCount: selectedGroupProductIds.value.length }
      view.value = 'group-detail'
      await refreshGroupDetailProducts()
    }
    selectedGroup.value = null
    feedback.value = '群組已儲存。'
  } catch (cause) { groupFormError.value = cause.message || '儲存群組失敗，請重試。' }
  finally { groupSaving.value = false }
}
async function confirmGroupDelete() {
  if (!selectedGroup.value || groupDeleting.value) return
  groupDeleting.value = true
  try {
    await deleteGroup(selectedGroup.value.id)
    await refreshGroups()
    showGroupDelete.value = false
    selectedGroup.value = null
    groupDetail.value = null
    groupDetailProducts.value = []
    view.value = 'groups'
    feedback.value = '群組已刪除。'
  } catch (cause) { showGroupDelete.value = false; groupFormError.value = cause.message || '刪除群組失敗。' }
  finally { groupDeleting.value = false }
}
async function openGroupPicker() {
  groupPickerError.value = ''
  groupPickerOpen.value = true
  try {
    await refreshGroups()
    productGroupIds.value = await listGroupIdsForProduct(selected.value.id)
  } catch { groupPickerError.value = '無法讀取群組，請重試。' }
}
async function toggleProductGroup(groupId) {
  if (!selected.value || groupPickerBusy.value) return
  groupPickerBusy.value = true
  groupPickerError.value = ''
  try {
    if (productGroupIds.value.includes(groupId)) await removeProductFromGroup(selected.value.id, groupId)
    else await addProductToGroup(selected.value.id, groupId)
    productGroupIds.value = await listGroupIdsForProduct(selected.value.id)
    await refreshGroups()
    feedback.value = '群組已更新。'
  } catch (cause) { groupPickerError.value = cause.message || '更新群組失敗。' }
  finally { groupPickerBusy.value = false }
}
function openProductFromGroup(id) {
  selected.value = products.value.find(product => product.id === id) ?? groupDetailProducts.value.find(product => product.id === id) ?? null
  if (selected.value) {
    productReturnLocationId.value = null
    productReturnGroupId.value = groupDetail.value?.id ?? null
    view.value = 'detail'
  }
}
watch(feedback, message => {
  window.clearTimeout(feedbackTimer)
  if (message) feedbackTimer = window.setTimeout(() => { feedback.value = '' }, 3000)
})
function onKeyDown(event) {
  if (event.key === 'Escape') {
    showImagePreview.value = false
    if (showLocationDelete.value && !locationDeleting.value) showLocationDelete.value = false
    if (showGroupDelete.value && !groupDeleting.value) showGroupDelete.value = false
    if (groupPickerOpen.value && !groupPickerBusy.value) groupPickerOpen.value = false
    if (locationPickerOpen.value) closeLocationPicker()
    if (linkedLocationDetail.value) closeLinkedLocationDetail()
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.clearTimeout(feedbackTimer)
  window.clearTimeout(backupFeedbackTimer)
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
  productReturnLocationId.value = null
  productReturnGroupId.value = null
  selected.value = products.value.find(p => p.id === id) ?? null
  view.value = selected.value ? 'detail' : 'library'
  scrollToTop()
}
function openProductFromLocation(id) {
  const product = products.value.find(item => item.id === id) ?? locationDetailProducts.value.find(item => item.id === id)
  if (!product || !locationDetail.value) return
  productReturnLocationId.value = locationDetail.value.id
  productReturnGroupId.value = null
  selected.value = product
  view.value = 'detail'
  scrollToTop()
}
function returnFromProductDetail() {
  if (productReturnGroupId.value && groupDetail.value?.id === productReturnGroupId.value) {
    selected.value = null
    productReturnGroupId.value = null
    view.value = 'group-detail'
    refreshGroupDetailProducts()
    return
  }
  if (productReturnLocationId.value && locationDetail.value?.id === productReturnLocationId.value) {
    selected.value = null
    productReturnLocationId.value = null
    view.value = 'location-detail'
    refreshLocationDetailProducts()
    scrollToTop()
    return
  }
  navigate('library')
}
function startCreate() { selected.value = null; view.value = 'form'; scrollToTop() }
function startEdit() { view.value = 'form'; scrollToTop() }
function startProductForLocation() {
  if (locationSaving.value || locationLinksLoading.value || locationLinksFailed.value) return
  locationProductReturnContext = { view: view.value, product: selected.value }
  creatingProductForLocation.value = true
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
  selected.value = locationProductReturnContext?.product ?? null
  view.value = locationProductReturnContext?.view ?? 'locations'
  locationProductReturnContext = null
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
    if (productReturnLocationId.value && locationDetail.value?.id === productReturnLocationId.value) {
      productReturnLocationId.value = null
      view.value = 'location-detail'
      await refreshLocationDetailProducts()
    } else if (productReturnGroupId.value && groupDetail.value?.id === productReturnGroupId.value) {
      productReturnGroupId.value = null
      view.value = 'group-detail'
      await refreshGroupDetailProducts()
    } else view.value = 'library'
    await refreshGroups()
    feedback.value = '商品已刪除。'
  } catch { error.value = '刪除失敗，請再試一次。'; showDelete.value = false }
  finally { deleting.value = false }
}
function navigate(target) {
  if (saving.value || deleting.value || locationSaving.value || locationDeleting.value || unlinkingLocation.value || purchaseSaving.value || groupSaving.value || groupDeleting.value) return
  creatingProductForLocation.value = false
  locationProductReturnContext = null
  closeLocationPicker()
  closeLinkedLocationDetail()
  locationDetailRequest += 1
  productReturnLocationId.value = null
  productReturnGroupId.value = null
  locationDetail.value = null
  locationDetailProducts.value = []
  groupDetailRequest += 1
  groupFormRequest += 1
  groupDetail.value = null
  groupDetailProducts.value = []
  groupPickerOpen.value = false
  selectedGroup.value = null
  view.value = target
  selected.value = null
  feedback.value = ''
  locationFormRequest += 1
  selectedLocation.value = null
  locationError.value = ''
  showLocationDelete.value = false
  if (target === 'locations') refreshLocations()
  if (target === 'groups') refreshGroups()
  scrollToTop()
}
function setBackupFeedback(message) {
  window.clearTimeout(backupFeedbackTimer)
  backupFeedback.value = message
  if (message) backupFeedbackTimer = window.setTimeout(() => { backupFeedback.value = '' }, 3000)
}
async function handleExportBackup() {
  backupBusy.value = true
  backupError.value = ''
  setBackupFeedback('')
  try {
    const { bytes, filename } = await exportBackup({ platform: 'web' })
    await saveBackupFile(bytes, filename, 'application/zip')
    setBackupFeedback('備份已匯出。')
  } catch (cause) {
    backupError.value = cause.message || '匯出備份失敗，請重試。'
  } finally {
    backupBusy.value = false
  }
}
async function handleExportSpreadsheet() {
  backupBusy.value = true
  backupError.value = ''
  setBackupFeedback('')
  try {
    const { bytes, filename, mime } = await exportSpreadsheet()
    await saveBackupFile(bytes, filename, mime)
    setBackupFeedback('Excel 表格已匯出。')
  } catch (cause) {
    backupError.value = cause.message || '匯出表格失敗，請重試。'
  } finally {
    backupBusy.value = false
  }
}
async function handleImportBackup() {
  backupBusy.value = true
  backupError.value = ''
  setBackupFeedback('')
  try {
    const result = await readBackupFile()
    if (!result) return
    const { bytes } = result
    const validation = await validateBackup(bytes)
    if (!validation.ok) {
      backupError.value = validation.errors.slice(0, 3).join(' ') + (validation.errors.length > 3 ? '……' : '')
      return
    }
    pendingRestoreBytes.value = bytes
    restoreWarnings.value = validation.warnings || []
    restoreCounts.value = validation.manifest?.counts
    restoreConfirmOpen.value = true
  } catch (cause) {
    backupError.value = cause.message || '匯入備份失敗，請重試。'
  } finally {
    backupBusy.value = false
  }
}
async function handleConfirmRestore() {
  if (!pendingRestoreBytes.value) return
  backupBusy.value = true
  backupError.value = ''
  try {
    const result = await restoreBackup(pendingRestoreBytes.value, { mode: 'replace' })
    await refresh()
    await refreshLocations()
    await refreshGroups()
    restoreConfirmOpen.value = false
    pendingRestoreBytes.value = null
    restoreWarnings.value = []
    restoreCounts.value = null
    const counts = result.restored
    const warning = result.warnings?.length ? `（${result.warnings.length} 個警告）` : ''
    setBackupFeedback(`還原完成：商品 ${counts.products} 件、地點 ${counts.locations} 個、群組 ${counts.groups} 個、圖片 ${counts.images} 張。${warning}`)
  } catch (cause) {
    backupError.value = cause.message || '還原失敗，請重試。'
  } finally {
    backupBusy.value = false
  }
}
function closeRestoreConfirm() {
  if (backupBusy.value) return
  restoreConfirmOpen.value = false
  pendingRestoreBytes.value = null
  restoreWarnings.value = []
  restoreCounts.value = null
}
</script>

<template>
  <div class="app-shell" :class="{ 'collection-shell': ['library', 'locations', 'groups', 'settings'].includes(view) }">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="navigate('library')"><span class="brand-mark" aria-hidden="true"><img :src="brandLogo" alt="" /></span><span>GullStuff<small>把喜歡的，好好收著。</small></span></a>
      <div class="nav-label">WORKSPACE</div>
      <nav aria-label="主要導覽">
        <button class="nav-item" :class="{ active: ['library','detail','form'].includes(view) }" @click="navigate('library')"><span aria-hidden="true">▦</span> 商品收藏 <span class="nav-count">{{ products.length }}</span></button>
        <button class="nav-item" :class="{ active: ['locations', 'location-detail', 'location-form'].includes(view) }" @click="navigate('locations')"><span aria-hidden="true">⌖</span> 地點列表</button>
        <button class="nav-item" :class="{ active: ['groups', 'group-detail', 'group-form'].includes(view) }" @click="navigate('groups')"><span aria-hidden="true">◫</span> 群組</button>
      </nav>
      <div class="sidebar-bottom"><div class="privacy-note"><span aria-hidden="true">✳</span><strong>你的收藏，只屬於你。</strong><p>資料與照片保存在這台裝置，不需註冊帳號。</p></div><button class="nav-item settings-item" :class="{ active: view === 'settings' }" @click="navigate('settings')"><span aria-hidden="true">⚙</span> 設定</button></div>
    </aside>

    <main ref="mainContent" class="main-content">
      <div class="mobile-bar" :class="{ 'is-collection': ['library', 'locations', 'groups', 'settings'].includes(view), 'is-detail': ['detail', 'location-detail', 'group-detail'].includes(view), 'is-editor': ['form', 'location-form', 'group-form'].includes(view) }">
        <button v-if="view === 'form'" class="mobile-back" type="button" aria-label="返回" @click="goBack">‹</button>
        <button v-else-if="view === 'location-form'" class="mobile-back" type="button" aria-label="返回" @click="closeLocationForm">‹</button>
        <button v-else-if="view === 'group-form'" class="mobile-back" type="button" aria-label="返回" @click="closeGroupForm">‹</button>
        <button v-else-if="view === 'group-detail'" class="mobile-back" type="button" aria-label="返回群組列表" @click="navigate('groups')">‹</button>
        <button v-else-if="view === 'location-detail'" class="mobile-back" type="button" aria-label="返回地點列表" @click="navigate('locations')">‹</button>
        <button v-else-if="view === 'detail'" class="mobile-back" type="button" :aria-label="productReturnGroupId ? '返回群組詳情' : productReturnLocationId ? '返回地點詳情' : '返回商品收藏'" @click="returnFromProductDetail">‹</button>
        <button v-else-if="!['library', 'locations', 'groups', 'settings'].includes(view)" class="mobile-back" type="button" aria-label="返回商品收藏" @click="navigate('library')">‹</button>
        <span class="mobile-title"><small v-if="!['form', 'location-form', 'group-form'].includes(view)" class="mobile-wordmark"><span class="brand-mark" aria-hidden="true"><img :src="brandLogo" alt="" /></span>GullStuff</small><span v-if="!['detail', 'location-detail', 'group-detail'].includes(view)">{{ view === 'form' ? selected ? '編輯商品' : '新增商品' : view === 'location-form' ? selectedLocation ? '編輯地點' : '新增地點' : view === 'group-form' ? selectedGroup ? '編輯群組' : '新增群組' : { library: '商品', locations: '地點列表', groups: '群組', settings: '設定' }[view] }}</span></span>
        <span v-if="['library', 'locations', 'groups', 'settings'].includes(view)" class="mobile-bar-spacer"></span>
        <button v-else-if="view === 'form'" class="mobile-save" type="submit" form="product-form" :disabled="saving">{{ saving ? '儲存中' : '儲存' }}</button>
        <button v-else-if="view === 'location-form'" class="mobile-save" type="submit" form="location-form" :disabled="locationSaving || locationLinksLoading || locationLinksFailed || loading || Boolean(error)">{{ locationSaving ? '儲存中' : '儲存' }}</button>
        <button v-else-if="view === 'group-form'" class="mobile-save" type="submit" form="group-form" :disabled="groupSaving || loading || groupFormLinksLoading || groupFormLinksFailed || Boolean(error)">{{ groupSaving ? '儲存中' : '儲存' }}</button>
        <button v-else-if="view === 'detail'" class="mobile-edit" type="button" @click="startEdit" aria-label="編輯商品">✎</button>
        <button v-else-if="view === 'location-detail'" class="mobile-edit" type="button" @click="openLocationForm(locationDetail)" aria-label="編輯地點">✎</button>
        <button v-else-if="view === 'group-detail'" class="mobile-edit" type="button" @click="openGroupForm(groupDetail)" aria-label="編輯群組">✎</button>
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
            <div v-else-if="locationError" class="state-box"><span class="state-symbol">!</span><h3>無法顯示地點</h3><p>{{ locationError }}</p><button class="secondary-button" type="button" @click="refreshLocations">重試</button></div>
            <div v-else-if="!locations.length" class="state-box locations-empty"><span class="location-empty-icon" aria-hidden="true">⌖</span><h2>還沒有地點</h2><p>點右上角「新增地點」，開始收藏想逛的店與喜歡的地方。</p></div>
            <div v-else-if="!visibleLocations.length" class="state-box"><span class="state-symbol">⌕</span><h3>沒有找到符合的地點</h3><p>試試其他名稱，或切換地區。</p><button class="text-button" type="button" @click="locationQuery = ''; locationCity = ''">清除搜尋與篩選</button></div>
            <div v-else class="locations-list"><button v-for="location in visibleLocations" :key="location.id" class="location-row" type="button" :aria-label="`查看 ${location.name}${location.address ? `，${location.address}` : ''} 的地點詳情，已連結 ${location.productCount} 件商品`" @click="openLocationDetail(location)"><span class="location-pin" aria-hidden="true">⌖</span><span class="location-row-main"><strong>{{ location.name }}</strong><small v-if="location.city || location.country">{{ [location.city, location.country].filter(Boolean).join(' · ') }}</small><small v-if="location.address" class="location-row-address">{{ location.address }}</small><small class="location-product-count">{{ location.productCount ? `已連結 ${location.productCount} 件商品` : '尚未連結商品' }}</small></span><span class="location-row-action" aria-hidden="true">›</span></button></div>
          </div>
        </section>
      </template>

      <template v-else-if="view === 'groups'">
        <header class="page-heading locations-heading group-heading"><div><p class="eyebrow">YOUR COLLECTIONS</p><h1>群組<span class="heading-spark">✦</span></h1><p class="subtext">像播放清單一樣，依自己的方式整理商品。</p></div><button class="primary-button" type="button" @click="openGroupForm()">＋ 新增群組</button></header>
        <section class="library-panel locations-panel">
          <div class="section-top"><div><h2>所有群組 <span>{{ groups.length }}</span></h2><p>同一件商品可以收進多個群組</p></div></div>
          <div class="toolbar"><label class="search-wrap"><span aria-hidden="true">⌕</span><span class="sr-only">搜尋群組</span><input v-model="groupQuery" type="search" placeholder="搜尋群組名稱或說明…" /></label></div>
          <div class="collection-results" aria-label="群組列表">
            <div v-if="!groupsLoading && groups.length" class="collection-caption"><span>{{ groupQuery ? `找到 ${visibleGroups.length} 個群組` : `已建立 ${groups.length} 個群組` }}</span><i aria-hidden="true"></i></div>
            <div v-if="groupsLoading" class="state-box" role="status"><span class="state-symbol">◌</span><h3>正在載入群組…</h3></div>
            <div v-else-if="groupsError" class="state-box" role="alert"><h3>無法顯示群組</h3><button class="secondary-button" type="button" @click="refreshGroups">重試</button></div>
            <div v-else-if="!groups.length" class="state-box locations-empty"><span class="location-empty-icon group-empty-icon" aria-hidden="true"><GroupIcon /></span><h2>建立第一個群組</h2><p>點右上角「新增群組」，把喜歡的商品整理成自己的清單。</p></div>
            <div v-else-if="!visibleGroups.length" class="state-box"><span class="state-symbol">⌕</span><h3>沒有找到群組</h3><button class="text-button" type="button" @click="groupQuery = ''">清除搜尋</button></div>
            <div v-else class="locations-list"><button v-for="group in visibleGroups" :key="group.id" class="location-row group-row" type="button" :aria-label="`查看 ${group.name}，${group.productCount} 件商品`" @click="openGroupDetail(group)"><span class="location-pin group-icon" :style="groupAppearance(group)" aria-hidden="true"><GroupIcon :icon="group.icon" /></span><span class="location-row-main"><strong>{{ group.name }}</strong><small v-if="group.notes">{{ group.notes }}</small><small class="location-product-count">{{ group.productCount }} 件商品</small></span><span class="location-row-action" aria-hidden="true">›</span></button></div>
          </div>
        </section>
      </template>

      <template v-else-if="view === 'group-detail' && groupDetail">
        <header class="page-heading detail-heading"><button class="back-link" type="button" @click="navigate('groups')">← 返回群組</button><div class="heading-actions"><button class="secondary-button" type="button" @click="openGroupForm(groupDetail)">編輯群組</button></div></header>
        <div class="group-detail-page"><section class="group-detail-summary panel"><span class="group-detail-mark" :style="groupAppearance(groupDetail)" aria-hidden="true"><GroupIcon :icon="groupDetail.icon" /></span><div><p class="eyebrow">MY GROUP</p><h1>{{ groupDetail.name }}</h1><p v-if="groupDetail.notes" class="notes">{{ groupDetail.notes }}</p></div></section>
          <section class="group-detail-items panel" aria-labelledby="group-products-title"><div class="group-detail-items-heading"><h2 id="group-products-title">商品 <span v-if="!groupDetailLoading && !groupDetailError">{{ groupDetailProducts.length }}</span></h2><button type="button" @click="openGroupForm(groupDetail)">管理商品</button></div>
            <p v-if="groupDetailLoading" class="location-detail-message" role="status">正在載入商品…</p><p v-else-if="groupDetailError" class="location-detail-message" role="alert">無法讀取群組商品。<button class="text-button" type="button" @click="refreshGroupDetailProducts">重試</button></p><p v-else-if="!groupDetailProducts.length" class="location-detail-message">群組裡還沒有商品，點「管理商品」即可加入。</p>
            <div v-else class="group-product-list"><GroupProductRow v-for="(product, index) in groupDetailProducts" :key="product.id" :product="product" :index="index" @open="openProductFromGroup" /></div>
          </section></div>
      </template>

      <template v-else-if="view === 'location-detail' && locationDetail">
        <header class="page-heading detail-heading"><button class="back-link" type="button" @click="navigate('locations')">← 返回地點列表</button><div class="heading-actions"><button class="secondary-button" type="button" @click="openLocationForm(locationDetail)">編輯地點</button></div></header>
        <LocationDetail :location="locationDetail" :products="locationDetailProducts" :loading="locationDetailLoading" :error="locationDetailError" @retry="refreshLocationDetailProducts" @select-product="openProductFromLocation" />
      </template>

      <template v-else-if="view === 'detail' && selected">
        <header class="page-heading detail-heading"><button class="back-link" @click="returnFromProductDetail">← 返回{{ productReturnGroupId ? '群組詳情' : productReturnLocationId ? '地點詳情' : '商品收藏' }}</button><div class="heading-actions"><button class="secondary-button" @click="startEdit">編輯商品</button><button class="danger-button" @click="showDelete = true">刪除</button></div></header>
        <div class="detail-grid"><button ref="imageTrigger" class="detail-photo" type="button" :disabled="!detailImage" :aria-label="detailImage ? `放大檢視 ${selected.name} 的照片` : '尚無商品照片'" @click="showImagePreview = true"><img v-if="detailImage" :src="detailImage" :alt="selected.name" /><span v-else aria-hidden="true">✦</span></button><div class="detail-info panel"><div class="detail-summary"><p class="eyebrow">SAVED ITEM</p><h2>{{ selected.name }}</h2><p class="detail-date">收藏於 {{ new Date(selected.createdAt).toLocaleDateString('zh-TW') }}</p><div class="product-groups" :class="{ 'has-groups': productGroupIds.length }" role="group" aria-label="所屬群組"><div v-if="productGroupIds.length" class="group-tags"><span v-for="group in groups.filter(item => productGroupIds.includes(item.id))" :key="group.id" :style="groupAppearance(group)">{{ group.name }}</span></div><button class="group-add-button" type="button" :aria-label="productGroupIds.length ? '加入或管理群組' : '加入群組'" :title="productGroupIds.length ? '加入或管理群組' : '加入群組'" @click="openGroupPicker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg><span v-if="!productGroupIds.length">加入群組</span></button></div></div><div class="detail-fields"><div v-if="selected.brand"><small>品牌</small><span>{{ selected.brand }}</span></div><div v-if="selected.category"><small>分類</small><span>{{ selected.category }}</span></div><div v-if="selected.model"><small>型號 / 規格</small><span>{{ selected.model }}</span></div><div v-if="selected.notes"><small>備註</small><p class="notes">{{ selected.notes }}</p></div></div><div v-if="![selected.brand, selected.category, selected.model, selected.notes].some(Boolean)" class="detail-empty">還沒有其他資料，隨時可以編輯補上。</div><button class="mobile-detail-delete" type="button" @click="showDelete = true">刪除商品</button></div></div>
        <section class="product-locations panel" aria-labelledby="product-locations-title">
          <div class="product-locations-heading"><div><p class="eyebrow">WHERE TO FIND IT</p><h3 id="product-locations-title">可購買地點 <span v-if="!linkedLocationsLoading && !linkedLocationsError">{{ linkedLocations.length }}</span></h3></div><button ref="locationPickerTrigger" class="product-location-add" type="button" @click="openLocationPicker">＋ 連結地點</button></div>
          <p v-if="linkedLocationsLoading" class="product-location-message" role="status">正在載入地點…</p>
          <div v-else-if="linkedLocationsError" class="product-location-message" role="alert">無法讀取可購買地點。<button class="text-button" type="button" @click="refreshLinkedLocations">重試</button></div>
          <p v-else-if="!linkedLocations.length" class="product-location-message">還沒有連結地點。先從既有地點選取；找不到時再新增。</p>
          <div v-else class="linked-location-list"><button v-for="location in linkedLocations" :key="location.id" class="location-row" type="button" :aria-label="`查看 ${[location.name, location.city, location.country, location.address].filter(Boolean).join('，')} 的地點詳情`" @click="openLinkedLocationDetail(location, $event)"><span class="location-pin" aria-hidden="true">⌖</span><span class="location-row-main"><strong>{{ location.name }}</strong><small v-if="location.city || location.country">{{ [location.city, location.country].filter(Boolean).join(' · ') }}</small><small v-if="location.address" class="location-row-address">{{ location.address }}</small><small v-if="formatPurchasePrice(location.purchase)" class="location-row-price">{{ formatPurchasePrice(location.purchase) }}</small></span><span class="location-row-action" aria-hidden="true">›</span></button></div>
        </section>
      </template>

      <ProductForm v-else-if="view === 'form'" :product="selected" :saving="saving" @save="handleSave" @cancel="goBack" />

      <div v-else-if="view === 'location-form'" class="editor-shell location-editor">
        <div class="page-heading editor-heading"><div><button class="back-link" type="button" @click="closeLocationForm">← 返回</button><p class="eyebrow">MY PLACES / {{ selectedLocation ? 'EDIT' : 'NEW' }}</p><h1>{{ selectedLocation ? '編輯地點' : '新增地點' }}</h1><p class="subtext">先記下地點名稱，再選擇可以在這裡買到的商品。</p></div></div>
        <form id="location-form" class="editor-grid" @submit.prevent="handleLocationSave">
          <div class="form-main panel">
            <div class="section-title"><span class="step">01</span><div><h2>地點資料</h2><p>只有名稱是必填，其餘可以稍後補上。</p></div></div>
            <label class="field"><span>地點名稱 <em>必填</em></span><input ref="locationNameInput" v-model="locationDraft.name" type="text" required maxlength="150" placeholder="例如：松本清 新宿東口店" /></label>
            <label class="field">城市／地區（選填）<input v-model="locationDraft.city" type="text" maxlength="100" placeholder="例如：東京、新宿或台北" /></label>
            <label class="field">地址<input v-model="locationDraft.address" type="text" maxlength="300" placeholder="例如：新宿 3-24-1" /></label>
            <button class="location-extra-toggle" type="button" :aria-expanded="locationExtraOpen" aria-controls="location-extra-fields" @click="locationExtraOpen = !locationExtraOpen">{{ locationExtraOpen ? '收起位置資訊' : '更多位置資訊（選填）' }}<span aria-hidden="true">{{ locationExtraOpen ? '⌃' : '⌄' }}</span></button>
            <div v-show="locationExtraOpen" id="location-extra-fields" class="location-field-row"><label class="field">國家<input v-model="locationDraft.country" type="text" maxlength="100" placeholder="例如：日本" /></label><label class="field">區域<input v-model="locationDraft.area" type="text" maxlength="100" placeholder="例如：新宿區" /></label></div>
            <label class="field">備註<textarea v-model="locationDraft.notes" maxlength="1000" rows="3" placeholder="營業時間、想買的東西…"></textarea></label>
          </div>
          <div class="form-side">
            <section ref="locationProductsSection" class="location-product-picker panel" aria-labelledby="location-products-title" tabindex="-1">
              <div class="section-title"><span class="step">02</span><div><h2 id="location-products-title">可購買的商品</h2><p>勾選已建立的商品，儲存時一併連結。</p></div></div>
              <div class="location-products-heading"><span>已選 {{ selectedProductIds.length }} 件</span></div>
              <label v-if="products.length" class="location-product-search"><span class="sr-only">搜尋已建立的商品</span><input v-model="locationProductQuery" type="search" placeholder="搜尋商品名稱、品牌或分類…" /></label>
              <div v-if="loading || locationLinksLoading" class="product-picker-message" role="status">正在載入商品…</div>
              <div v-else-if="error" class="product-picker-message" role="alert">商品列表讀取失敗，請返回後重試。</div>
              <div v-else-if="!products.length" class="product-picker-message">目前沒有商品。新增後會自動回到這個地點並勾選商品。</div>
              <div v-else-if="!productChoices.length" class="product-picker-message">找不到符合的商品。</div>
              <div v-else class="product-picker-list"><ProductPickerOption v-for="product in productChoices" :key="product.id" :product="product" :checked="selectedProductIds.includes(product.id)" @toggle="toggleProductSelection" /></div>
              <button class="location-create-product" type="button" :disabled="locationSaving || locationLinksLoading || locationLinksFailed" @click="startProductForLocation"><span aria-hidden="true">＋</span> 新增商品並連結</button>
            </section>
            <div class="form-actions"><p v-if="locationError" class="form-error" role="alert">{{ locationError }}</p><button class="primary-button full" type="submit" :disabled="locationSaving || locationLinksLoading || locationLinksFailed || loading || Boolean(error)">{{ locationSaving ? '儲存中…' : '儲存' }} <span aria-hidden="true">↗</span></button><button class="text-button full" type="button" @click="closeLocationForm">取消</button><button v-if="selectedLocation" class="location-delete-link full" type="button" @click="requestLocationDelete">刪除地點</button></div>
          </div>
        </form>
      </div>

      <div v-else-if="view === 'group-form'" class="editor-shell group-editor">
        <div class="page-heading editor-heading"><div><button class="back-link" type="button" @click="closeGroupForm">← 返回</button><p class="eyebrow">MY GROUPS / {{ selectedGroup ? 'EDIT' : 'NEW' }}</p><h1>{{ selectedGroup ? '編輯群組' : '新增群組' }}</h1><p class="subtext">幫清單取個名字，再挑選要放進去的商品。</p></div></div>
        <form id="group-form" class="editor-grid" @submit.prevent="handleGroupSave">
          <div class="form-main panel"><div class="section-title"><span class="step">01</span><div><h2>群組資訊</h2><p>只有名稱是必填。</p></div></div><label class="field"><span>群組名稱 <em>必填</em></span><input ref="groupNameInput" v-model="groupDraft.name" maxlength="150" required placeholder="例如：東京購物清單" /></label><fieldset class="group-choice"><legend>圖示</legend><div class="group-icon-options"><label v-for="option in GROUP_ICONS" :key="option.id"><input v-model="groupDraft.icon" type="radio" name="group-icon" :value="option.id" :aria-label="option.label" /><span><GroupIcon :icon="option.id" /></span></label></div></fieldset><fieldset class="group-choice"><legend>顏色</legend><div class="group-color-options"><label v-for="option in GROUP_COLORS" :key="option.id" :title="option.label"><input v-model="groupDraft.color" type="radio" name="group-color" :value="option.id" /><span :style="groupAppearance({ color: option.id })"><i aria-hidden="true"></i><small>{{ option.label }}</small></span></label></div></fieldset><label class="field">說明<textarea v-model="groupDraft.notes" maxlength="1000" rows="4" placeholder="這個群組想收藏什麼？"></textarea></label></div>
          <div class="form-side">
            <section class="location-product-picker panel" aria-labelledby="group-form-products-title">
              <div class="section-title"><span class="step">02</span><div><h2 id="group-form-products-title">選擇商品</h2><p>同一件商品也能加入其他群組。</p></div></div>
              <div class="location-products-heading"><span>已選 {{ selectedGroupProductIds.length }} 件</span></div>
              <label v-if="products.length" class="location-product-search"><span class="sr-only">搜尋商品</span><input v-model="groupProductQuery" type="search" placeholder="搜尋商品名稱、品牌或分類…" /></label>
              <p v-if="loading || groupFormLinksLoading" class="product-picker-message" role="status">正在載入商品…</p>
              <p v-else-if="error" class="product-picker-message" role="alert">無法讀取商品，請稍後重試。</p>
              <p v-else-if="!products.length" class="product-picker-message">目前沒有商品，群組建立後仍可再加入。</p>
              <p v-else-if="!groupProductChoices.length" class="product-picker-message">找不到符合的商品。</p>
              <div v-else class="product-picker-list"><ProductPickerOption v-for="product in groupProductChoices" :key="product.id" :product="product" :checked="selectedGroupProductIds.includes(product.id)" @toggle="toggleGroupProduct" /></div>
              <div v-if="selectedGroupProductIds.length > 1" class="group-order"><h3>清單順序</h3><div v-for="(productId, index) in selectedGroupProductIds" :key="productId" class="group-order-row"><span>{{ index + 1 }}. {{ groupProductName(productId) }}</span><button type="button" :disabled="index === 0" :aria-label="`將商品上移：${groupProductName(productId)}`" @click="moveGroupProduct(productId, -1)">↑</button><button type="button" :disabled="index === selectedGroupProductIds.length - 1" :aria-label="`將商品下移：${groupProductName(productId)}`" @click="moveGroupProduct(productId, 1)">↓</button></div></div>
            </section>
            <div class="form-actions"><p v-if="groupFormError" class="form-error" role="alert">{{ groupFormError }}</p><button class="primary-button full" type="submit" :disabled="groupSaving || loading || groupFormLinksLoading || groupFormLinksFailed || Boolean(error)">{{ groupSaving ? '儲存中…' : '儲存' }} <span aria-hidden="true">↗</span></button><button class="text-button full" type="button" @click="closeGroupForm">取消</button><button v-if="selectedGroup" class="location-delete-link full" type="button" @click="showGroupDelete = true">刪除群組</button></div>
          </div>
        </form>
      </div>

      <template v-else-if="view === 'settings'">
        <header class="page-heading library-heading settings-heading"><div><p class="eyebrow">PREFERENCES</p><h1>設定<span class="heading-spark">✦</span></h1><p class="subtext">調整外觀並管理收藏資料。</p></div></header>
        <section class="library-panel settings-panel">
          <div class="collection-results settings-results">
            <div class="settings-section settings-appearance">
              <h2>外觀</h2>
              <label class="theme-setting">
                <span class="theme-setting-copy"><strong>深色模式</strong><small>使用藍色背景與白色文字</small></span>
                <input v-model="darkMode" type="checkbox" role="switch" aria-label="深色模式" />
              </label>
            </div>
            <div class="settings-section">
              <h2>備份與還原</h2>
              <p class="settings-intro">備份包含所有商品、地點、群組、關聯與照片，匯出為單一檔案。還原會取代這台裝置目前的資料。</p>
              <div class="settings-actions">
                <button class="primary-button" type="button" :disabled="backupBusy" @click="handleExportBackup">{{ backupBusy ? '匯出中…' : '匯出備份' }}</button>
                <button class="secondary-button" type="button" :disabled="backupBusy" @click="handleImportBackup">{{ backupBusy ? '處理中…' : '匯入備份' }}</button>
              </div>
              <div class="settings-table-export">
                <h3>表格匯出</h3>
                <p class="settings-intro">將商品、地點與群組整理成 Excel 工作表，商品列會顯示所屬群組。表格不含照片、地點關聯與購買價格，也無法用於備份還原。</p>
                <button class="secondary-button" type="button" :disabled="backupBusy" @click="handleExportSpreadsheet">{{ backupBusy ? '處理中…' : '匯出 Excel 表格' }}</button>
              </div>
              <p v-if="backupFeedback" class="settings-feedback" role="status">{{ backupFeedback }}</p>
              <p v-if="backupError" class="settings-error" role="alert">{{ backupError }}</p>
            </div>
          </div>
        </section>
      </template>

      <div v-else class="coming-soon"><button class="back-link" @click="navigate('library')">← 返回商品收藏</button><span class="coming-icon">✦</span><p class="eyebrow">COMING SOON</p><h1>頁面暫時無法顯示</h1><button class="primary-button" @click="navigate('library')">查看商品收藏</button></div>
    </main>
    <nav class="mobile-nav" aria-label="行動版導覽"><button :class="{ active: ['library', 'detail', 'form'].includes(view) && !creatingProductForLocation }" @click="navigate('library')"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2.5 9 4.8v9.4l-9 4.8-9-4.8V7.3l9-4.8Z" /><path d="m3 7.3 9 4.8 9-4.8M12 12.1v9.4" /></svg></span><span class="nav-text">商品</span></button><button :class="{ active: ['locations', 'location-detail', 'location-form'].includes(view) || creatingProductForLocation }" @click="navigate('locations')"><span class="nav-icon" aria-hidden="true">⌖</span><span class="nav-text">地點</span></button><button :class="{ active: ['groups', 'group-detail', 'group-form'].includes(view) }" @click="navigate('groups')"><span class="nav-icon" aria-hidden="true"><GroupIcon /></span><span class="nav-text">群組</span></button><button :class="{ active: view === 'settings' }" @click="navigate('settings')"><span class="nav-icon" aria-hidden="true">⚙</span><span class="nav-text">設定</span></button></nav>
    <div v-if="showDelete" class="dialog-backdrop" @click.self="showDelete = false"><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-desc"><span class="dialog-icon">!</span><h2 id="delete-title">刪除這件商品？</h2><p id="delete-desc">「{{ selected?.name }}」與它的照片會從這台裝置永久刪除，無法復原。</p><div class="dialog-actions"><button class="secondary-button" :disabled="deleting" @click="showDelete = false">取消</button><button class="danger-fill" :disabled="deleting" @click="confirmDelete">{{ deleting ? '刪除中…' : '確認刪除' }}</button></div></div></div>
    <LocationLinkPicker v-if="locationPickerOpen" :locations="locationPickerLocations" :linked-ids="locationPickerLinkedIds" :loading="locationPickerLoading" :error="locationPickerError" :busy-id="linkingLocationId" @close="closeLocationPicker" @retry="loadLocationPicker" @select="selectLocationForProduct" @create="createLocationFromPicker" />
    <LinkedLocationDetail v-if="linkedLocationDetail" :location="linkedLocationDetail" :busy="unlinkingLocation" :error="unlinkLocationError" :purchase-saving="purchaseSaving" :purchase-error="purchaseError" :purchase-saved-key="purchaseSavedKey" @close="closeLinkedLocationDetail" @unlink="unlinkLinkedLocation" @edit="editLinkedLocation" @save-purchase="saveLinkedLocationPurchase" @clear-purchase-error="purchaseError = ''" />
    <div v-if="groupPickerOpen" class="dialog-backdrop" @click.self="!groupPickerBusy && (groupPickerOpen = false)"><section class="dialog group-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="group-picker-title"><div class="group-picker-heading"><div><h2 id="group-picker-title">加入群組</h2><p>一件商品可以同時收進多個群組。</p></div><button type="button" aria-label="關閉群組選擇" :disabled="groupPickerBusy" @click="groupPickerOpen = false">×</button></div><p v-if="groupPickerError" class="form-error" role="alert">{{ groupPickerError }}</p><p v-if="groupsLoading" class="product-picker-message" role="status">正在載入群組…</p><p v-else-if="groupsError" class="product-picker-message" role="alert">{{ groupsError }} <button class="text-button" type="button" @click="refreshGroups">重試</button></p><div v-else-if="groups.length" class="group-picker-list"><label v-for="group in groups" :key="group.id" class="group-picker-option"><input type="checkbox" :checked="productGroupIds.includes(group.id)" :disabled="groupPickerBusy" @change="toggleProductGroup(group.id)" /><span><strong>{{ group.name }}</strong><small>{{ group.productCount }} 件商品</small></span></label></div><p v-else class="product-picker-message">目前沒有群組，先建立第一個吧。</p><button class="location-create-product" type="button" :disabled="groupPickerBusy" @click="openGroupForm(null, selected?.id)">＋ 新增群組並加入</button></section></div>
    <div v-if="showGroupDelete" class="dialog-backdrop" @click.self="!groupDeleting && (showGroupDelete = false)"><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="group-delete-title"><span class="dialog-icon">!</span><h2 id="group-delete-title">刪除這個群組？</h2><p>「{{ selectedGroup?.name }}」與群組中的商品關聯會刪除，商品本身會保留。</p><div class="dialog-actions"><button class="secondary-button" type="button" :disabled="groupDeleting" @click="showGroupDelete = false">取消</button><button class="danger-fill" type="button" :disabled="groupDeleting" @click="confirmGroupDelete">{{ groupDeleting ? '刪除中…' : '確認刪除' }}</button></div></div></div>
    <div v-if="showLocationDelete" class="dialog-backdrop" @click.self="showLocationDelete = false"><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="location-delete-title" aria-describedby="location-delete-desc"><span class="dialog-icon">!</span><h2 id="location-delete-title">刪除這個地點？</h2><p id="location-delete-desc">「{{ selectedLocation?.name }}」及其商品關聯會從這台裝置永久刪除，無法復原。商品本身會保留。</p><div class="dialog-actions"><button class="secondary-button" type="button" :disabled="locationDeleting" @click="showLocationDelete = false">取消</button><button class="danger-fill" type="button" :disabled="locationDeleting" @click="confirmLocationDelete">{{ locationDeleting ? '刪除中…' : '確認刪除' }}</button></div></div></div>
    <div v-if="showImagePreview && detailImage" class="image-preview" role="dialog" aria-modal="true" :aria-label="`${selected?.name} 的照片`" @click.self="showImagePreview = false"><button ref="imageCloseButton" class="image-preview-close" type="button" aria-label="關閉照片" @click="showImagePreview = false">×</button><img :src="detailImage" :alt="selected?.name" /></div>
    <div v-if="restoreConfirmOpen" class="dialog-backdrop" @click.self="closeRestoreConfirm"><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="restore-title" aria-describedby="restore-desc"><span class="dialog-icon">!</span><h2 id="restore-title">確認還原備份？</h2><p id="restore-desc">這會取代這台裝置目前的所有資料。<br />商品 {{ restoreCounts?.products ?? 0 }} 件、地點 {{ restoreCounts?.locations ?? 0 }} 個、群組 {{ restoreCounts?.groups ?? 0 }} 個、關聯 {{ (restoreCounts?.locationProducts ?? 0) + (restoreCounts?.groupProducts ?? 0) }} 筆、圖片 {{ restoreCounts?.images ?? 0 }} 張。</p><div v-if="restoreWarnings.length" class="restore-warnings"><p><strong>警告：</strong></p><ul><li v-for="(warning, index) in restoreWarnings" :key="index">{{ warning }}</li></ul></div><div class="dialog-actions"><button class="secondary-button" type="button" :disabled="backupBusy" @click="closeRestoreConfirm">取消</button><button class="danger-fill" type="button" :disabled="backupBusy" @click="handleConfirmRestore">{{ backupBusy ? '還原中…' : '確認還原' }}</button></div></div></div>
  </div>
</template>
