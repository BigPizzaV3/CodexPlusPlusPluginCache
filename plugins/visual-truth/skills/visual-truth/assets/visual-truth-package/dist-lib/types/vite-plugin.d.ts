import type { Plugin } from 'vite'

export type VisualTruthSourcePluginOptions = {
  output?: string
}

export declare function visualTruthSourcePlugin(options?: VisualTruthSourcePluginOptions): Plugin
