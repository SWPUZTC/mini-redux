import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 工作区包（@mini-redux/*）的 package.json main 直接指向 TS 源码，
// vite 跟随 node_modules 里的符号链接即可从源码解析。
// 注意：不要开启 resolve.preserveSymlinks —— 它会让 esbuild 无法跟随
// bun 隔离安装（.bun 仓库）里的 react-dom → scheduler 链接，导致解析失败。
export default defineConfig({
  plugins: [react()],
});
