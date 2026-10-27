<script setup>
import { computed, ref, useId, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  placeholder: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  required: { type: Boolean, default: false },
  maxlength: { type: Number, default: undefined },
})
const emit = defineEmits(['update:modelValue'])
const id = useId()
const open = ref(false)
const activeIndex = ref(-1)
const input = ref(null)
defineExpose({ focus: () => input.value?.focus() })
const matches = computed(() => {
  const needle = props.modelValue.trim().toLocaleLowerCase('zh-TW')
  if (!needle) return []
  return props.options.filter(option => option.toLocaleLowerCase('zh-TW').includes(needle))
})
const expanded = computed(() => open.value && matches.value.length > 0)

watch(matches, () => { activeIndex.value = -1 })

function onInput(event) {
  emit('update:modelValue', event.target.value)
  open.value = true
}
function onFocusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) open.value = false
}
function move(direction) {
  if (!matches.value.length) return
  open.value = true
  activeIndex.value = activeIndex.value < 0
    ? (direction > 0 ? 0 : matches.value.length - 1)
    : (activeIndex.value + direction + matches.value.length) % matches.value.length
}
function select(option) {
  emit('update:modelValue', option)
  open.value = false
  activeIndex.value = -1
}
function onEnter(event) {
  if (expanded.value && activeIndex.value >= 0) {
    event.preventDefault()
    select(matches.value[activeIndex.value])
  }
}
</script>

<template>
  <div class="field suggestion-field" @focusout="onFocusOut">
    <label :for="`${id}-input`">{{ label }} <em v-if="required">必填</em></label>
    <div class="suggestion-control">
      <input
        ref="input"
        :id="`${id}-input`"
        :value="modelValue"
        :placeholder="placeholder"
        :required="required"
        :maxlength="maxlength"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="expanded"
        :aria-controls="expanded ? `${id}-list` : undefined"
        :aria-activedescendant="expanded && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined"
        @input="onInput"
        @focus="open = true"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter="onEnter"
        @keydown.esc="open = false"
      />
      <ul v-if="expanded" :id="`${id}-list`" class="suggestion-list" role="listbox" :aria-label="`${label}建議選項`">
        <li v-for="(option, index) in matches" :id="`${id}-option-${index}`" :key="option" role="option" :aria-selected="index === activeIndex">
          <button type="button" :class="{ active: index === activeIndex }" @mousedown.prevent @click="select(option)">{{ option }}</button>
        </li>
      </ul>
    </div>
  </div>
</template>
