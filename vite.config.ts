import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Tout est intégré à la page (images comprises) pour la publier en un seul fichier.
  build: { assetsInlineLimit: 8 * 1024 * 1024 },
});
