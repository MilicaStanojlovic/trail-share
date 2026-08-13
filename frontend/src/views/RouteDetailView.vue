<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoutesStore } from '@/stores/routes'
import { useToastStore } from '@/stores/toast'
import { difficultyTagVariant } from '@/types/ui'
import TrailMap from '@/components/TrailMap.vue'
import AppButton from '@/components/AppButton.vue'
import Tag from '@/components/Tag.vue'
import StatTile from '@/components/StatTile.vue'
import EmptyState from '@/components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const routesStore = useRoutesStore()
const toastStore = useToastStore()

const currentRoute = computed(() => routesStore.current)

// Route params are typed `string | string[]`; the catalog only ever produces a
// single `:id` segment, so collapse the array form to its first value.
function idOf(value: string | string[] | undefined): string {
  if (value === undefined) return ''
  return Array.isArray(value) ? (value[0] ?? '') : value
}

async function load(id: string): Promise<void> {
  try {
    await routesStore.fetchRoute(id)
  } catch {
    toastStore.show('Route not found')
    await router.replace('/routes')
  }
}

onMounted(() => {
  void load(idOf(route.params.id))
})

watch(
  () => route.params.id,
  (id) => {
    void load(idOf(id))
  },
)
</script>

<template>
  <section v-if="currentRoute" class="route-detail">
    <div class="route-detail__map">
      <div class="route-detail__map-layer">
        <TrailMap mode="view" :coords="currentRoute.waypoints" />
      </div>

      <AppButton
        variant="secondary"
        :style="{
          position: 'absolute',
          left: '16px',
          top: '16px',
          zIndex: 450,
          background: 'var(--color-bg)',
        }"
        @click="router.push('/routes')"
      >
        ← All routes
      </AppButton>
    </div>

    <div class="route-detail__panel">
      <div class="route-detail__tags">
        <Tag :variant="difficultyTagVariant(currentRoute.difficulty)">
          {{ currentRoute.difficulty }}
        </Tag>
        <Tag>{{ currentRoute.activity }}</Tag>
      </div>

      <h2 class="route-detail__title">{{ currentRoute.name }}</h2>

      <p class="route-detail__description">{{ currentRoute.description }}</p>

      <div class="route-detail__stats">
        <StatTile label="Distance" :value="currentRoute.distanceLabel" size="md" />
        <StatTile label="Elevation gain" :value="currentRoute.elevationLabel" size="md" />
        <StatTile label="Est. duration" :value="currentRoute.durationLabel" size="md" />
        <StatTile label="Waypoints" :value="currentRoute.waypointCount" size="md" />
      </div>

      <div class="route-detail__section-head">
        <h4>Upcoming tours</h4>
      </div>

      <EmptyState compact message="No tours scheduled on this route yet." />
    </div>
  </section>
</template>

<style scoped>
.route-detail {
  display: grid;
  grid-template-columns: 1fr 400px;
  min-height: calc(100vh - 63px);
  animation: ts-rise 0.35s ease both;
}

.route-detail__map {
  position: relative;
  margin: 0 0 0 32px;
  border-radius: 28px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.route-detail__map-layer {
  position: absolute;
  inset: 0;
}

.route-detail__panel {
  padding: 8px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.route-detail__tags {
  display: flex;
  gap: 6px;
}

.route-detail__title {
  font-size: 34px;
  margin: 0;
}

.route-detail__description {
  margin: 0;
  opacity: 0.8;
}

.route-detail__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.route-detail__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.route-detail__section-head h4 {
  margin: 0;
}
</style>
