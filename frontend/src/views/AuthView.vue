<script setup lang="ts">
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/AppButton.vue'
import BrandMark from '@/components/BrandMark.vue'
import FormField from '@/components/FormField.vue'
import SegControl from '@/components/SegControl.vue'
import Tag from '@/components/Tag.vue'
import TrailMap from '@/components/TrailMap.vue'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useRoutesStore } from '@/stores/routes'
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
const routes = useRoutesStore()
const toast = useToastStore()
const router = useRouter()

const featured = computed(() => routes.list[0] ?? null)

// The routes endpoint is public so the hero renders while signed out. If the
// backend is down the right column simply stays surface-coloured while the
// sign-in form keeps working: never surface an error and never block the form.
onMounted(() => {
  routes.fetchRoutes().catch(() => {})
})

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
      <template v-if="featured">
        <div style="position: absolute; inset: 0">
          <TrailMap mode="hero" :coords="featured.waypoints" />
        </div>

        <div
          style="
            position: absolute;
            left: 28px;
            bottom: 28px;
            z-index: 450;
            padding: 14px 18px;
            border-radius: 28px;
            background: var(--color-bg);
            box-shadow: var(--shadow-lg);
            display: flex;
            gap: 22px;
            align-items: center;
          "
        >
          <div>
            <div style="font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--color-accent)">Featured</div>
            <div style="font-family: var(--font-heading); font-size: 17px">{{ featured.name }}</div>
          </div>
          <Tag>{{ featured.difficulty }} · {{ featured.distanceLabel }}</Tag>
        </div>
      </template>
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
