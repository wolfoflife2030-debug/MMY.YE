/* MMY.YE native bridge — Android biometric authentication + WebView file sharing */
(function () {
  'use strict';

  const cap = window.Capacitor;
  const isAndroid = !!(cap && cap.isNativePlatform && cap.isNativePlatform() && cap.getPlatform && cap.getPlatform() === 'android');
  const isElectron = /Electron\//.test(navigator.userAgent);

  if (!isAndroid && !isElectron) return;

  let NativeBiometric = null;
  if (isAndroid && cap && typeof cap.registerPlugin === 'function') {
    try { NativeBiometric = cap.registerPlugin('NativeBiometric'); } catch (_) {}
  }

  const nativeBiometricKey = 'mmy_native_biometric_enabled_v1';

  function nativeBiometricStored() {
    try { return localStorage.getItem(nativeBiometricKey) === '1'; } catch (_) { return false; }
  }
  function setNativeBiometricStored(value) {
    try {
      if (value) localStorage.setItem(nativeBiometricKey, '1');
      else localStorage.removeItem(nativeBiometricKey);
    } catch (_) {}
  }

  async function nativeBiometricAvailable() {
    if (!isAndroid || !NativeBiometric) return false;
    try {
      const result = await NativeBiometric.isAvailable();
      return !!(result && result.isAvailable);
    } catch (_) { return false; }
  }

  // Android uses the native BiometricPrompt. Web/Electron keeps the original WebAuthn flow.
  if (isAndroid) {
    window.biometricSupported = function () { return !!NativeBiometric; };

    window.updateBiometricUI = async function () {
      const btn = document.getElementById('lock-biometric-btn');
      const status = document.getElementById('biometric-status');
      const reg = document.getElementById('register-biometric-btn');
      const rem = document.getElementById('remove-biometric-btn');
      const available = await nativeBiometricAvailable();
      const saved = nativeBiometricStored();

      if (btn) btn.disabled = !available || !saved;
      if (reg) reg.disabled = !available;
      if (rem) rem.disabled = !saved;

      if (status) {
        status.className = 'biometric-status';
        if (!available) {
          status.classList.add('warn');
          status.textContent = 'بصمة الجهاز غير متاحة أو لم يتم تسجيل بصمة في إعدادات أندرويد.';
        } else if (saved) {
          status.classList.add('ok');
          status.textContent = 'تم تفعيل الدخول بالبصمة على هذا الجهاز.';
        } else {
          status.textContent = 'الجهاز يدعم البصمة. اضغط «تسجيل هذا الجهاز» لتفعيل الدخول السريع.';
        }
      }
    };

    window.registerBiometric = async function () {
      if (!NativeBiometric || !(await nativeBiometricAvailable())) {
        if (typeof window.toast === 'function') window.toast('البصمة غير متاحة على هذا الجهاز', 'danger');
        return;
      }
      try {
        await NativeBiometric.verifyIdentity({
          reason: 'تأكيد تفعيل الدخول بالبصمة',
          title: 'تفعيل الدخول بالبصمة',
          subtitle: 'MMY.YE',
          description: 'تحقق من بصمة الجهاز لتفعيل الدخول السريع.',
          negativeButtonText: 'إلغاء',
          maxAttempts: 5,
          useFallback: false
        });
        setNativeBiometricStored(true);
        await window.updateBiometricUI();
        if (typeof window.toast === 'function') window.toast('تم تفعيل الدخول بالبصمة لهذا الجهاز', 'success');
      } catch (e) {
        console.error(e);
        if (typeof window.toast === 'function') {
          window.toast((e && (e.code === 3 || e.errorCode === 3))
            ? 'لم يتم تسجيل بصمة في الجهاز بعد'
            : 'تم إلغاء التحقق أو تعذر استخدام البصمة', 'danger');
        }
      }
    };

    window.loginWithBiometric = async function () {
      if (!nativeBiometricStored()) {
        if (typeof window.toast === 'function') window.toast('فعّل الدخول بالبصمة أولاً من إعدادات البرنامج', 'danger');
        return;
      }
      if (!NativeBiometric || !(await nativeBiometricAvailable())) {
        if (typeof window.toast === 'function') window.toast('البصمة غير متاحة حالياً على الجهاز', 'danger');
        return;
      }
      try {
        await NativeBiometric.verifyIdentity({
          reason: 'تسجيل الدخول إلى MMY.YE',
          title: 'تسجيل الدخول بالبصمة',
          subtitle: 'MMY.YE',
          description: 'تحقق من بصمة الجهاز لفتح البرنامج.',
          negativeButtonText: 'إلغاء',
          maxAttempts: 5,
          useFallback: false
        });
        unlockApp();
        await loadRemoteDB();
        renderAll();
        if (typeof window.toast === 'function') window.toast('تم تسجيل الدخول بالبصمة بنجاح', 'success');
      } catch (e) {
        console.error(e);
        if (typeof window.toast === 'function') window.toast('فشل التحقق بالبصمة أو تم إلغاؤه', 'danger');
      }
    };

    window.removeBiometric = function () {
      if (!nativeBiometricStored()) {
        if (typeof window.toast === 'function') window.toast('لا توجد بصمة مفعلة لهذا الجهاز');
        return;
      }
      if (!confirm('هل تريد إيقاف الدخول بالبصمة لهذا الجهاز؟')) return;
      setNativeBiometricStored(false);
      window.updateBiometricUI();
      if (typeof window.toast === 'function') window.toast('تم إيقاف الدخول بالبصمة');
    };

    window.setTimeout(function () {
      try { window.updateBiometricUI(); } catch (_) {}
    }, 250);
  }

  // Android: downloads created from Blob URLs need native Filesystem + Share.
  if (isAndroid) {
    const blobs = new Map();
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (obj) {
      const u = origCreate(obj);
      if (obj instanceof Blob) blobs.set(u, obj);
      return u;
    };

    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      const href = this.href, name = this.download;
      if (name && href && href.startsWith('blob:') && blobs.has(href)) {
        const reader = new FileReader();
        reader.onload = async function () {
          try {
            const plugins = cap.Plugins || {};
            const Filesystem = plugins.Filesystem;
            const Share = plugins.Share;
            const base64 = String(reader.result).split(',')[1] || '';
            const res = await Filesystem.writeFile({ path: name, data: base64, directory: 'CACHE' });
            await Share.share({ title: name, url: res.uri, dialogTitle: 'حفظ الملف' });
          } catch (err) {
            if (typeof window.toast === 'function') window.toast('تعذّر حفظ الملف: ' + ((err && err.message) || err), 'danger');
          }
        };
        reader.readAsDataURL(blobs.get(href));
        return;
      }
      return origClick.apply(this, arguments);
    };

    try {
      if (cap.Plugins && cap.Plugins.StatusBar) {
        cap.Plugins.StatusBar.setBackgroundColor({ color: '#136031' });
      }
    } catch (_) {}
  }
})();
