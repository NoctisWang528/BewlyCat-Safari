import type { AttributifyAttributes } from 'unocss'

declare module '@vue/runtime-dom' {
  interface HTMLAttributes extends AttributifyAttributes {}
}

declare global {
  const __BEWLY_VERSION__: string
}
