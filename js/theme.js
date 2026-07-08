/**
 * =============================================================
 *  theme.js
 *  Punto Frío Bocagrande — Configuración centralizada
 *  - Inicialización de Firebase (Firestore + Auth) con persistencia
 *  - Configuración del Widget de subida de Cloudinary (Unsigned)
 *  - Utilidades globales compartidas entre la tienda y el admin
 * =============================================================
 *  Este archivo se importa como módulo ES6 tanto en /index.html
 *  como en /admin/index.html:
 *     <script type="module" src="/js/theme.js"></script>
 *  o bien:
 *     import { db, auth, ... } from '../js/theme.js';
 * =============================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  runTransaction,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* -------------------------------------------------------------
 * 1. CONFIGURACIÓN DE FIREBASE
 *    ⚠️ Reemplaza estos valores con los de tu proyecto en
 *    https://console.firebase.google.com/  → Configuración del proyecto
 * ----------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyAlx37xpQo9mV4-oY_SQ6HYaKOw8o3l0_A",
  authDomain: "puntofriobocagrande.firebaseapp.com",
  projectId: "puntofriobocagrande",
  storageBucket: "puntofriobocagrande.firebasestorage.app",
  messagingSenderId: "1074089795642",
  appId: "1:1074089795642:web:2c25fb977ecf7650811503"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Sin persistencia entre recargas: cada vez que se actualiza la página del admin,
// hay que volver a iniciar sesión (por seguridad/profesionalismo del panel).
setPersistence(auth, inMemoryPersistence).catch((err) => {
  console.error("[theme.js] Error configurando persistencia de Auth:", err);
});

// Persistencia offline obligatoria de Firestore (IndexedDB)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn(
      "[theme.js] Persistencia offline no habilitada: hay múltiples pestañas abiertas."
    );
  } else if (err.code === "unimplemented") {
    console.warn(
      "[theme.js] Este navegador no soporta persistencia offline de Firestore."
    );
  } else {
    console.error("[theme.js] Error habilitando persistencia offline:", err);
  }
});

/* -------------------------------------------------------------
 * 2. CONFIGURACIÓN DE CLOUDINARY (Unsigned Upload Preset)
 *    ⚠️ Reemplaza con tu cloud_name y upload_preset creados en
 *    https://console.cloudinary.com/  → Settings → Upload
 * ----------------------------------------------------------- */
const CLOUDINARY_CONFIG = {
  cloudName: "edemphje",
  uploadPreset: "puntofrio_unsigned",
  folder: "puntofrio_productos"
};

/**
 * Abre el widget de subida de Cloudinary y ejecuta un callback
 * con la URL segura de la imagen subida.
 * @param {(secureUrl: string, publicId: string) => void} onSuccess
 */
function openCloudinaryWidget(onSuccess) {
  if (typeof window.cloudinary === "undefined") {
    alert(
      "El widget de Cloudinary no cargó. Verifica que el script " +
        "https://widget.cloudinary.com/v2.0/global/all.js esté incluido."
    );
    return;
  }

  const widget = window.cloudinary.createUploadWidget(
    {
      cloudName: CLOUDINARY_CONFIG.cloudName,
      uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
      folder: CLOUDINARY_CONFIG.folder,
      sources: ["local", "camera", "url"],
      multiple: true,
      maxFiles: 6,
      cropping: true,
      croppingAspectRatio: 1,
      language: "es",
      text: {
        es: {
          or: "o",
          menu: { files: "Mis archivos" },
          local: { browse: "Buscar", dd_title_single: "Arrastra tu imagen aquí" }
        }
      },
      styles: {
        palette: {
          window: "#FFFFFF",
          windowBorder: "#FFC107",
          tabIcon: "#FFA000",
          menuIcons: "#333333",
          textDark: "#212121",
          textLight: "#FFFFFF",
          link: "#FFA000",
          action: "#FF8F00",
          inactiveTabIcon: "#B0B0B0",
          error: "#D32F2F",
          inProgress: "#FFC107",
          complete: "#43A047",
          sourceBg: "#FAFAFA"
        }
      }
    },
    (error, result) => {
      if (!error && result && result.event === "success") {
        onSuccess(result.info.secure_url, result.info.public_id);
      }
      if (error) {
        console.error("[theme.js] Error en Cloudinary Widget:", error);
      }
    }
  );

  widget.open();
}

/* -------------------------------------------------------------
 * 3. UTILIDADES GLOBALES
 * ----------------------------------------------------------- */

/** Formatea un número como pesos colombianos: 1234567 -> "$ 1.234.567" */
function formatCOP(value) {
  const num = Number(value) || 0;
  return (
    "$ " +
    num.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  );
}

/** Formatea una fecha (Date o Timestamp de Firestore) a "dd/mm/aaaa hh:mm" */
function formatFecha(fechaInput) {
  const fecha = fechaInput?.toDate ? fechaInput.toDate() : new Date(fechaInput);
  return fecha.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Genera el link de WhatsApp con el pedido formateado para la tienda pública.
 * @param {Array<{nombre:string, cantidad:number, precio:number}>} carrito
 * @param {{nombre:string, direccion:string, telefono?:string}} cliente
 * @param {string} numeroWhatsapp Número del negocio en formato internacional, ej: "573001234567"
 */
function generarLinkWhatsApp(carrito, cliente, numeroWhatsapp) {
  let mensaje = `🧊 *NUEVO PEDIDO - PUNTO FRÍO BOCAGRANDE* 🧊\n\n`;
  mensaje += `👤 *Cliente:* ${cliente.nombre}\n`;
  if (cliente.cedula) mensaje += `🪪 *Cédula/NIT:* ${cliente.cedula}\n`;
  if (cliente.correo) mensaje += `✉️ *Correo:* ${cliente.correo}\n`;
  mensaje += `📍 *Dirección:* ${cliente.direccion}\n`;
  if (cliente.ubicacionLink) mensaje += `🗺️ *Ubicación (Google Maps):* ${cliente.ubicacionLink}\n`;
  if (cliente.telefono) mensaje += `📞 *Teléfono:* ${cliente.telefono}\n`;
  mensaje += `\n🛒 *Detalle del pedido:*\n`;

  let total = 0;
  carrito.forEach((item) => {
    const subtotal = item.cantidad * item.precio;
    total += subtotal;
    const notaEnvase = item.conEnvase === true ? " (trae envase)" : item.conEnvase === false ? " (sin envase)" : "";
    mensaje += `• ${item.cantidad}x ${item.nombre}${notaEnvase} — ${formatCOP(item.precio)} c/u = ${formatCOP(
      subtotal
    )}\n`;
  });

  mensaje += `\n💰 *TOTAL: ${formatCOP(total)}*\n`;
  mensaje += `\n_Pedido generado automáticamente desde la tienda web._`;

  const url = `https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(mensaje)}`;
  return url;
}

/** Debounce simple para inputs (ej. búsqueda por cédula en 'blur'/'input') */
function debounce(fn, delayMs = 400) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

/* -------------------------------------------------------------
 * 4. EXPORTS
 * ----------------------------------------------------------- */
export {
  app,
  db,
  auth,
  // Firestore helpers re-exportados para no repetir imports en cada página
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  runTransaction,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  // Auth helpers
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  // Cloudinary
  openCloudinaryWidget,
  CLOUDINARY_CONFIG,
  // Utilidades
  formatCOP,
  formatFecha,
  generarLinkWhatsApp,
  debounce
};
