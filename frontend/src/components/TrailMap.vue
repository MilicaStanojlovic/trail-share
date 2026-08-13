<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps<{
  mode: 'hero' | 'view' | 'draw'
  coords: [number, number][]
}>()

const el = ref<HTMLDivElement | null>(null)

// The Leaflet objects are deliberately plain `let` bindings, not refs: Vue's
// deep reactive proxy recurses into Leaflet's internals and breaks the map.
let map: L.Map | null = null
let group: L.LayerGroup | null = null
let lastShapeKey = ''

function shapeKey(): string {
  return JSON.stringify(props.coords)
}

function paint(fit: boolean): void {
  if (!map || !group) return
  group.clearLayers()

  const pts = props.coords
  if (pts.length === 0) return

  // Halo underneath the route line, then the terracotta line itself.
  L.polyline(pts, { color: '#8c491a', weight: 7, opacity: 0.25, lineJoin: 'round' }).addTo(group)
  L.polyline(pts, { color: '#c67139', weight: 4, lineJoin: 'round' }).addTo(group)

  // Draw mode shows the bare polylines and never re-fits the viewport — the
  // click/drag handling and numbered `.ts-wp` markers arrive with the drawing
  // slice.
  if (props.mode === 'draw') return

  L.circleMarker(pts[0]!, {
    radius: 7,
    color: '#f5ead8',
    weight: 3,
    fillColor: '#c67139',
    fillOpacity: 1,
  }).addTo(group)

  if (pts.length > 1) {
    L.circleMarker(pts[pts.length - 1]!, {
      radius: 7,
      color: '#f5ead8',
      weight: 3,
      fillColor: '#56633f',
      fillOpacity: 1,
    }).addTo(group)
  }

  if (fit) {
    map.fitBounds(L.latLngBounds(pts).pad(0.25), { animate: false })
  }
}

onMounted(() => {
  if (!el.value) return

  map = L.map(el.value, {
    preferCanvas: true,
    zoomControl: props.mode !== 'hero',
    attributionControl: true,
    scrollWheelZoom: props.mode !== 'hero',
    dragging: true,
  }).setView([45.9, 15.96], 12)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map)

  if (props.mode !== 'hero') {
    map.zoomControl.setPosition('bottomright')
  }

  group = L.layerGroup().addTo(map)
  lastShapeKey = shapeKey()
  paint(true)

  // The container is often still settling into its final size on mount.
  window.setTimeout(() => map?.invalidateSize(), 60)
})

watch(
  () => props.coords,
  () => {
    const key = shapeKey()
    const changed = key !== lastShapeKey
    lastShapeKey = key
    paint(changed)
  },
  { deep: true },
)

onUnmounted(() => {
  // Without this every hot reload leaks a live map instance.
  map?.remove()
  map = null
  group = null
})
</script>

<template>
  <div ref="el" class="trail-map"></div>
</template>

<style scoped>
.trail-map {
  width: 100%;
  height: 100%;
}
</style>
