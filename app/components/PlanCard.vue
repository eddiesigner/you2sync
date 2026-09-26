<script setup lang="ts">
import { AlertTriangle, ChevronDown, Minus, Pencil, Plus, Sparkles } from '@lucide/vue'
import { PlaylistKind, type PlaylistPlan, SERVICE_LABEL, otherService } from '#shared/types'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'

const props = defineProps<{ plan: PlaylistPlan }>()
// Target ids confirmed for removal, and whether to copy the cover.
const removeIds = defineModel<Set<string>>('removeIds', { required: true })
const copyCover = defineModel<boolean>('copyCover', { required: true })

const target = computed(() => SERVICE_LABEL[otherService(props.plan.source)])
const hasChanges = computed(() => props.plan.add.length + props.plan.remove.length + props.plan.unmatched.length > 0 || props.plan.willCreate || props.plan.willRename)
const allRemovals = computed(() => props.plan.remove.length > 0 && props.plan.remove.every(track => removeIds.value.has(track.id)))

function toggleRemoval(id: string, checked: boolean | 'indeterminate') {
  const next = new Set(removeIds.value)
  if (checked === true) {
    next.add(id)
  }
  else {
    next.delete(id)
  }
  removeIds.value = next
}

function toggleAllRemovals(checked: boolean | 'indeterminate') {
  removeIds.value = checked === true ? new Set(props.plan.remove.map(track => track.id)) : new Set()
}
</script>

<template>
  <article class="overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur" :aria-labelledby="`plan-${plan.key}`">
    <header class="flex items-center gap-4 p-4">
      <CoverImage :src="plan.sourcePlaylist.image" :liked="plan.sourcePlaylist.kind === PlaylistKind.Liked" class="size-16 shrink-0 rounded-lg shadow-lg" />
      <div class="min-w-0 flex-1">
        <h3 :id="`plan-${plan.key}`" class="truncate font-semibold">
          {{ plan.sourcePlaylist.name }}
        </h3>
        <p v-if="plan.error" class="mt-1 flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle class="size-4 shrink-0" aria-hidden="true" /> {{ plan.error }}
          <ReconnectLink v-if="plan.reconnect" :service="plan.reconnect" />
        </p>
        <div v-else class="mt-1.5 flex flex-wrap gap-1.5">
          <Badge v-if="plan.willCreate" class="bg-primary-glow/20 text-primary-glow">
            <Sparkles aria-hidden="true" /> New on {{ target }}
          </Badge>
          <Badge v-if="plan.willRename" variant="secondary">
            <Pencil aria-hidden="true" /> Rename from “{{ plan.targetName }}”
          </Badge>
          <Badge v-if="plan.add.length" variant="secondary" class="text-spotify">
            <Plus aria-hidden="true" /> {{ plan.add.length }}
          </Badge>
          <Badge v-if="plan.remove.length" variant="secondary" class="text-red-400">
            <Minus aria-hidden="true" /> {{ plan.remove.length }}
          </Badge>
          <Badge v-if="plan.unmatched.length" variant="secondary" class="text-amber-300">
            <AlertTriangle aria-hidden="true" /> {{ plan.unmatched.length }} not found
          </Badge>
          <span v-if="!hasChanges" class="text-sm text-muted-foreground">Already in sync</span>
          <span v-else-if="plan.unchanged" class="self-center text-xs text-muted-foreground">{{ plan.unchanged }} unchanged</span>
        </div>
      </div>
    </header>

    <div v-if="!plan.error && hasChanges" class="divide-y divide-white/5 border-t border-white/5">
      <div v-if="plan.canCopyCover" class="flex items-center gap-3 px-4 py-3">
        <Checkbox :id="`cover-${plan.key}`" v-model="copyCover" />
        <Label :for="`cover-${plan.key}`" class="font-normal">Copy the cover image to {{ target }}</Label>
      </div>

      <Collapsible v-if="plan.add.length" v-slot="{ open }">
        <CollapsibleTrigger class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none">
          <span>{{ plural(plan.add.length, 'song') }} to add</span>
          <ChevronDown class="size-4 transition-transform" :class="{ 'rotate-180': open }" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul class="max-h-80 space-y-2 overflow-y-auto px-4 pb-4">
            <li v-for="item in plan.add" :key="item.source.id">
              <TrackRow :track="item.source" />
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      <!-- Removals are opt-in per song: nothing is deleted without a check. -->
      <Collapsible v-if="plan.remove.length" v-slot="{ open }" :default-open="true">
        <CollapsibleTrigger class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none">
          <span>{{ plural(plan.remove.length, 'song') }} to remove from {{ target }} <span class="font-normal text-muted-foreground">({{ removeIds.size }} confirmed)</span></span>
          <ChevronDown class="size-4 transition-transform" :class="{ 'rotate-180': open }" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div class="flex items-center gap-3 px-4 pb-2">
            <Checkbox :id="`remove-all-${plan.key}`" :model-value="allRemovals" @update:model-value="toggleAllRemovals" />
            <Label :for="`remove-all-${plan.key}`" class="text-xs font-normal text-muted-foreground">Confirm all removals</Label>
          </div>
          <ul class="max-h-80 space-y-2 overflow-y-auto px-4 pb-4">
            <li v-for="track in plan.remove" :key="track.id" class="flex items-center gap-3">
              <Checkbox
                :id="`remove-${plan.key}-${track.id}`"
                :model-value="removeIds.has(track.id)"
                :aria-label="`Remove ${track.title}`"
                @update:model-value="toggleRemoval(track.id, $event)"
              />
              <label :for="`remove-${plan.key}-${track.id}`" class="min-w-0 flex-1 cursor-pointer">
                <TrackRow :track="track" />
              </label>
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible v-if="plan.unmatched.length" v-slot="{ open }">
        <CollapsibleTrigger class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none">
          <span>{{ plural(plan.unmatched.length, 'song') }} not found <span class="font-normal text-muted-foreground">· skipped, added to Review</span></span>
          <ChevronDown class="size-4 transition-transform" :class="{ 'rotate-180': open }" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul class="max-h-80 space-y-2 overflow-y-auto px-4 pb-4">
            <li v-for="item in plan.unmatched" :key="item.source.id">
              <TrackRow :track="item.source" />
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </article>
</template>
