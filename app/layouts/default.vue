<script setup lang="ts">
import { Library, ListChecks, LogOut, Settings } from '@lucide/vue'
import { Service } from '#shared/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const route = useRoute()
const { state, logout } = useAuth()
const { data: reviews, execute: loadReviews } = useReviews()

watch(() => state.value.ready, (ready) => {
  if (ready) {
    loadReviews()
  }
}, { immediate: true })

const showNav = computed(() => state.value.ready)
const services = [Service.Spotify, Service.YTMusic]

const links = computed(() => [
  { to: '/', label: 'Library', icon: Library },
  { to: '/review', label: 'Review', icon: ListChecks, count: reviews.value.length },
  { to: '/settings', label: 'Settings', icon: Settings },
])
</script>

<template>
  <div class="relative flex min-h-dvh flex-col">
    <a href="#main" class="sr-only z-50 rounded-md bg-primary px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
      Skip to content
    </a>

    <header class="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <NuxtLink to="/" class="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label="You2Sync home">
          <AppLogo />
        </NuxtLink>

        <nav v-if="showNav" aria-label="Main" class="ml-2 hidden items-center gap-1 md:flex">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            active-class="!text-foreground bg-white/10"
            :aria-current="route.path === link.to ? 'page' : undefined"
          >
            {{ link.label }}
            <Badge v-if="link.count" variant="secondary" class="rounded-full bg-primary-glow/20 px-1.5 text-primary-glow">
              {{ link.count }}
            </Badge>
          </NuxtLink>
        </nav>

        <div v-if="showNav" class="ml-auto flex items-center gap-2">
          <div class="flex -space-x-2" aria-label="Connected accounts">
            <Avatar v-for="service in services" :key="service" class="size-8 ring-2 ring-background">
              <AvatarImage v-if="state.accounts[service]?.avatar" :src="state.accounts[service]!.avatar!" :alt="`${state.accounts[service]?.name} on ${service}`" referrerpolicy="no-referrer" />
              <AvatarFallback class="bg-secondary">
                <BrandIcon :service="service" class="size-4" />
              </AvatarFallback>
            </Avatar>
          </div>
          <Button variant="ghost" size="icon" aria-label="Sign out" @click="logout">
            <LogOut />
          </Button>
        </div>
      </div>
    </header>

    <main id="main" class="relative flex-1 pb-24 md:pb-10">
      <slot />
    </main>

    <!-- Bottom tab bar on small screens, like the mobile music apps. -->
    <nav v-if="showNav" aria-label="Main" class="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul class="mx-auto grid max-w-md grid-cols-3">
        <li v-for="link in links" :key="link.to">
          <NuxtLink
            :to="link.to"
            class="relative flex flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            active-class="!text-foreground"
          >
            <component :is="link.icon" class="size-5" aria-hidden="true" />
            {{ link.label }}
            <span v-if="link.count" class="absolute right-1/2 top-1.5 translate-x-5 rounded-full bg-primary-glow px-1.5 text-[10px] font-semibold text-black">
              {{ link.count }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
