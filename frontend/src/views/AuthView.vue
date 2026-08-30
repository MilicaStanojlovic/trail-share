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

// The design features whichever route comes first; this app names the one it
// wants, because the seeder is create-only — a route added to an already
// seeded database gets today's createdAt and sorts last, not first. Falls
// back to the first route so the hero still renders if it is ever unseeded.
const FEATURED_ROUTE_NAME = 'Fruška Gora Ridge Trail'
const featured = computed(
  () => routes.list.find((r) => r.name === FEATURED_ROUTE_NAME) ?? routes.list[0] ?? null,
)

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
  <div class="auth">
    <div class="auth__panel">
      <div style="display: flex; align-items: center; gap: 10px">
        <BrandMark :size="30" />
        <span style="font-family: var(--font-heading); font-size: 21px">TrailShare</span>
      </div>

      <div style="margin-top: 8px">
        <h1 class="auth__title">
          Draw the trail. Bring people along.
        </h1>
        <p style="font-size: 16px; max-width: 41em; opacity: 0.8">
          Sketch a route on the map, tag how hard it is, and publish. Guides schedule tours on it — hikers book a seat.
        </p>
      </div>

      <SegControl v-model="mode" :options="modeOptions" style="align-self: flex-start" />

      <form @submit.prevent="onSubmit" class="auth__form">
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
          <div class="auth__roles">
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
          style="min-height: 50px; font-size: 16px"
        >
          {{ isRegister ? 'Create account' : 'Log in' }}
        </AppButton>

        <div style="font-size: 12px; opacity: 0.6">
          Protected by JWT — session lasts 24 h.
        </div>
      </form>
    </div>

    <div class="auth__media">
      <template v-if="featured">
        <div style="position: absolute; inset: 0">
          <TrailMap mode="hero" :coords="featured.waypoints" />
        </div>

        <div class="auth__featured">
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
.auth {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  background: var(--color-bg);
  color: var(--color-text);
}

.auth__panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  width: 100%;
  max-width: 760px;
  margin-inline: auto;
  padding: clamp(28px, 4vw, 48px) clamp(20px, 3vw, 44px);
}

.auth__title {
  font-size: clamp(30px, 5.2vw, 52px);
  max-width: 13em;
  margin-bottom: 12px;
}

.auth__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 660px;
}

/* Chunkier controls, auth screen only. These inputs live in this component's
   template so they carry its scope id — the design system's global 36px
   .input is untouched on every other screen. */
.auth__form .input {
  min-height: 44px;
  padding: 10px 16px;
}

.auth__roles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.auth__media {
  position: relative;
  overflow: hidden;
  background: var(--color-surface);
}

.auth__featured {
  position: absolute;
  left: 28px;
  bottom: 28px;
  z-index: 450;
  max-width: calc(100% - 56px);
  padding: 14px 18px;
  border-radius: 28px;
  background: var(--color-bg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  align-items: center;
}

/* Below the split's comfortable minimum the two tracks can no longer hold
   56px of padding plus the 400px form, so collapse to one column and demote
   the map to a banner above the form. The .98 guards fractional viewport
   widths on scaled displays (a 899.18px viewport must still collapse). */
@media (max-width: 899.98px) {
  .auth {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .auth__media {
    order: -1;
    height: clamp(150px, 26vh, 220px);
  }

  .auth__featured {
    left: 16px;
    bottom: 16px;
    gap: 14px;
    max-width: calc(100% - 32px);
  }

  .auth__panel {
    max-width: 620px;
  }
}

.role-card {
  padding: 14px 16px;
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
