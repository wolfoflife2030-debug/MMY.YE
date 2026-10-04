// Adds the Android biometric permission after Capacitor generates the native project.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifest)) {
  console.log('Android project not generated yet; skipping biometric manifest patch.');
  process.exit(0);
}

let xml = fs.readFileSync(manifest, 'utf8');
const permission = '<uses-permission android:name="android.permission.USE_BIOMETRIC" />';

if (!xml.includes('android.permission.USE_BIOMETRIC')) {
  const marker = '<application';
  const idx = xml.indexOf(marker);
  if (idx < 0) throw new Error('Could not find <application> in AndroidManifest.xml');
  xml = xml.slice(0, idx) + permission + '\n    ' + xml.slice(idx);
  fs.writeFileSync(manifest, xml);
  console.log('Android biometric permission added ✔');
} else {
  console.log('Android biometric permission already present ✔');
}
