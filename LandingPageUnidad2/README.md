# Luxury Galaxy — Exótico Versión

Plataforma premium de preventa y exhibición de vehículos exóticos con visor 3D procedural interactivo, catálogo curado en tiempo real, radicación trazable de órdenes con código criptográfico y panel de administración con estadísticas de demanda.

---

## 1. Bitácora de Prompts en Formato R-C-I-F (Rol, Contexto, Instrucciones, Formato)

A continuación se documentan de forma simple y numerada los prompts aplicados durante el ciclo de ingeniería del proyecto:

### Prompt 1 — Arquitectura Base y Experiencia Visual Luxury
* **R (Rol):** Senior Frontend Engineer & UI/UX Designer de marcas automotrices de lujo.
* **C (Contexto):** Proyecto de preventa de vehículos exóticos de serie limitada en Colombia con estética cyberpunk/lujo brutalista.
* **I (Instrucciones):** Construir la landing page completa con navegación sticky, Hero con Lamborghini Aventador SVJ en 3D, catálogo curado con selección múltiple reactiva, proceso en 5 pasos, testimonios, formulario de preventa con autoguardado en `localStorage`, modales para PQRS y política de privacidad, e internacionalización bilingüe (ES/EN) con alternador de tema oscuro (esmeralda) y claro (rubí).
* **F (Formato):** SPA modular en React + TypeScript + Tailwind CSS, validado sin errores de consola.

### Prompt 2 — Encuadre y Traslado Central del Auto 3D
* **R (Rol):** 3D WebGL Graphic Engineer & UI Layout Specialist.
* **C (Contexto):** El visor 3D se encontraba limitado en una columna lateral y requería centrado absoluto sin saturar la composición.
* **I (Instrucciones):** Trasladar el auto 3D justo en el medio, debajo de los botones de preventa del Hero y directamente encima de las estadísticas de unidades y respuesta. Recalcular las matrices de proyección focal para que todo el vehículo (desde el splitter delantero hasta el alerón de carbono) sea 100% visible sin recortes en 360°.
* **F (Formato):** Bloque visual central de ancho completo con control de rotación y reciente de cámara.

### Prompt 3 — Control de Scroll e Interacción por Doble Clic
* **R (Rol):** UX & Accessibility Engineer.
* **C (Contexto):** El lienzo 3D interceptaba la rueda del ratón y el swipe táctil, impidiendo desplazarse verticalmente por la landing page.
* **I (Instrucciones):** Desactivar la captura de scroll por defecto (`touchAction: 'pan-y'`). Habilitar la órbita 3D manual **únicamente** tras hacer doble clic o pulsar el botón de desbloqueo, liberando el scroll de la página cuando el usuario solo desea navegar.
* **F (Formato):** Eventos condicionales en WebGL con badge visual dinámico (`2ble clic para activar 3D` / `3D Activo · Bloquear`).

### Prompt 4 — Flujo Guiado de Preventa, Animaciones y Seguridad RLS
* **R (Rol):** Full-Stack Security Architect & Academic Evaluator.
* **C (Contexto):** Reauditoría de integridad funcional y alineación de reglas de negocio.
* **I (Instrucciones):**
  1. Si no hay vehículos seleccionados, el botón *"Reservar mi preventa"* guía al usuario al catálogo con notificación; el formulario se activa solo con unidades elegidas.
  2. Implementar animación Typewriter en el H1 mediante `sessionStorage` (una sola vez por sesión).
  3. Re-ensamblar las partículas 3D cuando el usuario hace scroll hacia el modelo (`IntersectionObserver`).
  4. Resaltar inputs inválidos con iluminación roja (*glowing red outline*) al perder el foco (`onBlur`).
  5. Crear esquema SQL limpio sin sentencias `DROP` con políticas RLS de inserción pública y lectura para administradores.
  6. Crear panel administrativo con estadísticas de demanda, gestión de flota y consulta de órdenes.
* **F (Formato):** Base de código TypeScript compilada, esquema `schema.sql` y backend Node.js resiliente con almacenamiento persistente.

### Prompt 5 — Autenticación con Usuario/Contraseña y Anexado Seguro de Imágenes
* **R (Rol):** Full-Stack Security Engineer & Supabase Administrator.
* **C (Contexto):** Mitigación de vulnerabilidad de contraseña única, soporte para usuarios en Supabase Auth y curaduría multimedia del catálogo.
* **I (Instrucciones):**
  1. Transformar el acceso de administrador para exigir **Correo Electrónico (Usuario)** y **Contraseña** (integrado directamente con `supabase.auth.signInWithPassword` y fallback con credenciales de dirección).
  2. Agregar funcionalidad para anexar imágenes al crear o editar vehículos, con validación estricta de extensiones autorizadas (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.svg`) y bloqueo de ejecutables o extensiones desconocidas.
  3. Vista previa inmediata de la imagen cargada con botón para sustituir o remover.
  4. Garantizar cero sentencias `DROP` en la base de datos Supabase, aplicando únicamente actualizaciones no destructivas (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
* **F (Formato):** Formulario con drag-and-drop en React 19 + TypeScript, validación bidireccional cliente/servidor y esquema `schema.sql` limpio.

---




```

> **Nota:** La aplicación incluye almacenamiento persistente local en disco (`./data/`) para que funcione de forma autónoma aun antes de enlazar las credenciales remotas de Supabase.

---

## 3. Cómo Acceder al Panel de Administración

El panel administrativo permite visualizar estadísticas de peticiones en tiempo real, gestionar qué autos están disponibles para preventa, anexar nuevas imágenes y consultar las órdenes radicadas.

Existen 3 formas de acceder:
1. **Acceso directo por URL:** Añade el hash `#admin` en el navegador (ejemplo: `http://localhost:3000/#admin`).
2. **Acceso por Header:** Haz clic en el icono de candado/escudo situado en la barra de herramientas superior (junto al botón de tema claro/oscuro).
3. **Acceso por Footer:** Haz clic en el enlace *"Panel de Administración"* o *"Acceso Admin"* en el pie de página.

### Credenciales de Acceso:
* **Usuario / Correo:** `admin@luxurygalaxy.com` (o el correo de tu usuario registrado en **Supabase Auth**).
* **Contraseña:** `GalaxyAdmin2026!` (o la contraseña de tu usuario en Supabase Auth o variable `ADMIN_PASSWORD` en `.env`).

---

## 4. Anexado y Validación de Imágenes en el Catálogo

Al añadir o editar un vehículo desde la pestaña **Catálogo & Unidades**:
* **Formatos autorizados:** Archivos con extensión `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif` o `.svg` (tamaño máximo de 8 MB).
* **Protección activa:** Se rechazan y bloquean scripts, ejecutables (`.exe`, `.sh`, `.bin`, `.js`, etc.) y archivos no gráficos (`.pdf`, `.zip`, `.doc`).
* **Soporte dual:** Permite arrastrar y soltar el archivo directamente desde tu equipo (convirtiéndolo a Base64 optimizado) o enlazar una URL HTTPS externa con vista previa instantánea.
