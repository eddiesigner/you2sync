<template>
  <span class="inline-flex items-center gap-2 font-semibold tracking-tight">
    <svg viewBox="0 0 32 32" class="size-7" aria-hidden="true">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1ed760" />
          <stop offset="0.5" stop-color="#8b5cf6" />
          <stop offset="1" stop-color="#ff0033" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-gradient)" />
      <!-- Two arrows chasing each other: the sync loop. -->
      <path d="M9 13a7 7 0 0 1 12.2-3.6M23 19a7 7 0 0 1-12.2 3.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" />
      <path d="M22.5 6.5v3.8h-3.8M9.5 25.5v-3.8h3.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="text-lg">You<span class="text-primary-glow">2</span>Sync</span>
  </span>
</template>
