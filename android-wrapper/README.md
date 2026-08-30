# تطبيق ترتيل Android / iOS

هذا المجلد يحتوي مشروع Capacitor لتشغيل واجهة منصة ترتيل داخل تطبيق Android وتهيئة نسخة iOS. تُبنى ملفات الواجهة أولاً من المشروع الرئيسي ثم تُنسخ إلى `www`، لذلك لا يعتمد التطبيق على فتح صفحة Manus خارجية عند التشغيل.

## البناء المحلي

من جذر المشروع:

```bash
pnpm install --frozen-lockfile
pnpm mobile:build
```

ثم من داخل `android-wrapper`:

```bash
npm ci
npx cap sync android
```

لبناء APK تجريبي، بعد تثبيت Java 21 وAndroid SDK:

```bash
cd android
./gradlew assembleDebug --no-daemon
```

يوجد أيضًا Workflow في `.github/workflows/build-apk.yml` يبني واجهة الويب تلقائيًا، ينسخها إلى Capacitor، ثم يبني APK ويرفعه كـ Artifact باسم `tarteel-android-debug`.

## ملاحظات

- تسجيل الدخول وبيانات الخادم تابعان للخادم إلى أن تُستبدل طبقة المصادقة وتُضاف مزامنة شاملة.
- بيانات القرآن الأساسية محلية، ويمكن تنزيل حزمة صفحات المصحف الكاملة من داخل التطبيق للاستخدام دون اتصال.
- لا تُضع أي قيم سرية داخل هذا المجلد أو داخل APK.
- APK الناتج من GitHub Actions هو نسخة Debug للاختبار، وليس إصدارًا موقّعًا للنشر في Google Play.
