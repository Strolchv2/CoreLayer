import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'scripts/migrate': 'src/scripts/migrate.ts',
    'scripts/seed': 'src/scripts/seed.ts',
    'scripts/createAdmin': 'src/scripts/createAdmin.ts',
    'scripts/backup': 'src/scripts/backup.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // Workspace-Paket wird eingebettet, alle anderen Abhängigkeiten bleiben extern.
  noExternal: ['@cv-studio/shared'],
});
