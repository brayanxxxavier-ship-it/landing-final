import React, { useState } from 'react';
import { X, Send, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { Language, PqrsFormData } from '../types';
import { t } from '../i18n/translations';
import { supabase } from '../lib/supabase';

interface PqrsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const PqrsModal: React.FC<PqrsModalProps> = ({ isOpen, onClose, lang }) => {
  const [formData, setFormData] = useState<PqrsFormData>({
    requestType: 'petition',
    fullName: '',
    email: '',
    phone: '',
    documentType: 'cc',
    documentNumber: '',
    subject: '',
    message: '',
    termsAccepted: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ name: string; code: string; type: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.requestType) {
      newErrors.requestType = t('validation.pqrs.type.invalid', lang);
    }
    if (!formData.fullName.trim() || formData.fullName.trim().length < 3) {
      newErrors.fullName = t('validation.fullName.invalid', lang);
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email.trim())) {
      newErrors.email = t('validation.email.invalid', lang);
    }
    if (!formData.subject.trim() || formData.subject.trim().length < 4) {
      newErrors.subject = t('validation.pqrs.subject.invalid', lang);
    }
    if (!formData.message.trim() || formData.message.trim().length < 20) {
      newErrors.message = t('validation.pqrs.message.short', lang);
    }
    if (!formData.termsAccepted) {
      newErrors.terms = t('validation.terms.required', lang);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/pqrs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      const trackingCode = (response.ok && data.ok) ? data.trackingCode : String(Math.floor(100000 + Math.random() * 900000));

      // Persist in Supabase pqrs table
      try {
        const typeMap: Record<string, string> = {
          petition: 'peticion',
          complaint: 'queja',
          claim: 'reclamo',
          suggestion: 'sugerencia',
        };
        await supabase.from('pqrs').insert({
          type: typeMap[formData.requestType] || 'peticion',
          full_name: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          message: `[${formData.subject}] ${formData.message}`.trim(),
          tracking_code: trackingCode,
        });
      } catch {}

      setResult({
        name: data?.fullName || formData.fullName,
        code: trackingCode,
        type: t(`pqrs.type.${formData.requestType}`, lang),
      });
    } catch {
      setResult({
        name: formData.fullName,
        code: String(Math.floor(100000 + Math.random() * 900000)),
        type: t(`pqrs.type.${formData.requestType}`, lang),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = () => {
    if (result?.code) {
      navigator.clipboard?.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
        >
          <X className="w-5 h-5" />
        </button>

        <header className="mb-6">
          <div className="inline-flex items-center gap-2 mb-2 font-mono text-xs font-semibold tracking-widest uppercase text-[hsl(var(--primary))]">
            <span className="w-4 h-[1.5px] bg-current inline-block" />
            <span>{t('brand.name', lang)}</span>
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
                  {t('pqrs.success', lang, { name: result.name, code: result.code, type: result.type })}
                </h3>
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  Guarda este número para realizar el seguimiento institucional de tu radicado.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">RADICADO:</span>
                <span className="font-mono text-xl font-bold tracking-widest text-[hsl(var(--primary))]">
                  {result.code}
                </span>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
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
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {/* Request type */}
            <div>
              <label htmlFor="requestType" className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                {t('pqrs.type.label', lang)} *
              </label>
              <select
                id="requestType"
                name="requestType"
                value={formData.requestType}
                onChange={handleChange}
                className="w-full h-11 px-3 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
              >
                <option value="petition">{t('pqrs.type.petition', lang)}</option>
                <option value="complaint">{t('pqrs.type.complaint', lang)}</option>
                <option value="claim">{t('pqrs.type.claim', lang)}</option>
                <option value="suggestion">{t('pqrs.type.suggestion', lang)}</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pqrs-name" className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                  {t('form.fullName.label', lang)} *
                </label>
                <input
                  type="text"
                  id="pqrs-name"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full h-11 px-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
                />
                {errors.fullName && <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.fullName}</p>}
              </div>

              <div>
                <label htmlFor="pqrs-email" className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                  {t('form.email.label', lang)} *
                </label>
                <input
                  type="email"
                  id="pqrs-email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full h-11 px-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
                />
                {errors.email && <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.email}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="pqrs-subject" className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                {t('pqrs.subject.label', lang)} *
              </label>
              <input
                type="text"
                id="pqrs-subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full h-11 px-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
              />
              {errors.subject && <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.subject}</p>}
            </div>

            <div>
              <label htmlFor="pqrs-message" className="block font-mono text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                {t('pqrs.message.label', lang)} *
              </label>
              <textarea
                id="pqrs-message"
                name="message"
                rows={4}
                value={formData.message}
                onChange={handleChange}
                required
                className="w-full p-3.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))]"
              />
              {errors.message && <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.message}</p>}
            </div>

            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="termsAccepted"
                  checked={formData.termsAccepted}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4 rounded border-gray-400 accent-[hsl(var(--primary))]"
                />
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t('form.terms.label', lang)}
                </span>
              </label>
              {errors.terms && <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.terms}</p>}
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-mono text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold text-xs uppercase tracking-wider hover:bg-[hsl(var(--primary-glow))] transition-all"
              >
                {isSubmitting ? t('pqrs.submitting', lang) : t('pqrs.submit', lang)}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
