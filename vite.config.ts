import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
    base: '/applications/vue-base64-converter',
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src')
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `
                    @use "@/styles/variables.scss" as *;
                    @use "@/styles/mixins.scss" as *;
                `
            }
        }
    }
})