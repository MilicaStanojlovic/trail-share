import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  {
    // Design-system primitives are named after the utility classes they wrap
    // (`.tag` in design/styles.css), so their single-word names are deliberate
    // and shared with the design vocabulary rather than accidental. Every other
    // component keeps the multi-word rule. Add new primitives to this list only
    // when the name comes straight from the design system.
    name: 'app/design-system-primitives',
    files: ['src/components/Tag.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
)
