# 🏫 Asignación de Asientos · UNIROMANA

Sistema de asignación aleatoria de asientos por mes, con historial en Firebase y soporte para múltiples grupos/materias.

## ⚡ Requisitos

- Node.js 18 o superior (`node -v` para verificar)
- Cuenta de GitHub
- Proyecto Firebase creado (Firestore habilitado)

---

## 🚀 Instalación local

```bash
# 1. Instalar dependencias
npm install

# 2. Correr en modo desarrollo
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

---

## 🌐 Publicar en GitHub Pages

### Paso 1 — Crear el repositorio en GitHub

1. Ve a [github.com/new](https://github.com/new)
2. Nombre del repositorio: **`classroom-seats`** (exactamente igual)
3. Déjalo público
4. **No** inicialices con README (ya tienes uno)
5. Clic en **Create repository**

### Paso 2 — Subir el proyecto

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/classroom-seats.git
git push -u origin main
```

> Reemplaza `TU_USUARIO` con tu usuario de GitHub.

### Paso 3 — Desplegar a GitHub Pages

```bash
npm run deploy
```

Esto construye el proyecto y lo sube a la rama `gh-pages` automáticamente.

### Paso 4 — Activar GitHub Pages

1. En tu repositorio de GitHub: **Settings → Pages**
2. En **Branch** selecciona `gh-pages` → `/ (root)`
3. Clic en **Save**

En 1-2 minutos tu app estará en:
```
https://TU_USUARIO.github.io/classroom-seats/
```

---

## 🔄 Actualizar la app después de cambios

```bash
# Subir cambios al código fuente
git add .
git commit -m "descripción del cambio"
git push

# Redesplegar a GitHub Pages
npm run deploy
```

---

## 🔥 Configurar Firestore (reglas de seguridad)

En [Firebase Console](https://console.firebase.google.com) → **Firestore Database → Reglas**:

**Para desarrollo/uso personal (acceso abierto):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

## 📁 Estructura del proyecto

```
classroom-seats/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          ← Componente principal
│   ├── firebase.js      ← Configuración Firebase
│   ├── main.jsx         ← Entry point React
│   └── index.css        ← Estilos globales
├── index.html
├── vite.config.js
├── package.json
└── .gitignore
```

---

## ✨ Funcionalidades

- ✅ Asignación aleatoria mensual por grupo/materia
- ✅ Historial completo guardado en Firebase
- ✅ Múltiples grupos (Programación I, Estadística, Lógica, etc.)
- ✅ Filas y columnas configurables (hasta 10×12)
- ✅ Bloquear asientos específicos
- ✅ Importar lista desde CSV
- ✅ Búsqueda de estudiantes en el mapa
- ✅ Modo oscuro
- ✅ Lista ordenada por fila
- ✅ Desglose por zonas (Frente / Centro / Fondo)
- ✅ Copiar lista al portapapeles
