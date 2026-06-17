# Vision Center Online System

مشروع كامل لتحويل موقع إدارة السنتر من نسخة محلية إلى نسخة Online:

- `backend/`: REST API يعمل على Deno ويستخدم MongoDB Atlas.
- `frontend/`: نفس واجهة HTML الحالية، جاهزة للنشر على Vercel باستخدام Vite.
- `postman/`: Postman Collection + بيئتين Local وProduction لاختبار الـ Backend.

## 1) Backend على Deno + MongoDB

### تشغيل محلي

1. انسخ ملف البيئة:

```bash
cd backend
cp .env.example .env
```

2. عدل `.env` وضع بيانات MongoDB Atlas:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=vision_center
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
PORT=8000
```

3. شغل السيرفر:

```bash
deno task dev
```

4. جرّب:

```bash
curl http://localhost:8000/api/health
```

### نشر على Deno Deploy

ارفع فولدر `backend` على GitHub ثم اربطه مع Deno Deploy.

أضف Environment Variables في Deno Deploy:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=vision_center
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

بعد النشر انسخ رابط السيرفر، مثال:

```text
https://your-deno-backend.deno.dev
```

## 2) Frontend على Vercel

### تشغيل محلي

```bash
cd frontend
cp .env.example .env.local
```

داخل `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_CENTER_ID=vision-main
```

ثم:

```bash
npm install
npm run dev
```

### نشر على Vercel

ارفع فولدر `frontend` على GitHub أو اختاره كـ Root Directory في Vercel.

أضف Environment Variables في Vercel:

```env
VITE_API_BASE_URL=https://your-deno-backend.deno.dev
VITE_CENTER_ID=vision-main
```

## 3) طريقة حفظ البيانات

- لو `VITE_API_BASE_URL` مضبوط: البيانات تتحفظ في MongoDB عن طريق Backend.
- لو السيرفر غير متاح: الموقع يفضل شغال ويخزن البيانات مؤقتًا في Local Storage.
- من إعدادات الموقع يمكن تعديل رابط الـ API وكود السنتر، ويمكن رفع أو تغيير أيقونة السايدبار.

## 4) Postman

استورد الملفات من فولدر `postman`:

- `vision-center-backend.postman_collection.json`
- `vision-center-local.postman_environment.json`
- `vision-center-production.postman_environment.json`

ابدأ بـ `Health Check` ثم `Save Full App State` أو اختبر CRUD للطلاب.

## API Summary

### App State

- `GET /api/state?centerId=vision-main`
- `PUT /api/state`
- `DELETE /api/state?centerId=vision-main`

### Generic CRUD

Available collections:

`students, attendance, payments, groups, teachers, exams, homework, whatsapp, rooms, expenses, staff, leads, complaints`

Routes:

- `GET /api/:collection?centerId=vision-main`
- `POST /api/:collection`
- `GET /api/:collection/:id?centerId=vision-main`
- `PUT /api/:collection/:id`
- `DELETE /api/:collection/:id?centerId=vision-main`
