import { ref } from 'vue'
import { defineStore } from 'pinia'

const AUTO_DISMISS_MS = 3200

export const useToastStore = defineStore('toast', () => {
  const message = ref<string | null>(null)

  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function show(msg: string) {
    // Clear first so a second show() restarts the full countdown
    // instead of inheriting the previous message's timer.
    clearTimer()
    message.value = msg
    timer = setTimeout(() => {
      timer = null
      message.value = null
    }, AUTO_DISMISS_MS)
  }

  function dismiss() {
    clearTimer()
    message.value = null
  }

  return { message, show, dismiss }
})
