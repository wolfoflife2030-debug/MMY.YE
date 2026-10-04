// يجهّز مجلد www من src: خطوط محلية (للعمل دون إنترنت) + تصحيح CSP + إضافة طبقة التوافق
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, 'fonts'), { recursive: true });
fs.copyFileSync(path.join(root, 'src', 'logo.webp'), path.join(www, 'logo.webp'));

const AR = 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0898-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC';
const LA = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const fams = [['Cairo', 'cairo', [300, 400, 500, 600, 700, 800]], ['Tajawal', 'tajawal', [400, 500, 700]]];
let css = '', missing = 0;
for (const [name, pkg, weights] of fams) {
  for (const w of weights) for (const [sub, range] of [['arabic', AR], ['latin', LA]]) {
    const file = `${pkg}-${sub}-${w}-normal.woff2`;
    const src = path.join(root, 'node_modules', '@fontsource', pkg, 'files', file);
    if (!fs.existsSync(src)) { missing++; continue; }
    fs.copyFileSync(src, path.join(www, 'fonts', file));
    css += `@font-face{font-family:'${name}';font-style:normal;font-display:swap;font-weight:${w};src:url(${file}) format('woff2');unicode-range:${range};}\n`;
  }
}
fs.writeFileSync(path.join(www, 'fonts', 'fonts.css'), css);
if (missing) console.warn(`تنبيه: ${missing} ملف خط غير موجود — شغّل npm install أولاً. سيستخدم النظام خطوطاً بديلة.`);

let html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
html = html
  .replace(/<link[^>]*rel="preconnect"[^>]*fonts\.googleapis\.com[^>]*>\s*/g, '')
  .replace(/<link[^>]*href="https:\/\/fonts\.googleapis\.com\/css2[^"]*"[^>]*>/g, '<link rel="stylesheet" href="fonts/fonts.css">')
  .replace(/font-src https:\/\/fonts\.gstatic\.com/, "font-src 'self' data:")
  .replace(/style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/, "style-src 'self' 'unsafe-inline'")
  .replace(/<\/body>/i, '<script src="native-bridge.js"></script>\n</body>');
for (const [label, re] of [['fonts.css', /fonts\/fonts\.css/], ['native-bridge', /native-bridge\.js/], ['font-src', /font-src 'self' data:/]])
  if (!re.test(html)) throw new Error('فشل تطبيق التعديل: ' + label);
fs.writeFileSync(path.join(www, 'index.html'), html);
fs.copyFileSync(path.join(root, 'src', 'native-bridge.js'), path.join(www, 'native-bridge.js'));
console.log('تم تجهيز www ✔');
