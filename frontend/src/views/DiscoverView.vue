<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoutesStore } from '@/stores/routes'
import { useToastStore } from '@/stores/toast'
import RouteCard from '@/components/RouteCard.vue'
import SegControl from '@/components/SegControl.vue'
import type { Difficulty } from '@/types/domain'

const store = useRoutesStore()
const toast = useToastStore()
const router = useRouter()

const difficultyOptions = [
  { label: 'All', value: 'All' },
  { label: 'Easy', value: 'Easy' },
  { label: 'Moderate', value: 'Moderate' },
  { label: 'Hard', value: 'Hard' },
]

const filterModel = computed({
  get() {
    return store.filter
  },
  set(value: string) {
    store.filter = value as Difficulty | 'All'
  },
})

const subline = computed(() => {
  // The TOTAL fetched count, never the filtered length — the design's header
  // keeps naming the full count while the grid narrows. The area wording is
  // widened from the design's "around Zagreb and the Medvednica hills": the
  // catalog now carries a Fruska Gora route too.
  return store.totalCount + ' community routes across the region.'
})

function openRoute(id: string) {
  router.push('/routes/' + id)
}

onMounted(async () => {
  try {
    await store.fetchRoutes()
  } catch {
    toast.show('Could not load routes')
  }
})
</script>

<template>
  <div style="padding: 26px 32px 56px; animation: ts-rise .35s ease both">
    <div style="display: flex; align-items: flex-end; gap: 24px; margin-bottom: 22px">
      <div>
        <h2 style="margin-bottom: 4px">Published routes</h2>
        <p style="margin: 0; opacity: .7; font-size: 14px">{{ subline }}</p>
      </div>
      <div style="margin-left: auto; display: flex; gap: 10px; align-items: center">
        <input
          v-model="store.search"
          class="input"
          type="text"
          placeholder="Search routes"
          style="width: 210px"
        />
        <SegControl v-model="filterModel" :options="difficultyOptions" />
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px">
      <RouteCard
        v-for="r in store.visibleRoutes"
        :key="r.id"
        :route="r"
        @open="openRoute(r.id)"
      />
    </div>
  </div>
</template>
