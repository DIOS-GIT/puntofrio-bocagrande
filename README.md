# 🧊 Punto Frío Bocagrande — Sistema Web (Tienda + Admin + Facturación DIAN)

## Estructura de archivos
```
/index.html            → Tienda pública
/admin/index.html      → Panel de administración (SPA)
/css/styles.css        → Estilos tienda pública (tema amarillo)
/css/admin.css         → Estilos panel admin
/js/theme.js           → Firebase + Cloudinary + utilidades compartidas
/legal/                → Políticas / documentación legal
```

## Configuración obligatoria antes de publicar

1. **Firebase** (`/js/theme.js`): reemplaza `firebaseConfig` con las credenciales de tu proyecto
   (Firebase Console → Configuración del proyecto → SDK setup).
2. **Cloudinary** (`/js/theme.js`): reemplaza `cloudName` y crea un *Upload Preset* tipo
   **Unsigned** en Cloudinary Console → Settings → Upload.
3. **WhatsApp** (`/index.html`): reemplaza `NUMERO_WHATSAPP_NEGOCIO` con el número real
   del negocio en formato internacional sin "+" (ej: `573001234567`).
4. **Correo del negocio** (`/admin/index.html`): reemplaza `CORREO_NEGOCIO`.
5. **Usuario admin**: crea el usuario en Firebase Auth → Authentication → Users
   (correo + contraseña) — es el único método de login habilitado en este panel.

## Colecciones de Firestore usadas

| Colección           | Propósito                                                        |
|---------------------|--------------------------------------------------------------------|
| `productos`         | Catálogo (nombre, categoría, precio, stock, stockMinimo, imagen)  |
| `clientes`          | Clientes por cédula/NIT (autocompletado en facturación)          |
| `facturas`          | Facturas emitidas (numero, cliente, items, total, metodoPago)    |
| `config/consecutivos` | Documento único con el campo `ultimoNumero` (consecutivo DIAN) |
| `correos_facturas`  | Cola de envío de factura por correo (para procesar con una Cloud Function o Apps Script externo, ya que GitHub Pages no ejecuta backend) |

## Reglas de seguridad sugeridas (Firestore)

⚠️ Ajusta esto según tus necesidades reales; son un punto de partida seguro:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /productos/{id} {
      allow read: if true;                 // catálogo público
      allow write: if request.auth != null; // solo admin autenticado
    }

    match /clientes/{id} {
      allow read, write: if request.auth != null;
    }

    match /facturas/{id} {
      allow read, write: if request.auth != null;
    }

    match /config/{id} {
      allow read, write: if request.auth != null;
    }

    match /correos_facturas/{id} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Notas importantes

- El envío real de la factura por correo electrónico **no puede ejecutarse desde
  GitHub Pages** (es 100% estático/frontend). El documento en `correos_facturas`
  queda en cola para ser procesado por un servicio externo (Cloud Function, Zapier,
  Apps Script, etc.) que lea esa colección y envíe el correo.
- El consecutivo de facturación se maneja con `runTransaction`, lo que garantiza
  que dos facturas nunca reciban el mismo número aunque se generen al mismo tiempo.
- El módulo de impresión usa `@media print` optimizado para impresoras térmicas
  de tiquetes (ancho ~280px / 80mm).
