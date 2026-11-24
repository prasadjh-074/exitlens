import {defineConfig} from 'vite'
export default defineConfig({base:'./',build:{rollupOptions:{input:{dashboard:'dashboard.html',sidepanel:'sidepanel.html'}}}})
