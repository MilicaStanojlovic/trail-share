<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/AppButton.vue'
import BrandMark from '@/components/BrandMark.vue'
import FormField from '@/components/FormField.vue'
import RouteSparkline from '@/components/RouteSparkline.vue'
import SegControl from '@/components/SegControl.vue'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import type { Role } from '@/types/domain'

const mode = ref('login')
const role: Ref<Role> = ref('HIKER')
const displayName = ref('')
const email = ref('')
const password = ref('')
const pending = ref(false)
const error = ref<string | null>(null)

const isRegister = computed(() => mode.value === 'register')

const auth = useAuthStore()
const toast = useToastStore()
const router = useRouter()

watch([mode, displayName, email, password, role], () => {
  error.value = null
})

function messageOf(err: ApiError): string {
  if (
    err.details &&
    typeof err.details === 'object' &&
    'message' in err.details &&
    Array.isArray((err.details as { message: unknown }).message) &&
    ((err.details as { message: unknown[] }).message.length > 0)
  ) {
    return String((err.details as { message: unknown[] }).message[0])
  }
  return err.message
}

async function onSubmit() {
  if (pending.value) return
  pending.value = true
  error.value = null
  try {
    if (isRegister.value) {
      await auth.register({
        displayName: displayName.value.trim(),
        email: email.value.trim(),
        password: password.value,
        role: role.value,
      })
    } else {
      await auth.login(email.value.trim(), password.value)
    }
    const guide = auth.isGuide
    toast.show(guide ? 'Signed in as a guide' : 'Signed in as a hiker')
    await router.push(guide ? '/dashboard' : '/routes')
  } catch (err) {
    error.value =
      err instanceof ApiError
        ? messageOf(err)
        : 'Something went wrong. Please try again.'
  } finally {
    pending.value = false
  }
}

const heroCoords: [number, number][] = [
  [45.9002, 15.9432],
  [45.9068, 15.9508],
  [45.9121, 15.9601],
  [45.9155, 15.9723],
  [45.9098, 15.9805],
  [45.9012, 15.9748],
  [45.8961, 15.9612],
  [45.9002, 15.9432],
]

const modeOptions = [
  { label: 'Log in', value: 'login' },
  { label: 'Register', value: 'register' },
]
</script>

<template>
  <div
    style="
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.05fr 1fr;
      background: var(--color-bg);
      color: var(--color-text);
    "
  >
    <div
      style="
        padding: 48px 56px;
        display: flex;
        flex-direction: column;
        gap: 28px;
        max-width: 560px;
      "
    >
      <div style="display: flex; align-items: center; gap: 10px">
        <BrandMark :size="30" />
        <span style="font-family: var(--font-heading); font-size: 21px">TrailShare</span>
      </div>

      <div style="margin-top: 8px">
        <h1 style="font-size: 52px; max-width: 9em; margin-bottom: 12px">
          Draw the trail. Bring people along.
        </h1>
        <p style="font-size: 16px; max-width: 34em; opacity: 0.8">
          Sketch a route on the map, tag how hard it is, and publish. Guides schedule tours on it — hikers book a seat.
        </p>
      </div>

      <SegControl v-model="mode" :options="modeOptions" style="align-self: flex-start" />

      <form
        @submit.prevent="onSubmit"
        style="display: flex; flex-direction: column; gap: 14px; max-width: 400px"
      >
        <FormField v-if="isRegister" label="Display name">
          <input
            v-model="displayName"
            class="input"
            placeholder="Ivana Kovač"
            autocomplete="name"
          />
        </FormField>

        <FormField label="Email">
          <input
            v-model="email"
            class="input"
            type="email"
            placeholder="ivana@trailshare.hr"
            autocomplete="email"
          />
        </FormField>

        <FormField
          label="Password"
          hint="✓ 8+ characters, one number"
        >
          <input
            v-model="password"
            class="input"
            type="password"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
          />
        </FormField>

        <div v-if="isRegister" style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px">
          <label style="font-size: 12px; opacity: 0.7">
            Pick your role — this is fixed after registration
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
            <button
              type="button"
              class="role-card"
              :class="{ 'role-card--selected': role === 'GUIDE' }"
              :aria-pressed="role === 'GUIDE'"
              @click="role = 'GUIDE'"
            >
              <div style="font-family: var(--font-heading); font-size: 16px">Guide</div>
              <div style="font-size: 12px; opacity: 0.75">
                Publish routes and schedule guided tours.
              </div>
            </button>
            <button
              type="button"
              class="role-card"
              :class="{ 'role-card--selected': role === 'HIKER' }"
              :aria-pressed="role === 'HIKER'"
              @click="role = 'HIKER'"
            >
              <div style="font-family: var(--font-heading); font-size: 16px">Hiker</div>
              <div style="font-size: 12px; opacity: 0.75">
                Browse upcoming tours and book a seat.
              </div>
            </button>
          </div>
        </div>

        <div
          v-if="error"
          role="alert"
          style="
            font-size: 12px;
            color: var(--color-accent-700);
            background: var(--color-accent-100);
            border-radius: var(--radius-md);
            padding: 10px 14px;
          "
        >
          {{ error }}
        </div>

        <AppButton
          type="submit"
          block
          :disabled="pending"
          style="min-height: 42px; font-size: 15px"
        >
          {{ isRegister ? 'Create account' : 'Log in' }}
        </AppButton>

        <div style="font-size: 12px; opacity: 0.6">
          Protected by JWT — session lasts 24 h.
        </div>
      </form>
    </div>

    <div style="position: relative; overflow: hidden; background: var(--color-surface)">
      <!-- The hero Leaflet map and FEATURED card are a slice-3 follow-up; this is a decorative placeholder. -->
      <div style="position: absolute; inset: 0; opacity: 0.45" aria-hidden="true">
        <RouteSparkline :coords="heroCoords" :stroke-width="1.6" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-card {
  padding: 12px 14px;
  border-radius: 20px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1.5px solid var(--color-divider);
}

.role-card--selected {
  border-color: var(--color-accent);
  background: var(--color-accent-100);
}
</style>
