import React, { useState, useEffect } from 'react';
import { Vehicle, Language, PreorderFormData } from '../types';
import { t } from '../i18n/translations';
import { supabase } from '../lib/supabase';
import { ArrowUpRight, AlertCircle, CheckCircle2, Car } from 'lucide-react';

interface PreorderFormProps {
  vehicles: Vehicle[];
  selectedVehicleIds: string[];
  onRemoveVehicle: (id: string) => void;
  onClearSelection: () => void;
  lang: Language;
}

export const PreorderForm: React.FC<PreorderFormProps> = ({
  vehicles,
  selectedVehicleIds,
  onClearSelection,
  lang,
}) => {
  const selectedVehicles = vehicles.filter((v) => selectedVehicleIds.includes(v.id));

  const [formData, setFormData] = useState<PreorderFormData>({
    fullName: '',
    email: '',
    phone: '',
    age: '',
    documentType: '',
    documentNumber: '',
    message: '',
    termsAccepted: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ state: 'success' | 'error'; text: string; code?: string; subtext?: string } | null>(null);
  const [autosaveText, setAutosaveText] = useState<string>('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lg-preorder-draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({
          ...prev,
          fullName: parsed.fullName || '',
          email: parsed.email || '',
          phone: parsed.phone || '',
          age: parsed.age || '',
          documentType: parsed.documentType || '',
          message: parsed.message || '',
        }));
        setAutosaveText(t('form.autosave.restored', lang));
      }
    } catch {}
  }, [lang]);

  const saveDraft = (data: PreorderFormData) => {
    try {
      const draft = {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        age: data.age,
        documentType: data.documentType,
        message: data.message,
      };
      localStorage.setItem('lg-preorder-draft', JSON.stringify(draft));
      setAutosaveText(t('form.autosave.saved', lang));
    } catch {}
  };

  const validateField = (name: string, value: any): string => {
    let error = '';
    const str = String(value || '').trim();

    if (name === 'fullName') {
      if (!str || str.length < 3) error = t('validation.fullName.invalid', lang);
    } else if (name === 'email') {
      if (!str || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str)) error = t('validation.email.invalid', lang);
    } else if (name === 'phone') {
      if (!str || str.length < 7) error = t('validation.phone.invalid', lang);
    } else if (name === 'age') {
      const num = Number(value);
      if (!value || isNaN(num) || num < 18 || num > 120) error = t('validation.age.range', lang);
    } else if (name === 'documentType') {
      if (!str) error = t('validation.documentType.invalid', lang);
    } else if (name === 'documentNumber') {
      if (!str || str.length < 4) error = t('validation.documentNumber.invalid', lang);
    } else if (name === 'termsAccepted') {
      if (!value) error = t('validation.terms.required', lang);
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[name] = error;
      } else {
        delete next[name];
      }
      return next;
    });

    return error;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setTouchedFields((prev) => ({ ...prev, [name]: true }));
    validateField(name, type === 'checkbox' ? checked : value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    const updated = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    };

    setFormData(updated);

    if (errors[name]) {
      validateField(name, type === 'checkbox' ? checked : value);
    }

    if (type !== 'checkbox' && name !== 'documentNumber') {
      saveDraft(updated);
    }
  };

  const handleForgetDraft = () => {
    try {
      localStorage.removeItem('lg-preorder-draft');
    } catch {}

    setFormData({
      fullName: '',
      email: '',
      phone: '',
      age: '',
      documentType: '',
      documentNumber: '',
      message: '',
      termsAccepted: false,
    });
    setErrors({});
    setTouchedFields({});
    onClearSelection();
    setAutosaveText(t('form.autosave.cleared', lang));
    setStatusMessage(null);
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};

    const errName = validateField('fullName', formData.fullName);
    if (errName) newErrors.fullName = errName;

    const errEmail = validateField('email', formData.email);
    if (errEmail) newErrors.email = errEmail;

    const errPhone = validateField('phone', formData.phone);
    if (errPhone) newErrors.phone = errPhone;

    const errAge = validateField('age', formData.age);
    if (errAge) newErrors.age = errAge;

    const errDocType = validateField('documentType', formData.documentType);
    if (errDocType) newErrors.documentType = errDocType;

    const errDocNum = validateField('documentNumber', formData.documentNumber);
    if (errDocNum) newErrors.documentNumber = errDocNum;

    const errTerms = validateField('termsAccepted', formData.termsAccepted);
    if (errTerms) newErrors.terms = errTerms;

    if (selectedVehicleIds.length === 0) {
      newErrors.vehicles = t('validation.vehicles.required', lang);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!validateAll()) {
      setStatusMessage({ state: 'error', text: 'Revisa los campos marcados en rojo antes de enviar.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/preorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          vehicleIds: selectedVehicleIds,
        }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        // Try inserting into Supabase if accessible
        try {
          await supabase.from('preorders').insert({
            full_name: (data.fullName || formData.fullName).trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim(),
            age: Number(formData.age),
            document_type: formData.documentType.toUpperCase() === 'PASSPORT' ? 'PAS' : formData.documentType.toUpperCase(),
            document_number: formData.documentNumber.trim().toUpperCase(),
            selected_vehicle_ids: selectedVehicleIds,
            message: formData.message.trim(),
            tracking_code: data.trackingCode,
          });
        } catch {}

        setStatusMessage({
          state: 'success',
          text: `${data.fullName || formData.fullName}, solicitud de preventa recibida.`,
          code: data.trackingCode,
          subtext: 'Pronto tendrás respuestas.',
        });

        try {
          localStorage.removeItem('lg-preorder-draft');
        } catch {}

        onClearSelection();
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          age: '',
          documentType: '',
          documentNumber: '',
          message: '',
          termsAccepted: false,
        });
        setTouchedFields({});
        setAutosaveText('');
      } else {
        if (data.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.fieldErrors)) {
            mapped[k] = t(v as string, lang);
          }
          setErrors(mapped);
        }
        setStatusMessage({ state: 'error', text: 'Revisa los campos marcados en rojo antes de continuar.' });
      }
    } catch {
      setStatusMessage({
        state: 'error',
        text: 'No fue posible conectar con el servidor para registrar tu solicitud. Por favor verifica tu conexión a internet o intenta nuevamente más tarde.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormLocked = selectedVehicleIds.length === 0;

  return (
    <section className="section section--form" id="preorder" aria-labelledby="preorder-title">
      <div className="container form-layout">
        <header className="section__head section__head--form">
          <p className="eyebrow">{t('form.eyebrow', lang)}</p>
          <h2 className="section__title" id="preorder-title">
            {t('form.title', lang)}
          </h2>
          <p className="section__lede">{t('form.lede', lang)}</p>
        </header>

        {/* Aside: Selected Vehicles List */}
        <div className="form-aside">
          <h3 className="form-aside__title">{t('form.selection.title', lang)}</h3>
          {selectedVehicles.length > 0 ? (
            <ul className="selection-list" id="form-selection">
              {selectedVehicles.map((vehicle) => (
                <li key={vehicle.id} className="selection-list__item">
                  <span>{vehicle.name}</span>
                  <span className="selection-list__price">{vehicle.internal_code}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="form-aside__empty" id="form-selection-empty">
              {t('form.selection.empty', lang)}
            </p>
          )}
          <p className="form-aside__note">{t('form.selection.note', lang)}</p>
        </div>

        {/* LOCKED STATE BANNER: IF NO VEHICLES SELECTED */}
        {isFormLocked ? (
          <div className="form p-8 rounded-2xl border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--card))] shadow-lg flex flex-col items-center text-center justify-center my-auto min-h-[360px]">
            <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))] flex items-center justify-center mb-4">
              <Car className="w-7 h-7" />
            </div>
            <h3 className="font-display font-bold text-xl text-[hsl(var(--foreground))] mb-2">
              Selecciona tus vehículos para activar la preventa
            </h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mb-6 leading-relaxed">
              El formulario se activa automáticamente cuando marcas al menos una unidad del catálogo. Explora las unidades disponibles y resérvalas con trazabilidad directa.
            </p>
            <a
              href="#catalogue"
              className="btn btn--primary px-6 py-3 text-sm shadow-glow flex items-center gap-2 cursor-pointer font-mono uppercase"
            >
              <span>Ir al Catálogo de Vehículos</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        ) : (
          /* ACTIVE PREORDER FORM */
          <form className="form" id="preorder-form" onSubmit={handleSubmit} noValidate>
            <fieldset className="form__group">
              <legend className="form__legend">{t('form.legend.identity', lang)}</legend>

              {/* Full Name */}
              <div className={`field ${errors.fullName ? 'has-error' : ''}`}>
                <label className="field__label" htmlFor="fullName">
                  {t('form.fullName.label', lang)}
                </label>
                <input
                  className={`field__input ${errors.fullName ? 'is-invalid border-[hsl(var(--destructive))]' : ''}`}
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  minLength={3}
                  maxLength={120}
                  value={formData.fullName}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                />
                {errors.fullName && (
                  <p className="field__error" id="fullName-error">
                    {errors.fullName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className={`field ${errors.email ? 'has-error' : ''}`}>
                <label className="field__label" htmlFor="email">
                  {t('form.email.label', lang)}
                </label>
                <input
                  className={`field__input ${errors.email ? 'is-invalid border-[hsl(var(--destructive))]' : ''}`}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={160}
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <p className="field__error" id="email-error">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className={`field ${errors.phone ? 'has-error' : ''}`}>
                <label className="field__label" htmlFor="phone">
                  {t('form.phone.label', lang)}
                </label>
                <input
                  className={`field__input ${errors.phone ? 'is-invalid border-[hsl(var(--destructive))]' : ''}`}
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={24}
                  placeholder="+57 300 000 0000"
                  value={formData.phone}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? 'phone-error' : undefined}
                />
                {errors.phone && (
                  <p className="field__error" id="phone-error">
                    {errors.phone}
                  </p>
                )}
              </div>

              {/* Age */}
              <div className={`field ${errors.age ? 'has-error' : ''}`}>
                <label className="field__label" htmlFor="age">
                  {t('form.age.label', lang)}
                </label>
                <input
                  className={`field__input ${errors.age ? 'is-invalid border-[hsl(var(--destructive))]' : ''}`}
                  id="age"
                  name="age"
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={100}
                  step={1}
                  required
                  value={formData.age}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(errors.age)}
                  aria-describedby={errors.age ? 'age-error' : undefined}
                />
                {errors.age && (
                  <p className="field__error" id="age-error">
                    {errors.age}
                  </p>
                )}
              </div>
            </fieldset>

            {/* Document Group */}
            <fieldset className="form__group">
              <legend className="form__legend">{t('form.legend.document', lang)}</legend>

              <div className="field field--split">
                <div className={`field__half ${errors.documentType ? 'has-error' : ''}`}>
                  <label className="field__label" htmlFor="documentType">
                    {t('form.documentType.label', lang)}
                  </label>
                  <select
                    className={`field__input ${errors.documentType ? 'is-invalid border-[hsl(var(--destructive))]' : ''}`}
                    id="documentType"
                    name="documentType"
                    required
                    value={formData.documentType}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    aria-invalid={Boolean(errors.documentType)}
                    aria-describedby={errors.documentType ? 'documentType-error' : undefined}
                  >
                    <option value="">{t('form.documentType.placeholder', lang)}</option>
                    <option value="cc">{t('form.documentType.cc', lang)}</option>
                    <option value="ce">{t('form.documentType.ce', lang)}</option>
                    <option value="passport">{t('form.documentType.passport', lang)}</option>
                    <option value="nit">{t('form.documentType.nit', lang)}</option>
                    <option value="other">{t('form.documentType.other', lang)}</option>
                  </select>
                  {errors.documentType && (
                    <p className="field__error" id="documentType-error">
                      {errors.documentType}
                    </p>
                  )}
                </div>

                <div className={`field__half ${errors.documentNumber ? 'has-error' : ''}`}>
                  <label className="field__label" htmlFor="documentNumber">
                    {t('form.documentNumber.label', lang)}
                  </label>
                  <input
                    className={`field__input ${errors.documentNumber ? 'is-invalid border-[hsl(var(--destructive))]' : ''}`}
                    id="documentNumber"
                    name="documentNumber"
                    type="text"
                    required
                    minLength={4}
                    maxLength={20}
                    autoComplete="off"
                    value={formData.documentNumber}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    aria-invalid={Boolean(errors.documentNumber)}
                    aria-describedby={errors.documentNumber ? 'documentNumber-error' : undefined}
                  />
                  <p className="field__hint" id="form-documentNote">
                    {t('form.documentNumber.hint', lang)}
                  </p>
                  {errors.documentNumber && (
                    <p className="field__error" id="documentNumber-error">
                      {errors.documentNumber}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* Request Group */}
            <fieldset className="form__group">
              <legend className="form__legend">{t('form.legend.request', lang)}</legend>

              <div className="field">
                <label className="field__label" htmlFor="message">
                  {t('form.message.label', lang)}
                </label>
                <textarea
                  className="field__input field__input--area"
                  id="message"
                  name="message"
                  rows={4}
                  maxLength={600}
                  value={formData.message}
                  onChange={handleInputChange}
                />
                <p className="field__hint" id="message-counter">
                  {t('form.message.hint', lang)}
                </p>
              </div>

              {/* Terms Checkbox */}
              <div className={`field field--check ${errors.terms ? 'has-error' : ''}`}>
                <input
                  className="check__input"
                  id="terms"
                  name="termsAccepted"
                  type="checkbox"
                  required
                  checked={formData.termsAccepted}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(errors.terms)}
                  aria-describedby={errors.terms ? 'terms-error' : undefined}
                />
                <label className="check__label" htmlFor="terms">
                  {t('form.terms.label', lang)}
                </label>
                {errors.terms && (
                  <p className="field__error" id="terms-error">
                    {errors.terms}
                  </p>
                )}
              </div>

              <div className="form__actions">
                <button
                  className="btn btn--primary cursor-pointer shadow-glow"
                  type="submit"
                  id="preorder-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('form.submitting', lang) : t('form.submit', lang)}
                </button>
                <button
                  className="btn btn--ghost btn--sm cursor-pointer"
                  type="button"
                  id="preorder-forget"
                  onClick={handleForgetDraft}
                >
                  {t('form.forget', lang)}
                </button>
              </div>

              {/* Status Message Display */}
              {statusMessage && (
                <div
                  className={`form__status p-4 rounded-xl border mt-4 text-sm font-mono flex flex-col gap-1 ${
                    statusMessage.state === 'success'
                      ? 'bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.4)] text-[hsl(var(--foreground))] shadow-[0_0_24px_hsl(var(--primary)/0.25)]'
                      : 'bg-[hsl(var(--destructive)/0.12)] border-[hsl(var(--destructive)/0.4)] text-[hsl(var(--destructive))]'
                  }`}
                  data-state={statusMessage.state}
                  role="status"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {statusMessage.state === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-[hsl(var(--primary))]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[hsl(var(--destructive))]" />
                    )}
                    <span>{statusMessage.text}</span>
                  </div>
                  {statusMessage.code && (
                    <p className="font-bold text-[hsl(var(--primary))] text-base">
                      Código: {statusMessage.code}
                    </p>
                  )}
                  {statusMessage.subtext && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {statusMessage.subtext}
                    </p>
                  )}
                </div>
              )}

              {autosaveText && (
                <p className="form__autosave" id="preorder-autosave" role="status">
                  {autosaveText}
                </p>
              )}
            </fieldset>
          </form>
        )}
      </div>
    </section>
  );
};
