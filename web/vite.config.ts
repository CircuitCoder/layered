import type { UserConfig } from 'vite'
import Yaml from './plugins/yaml'

export default {
  plugins: [Yaml()],
} satisfies UserConfig