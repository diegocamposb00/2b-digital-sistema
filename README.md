# 2B Digital — Sistema Técnico

App móvil para gestión de clientes, auditorías técnicas y cotizaciones.

---

## Pasos para publicar (20 minutos, todo gratis)

### 1. Configurar Supabase (base de datos)

1. Entrá a https://supabase.com y creá una cuenta gratis
2. Creá un proyecto nuevo → poné nombre: `2b-digital-sistema`
3. Esperá que termine de crear (1-2 minutos)
4. Andá a **SQL Editor** → **New query**
5. Copiá todo el contenido de `supabase_schema.sql` y ejecutalo (botón Run)
6. Andá a **Settings → API** y copiá:
   - **Project URL** → algo como `https://xxxxxxxxxxxx.supabase.co`
   - **anon public key** → clave larga que empieza con `eyJ...`

### 2. Configurar las credenciales

1. Copiá el archivo `.env.example` y renombralo a `.env`
2. Reemplazá los valores:
```
REACT_APP_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
REACT_APP_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI
```

### 3. Subir a Vercel (hosting gratis)

**Opción A — Sin instalar nada (más fácil):**
1. Creá cuenta en https://github.com (si no tenés)
2. Creá un repositorio nuevo y subí todos estos archivos
3. Entrá a https://vercel.com → importá el repositorio de GitHub
4. En Vercel, andá a **Settings → Environment Variables** y agregá:
   - `REACT_APP_SUPABASE_URL` con tu URL
   - `REACT_APP_SUPABASE_ANON_KEY` con tu key
5. Deploy → te dan una URL pública

**Opción B — Con terminal:**
```bash
npm install
npm run build
npx vercel --prod
```

### 4. Instalar en celular como app

1. Abrí la URL de Vercel desde tu celular en Chrome (Android) o Safari (iPhone)
2. Android: menú → "Agregar a pantalla de inicio"
3. iPhone: botón compartir → "Agregar a pantalla de inicio"

---

## Estructura del proyecto

```
src/
  App.js          ← toda la lógica y UI
  supabase.js     ← conexión a la base de datos
  index.js        ← entrada de React
  index.css       ← estilos base
supabase_schema.sql  ← tablas que hay que crear en Supabase
.env.example         ← plantilla de credenciales
```

## Módulos de la app

- **Dashboard** — lista de clientes con KPIs e ingreso total
- **Ficha cliente** — datos, estado de auditoría y cotización
- **Revisión Preliminar** — checklist técnico con riesgo automático
- **Cotización** — cálculo automático de precios por variables

---

## ¿Algo no funciona?

Revisá que el SQL se ejecutó correctamente en Supabase (Table Editor → deberías ver 3 tablas: clientes, auditorias, cotizaciones).
