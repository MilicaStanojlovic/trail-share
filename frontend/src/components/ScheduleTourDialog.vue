<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToursStore } from '@/stores/tours'
import { useToastStore } from '@/stores/toast'
import { formatDateLong } from '@/lib/dates'
import AppDialog from '@/components/AppDialog.vue'
import AppButton from '@/components/AppButton.vue'
import FormField from '@/components/FormField.vue'
import type { TrailRoute, Tour } from '@/types/domain'

const props = defineProps<{
  open: boolean
  route: TrailRoute
}>()

const emit = defineEmits<{
  close: []
  scheduled: [tour: Tour]
}>()

const toursStore = useToursStore()
const toastStore = useToastStore()

const date = ref('')
const startTime = ref('')
const capacity = ref(12)
const pace = ref('')
const meetingPoint = ref('')
const notes = ref('')
const submitting = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      date.value = ''
      startTime.value = ''
      capacity.value = 12
      pace.value = ''
      meetingPoint.value = ''
      notes.value = ''
      submitting.value = false
    }
  },
)

const canSubmit = computed(() => {
  return (
    date.value !== '' &&
    startTime.value !== '' &&
    meetingPoint.value.trim() !== '' &&
    pace.value.trim() !== '' &&
    Number(capacity.value) >= 1
  )
})

async function submit() {
  if (!canSubmit.value || submitting.value) return

  submitting.value = true
  try {
    const tour = await toursStore.scheduleTour(props.route.id, {
      date: date.value,
      startTime: startTime.value,
      capacity: Number(capacity.value),
      meetingPoint: meetingPoint.value.trim(),
      pace: pace.value.trim(),
      notes: notes.value.trim() || undefined,
    })
    toastStore.show('Tour scheduled for ' + formatDateLong(tour.date))
    emit('scheduled', tour)
    emit('close')
  } catch {
    toastStore.show('Could not schedule tour')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AppDialog :open="open" title="Schedule a tour" @close="$emit('close')">
    <div class="schedule-context">
      On {{ route.name }} · {{ route.distanceLabel }} · {{ route.difficulty }}
    </div>

    <div class="schedule-grid">
      <FormField label="Date">
        <input v-model="date" class="input" type="date" />
      </FormField>

      <FormField label="Start time">
        <input v-model="startTime" class="input" type="time" />
      </FormField>

      <FormField label="Capacity">
        <input
          v-model.number="capacity"
          class="input"
          type="number"
          min="1"
          max="99"
        />
      </FormField>

      <FormField label="Pace">
        <input v-model="pace" class="input" type="text" placeholder="Relaxed" />
      </FormField>
    </div>

    <FormField label="Meeting point">
      <input
        v-model="meetingPoint"
        class="input"
        type="text"
        placeholder="Bliznec parking lot"
      />
    </FormField>

    <FormField label="Notes for hikers">
      <textarea
        v-model="notes"
        class="input"
        style="border-radius: 20px; min-height: 76px"
        placeholder="Bring 1.5 L of water and layers — the ridge is windy."
      ></textarea>
    </FormField>

    <template #actions>
      <AppButton variant="secondary" @click="$emit('close')">Cancel</AppButton>
      <AppButton
        variant="primary"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        Publish tour
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.schedule-context {
  font-size: 13px;
  opacity: 0.7;
}

.schedule-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 4px;
}
</style>
