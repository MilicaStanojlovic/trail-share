<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = withDefaults(
  defineProps<{
    mode: 'hero' | 'view' | 'draw'
    coords?: [number, number][]
    modelValue?: [number, number][]
  }>(),
  {
    coords: () => [],
    modelValue: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: [number, number][]]
}>()

const el = ref<HTMLDivElement | null>(null)

// The Leaflet objects are deliberately plain `let` bindings, not refs: Vue's
// deep reactive proxy recurses into Leaflet's internals and breaks the map.
let map: L.Map | null = null
let group: L.LayerGroup | null = null
let wpGroup: L.LayerGroup | null = null
let dragging = false
let lastShapeKey = ''

function currentPoints(): [number, number][] {
  return props.mode === 'draw' ? props.modelValue : props.coords
}

function shapeKey(): string {
  return `${props.mode}|${JSON.stringify(currentPoints())}`
}

function paint(fit: boolean): void {
  if (!map || !group || !wpGroup) return

  const key = shapeKey()
  const painted = group.getLayers().length > 0
  if (key === lastShapeKey && !fit && painted) return

  const changed = key !== lastShapeKey
  lastShapeKey = key
  group.clearLayers()

  const pts = currentPoints()
  if (pts.length === 0) {
    wpGroup.clearLayers()
    return
  }

  // Halo underneath the route line, then the terracotta line itself.
  L.polyline(pts, { color: '#8c491a', weight: 7, opacity: 0.25, lineJoin: 'round' }).addTo(group)
  L.polyline(pts, {
    color: '#c67139',
    weight: 4,
    lineJoin: 'round',
    dashArray: props.mode === 'draw' ? '1 0' : undefined,
  }).addTo(group)

  // Draw mode shows the bare polylines and never re-fits the viewport — the
  // click/drag handling and numbered `.ts-wp` markers arrive with the drawing
  // slice.
  if (props.mode === 'draw') {
    if (dragging) return

    wpGroup.clearLayers()
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!
      const marker = L.marker(p, {
        draggable: true,
        icon: L.divIcon({
          className: 'ts-wp',
          html: String(i + 1),
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(wpGroup)

      marker.on('dragstart', () => {
        dragging = true
      })
      marker.on('drag', () => {
        const latlng = marker.getLatLng()
        const next: [number, number][] = [...currentPoints()]
        next[i] = [latlng.lat, latlng.lng]
        emit('update:modelValue', next)
      })
      marker.on('dragend', () => {
        dragging = false
        paint(true)
      })
    }
    return
  }

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

  if (fit || changed) {
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
  wpGroup = L.layerGroup().addTo(map)
  lastShapeKey = ''
  paint(true)

  if (props.mode === 'draw') {
    map.getContainer().style.cursor = 'crosshair'
    map.on('click', (e: L.LeafletMouseEvent) => {
      emit('update:modelValue', [...currentPoints(), [e.latlng.lat, e.latlng.lng]])
    })
  }

  // The container is often still settling into its final size on mount.
  window.setTimeout(() => map?.invalidateSize(), 60)
})

watch(
  () => [props.coords, props.modelValue],
  () => paint(false),
  { deep: true },
)

onUnmounted(() => {
  // Without this every hot reload leaks a live map instance.
  map?.remove()
  map = null
  group = null
  wpGroup = null
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
