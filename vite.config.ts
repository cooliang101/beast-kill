import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  server: {
    // 默认只绑 ::1 会导致 127.0.0.1 连不上（Windows 常见），
    // 绑定所有网卡同时便于手机同局域网访问调试。
    // 如需仅本机可访问，改为 host: '127.0.0.1'。
    host: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
