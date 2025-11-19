// Disable Kotlin allWarningsAsErrors in React Native Gradle plugin to prevent build failures
// caused by harmless warnings during plugin compilation.
// This runs on postinstall so it works both locally and on EAS (NODE_ENV=production).

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'react-native-gradle-plugin',
  'build.gradle.kts'
);

try {
  if (!fs.existsSync(targetPath)) {
    console.log('[patch-rn-gradle-plugin] build.gradle.kts not found, skipping.');
    process.exit(0);
  }
  const original = fs.readFileSync(targetPath, 'utf8');
  const patched = original.replace(
    /allWarningsAsErrors\s*=\s*true/g,
    'allWarningsAsErrors = false'
  );

  if (original !== patched) {
    fs.writeFileSync(targetPath, patched, 'utf8');
    console.log('[patch-rn-gradle-plugin] Patched: allWarningsAsErrors set to false.');
  } else {
    console.log('[patch-rn-gradle-plugin] No changes needed (already disabled).');
  }
} catch (err) {
  console.error('[patch-rn-gradle-plugin] Failed to patch plugin:', err);
  process.exitCode = 0; // Do not block install if patch fails
}