<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoutesStore } from '@/stores/routes'
import { useToastStore } from '@/stores/toast'
import { computeRouteStats } from '@/lib/route-stats'
import TrailMap from '@/components/TrailMap.vue'
import AppButton from '@/components/AppButton.vue'
import SegControl from '@/components/SegControl.vue'
import RadioGroup from '@/components/RadioGroup.vue'
import FormField from '@/components/FormField.vue'
import StatTile from '@/components/StatTile.vue'
import type { Activity, Difficulty } from '@/types/domain'

// The draft lives in the view, not in a store: the design only specifies a
// reset after publishing, so navigating away discards it.
const pts = ref<[number, number][]>([])
const name = ref('')
const difficulty = ref<Difficulty>('Moderate')
const activity = ref<Activity>('Hiking')
const description = ref('')

const router = useRouter()
const routesStore = useRoutesStore()
const toast = useToastStore()

const publishing = ref(false)

// Em dash: the stat placeholder before a path exists.
const DASH = '—'

const difficultyOptions = [
  { label: 'Easy', value: 'Easy' },
  { label: 'Moderate', value: 'Moderate' },
  { label: 'Hard', value: 'Hard' },
]

const activityOptions = [
  { label: 'Hiking', value: 'Hiking' },
  { label: 'Biking', value: 'Biking' },
]

const stats = computed(() => computeRouteStats(pts.value, activity.value))
const noPoints = computed(() => pts.value.length === 0)
const hasPath = computed(() => pts.value.length >= 2)

// Distance, elevation and duration are meaningless with fewer than two points,
// so they stay dashed — but the waypoint count is the only feedback the first
// click produces, so that tile always shows the live number.
const distanceValue = computed(() => (hasPath.value ? stats.value.distanceLabel : DASH))
const elevationValue = computed(() => (hasPath.value ? stats.value.elevationLabel : DASH))
const durationValue = computed(() => (hasPath.value ? stats.value.durationLabel : DASH))

// Only the first failing rule is shown, in this order.
const error = computed(() => {
  if (pts.value.length < 2) return 'Place at least two waypoints on the map.'
  if (name.value.trim().length < 3) return 'Give the route a name of 3 characters or more.'
  return null
})

function setDifficulty(value: string) {
  difficulty.value = value as Difficulty
}

function setActivity(value: string) {
  activity.value = value as Activity
}

function undoPoint() {
  // A new array, never a mutation: TrailMap repaints off the identity change.
  pts.value = pts.value.slice(0, -1)
}

function clearPoints() {
  pts.value = []
}

async function publish() {
  if (error.value !== null || publishing.value) return

  publishing.value = true
  try {
    const route = await routesStore.publishRoute({
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      difficulty: difficulty.value,
      activity: activity.value,
      waypoints: pts.value,
    })
    toast.show('Route published — ' + route.name)
    pts.value = []
    name.value = ''
    difficulty.value = 'Moderate'
    activity.value = 'Hiking'
    description.value = ''
    await router.push('/routes/' + route.id)
  } catch {
    // Keep the draft intact so the user can retry after fixing the error.
    toast.show('Could not publish route')
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <section class="draw">
    <div class="draw__side">
      <div>
        <h3 class="draw__title">Draw a route</h3>
        <p class="draw__help">
          Click the map to drop waypoints. Drag any pin to adjust; the line follows.
        </p>
      </div>

      <div class="draw__stats">
        <StatTile label="Distance" :value="distanceValue" size="sm" />
        <StatTile label="Elev. gain" :value="elevationValue" size="sm" />
        <StatTile label="Duration" :value="durationValue" size="sm" />
        <StatTile label="Waypoints" :value="pts.length" size="sm" />
      </div>

      <div class="draw__actions">
        <AppButton variant="secondary" :disabled="noPoints" @click="undoPoint">
          Undo point
        </AppButton>
        <AppButton variant="secondary" :disabled="noPoints" @click="clearPoints">
          Clear
        </AppButton>
      </div>

      <FormField label="Route name">
        <input v-model="name" class="input" type="text" placeholder="e.g. Sljeme Summit Climb" />
      </FormField>

      <FormField label="Difficulty">
        <SegControl
          block
          :options="difficultyOptions"
          :model-value="difficulty"
          @update:model-value="setDifficulty"
        />
      </FormField>

      <FormField label="Activity">
        <div class="draw__radios">
          <RadioGroup
            :options="activityOptions"
            :model-value="activity"
            @update:model-value="setActivity"
          />
        </div>
      </FormField>

      <FormField label="Description">
        <textarea
          v-model="description"
          class="input draw__textarea"
          placeholder="What makes this route worth walking?"
        ></textarea>
      </FormField>

      <div v-if="error" class="draw__banner">{{ error }}</div>

      <AppButton
        variant="primary"
        block
        class="draw__publish"
        :disabled="error !== null || publishing"
        @click="publish"
      >
        Publish route
      </AppButton>
    </div>

    <div class="draw__map">
      <div class="draw__map-layer">
        <TrailMap v-model="pts" mode="draw" />
      </div>

      <div v-if="noPoints" class="draw__hint">Click anywhere to place your first waypoint</div>
    </div>
  </section>
</template>

<style scoped>
.draw {
  display: grid;
  grid-template-columns: 372px 1fr;
  min-height: calc(100vh - 63px);
  animation: ts-rise 0.35s ease both;
}

.draw__side {
  padding: 4px 26px 40px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.draw__title {
  margin: 0 0 4px;
}

.draw__help {
  margin: 0;
  font-size: 13px;
  opacity: 0.7;
}

.draw__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.draw__actions {
  display: flex;
  gap: 8px;
}

.draw__radios {
  padding-top: 2px;
}

.draw__textarea {
  border-radius: 20px;
  min-height: 76px;
}

.draw__banner {
  font-size: 12px;
  color: var(--color-accent-700);
  background: var(--color-accent-100);
  padding: 10px 14px;
  border-radius: 16px;
}

.draw__publish {
  min-height: 42px;
  font-size: 15px;
}

.draw__map {
  position: relative;
  margin-right: 32px;
  border-radius: 28px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.draw__map-layer {
  position: absolute;
  inset: 0;
}

.draw__hint {
  position: absolute;
  left: 50%;
  top: 24px;
  transform: translateX(-50%);
  z-index: 450;
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--color-bg);
  box-shadow: var(--shadow-md);
  font-size: 13px;
}
</style>
