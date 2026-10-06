import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Vehicle } from './src/types.js';
import { INITIAL_VEHICLES } from './src/data/vehicles.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Support base64 image uploads up to 15MB
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Basic IP-based rate limiting to prevent spam and abuse
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
function rateLimiter(maxRequests = 40, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return res.status(429).json({
        ok: false,
        error: 'Demasiadas solicitudes. Por favor espera un momento antes de reintentar.',
      });
    }

    entry.count += 1;
    return next();
  };
}

// Resilient file-backed persistent storage (cache/backup)
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

const VEHICLES_FILE = path.join(DATA_DIR, 'vehicles.json');
const PREORDERS_FILE = path.join(DATA_DIR, 'preorders.json');
const PQRS_FILE = path.join(DATA_DIR, 'pqrs.json');

function loadJSON<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.warn(`[Storage] Failed to read ${file}:`, err);
  }
  return fallback;
}

function saveJSON<T>(file: string, data: T): void {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[Storage] Failed to write ${file}:`, err);
  }
}

let vehiclesList: Vehicle[] = loadJSON<Vehicle[]>(VEHICLES_FILE, [...INITIAL_VEHICLES]);
let preordersList: any[] = loadJSON<any[]>(PREORDERS_FILE, []);
let pqrsList: any[] = loadJSON<any[]>(PQRS_FILE, []);

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

// Active authenticated admin sessions with 8-hour expiry
const activeAdminSessions = new Map<string, { userId: string; email: string; role: string; expiresAt: number }>();

// Verify admin authorization strictly
async function verifyAdminAuthHeader(authHeader?: string): Promise<{ authorized: boolean; user?: any }> {
  if (!authHeader) return { authorized: false };
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { authorized: false };

  // 1. Check existing server session
  const session = activeAdminSessions.get(token);
  if (session && session.expiresAt > Date.now()) {
    return { authorized: true, user: session };
  } else if (session) {
    activeAdminSessions.delete(token);
  }

  // 2. If it's a Supabase JWT, verify directly with Supabase
  if (SUPABASE_URL && SUPABASE_ANON_KEY && token.startsWith('ey')) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });

      if (!userRes.ok) return { authorized: false };
      const user = (await userRes.json()) as any;
      if (!user?.id) return { authorized: false };

      // Query admin_profiles with the user's token
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/admin_profiles?user_id=eq.${user.id}&select=role,is_active`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        }
      );

      if (profRes.ok) {
        const profiles = (await profRes.json()) as any[];
        if (
          Array.isArray(profiles) &&
          profiles.length > 0 &&
          profiles[0].is_active &&
          (profiles[0].role === 'admin' || profiles[0].role === 'editor')
        ) {
          // Cache verified session for 1 hour
          activeAdminSessions.set(token, {
            userId: user.id,
            email: user.email,
            role: profiles[0].role,
            expiresAt: Date.now() + 60 * 60 * 1000,
          });
          return { authorized: true, user };
        }
      }
    } catch {}
  }

  return { authorized: false };
}

// SQL injection & dangerous control-character filter
function sanitizeText(val: unknown, maxLen = 255): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .trim()
    .slice(0, maxLen);
}

function isValidImagePayload(url: unknown): { valid: boolean; error?: string } {
  if (typeof url !== 'string' || !url.trim()) {
    return { valid: false, error: 'La imagen del vehículo es obligatoria.' };
  }

  const trimmed = url.trim();

  // Data URL verification (Strict base64 image types only, no executable/html payloads)
  if (trimmed.startsWith('data:')) {
    const allowedDataHeaderRegex = /^data:image\/(jpeg|jpg|png|webp|avif|svg\+xml);base64,/i;
    if (!allowedDataHeaderRegex.test(trimmed)) {
      return {
        valid: false,
        error: 'Formato de imagen no permitido. Solo se admiten archivos de imagen válidos (.jpg, .jpeg, .png, .webp, .avif, .svg).',
      };
    }
    return { valid: true };
  }

  // Web or asset URL verification
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:')
  ) {
    return { valid: false, error: 'Protocolo de archivo no permitido.' };
  }

  if (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('/') ||
    lower.startsWith('assets/')
  ) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'La imagen debe ser un archivo subido válido (.jpg, .jpeg, .png, .webp, .avif, .svg) o una URL HTTPS segura.',
  };
}

// Middleware to enforce active admin authentication on protected endpoints
async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const result = await verifyAdminAuthHeader(authHeader);
  if (!result.authorized) {
    return res.status(403).json({
      ok: false,
      error: 'No autorizado: Se requiere una sesión de administrador activa y verificada.',
    });
  }
  (req as any).adminUser = result.user;
  next();
}

// -----------------------------------------------------------------------------
// PUBLIC API ROUTES
// -----------------------------------------------------------------------------

app.get('/api/vehicles', async (_req: Request, res: Response) => {
  // If Supabase is configured, attempt reading live public vehicles from PostgreSQL
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const sbRes = await fetch(
        `${SUPABASE_URL}/rest/v1/vehicles?is_public=eq.true&status=neq.oculto&order=display_order.asc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (sbRes.ok) {
        const data = (await sbRes.json()) as any[];
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Vehicle[] = data.map((v, i) => ({
            id: v.id,
            internal_code: v.internal_id || `LG-EX-0${i + 1}`,
            name: v.name,
            description: v.description,
            image_url: v.image_url || INITIAL_VEHICLES[i % INITIAL_VEHICLES.length].image_url,
            price_cop: Number(v.price_cop) || 0,
            price_usd: Number(v.price_usd) || 0,
            status: v.status === 'agotado' ? 'sold' : v.status === 'consulta' ? 'reserved' : 'available',
            display_order: v.display_order ?? i + 1,
            is_public: v.is_public ?? true,
          }));
          return res.json({ ok: true, data: mapped });
        }
      }
    } catch {}
  }

  const publicVehicles = vehiclesList
    .filter((v) => (v.is_public && v.status !== 'sold' ? true : v.is_public))
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  res.json({ ok: true, data: publicVehicles });
});

app.post('/api/preorder', rateLimiter(20, 60000), async (req: Request, res: Response) => {
  const { fullName, email, phone, age, documentType, documentNumber, message, vehicleIds, termsAccepted } = req.body;

  const cleanFullName = sanitizeText(fullName, 120);
  const cleanEmail = sanitizeText(email, 160).toLowerCase();
  const cleanPhone = sanitizeText(phone, 30);
  const cleanDocNumber = sanitizeText(documentNumber, 40).toUpperCase();
  const cleanMessage = sanitizeText(message, 1000);

  if (!cleanFullName || cleanFullName.length < 3) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { fullName: 'validation.fullName.invalid' } });
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { email: 'validation.email.invalid' } });
  }
  if (!cleanPhone || cleanPhone.length < 7) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { phone: 'validation.phone.invalid' } });
  }
  const ageNum = Number(age);
  if (!age || isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { age: 'validation.age.range' } });
  }
  if (!documentType) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { documentType: 'validation.documentType.invalid' } });
  }
  if (!cleanDocNumber || cleanDocNumber.length < 4) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { documentNumber: 'validation.documentNumber.invalid' } });
  }
  if (!termsAccepted) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { terms: 'validation.terms.required' } });
  }
  if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { vehicles: 'validation.vehicles.required' } });
  }

  // 6-digit cryptographic tracking code
  const codeNum = crypto.randomInt(100000, 999999);
  const trackingCode = String(codeNum);

  // Retrieve names of selected vehicles
  const selectedVehicleObjects = vehiclesList.filter((v) => vehicleIds.includes(v.id));
  const vehicleNames = selectedVehicleObjects.map((v) => v.name);

  const newPreorder = {
    id: `pre-${Date.now()}`,
    trackingCode,
    fullName: cleanFullName,
    email: cleanEmail,
    phone: cleanPhone,
    age: Number(age),
    documentType: sanitizeText(documentType, 10).toUpperCase(),
    documentNumber: cleanDocNumber,
    message: cleanMessage,
    vehicleIds,
    vehicleNames,
    status: 'recibida',
    createdAt: new Date().toISOString(),
  };

  preordersList.unshift(newPreorder);
  saveJSON(PREORDERS_FILE, preordersList);

  // Sync to Supabase PostgreSQL preorders table if available
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const docTypeMapped = newPreorder.documentType === 'PASSPORT' ? 'PAS' : newPreorder.documentType;
      await fetch(`${SUPABASE_URL}/rest/v1/preorders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          full_name: newPreorder.fullName,
          email: newPreorder.email,
          phone: newPreorder.phone,
          age: newPreorder.age,
          document_type: ['CC', 'CE', 'PAS', 'NIT'].includes(docTypeMapped) ? docTypeMapped : 'OTRO',
          document_number: newPreorder.documentNumber,
          selected_vehicle_ids: vehicleIds,
          message: newPreorder.message,
          tracking_code: trackingCode,
          status: 'recibida',
        }),
      });
    } catch (err) {
      console.warn('[Sync] Preorder sync to Supabase notice:', err);
    }
  }

  return res.json({
    ok: true,
    trackingCode,
    fullName: newPreorder.fullName,
    createdAt: newPreorder.createdAt,
  });
});

app.post('/api/pqrs', rateLimiter(20, 60000), async (req: Request, res: Response) => {
  const { requestType, fullName, email, phone, documentType, documentNumber, subject, message, termsAccepted } = req.body;

  const cleanReqType = sanitizeText(requestType, 20).toLowerCase();
  const cleanFullName = sanitizeText(fullName, 120);
  const cleanEmail = sanitizeText(email, 160).toLowerCase();
  const cleanPhone = sanitizeText(phone, 30);
  const cleanSubject = sanitizeText(subject, 180);
  const cleanMessage = sanitizeText(message, 2000);
  const cleanDocNumber = sanitizeText(documentNumber, 40).toUpperCase();

  if (!cleanReqType) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { requestType: 'validation.pqrs.type.invalid' } });
  }
  if (!cleanFullName || cleanFullName.length < 3) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { fullName: 'validation.fullName.invalid' } });
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { email: 'validation.email.invalid' } });
  }
  if (!cleanSubject || cleanSubject.length < 4) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { subject: 'validation.pqrs.subject.invalid' } });
  }
  if (!cleanMessage || cleanMessage.length < 15) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { pqrsMessage: 'validation.pqrs.message.short' } });
  }
  if (!termsAccepted) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { terms: 'validation.terms.required' } });
  }

  const codeNum = crypto.randomInt(100000, 999999);
  const trackingCode = String(codeNum);

  const newPqrs = {
    id: `pqrs-${Date.now()}`,
    trackingCode,
    requestType: cleanReqType,
    fullName: cleanFullName,
    email: cleanEmail,
    phone: cleanPhone,
    documentType: documentType ? sanitizeText(documentType, 10).toUpperCase() : null,
    documentNumber: cleanDocNumber,
    subject: cleanSubject,
    message: cleanMessage,
    status: 'radicado',
    createdAt: new Date().toISOString(),
  };

  pqrsList.unshift(newPqrs);
  saveJSON(PQRS_FILE, pqrsList);

  // Sync to Supabase PostgreSQL pqrs table if available
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const typeMap: Record<string, string> = {
        petition: 'peticion',
        complaint: 'queja',
        claim: 'reclamo',
        suggestion: 'sugerencia',
        peticion: 'peticion',
        queja: 'queja',
        reclamo: 'reclamo',
        sugerencia: 'sugerencia',
      };
      await fetch(`${SUPABASE_URL}/rest/v1/pqrs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          type: typeMap[newPqrs.requestType] || 'peticion',
          full_name: newPqrs.fullName,
          email: newPqrs.email,
          phone: newPqrs.phone,
          document_type: newPqrs.documentType,
          document_number: newPqrs.documentNumber,
          subject: newPqrs.subject,
          message: newPqrs.message,
          tracking_code: trackingCode,
          status: 'radicado',
        }),
      });
    } catch (err) {
      console.warn('[Sync] PQRS sync to Supabase notice:', err);
    }
  }

  return res.json({
    ok: true,
    trackingCode,
    fullName: newPqrs.fullName,
    requestType: newPqrs.requestType,
  });
});

// -----------------------------------------------------------------------------
// ADMIN MANAGEMENT & DASHBOARD API ROUTES
// -----------------------------------------------------------------------------

app.post('/api/admin/login', rateLimiter(10, 60000), async (req: Request, res: Response) => {
  const { email, supabaseToken } = req.body;
  const normalizedEmail = sanitizeText(email, 120).toLowerCase();

  // STRICT REQUIREMENT: Only users with a valid Supabase Auth session can enter!
  if (!supabaseToken || typeof supabaseToken !== 'string') {
    return res.status(401).json({
      ok: false,
      error: 'Acceso denegado: Se requiere una sesión activa y verificada en Supabase Auth.',
    });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'Error de configuración: Variables de conexión a Supabase no configuradas en el entorno.',
    });
  }

  try {
    // 1. Verify token directly with Supabase Auth endpoint
    const sbRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${supabaseToken.trim()}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (!sbRes.ok) {
      return res.status(401).json({
        ok: false,
        error: 'Acceso denegado: El token de sesión no es válido o ha expirado en Supabase Auth.',
      });
    }

    const sbUser = (await sbRes.json()) as any;
    const verifiedEmail = String(sbUser.email || normalizedEmail).trim().toLowerCase();

    if (!sbUser?.id || !verifiedEmail) {
      return res.status(401).json({
        ok: false,
        error: 'Acceso denegado: Usuario no identificado por Supabase.',
      });
    }

    // 2. Strict RBAC check: verify in admin_profiles table via REST API using the user's token
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_profiles?user_id=eq.${sbUser.id}&select=role,is_active`,
      {
        headers: {
          Authorization: `Bearer ${supabaseToken.trim()}`,
          apikey: SUPABASE_ANON_KEY,
        },
      }
    );

    if (!profRes.ok) {
      return res.status(403).json({
        ok: false,
        error: 'Acceso denegado: No se pudo verificar el perfil de administrador en la base de datos.',
      });
    }

    const profiles = (await profRes.json()) as any[];
    if (
      !Array.isArray(profiles) ||
      profiles.length === 0 ||
      !profiles[0].is_active ||
      (profiles[0].role !== 'admin' && profiles[0].role !== 'editor')
    ) {
      return res.status(403).json({
        ok: false,
        error: 'Acceso denegado: La cuenta existe pero no cuenta con privilegios administrativos activos asignados.',
      });
    }

    const userRole = profiles[0].role;
    const sessionToken = `adm_${crypto.randomBytes(32).toString('hex')}`;
    activeAdminSessions.set(sessionToken, {
      userId: sbUser.id,
      email: verifiedEmail,
      role: userRole,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });

    return res.json({
      ok: true,
      token: sessionToken,
      user: {
        role: userRole,
        email: verifiedEmail,
        name: verifiedEmail.split('@')[0],
        supabaseId: sbUser.id,
      },
    });
  } catch (err) {
    console.error('[Admin Auth] Error verifying Supabase token:', err);
    return res.status(500).json({
      ok: false,
      error: 'Error interno de comunicación con el servicio de autenticación.',
    });
  }
});

app.get('/api/admin/stats', requireAdminAuth, (req: Request, res: Response) => {
  const totalPreorders = preordersList.length;
  const totalPqrs = pqrsList.length;
  const totalVehicles = vehiclesList.length;

  // Calculate vehicle demand distribution
  const demandMap: Record<string, number> = {};
  for (const p of preordersList) {
    if (Array.isArray(p.vehicleIds)) {
      for (const vid of p.vehicleIds) {
        demandMap[vid] = (demandMap[vid] || 0) + 1;
      }
    }
  }

  const vehicleStats = vehiclesList.map((v) => ({
    id: v.id,
    name: v.name,
    internal_code: v.internal_code,
    requestsCount: demandMap[v.id] || 0,
    status: v.status,
    price_cop: v.price_cop,
    price_usd: v.price_usd,
  })).sort((a, b) => b.requestsCount - a.requestsCount);

  return res.json({
    ok: true,
    stats: {
      totalPreorders,
      totalPqrs,
      totalVehicles,
      vehicleStats,
      recentPreorders: preordersList.slice(0, 10),
    },
  });
});

app.get('/api/admin/preorders', requireAdminAuth, (_req: Request, res: Response) => {
  return res.json({ ok: true, data: preordersList });
});

app.get('/api/admin/pqrs', requireAdminAuth, (_req: Request, res: Response) => {
  return res.json({ ok: true, data: pqrsList });
});

app.get('/api/admin/vehicles', requireAdminAuth, (_req: Request, res: Response) => {
  return res.json({ ok: true, data: vehiclesList });
});

app.post('/api/admin/vehicles', requireAdminAuth, (req: Request, res: Response) => {
  const { name, description, internal_code, price_cop, price_usd, status, is_public, image_url } = req.body;
  if (!name || !internal_code) {
    return res.status(400).json({ ok: false, error: 'Nombre y código interno son obligatorios' });
  }

  // Strict image format validation (reject rare/malicious extensions and non-image data)
  if (image_url) {
    const imgCheck = isValidImagePayload(image_url);
    if (!imgCheck.valid) {
      return res.status(400).json({ ok: false, error: imgCheck.error });
    }
  }

  const finalImageUrl = image_url || INITIAL_VEHICLES[0].image_url;

  const newVehicle: Vehicle = {
    id: `veh-${Date.now()}`,
    name: String(name).trim(),
    description: String(description || '').trim(),
    internal_code: String(internal_code).trim().toUpperCase(),
    price_cop: Number(price_cop) || 0,
    price_usd: Number(price_usd) || 0,
    status: status || 'available',
    is_public: is_public ?? true,
    display_order: vehiclesList.length + 1,
    image_url: finalImageUrl,
  };

  vehiclesList.push(newVehicle);
  saveJSON(VEHICLES_FILE, vehiclesList);

  return res.json({ ok: true, vehicle: newVehicle });
});

app.put('/api/admin/vehicles/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = vehiclesList.findIndex((v) => v.id === id);
  if (idx === -1) {
    return res.status(404).json({ ok: false, error: 'Vehículo no encontrado' });
  }

  // Strict image format validation if image_url is being updated
  if (req.body.image_url) {
    const imgCheck = isValidImagePayload(req.body.image_url);
    if (!imgCheck.valid) {
      return res.status(400).json({ ok: false, error: imgCheck.error });
    }
  }

  vehiclesList[idx] = {
    ...vehiclesList[idx],
    ...req.body,
    id: vehiclesList[idx].id,
  };
  saveJSON(VEHICLES_FILE, vehiclesList);

  return res.json({ ok: true, vehicle: vehiclesList[idx] });
});

app.delete('/api/admin/vehicles/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  vehiclesList = vehiclesList.filter((v) => v.id !== id);
  saveJSON(VEHICLES_FILE, vehiclesList);
  return res.json({ ok: true });
});

// -----------------------------------------------------------------------------
// VITE SPA MIDDLEWARE & PRODUCTION SERVING
// -----------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Luxury Galaxy] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
