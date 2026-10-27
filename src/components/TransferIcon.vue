<script setup>
defineProps({ kind: { type: String, required: true } })
</script>

<template>
  <svg v-if="kind === 'share'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3v13m0 0-4.5-4.5M12 16l4.5-4.5" />
    <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
  </svg>
</template>
