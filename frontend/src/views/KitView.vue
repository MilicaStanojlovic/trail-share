<script setup lang="ts">
import { ref } from 'vue'
import AppButton from '@/components/AppButton.vue'
import AppDialog from '@/components/AppDialog.vue'
import AppNav from '@/components/AppNav.vue'
import AvatarInitials from '@/components/AvatarInitials.vue'
import BrandMark from '@/components/BrandMark.vue'
import CapacityBar from '@/components/CapacityBar.vue'
import DataTable from '@/components/DataTable.vue'
import DateBadge from '@/components/DateBadge.vue'
import EmptyState from '@/components/EmptyState.vue'
import FormField from '@/components/FormField.vue'
import RadioGroup from '@/components/RadioGroup.vue'
import RouteSparkline from '@/components/RouteSparkline.vue'
import SegControl from '@/components/SegControl.vue'
import StatTile from '@/components/StatTile.vue'
import Tag from '@/components/Tag.vue'
import { useToastStore } from '@/stores/toast'
import { DIFFICULTIES } from '@/types/domain'
import { difficultyTagVariant, seatTagState } from '@/types/ui'

const medvednica: [number, number][] = [
  [45.9002, 15.9432],
  [45.9068, 15.9508],
  [45.9121, 15.9601],
  [45.9155, 15.9723],
  [45.9098, 15.9805],
  [45.9012, 15.9748],
  [45.8961, 15.9612],
  [45.9002, 15.9432],
]

const segOptions = [
  { label: 'All', value: 'all' },
  { label: 'Easy', value: 'Easy' },
  { label: 'Moderate', value: 'Moderate' },
  { label: 'Hard', value: 'Hard' },
]
const segValue = ref('all')
const segBlockValue = ref('Moderate')

const activityOptions = [
  { label: 'Hiking', value: 'Hiking' },
  { label: 'Biking', value: 'Biking' },
]
const activity = ref('Hiking')

const routeName = ref('')
const password = ref('')
const email = ref('')

const dialogOpen = ref(false)
const toast = useToastStore()

function confirmDialog() {
  dialogOpen.value = false
  toast.show('Tour scheduled')
}

const seatDemos = [
  seatTagState(3, 12, true),
  seatTagState(12, 12, false),
  seatTagState(10, 12, false),
  seatTagState(5, 12, false),
]

interface KitRow extends Record<string, unknown> {
  tour: string
  date: string
  guide: string
  booked: number
  capacity: number
  mine: boolean
}

const tableColumns = [
  { key: 'tour', label: 'Tour' },
  { key: 'date', label: 'Date' },
  { key: 'guide', label: 'Guide' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: '', align: 'right' as const },
]

const tableRows: KitRow[] = [
  { tour: 'Medvednica Ridge Loop', date: '22 Aug 2026', guide: 'Ivana Kovač', booked: 3, capacity: 12, mine: true },
  { tour: 'Sljeme Summit Climb', date: '29 Aug 2026', guide: 'Marko Babić', booked: 12, capacity: 12, mine: false },
  { tour: 'Sava Riverside Cruise', date: '5 Sep 2026', guide: 'Petra Novak', booked: 10, capacity: 12, mine: false },
]
</script>

<template>
  <main style="background: var(--color-bg); min-height: 100vh; padding: 26px 32px 56px; color: var(--color-text)">
    <h2>TrailShare component kit</h2>

    <section>
      <h3>Buttons</h3>
      <div class="row">
        <AppButton>Primary</AppButton>
        <AppButton variant="secondary">Secondary</AppButton>
        <AppButton variant="ghost">Ghost</AppButton>
      </div>
      <div class="row">
        <AppButton disabled>Primary</AppButton>
        <AppButton variant="secondary" disabled>Secondary</AppButton>
        <AppButton variant="ghost" disabled>Ghost</AppButton>
      </div>
      <div style="max-width: 320px">
        <AppButton block>Block button</AppButton>
      </div>
    </section>

    <section>
      <h3>Tags</h3>
      <div class="row">
        <Tag>Neutral</Tag>
        <Tag variant="accent">Accent</Tag>
        <Tag variant="accent-2">Accent 2</Tag>
        <Tag variant="outline">Outline</Tag>
      </div>
      <div class="row">
        <Tag v-for="d in DIFFICULTIES" :key="d" :variant="difficultyTagVariant(d)">
          {{ d }}
        </Tag>
      </div>
      <div class="row">
        <Tag v-for="(s, i) in seatDemos" :key="i" :variant="s.variant">
          {{ s.label }}
        </Tag>
      </div>
    </section>

    <section>
      <h3>Brand mark</h3>
      <div class="row">
        <BrandMark :size="24" />
        <BrandMark :size="30" />
      </div>
    </section>

    <section>
      <h3>Avatar initials</h3>
      <div class="row">
        <AvatarInitials name="Ivana Kovač" :size="22" bg="neutral" />
        <AvatarInitials name="Ivana Kovač" :size="24" bg="neutral" />
        <AvatarInitials name="Ivana Kovač" :size="34" bg="neutral" />
        <AvatarInitials name="Ivana Kovač" :size="40" bg="neutral" />
      </div>
      <div class="row">
        <AvatarInitials name="Ivana Kovač" :size="22" bg="accent-2" />
        <AvatarInitials name="Ivana Kovač" :size="24" bg="accent-2" />
        <AvatarInitials name="Ivana Kovač" :size="34" bg="accent-2" />
        <AvatarInitials name="Ivana Kovač" :size="40" bg="accent-2" />
      </div>
    </section>

    <section>
      <h3>Stat tiles</h3>
      <div class="row">
        <StatTile size="sm" label="Distance" value="9.9 km" />
        <StatTile size="md" label="Distance" value="9.9 km" />
        <StatTile size="lg" label="Rating" value="4.9" note="from 38 hikers" />
        <StatTile size="md" label="Rating" value="4.9" note="from 38 hikers" />
      </div>
    </section>

    <section>
      <h3>Date badge</h3>
      <div class="row">
        <DateBadge date="2026-08-22" />
      </div>
    </section>

    <section>
      <h3>Capacity bar</h3>
      <div class="col">
        <div style="width: 220px">
          <div class="text-muted">2 / 12</div>
          <CapacityBar :booked="2" :capacity="12" />
        </div>
        <div style="width: 220px">
          <div class="text-muted">9 / 12</div>
          <CapacityBar :booked="9" :capacity="12" />
        </div>
        <div style="width: 220px">
          <div class="text-muted">12 / 12</div>
          <CapacityBar :booked="12" :capacity="12" />
        </div>
      </div>
    </section>

    <section>
      <h3>Route sparkline</h3>
      <div class="row">
        <div style="height: 148px; background: var(--color-accent-2-200); border-radius: var(--radius-lg); overflow: hidden; max-width: 420px; flex: 1">
          <RouteSparkline :coords="medvednica" :stroke-width="1.6" />
        </div>
        <div style="width: 58px; height: 34px; background: var(--color-accent-2-200); border-radius: 10px; overflow: hidden">
          <RouteSparkline :coords="medvednica" :stroke-width="3" />
        </div>
      </div>
    </section>

    <section>
      <h3>Segmented control</h3>
      <div class="col">
        <SegControl v-model="segValue" :options="segOptions" />
        <div class="text-muted">Selected: {{ segValue }}</div>
      </div>
      <div style="max-width: 420px; margin-top: 14px">
        <SegControl v-model="segBlockValue" :options="segOptions" block />
      </div>
    </section>

    <section>
      <h3>Radio group</h3>
      <div class="col">
        <RadioGroup v-model="activity" :options="activityOptions" />
        <div class="text-muted">Selected: {{ activity }}</div>
      </div>
    </section>

    <section>
      <h3>Form fields</h3>
      <div class="col">
        <div style="max-width: 320px">
          <FormField label="Route name">
            <input v-model="routeName" class="input" placeholder="Medvednica Ridge Loop" />
          </FormField>
        </div>
        <div style="max-width: 320px">
          <FormField label="Password" hint="✓ 8+ characters, one number">
            <input v-model="password" class="input" type="password" />
          </FormField>
        </div>
        <div style="max-width: 320px">
          <FormField label="Email" error="That email is already registered.">
            <input v-model="email" class="input" />
          </FormField>
        </div>
      </div>
    </section>

    <section>
      <h3>Dialog</h3>
      <div class="row">
        <AppButton @click="dialogOpen = true">Open dialog</AppButton>
      </div>
      <AppDialog :open="dialogOpen" title="Schedule a tour" @close="dialogOpen = false">
        <div class="dialog-body">
          Pick a date and a group size. Hikers will see this tour on the Tours page as soon as you publish it.
        </div>
        <template #actions>
          <AppButton variant="ghost" @click="dialogOpen = false">Cancel</AppButton>
          <AppButton @click="confirmDialog">Confirm</AppButton>
        </template>
      </AppDialog>
    </section>

    <section>
      <h3>Toast</h3>
      <div class="col">
        <AppButton @click="toast.show('Seat booked — see it under My bookings')">Show toast</AppButton>
        <div class="text-muted">
          The toast is mounted globally in App.vue and auto-dismisses after 3.2 s.
        </div>
      </div>
    </section>

    <section>
      <h3>Data table</h3>
      <DataTable :columns="tableColumns" :rows="tableRows">
        <template #cell-status="{ row }: { row: KitRow }">
          <Tag :variant="seatTagState(row.booked, row.capacity, row.mine).variant">
            {{ seatTagState(row.booked, row.capacity, row.mine).label }}
          </Tag>
        </template>
        <template #cell-action="{ row }: { row: KitRow }">
          <AppButton variant="ghost" @click="toast.show(`Opening ${row.tour}`)">View tour</AppButton>
        </template>
      </DataTable>
    </section>

    <section>
      <h3>Empty state</h3>
      <div class="col">
        <div style="max-width: 520px">
          <EmptyState
            message="You have not booked any tours yet."
            cta-label="Browse tours"
            @cta="toast.show('Browsing tours')"
          />
        </div>
        <div style="max-width: 520px">
          <EmptyState compact message="No tours scheduled on this route yet." />
        </div>
      </div>
    </section>

    <section>
      <h3>Navigation</h3>
      <div class="text-muted">Hiker</div>
      <div class="nav-demo">
        <AppNav role="HIKER" user-name="Ivana Kovač" />
      </div>
      <div class="text-muted">Guide</div>
      <div class="nav-demo">
        <AppNav role="GUIDE" user-name="Marko Babić" />
      </div>
    </section>
  </main>
</template>

<style scoped>
h2,
h3 {
  font-family: var(--font-heading);
}

h3 {
  font-size: 18px;
  margin-top: 34px;
  margin-bottom: 12px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.nav-demo {
  position: relative;
  z-index: 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-divider);
  margin-bottom: 14px;
}
</style>
