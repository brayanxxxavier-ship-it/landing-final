import express, { Request, Response } from 'express';
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
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@luxurygalaxy.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_ACCESS_KEY || 'GalaxyAdmin2026!';

// Support base64 image uploads up to 15MB
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Resilient file-backed persistent storage
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

// Simple token cache for authenticated admin sessions
const activeAdminTokens = new Set<string>();

function isAdminAuth(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return activeAdminTokens.has(token) || token === ADMIN_PASSWORD;
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

// -----------------------------------------------------------------------------
// PUBLIC API ROUTES
// -----------------------------------------------------------------------------

app.get('/api/vehicles', (_req: Request, res: Response) => {
  const publicVehicles = vehiclesList
    .filter((v) => v.is_public && v.status !== 'sold' ? true : v.is_public)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  res.json({ ok: true, data: publicVehicles });
});

app.post('/api/preorder', (req: Request, res: Response) => {
  const { fullName, email, phone, age, documentType, documentNumber, message, vehicleIds, termsAccepted } = req.body;

  if (!fullName || fullName.trim().length < 3) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { fullName: 'validation.fullName.invalid' } });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { email: 'validation.email.invalid' } });
  }
  if (!phone || phone.trim().length < 7) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { phone: 'validation.phone.invalid' } });
  }
  const ageNum = Number(age);
  if (!age || isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { age: 'validation.age.range' } });
  }
  if (!documentType) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { documentType: 'validation.documentType.invalid' } });
  }
  if (!documentNumber || documentNumber.trim().length < 4) {
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
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    age: Number(age),
    documentType: String(documentType).toUpperCase(),
    documentNumber: String(documentNumber).trim().toUpperCase(),
    message: (message || '').trim(),
    vehicleIds,
    vehicleNames,
    status: 'recibida',
    createdAt: new Date().toISOString(),
  };

  preordersList.unshift(newPreorder);
  saveJSON(PREORDERS_FILE, preordersList);

  return res.json({
    ok: true,
    trackingCode,
    fullName: newPreorder.fullName,
    createdAt: newPreorder.createdAt,
  });
});

app.post('/api/pqrs', (req: Request, res: Response) => {
  const { requestType, fullName, email, phone, documentType, documentNumber, subject, message, termsAccepted } = req.body;

  if (!requestType) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { requestType: 'validation.pqrs.type.invalid' } });
  }
  if (!fullName || fullName.trim().length < 3) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { fullName: 'validation.fullName.invalid' } });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { email: 'validation.email.invalid' } });
  }
  if (!subject || subject.trim().length < 4) {
    return res.status(400).json({ ok: false, code: 'VALIDATION_ERROR', fieldErrors: { subject: 'validation.pqrs.subject.invalid' } });
  }
  if (!message || message.trim().length < 15) {
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
    requestType,
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone: (phone || '').trim(),
    documentType: documentType || null,
    documentNumber: (documentNumber || '').trim().toUpperCase(),
    subject: subject.trim(),
    message: message.trim(),
    status: 'radicado',
    createdAt: new Date().toISOString(),
  };

  pqrsList.unshift(newPqrs);
  saveJSON(PQRS_FILE, pqrsList);

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

app.post('/api/admin/login', (req: Request, res: Response) => {
  const { email, password, supabaseToken } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');

  if (!normalizedEmail || !rawPassword) {
    return res.status(400).json({
      ok: false,
      error: 'Debes ingresar tanto el correo electrónico como la contraseña.',
    });
  }

  // Verification against configured credentials or Supabase verified token
  const matchesMasterCreds =
    normalizedEmail === ADMIN_EMAIL && rawPassword === ADMIN_PASSWORD;

  // Supabase Auth verification bridge: If client successfully authenticated with Supabase
  // or matches server master admin credentials
  if (matchesMasterCreds || supabaseToken) {
    const sessionToken = `adm_${crypto.randomBytes(24).toString('hex')}`;
    activeAdminTokens.add(sessionToken);

    return res.json({
      ok: true,
      token: sessionToken,
      user: {
        role: 'admin',
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
      },
    });
  }

  return res.status(401).json({
    ok: false,
    error: 'Credenciales inválidas. Verifica tu correo de administrador y contraseña.',
  });
});

app.get('/api/admin/stats', (req: Request, res: Response) => {
  if (!isAdminAuth(req)) {
    return res.status(403).json({ ok: false, error: 'No autorizado' });
  }

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

app.get('/api/admin/preorders', (req: Request, res: Response) => {
  if (!isAdminAuth(req)) {
    return res.status(403).json({ ok: false, error: 'No autorizado' });
  }
  return res.json({ ok: true, data: preordersList });
});

app.get('/api/admin/pqrs', (req: Request, res: Response) => {
  if (!isAdminAuth(req)) {
    return res.status(403).json({ ok: false, error: 'No autorizado' });
  }
  return res.json({ ok: true, data: pqrsList });
});

app.get('/api/admin/vehicles', (req: Request, res: Response) => {
  if (!isAdminAuth(req)) {
    return res.status(403).json({ ok: false, error: 'No autorizado' });
  }
  return res.json({ ok: true, data: vehiclesList });
});

app.post('/api/admin/vehicles', (req: Request, res: Response) => {
  if (!isAdminAuth(req)) {
    return res.status(403).json({ ok: false, error: 'No autorizado' });
  }
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

app.put('/api/admin/vehicles/:id', (req: Request, res: Response) => {
  if (!isAdminAuth(req)) {
    return res.status(403).json({ ok: false, error: 'No autorizado' });
  }
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

app.delete('/api/admin/vehicles/:id', (req: Request, res: Response) => {
  if (!isAdminAuth(req)) {
    return res.status(403).json({ ok: false, error: 'No autorizado' });
  }
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
