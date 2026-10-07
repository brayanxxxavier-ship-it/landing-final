
import React, { useState } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Language, PqrsFormData } from '../types';
import { t } from '../i18n/translations';
import { supabase } from '../lib/supabase';

interface PqrsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

type PqrsResult = {
  name: string;
  code: string;
  type: string;
};

const EMPTY_FORM: PqrsFormData = {
  requestType: 'petition',
  fullName: '',
  email: '',
  phone: '',
  documentType: 'cc',
  documentNumber: '',
  subject: '',
  message: '',
  termsAccepted: false,
};

const MAX_TRACKING_ATTEMPTS = 5;

const generateTrackingCode = (): string => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);

  return String(100000 + (values[0] % 900000));
};

const normalizeDocumentType = (value: string): string => {
  const normalized = value.trim().toUpperCase();

  const map: Record<string, string> = {
    CC: 'CC',
    CE: 'CE',
    PASSPORT: 'PAS',
    PAS: 'PAS',
    NIT: 'NIT',
    OTHER: 'OTRO',
    OTRO: 'OTRO',
  };

  return map[normalized] || normalized;
};

const normalizePqrsType = (
  value: string
): 'peticion' | 'queja' | 'reclamo' | 'sugerencia' => {
  const map: Record<
    string,
    'peticion' | 'queja' | 'reclamo' | 'sugerencia'
  > = {
    petition: 'peticion',
    complaint: 'queja',
    claim: 'reclamo',
    suggestion: 'sugerencia',
  };

  return map[value] || 'peticion';
};

export const PqrsModal: React.FC<PqrsModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const [formData, setFormData] =
    useState<PqrsFormData>(EMPTY_FORM);

  const [errors, setErrors] =
    useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [result, setResult] =
    useState<PqrsResult | null>(null);

  const [copied, setCopied] =
    useState(false);

  if (!isOpen) return null;

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = event.target;

    const checked =
      (event.target as HTMLInputElement).checked;

    setFormData((previous) => ({
      ...previous,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }));

    if (errors[name]) {
      setErrors((previous) => {
        const next = { ...previous };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.requestType) {
      newErrors.requestType = t(
        'validation.pqrs.type.invalid',
        lang
      );
    }

    if (
      !formData.fullName.trim() ||
      formData.fullName.trim().length < 3
    ) {
      newErrors.fullName = t(
        'validation.fullName.invalid',
        lang
      );
    }

    if (
      !formData.email.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
        formData.email.trim()
      )
    ) {
      newErrors.email = t(
        'validation.email.invalid',
        lang
      );
    }

    if (
      !formData.phone.trim() ||
      formData.phone.trim().length < 7
    ) {
      newErrors.phone = t(
        'validation.phone.invalid',
        lang
      );
    }

    if (!formData.documentType.trim()) {
      newErrors.documentType = t(
        'validation.documentType.invalid',
        lang
      );
    }

    if (
      !formData.documentNumber.trim() ||
      formData.documentNumber.trim().length < 4
    ) {
      newErrors.documentNumber = t(
        'validation.documentNumber.invalid',
        lang
      );
    }

    if (
      !formData.subject.trim() ||
      formData.subject.trim().length < 4
    ) {
      newErrors.subject = t(
        'validation.pqrs.subject.invalid',
        lang
      );
    }

    if (
      !formData.message.trim() ||
      formData.message.trim().length < 20
    ) {
      newErrors.message = t(
        'validation.pqrs.message.short',
        lang
      );
    }

    if (!formData.termsAccepted) {
      newErrors.terms = t(
        'validation.terms.required',
        lang
      );
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const insertPqrs = async (): Promise<string> => {
    const payload = {
      type: normalizePqrsType(
        formData.requestType
      ),

      full_name:
        formData.fullName.trim(),

      email:
        formData.email.trim().toLowerCase(),

      phone:
        formData.phone.trim(),

      document_type:
        normalizeDocumentType(
          formData.documentType
        ),

      document_number:
        formData.documentNumber
          .trim()
          .toUpperCase(),

      subject:
        formData.subject.trim(),

      message:
        formData.message.trim(),
    };

    for (
      let attempt = 1;
      attempt <= MAX_TRACKING_ATTEMPTS;
      attempt++
    ) {
      const trackingCode =
        generateTrackingCode();

      const { error } = await supabase
        .from('pqrs')
        .insert({
          ...payload,
          tracking_code: trackingCode,
        });

      if (!error) {
        return trackingCode;
      }

      /*
       * 23505 = unique_violation.
       * Solo reintentamos si el código chocó
       * con otro registro existente.
       */
      if (
        error.code === '23505' &&
        attempt < MAX_TRACKING_ATTEMPTS
      ) {
        continue;
      }

      console.error(
        '[PQRS] Error al registrar la solicitud:',
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );

      throw error;
    }

    throw new Error(
      'No fue posible generar un código de radicado único.'
    );
  };

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (isSubmitting) return;

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      /*
       * ÚNICO flujo de persistencia:
       *
       * React
       *   ↓
       * Supabase client
       *   ↓
       * RLS
       *   ↓
       * PostgreSQL
       */
      const trackingCode =
        await insertPqrs();

      /*
       * El éxito solamente existe después
       * de que Supabase confirmó el INSERT.
       */
      setResult({
        name:
          formData.fullName.trim(),

        code: trackingCode,

        type: t(
          `pqrs.type.${formData.requestType}`,
          lang
        ),
      });

      setErrors({});
    } catch (error) {
      console.error(
        '[PQRS] La solicitud NO pudo registrarse:',
        error
      );

      /*
       * IMPORTANTE:
       * No generamos un código falso.
       * No mostramos éxito.
       * No limpiamos los datos.
       */
      setErrors((previous) => ({
        ...previous,
        submit:
          'No fue posible registrar la solicitud. Tus datos siguen en el formulario. Intenta nuevamente.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!result?.code) return;

    try {
      await navigator.clipboard?.writeText(
        result.code
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        '[PQRS] No se pudo copiar el código:',
        error
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[hsl(var(--background)/0.8)] backdrop-blur-md overflow-y-auto">

      <div className="relative w-full max-w-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">

        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          title="Cerrar"
          aria-label="Cerrar formulario PQRS"
        >
          <X className="w-5 h-5" />
        </button>

        <header className="mb-6">
          <div className="inline-flex items-center gap-2 mb-2 font-mono text-xs font-semibold tracking-widest uppercase text-[hsl(var(--primary))]">
            <span className="w-4 h-[1.5px] bg-current inline-block" />

            <span>
              {t('brand.name', lang)}
            </span>
          </div>

          <h2 className="font-display font-bold text-2xl sm:text-3xl text-[hsl(var(--foreground))]">
            {t('pqrs.title', lang)}
          </h2>

          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            {t('pqrs.lede', lang)}
          </p>
        </header>

        {result ? (
          <div className="p-6 rounded-xl border border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.12)] flex flex-col gap-4">

            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-[hsl(var(--success))] shrink-0 mt-0.5" />

              <div>
                <h3 className="font-display font-bold text-lg text-[hsl(var(--success))]">
                  {t(
                    'pqrs.success',
                    lang,
                    {
                      name: result.name,
                      code: result.code,
                      type: result.type,
                    }
                  )}
                </h3>

                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  Guarda este número para realizar el seguimiento institucional de tu radicado.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]">

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  RADICADO:
                </span>

                <span className="font-mono text-xl font-bold tracking-widest text-[hsl(var(--primary))]">
                  {result.code}
                </span>
              </div>

              <button
                type="button"
                onClick={copyCode}
                className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                aria-label="Copiar código de radicado"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full py-2.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold text-xs uppercase tracking-wider"
            >
              Finalizar
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-4"
          >

            <div>
              <label
                htmlFor="requestType"
                className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1"
              >
                {t('pqrs.type.label', lang)} *
              </label>

              <select
                id="requestType"
                name="requestType"
                value={formData.requestType}
                onChange={handleChange}
                className="w-full h-11 px-3 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
              >
                <option value="petition">
                  {t('pqrs.type.petition', lang)}
                </option>

                <option value="complaint">
                  {t('pqrs.type.complaint', lang)}
                </option>

                <option value="claim">
                  {t('pqrs.type.claim', lang)}
                </option>

                <option value="suggestion">
                  {t('pqrs.type.suggestion', lang)}
                </option>
              </select>

              {errors.requestType && (
                <p className="mt-1 text-xs text-[hsl(var(--destructive))]">
                  {errors.requestType}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <label
                  htmlFor="pqrs-name"
                  className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1"
                >
                  {t('form.fullName.label', lang)} *
                </label>

                <input
                  type="text"
                  id="pqrs-name"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  minLength={3}
                  maxLength={120}
                  autoComplete="name"
                  className="w-full h-11 px-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
                  aria-invalid={Boolean(errors.fullName)}
                />

                {errors.fullName && (
                  <p className="mt-1 text-xs text-[hsl(var(--destructive))]">
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="pqrs-email"
                  className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1"
                >
                  {t('form.email.label', lang)} *
                </label>

                <input
                  type="email"
                  id="pqrs-email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  maxLength={160}
                  autoComplete="email"
                  className="w-full h-11 px-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
                  aria-invalid={Boolean(errors.email)}
                />

                {errors.email && (
                  <p className="mt-1 text-xs text-[hsl(var(--destructive))]">
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div>
                <label
                  htmlFor="pqrs-phone"
                  className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1"
                >
                  {t('form.phone.label', lang)} *
                </label>

                <input
                  type="tel"
                  id="pqrs-phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  maxLength={24}
                  autoComplete="tel"
                  placeholder="+57 300 000 0000"
                  className="w-full h-11 px-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
                  aria-invalid={Boolean(errors.phone)}
                />

                {errors.phone && (
                  <p className="mt-1 text-xs text-[hsl(var(--destructive))]">
                    {errors.phone}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="pqrs-documentType"
                  className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1"
                >
                  {t(
                    'form.documentType.label',
                    lang
                  )} *
                </label>

                <select
                  id="pqrs-documentType"
                  name="documentType"
                  value={formData.documentType}
                  onChange={handleChange}
                  required
                  className="w-full h-11 px-3 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
                  aria-invalid={Boolean(
                    errors.documentType
                  )}
                >
                  <option value="cc">
                    {t(
                      'form.documentType.cc',
                      lang
                    )}
                  </option>

                  <option value="ce">
                    {t(
                      'form.documentType.ce',
                      lang
                    )}
                  </option>

                  <option value="passport">
                    {t(
                      'form.documentType.passport',
                      lang
                    )}
                  </option>

                  <option value="nit">
                    {t(
                      'form.documentType.nit',
                      lang
                    )}
                  </option>

                  <option value="other">
                    {t(
                      'form.documentType.other',
                      lang
                    )}
                  </option>
                </select>

                {errors.documentType && (
                  <p className="mt-1 text-xs text-[hsl(var(--destructive))]">
                    {errors.documentType}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="pqrs-documentNumber"
                className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1"
              >
                {t(
                  'form.documentNumber.label',
                  lang
                )} *
              </label>

              <input
                type="text"
                id="pqrs-documentNumber"
                name="documentNumber"
                value={formData.documentNumber}
                onChange={handleChange}
                required
                minLength={4}
                maxLength={20}
                autoComplete="off"
                className="w-full h-11 px-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
                aria-invalid={Boolean(
                  errors.documentNumber
                )}
              />

              {errors.documentNumber && (
                <p className="mt-1 text-xs text-[hsl(var(--destructive))]">
                  {errors.documentNumber}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="pqrs-subject"
                className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1"
              >
                {t(
                  'pqrs.subject.label',
                  lang
                )} *
              </label>

              <input
                type="text"
                id="pqrs-subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                minLength={4}
                maxLength={180}
                className="w-full h-11 px-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
                aria-invalid={Boolean(
                  errors.subject
                )}
              />

              {errors.subject && (
                <p className="mt-1 text-xs text-[hsl(var(--destructive))]">
                  {errors.subject}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="pqrs-message"
                className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1"
              >
                {t(
                  'pqrs.message.label',
                  lang
                )} *
              </label>

              <textarea
                id="pqrs-message"
                name="message"
                rows={4}
                minLength={20}
                maxLength={2000}
                value={formData.message}
                onChange={handleChange}
                required
                className="w-full p-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
                aria-invalid={Boolean(
                  errors.message
                )}
              />

              {errors.message && (
                <p className="mt-1 text-xs text-[hsl(var(--destructive))]">
                  {errors.message}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="termsAccepted"
                  checked={formData.termsAccepted}
                  onChange={handleChange}
                  required
                  className="mt-1 w-4 h-4 rounded border-gray-400"
                  aria-invalid={Boolean(
                    errors.terms
                  )}
                />

                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t(
                    'form.terms.label',
                    lang
                  )}
                </span>
              </label>

              {errors.terms && (
                <p className="mt-1 text-xs text-[hsl(var(--destructive))]">
                  {errors.terms}
                </p>
              )}
            </div>

            {errors.submit && (
              <div
                className="p-3 rounded-lg border border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.08)] text-sm text-[hsl(var(--destructive))] flex items-start gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

                <span>
                  {errors.submit}
                </span>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-3">

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-mono text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold text-xs uppercase tracking-wider hover:bg-[hsl(var(--primary-glow))] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Send className="w-4 h-4 animate-pulse" />
                    {t(
                      'pqrs.submitting',
                      lang
                    )}
                  </span>
                ) : (
                  t(
                    'pqrs.submit',
                    lang
                  )
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

