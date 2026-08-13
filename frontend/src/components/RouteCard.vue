<script setup lang="ts">
import { computed } from 'vue'
import Tag from '@/components/Tag.vue'
import AvatarInitials from '@/components/AvatarInitials.vue'
import RouteSparkline from '@/components/RouteSparkline.vue'
import { difficultyTagVariant } from '@/types/ui'
import type { TrailRoute } from '@/types/domain'

const props = defineProps<{ route: TrailRoute }>()
const emit = defineEmits<{ (e: 'open'): void }>()

const tourLabel = computed(() => {
  if (props.route.tourCount === 0) return 'no tours yet'
  if (props.route.tourCount === 1) return '1 tour scheduled'
  return props.route.tourCount + ' tours scheduled'
})
</script>

<template>
  <!-- Keyboard reachable, unlike the design's bare div: opening a route is the
       only way off the Discover grid, so a keyboard user would otherwise be
       stranded there. Same call made for sign-out in AppNav. -->
  <div
    class="card elev-sm route-card"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter.prevent="emit('open')"
    @keydown.space.prevent="emit('open')"
  >
    <div class="route-card-strip">
      <div class="route-card-spark">
        <RouteSparkline :coords="route.waypoints" />
      </div>
      <div class="route-card-tags">
        <Tag :variant="difficultyTagVariant(route.difficulty)">
          {{ route.difficulty }}
        </Tag>
        <Tag>{{ route.activity }}</Tag>
      </div>
    </div>
    <div class="route-card-body">
      <div class="card-title route-card-name">{{ route.name }}</div>
      <p class="card-body route-card-desc">{{ route.description }}</p>
      <div class="route-card-meta">
        <span>{{ route.distanceLabel }}</span>
        <span>↑ {{ route.elevationLabel }}</span>
        <span>{{ route.durationLabel }}</span>
      </div>
      <div class="route-card-author">
        <AvatarInitials :name="route.author.displayName" :size="22" />
        <span>{{ route.author.displayName }} · {{ tourLabel }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.route-card {
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  gap: 0;
}

.route-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.route-card-strip {
  position: relative;
  height: 148px;
  background: var(--color-accent-2-200);
}

.route-card-spark {
  position: absolute;
  inset: 0;
}

.route-card-tags {
  position: absolute;
  left: 12px;
  top: 12px;
  display: flex;
  gap: 6px;
}

.route-card-body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.route-card-name {
  font-size: 19px;
}

.route-card-desc {
  margin: 0;
}

.route-card-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  opacity: 0.65;
  margin-top: 2px;
}

.route-card-author {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.8;
}
</style>
