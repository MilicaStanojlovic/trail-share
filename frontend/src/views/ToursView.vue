<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToursStore } from '@/stores/tours'
import { useToastStore } from '@/stores/toast'
import TourCard from '@/components/TourCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = useToursStore()
const toast = useToastStore()
const router = useRouter()

const count = computed(() => store.list.length)
const countLabel = computed(() => count.value === 1 ? '1 tour' : count.value + ' tours')

function openTour(id: string) {
  router.push('/tours/' + id)
}

onMounted(async () => {
  try {
    await store.fetchTours()
  } catch {
    toast.show('Could not load tours')
  }
})
</script>

<template>
  <div style="padding: 26px 32px 56px; animation: ts-rise .35s ease both">
    <div style="margin-bottom: 22px">
      <h2 style="margin-bottom: 4px">Upcoming guided tours</h2>
      <p style="margin: 0; opacity: .7; font-size: 14px">
        <strong>{{ countLabel }}</strong> you can join, led by verified guides.
      </p>
    </div>

    <div
      v-if="store.list.length"
      style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 18px"
    >
      <TourCard
        v-for="t in store.list"
        :key="t.id"
        :tour="t"
        @open="openTour(t.id)"
      />
    </div>
    <EmptyState
      v-else-if="!store.loading"
      message="Nothing here yet."
    />
  </div>
</template>
