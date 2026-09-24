<script setup lang="ts">
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { JobKind, type JobState, JobStatus, type PlanDecision, SERVICE_LABEL, otherService } from '#shared/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

useHead({ title: 'Sync · You2Sync' })

const POLL_INTERVAL_MS = 1000

const route = useRoute()
const jobId = computed(() => String(route.params.id))

const job = ref<JobState>()
const loadError = ref<string>()
const applying = ref(false)
const confirmOpen = ref(false)

// Per-playlist choices, keyed by plan key.
const removals = reactive(new Map<string, Set<string>>())
const covers = reactive(new Map<string, boolean>())

const { refresh: refreshLibrary } = useLibrary()
const { refresh: refreshReviews } = useReviews()

/*
 * Poll while the job runs. Each response replaces the local state; the
 * heavy plan payload only arrives once the job is ready or done.
 */
let timer: ReturnType<typeof setTimeout> | undefined

async function poll() {
  try {
    const state = await api<JobState>(`/api/sync/${jobId.value}`)
    const becameReady = state.status === JobStatus.Ready && job.value?.status !== JobStatus.Ready
    job.value = state

    if (becameReady) {
      initDecisions(state)
    }
    if (state.status === JobStatus.Done) {
      refreshLibrary()
      refreshReviews()
    }
    if (state.status === JobStatus.Running) {
      timer = setTimeout(poll, POLL_INTERVAL_MS)
    }
  }
  catch (error) {
    loadError.value = errorText(error)
  }
}

function initDecisions(state: JobState) {
  for (const plan of state.plans) {
    removals.set(plan.key, new Set())
    covers.set(plan.key, plan.canCopyCover && plan.willCreate)
  }
}

onMounted(poll)
onBeforeUnmount(() => clearTimeout(timer))

const running = computed(() => job.value?.status === JobStatus.Running)
const progress = computed(() => job.value?.total ? Math.round((job.value.done / job.value.total) * 100) : 0)
const target = computed(() => job.value ? SERVICE_LABEL[otherService(job.value.source)] : '')

const totals = computed(() => {
  const plans = job.value?.plans ?? []
  return {
    add: plans.reduce((sum, plan) => sum + plan.add.length, 0),
    remove: [...removals.values()].reduce((sum, ids) => sum + ids.size, 0),
    unmatched: plans.reduce((sum, plan) => sum + plan.unmatched.length, 0),
    create: plans.filter(plan => plan.willCreate && !plan.error).length,
  }
})

const resultTotals = computed(() => {
  const results = job.value?.results ?? []
  return {
    added: results.reduce((sum, r) => sum + r.added, 0),
    removed: results.reduce((sum, r) => sum + r.removed, 0),
    unmatched: results.reduce((sum, r) => sum + r.unmatched, 0),
    failed: results.filter(r => r.error).length,
  }
})

// Sort plans with work first so the preview leads with what matters.
const sortedPlans = computed(() => [...(job.value?.plans ?? [])].sort((a, b) => weight(b) - weight(a)))
function weight(plan: JobState['plans'][number]) {
  return plan.error ? 1 : plan.add.length + plan.remove.length + plan.unmatched.length + (plan.willCreate ? 1 : 0)
}

function requestApply() {
  if (totals.value.remove) {
    confirmOpen.value = true
    return
  }
  apply()
}

async function apply() {
  confirmOpen.value = false
  applying.value = true
  const decisions: PlanDecision[] = (job.value?.plans ?? []).map(plan => ({
    key: plan.key,
    removeIds: [...(removals.get(plan.key) ?? [])],
    copyCover: covers.get(plan.key) ?? false,
  }))

  try {
    job.value = await api<JobState>('/api/sync/apply', { method: 'POST', body: { jobId: jobId.value, decisions } })
    poll()
  }
  catch (error) {
    toast.error(errorText(error))
  }
  finally {
    applying.value = false
  }
}
</script>

<template>
  <div class="relative isolate min-h-[calc(100dvh-4rem)]">
    <AmbientBackdrop :src="job?.current?.image ?? sortedPlans[0]?.sourcePlaylist.image" />

    <div class="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <NuxtLink to="/" class="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <ArrowLeft class="size-4" aria-hidden="true" /> Library
      </NuxtLink>

      <!-- Error loading the job -->
      <div v-if="loadError" class="mt-16 text-center" role="alert">
        <AlertTriangle class="mx-auto size-10 text-destructive" aria-hidden="true" />
        <p class="mt-4 text-lg font-medium">
          {{ loadError }}
        </p>
        <Button as-child class="mt-6 rounded-full">
          <NuxtLink to="/">
            Back to library
          </NuxtLink>
        </Button>
      </div>

      <!-- Running: planning or applying -->
      <section v-else-if="!job || running" class="mt-16 flex flex-col items-center text-center" aria-live="polite" aria-busy="true">
        <CoverImage :src="job?.current?.image" eager class="size-48 rounded-2xl shadow-2xl shadow-black/70 ring-1 ring-white/10 sm:size-56" />
        <p class="mt-8 flex items-center gap-3 text-sm font-medium text-primary-glow">
          <Equalizer />
          {{ job?.kind === JobKind.Apply ? `Writing to ${target}` : 'Matching songs' }}
        </p>
        <h1 class="mt-2 max-w-full truncate text-2xl font-bold sm:text-3xl">
          {{ job?.current?.name ?? 'Reading your library…' }}
        </h1>
        <div class="mt-6 w-full max-w-sm">
          <Progress :model-value="progress" class="h-1.5" :aria-label="`${progress}% complete`" />
          <p class="mt-2 text-xs text-muted-foreground tabular-nums">
            {{ job?.done ?? 0 }} of {{ job?.total || '…' }} playlists
          </p>
        </div>
      </section>

      <!-- Failed -->
      <div v-else-if="job.status === JobStatus.Failed" class="mt-16 text-center" role="alert">
        <AlertTriangle class="mx-auto size-10 text-destructive" aria-hidden="true" />
        <h1 class="mt-4 text-2xl font-bold">
          Sync failed
        </h1>
        <p class="mt-2 text-muted-foreground">
          {{ job.error }}
        </p>
        <Button as-child class="mt-6 rounded-full">
          <NuxtLink to="/">
            Back to library
          </NuxtLink>
        </Button>
      </div>

      <!-- Ready: preview and confirm -->
      <template v-else-if="job.status === JobStatus.Ready">
        <header class="mt-6">
          <p class="flex items-center gap-2 text-sm text-muted-foreground">
            <BrandIcon :service="job.source" class="size-4" />
            {{ SERVICE_LABEL[job.source] }}
            <ArrowRight class="size-3.5" aria-label="to" />
            <BrandIcon :service="otherService(job.source)" class="size-4" />
            {{ target }}
          </p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Review changes
          </h1>
          <dl class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-xl border border-white/10 bg-black/20 p-3">
              <dt class="text-xs text-muted-foreground">
                New playlists
              </dt>
              <dd class="text-2xl font-semibold tabular-nums">
                {{ totals.create }}
              </dd>
            </div>
            <div class="rounded-xl border border-white/10 bg-black/20 p-3">
              <dt class="text-xs text-muted-foreground">
                Songs to add
              </dt>
              <dd class="text-2xl font-semibold text-spotify tabular-nums">
                {{ totals.add }}
              </dd>
            </div>
            <div class="rounded-xl border border-white/10 bg-black/20 p-3">
              <dt class="text-xs text-muted-foreground">
                Confirmed removals
              </dt>
              <dd class="text-2xl font-semibold text-red-400 tabular-nums">
                {{ totals.remove }}
              </dd>
            </div>
            <div class="rounded-xl border border-white/10 bg-black/20 p-3">
              <dt class="text-xs text-muted-foreground">
                Not found
              </dt>
              <dd class="text-2xl font-semibold text-amber-300 tabular-nums">
                {{ totals.unmatched }}
              </dd>
            </div>
          </dl>
        </header>

        <section aria-label="Playlists" class="mt-6 space-y-3">
          <PlanCard
            v-for="plan in sortedPlans"
            :key="plan.key"
            :plan="plan"
            :remove-ids="removals.get(plan.key) ?? new Set()"
            :copy-cover="covers.get(plan.key) ?? false"
            @update:remove-ids="removals.set(plan.key, $event)"
            @update:copy-cover="covers.set(plan.key, $event)"
          />
        </section>

        <div class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] mt-6 flex justify-end md:bottom-6">
          <div class="flex items-center gap-2 rounded-full border border-white/10 bg-popover/90 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl">
            <Button variant="ghost" as-child class="rounded-full">
              <NuxtLink to="/">
                Cancel
              </NuxtLink>
            </Button>
            <Button class="rounded-full px-6" :disabled="applying" @click="requestApply">
              <Loader2 v-if="applying" class="animate-spin" />
              Apply changes
            </Button>
          </div>
        </div>

        <AlertDialog v-model:open="confirmOpen">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {{ plural(totals.remove, 'song') }} from {{ target }}?</AlertDialogTitle>
              <AlertDialogDescription>
                The songs you confirmed will be removed from their playlists on {{ target }}. This cannot be undone from You2Sync.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go back</AlertDialogCancel>
              <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="apply">
                Apply and remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </template>

      <!-- Done: results -->
      <template v-else>
        <header class="mt-6 text-center">
          <span class="mx-auto grid size-16 place-items-center rounded-full bg-primary-glow text-black shadow-[0_0_60px] shadow-primary-glow/50">
            <Check class="size-8" aria-hidden="true" />
          </span>
          <h1 class="mt-5 text-3xl font-bold tracking-tight">
            Sync complete
          </h1>
          <p class="mt-2 text-muted-foreground">
            {{ plural(resultTotals.added, 'song') }} added · {{ plural(resultTotals.removed, 'song') }} removed<template v-if="resultTotals.unmatched">
              · {{ resultTotals.unmatched }} to review
            </template>
          </p>
        </header>

        <ul class="mt-8 space-y-2">
          <li v-for="result in job.results" :key="result.key" class="flex items-center gap-3 rounded-xl border border-white/10 bg-card/60 p-3">
            <CoverImage :src="result.image" class="size-12 shrink-0 rounded-md" />
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">
                {{ result.name }}
              </p>
              <p v-if="result.error" class="truncate text-sm text-destructive">
                {{ result.error }}
              </p>
              <p v-else class="text-sm text-muted-foreground">
                <template v-if="result.created">
                  Created ·
                </template>
                +{{ result.added }} −{{ result.removed }}<template v-if="result.unmatched">
                  · {{ result.unmatched }} not found
                </template>
              </p>
            </div>
            <AlertTriangle v-if="result.error" class="size-5 text-destructive" aria-label="Failed" />
            <Check v-else class="size-5 text-primary-glow" aria-label="Done" />
          </li>
        </ul>

        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <Button v-if="resultTotals.unmatched" as-child variant="secondary" class="rounded-full">
            <NuxtLink to="/review">
              Review unmatched songs
            </NuxtLink>
          </Button>
          <Button as-child class="rounded-full">
            <NuxtLink to="/">
              Back to library
            </NuxtLink>
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
