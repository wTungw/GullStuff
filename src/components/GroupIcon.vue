<script setup>
defineProps({ icon: { type: String, default: 'folder' } })
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="icon === 'gift'"><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M2 9h20M12 9v12M12 9c-3-1-6-2-6-4a2 2 0 0 1 4-1c1 1 2 3 2 5Zm0 0c3-1 6-2 6-4a2 2 0 0 0-4-1c-1 1-2 3-2 5Z"/></template>
    <path v-else-if="icon === 'star'" d="m12 2.5 2.8 6 6.6.8-4.8 4.6 1.2 6.6-5.8-3.2-5.8 3.2 1.2-6.6-4.8-4.6 6.6-.8L12 2.5Z"/>
    <template v-else-if="icon === 'bag'"><path d="M4 8h16l-1 13H5L4 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></template>
    <path v-else-if="icon === 'plane'" d="m21 3-8 18-2.7-7.3L3 11l18-8ZM10.3 13.7 21 3"/>
    <path v-else-if="icon === 'heart'" d="M20.8 5.2a5 5 0 0 0-7.1 0L12 6.9l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.7a5 5 0 0 0 0-7.1Z"/>
    <path v-else d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>
  </svg>
</template>
