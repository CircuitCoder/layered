import viteCompression from 'vite-plugin-compression';

export default () => {
  return {
    plugins: [
      // viteCompression({ algorithm: 'gzip', ext: '.gz' }),
      // viteCompression({ algorithm: 'brotliCompress', ext: '.br' }),
    ],
  };
};
