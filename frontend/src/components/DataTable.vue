<script setup lang="ts" generic="T extends Record<string, unknown>">
interface Column {
  key: string
  label: string
  align?: 'left' | 'right'
}

interface Props {
  columns: Column[]
  rows: T[]
}

defineProps<Props>()
</script>

<template>
  <table class="table">
    <thead>
      <tr>
        <th
          v-for="col in columns"
          :key="col.key"
          :style="col.align === 'right' ? { textAlign: 'right' } : undefined"
        >
          {{ col.label }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
        <td
          v-for="col in columns"
          :key="col.key"
          :style="col.align === 'right' ? { textAlign: 'right' } : undefined"
        >
          <slot :name="`cell-${col.key}`" :row="row">
            {{ row[col.key] }}
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>
