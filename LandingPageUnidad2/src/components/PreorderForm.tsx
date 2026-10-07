
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

type StatusMessage = {
  state: 'success' | 'error';
  text: string;
  code?: string;
  subtext?: string;
};

const EMPTY_FORM: PreorderFormData = {
  fullName: '',
  email: '',
  phone: '',
  age: '',
  documentType: '',
  documentNumber: '',
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

export const PreorderForm: React.FC<PreorderFormProps> = ({
  vehicles,
  selectedVehicleIds,
  onClearSelection,
  lang,
}) => {
  const selectedVehicles = vehicles.filter((vehicle) =>
    selectedVehicleIds.includes(vehicle.id)
  );

  const [formData, setFormData] = useState<PreorderFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] =
    useState<StatusMessage | null>(null);
  const [autosaveText, setAutosaveText] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lg-preorder-draft');

      if (!saved) return;

      const parsed = JSON.parse(saved);

      setFormData((previous) => ({
        ...previous,
        fullName: parsed.fullName || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        age: parsed.age || '',
        documentType: parsed.documentType || '',
        documentNumber: '',
        message: parsed.message || '',
      }));

      setAutosaveText(t('form.autosave.restored', lang));
    } catch (error) {
      console.error('[Preorder] No se pudo restaurar el borrador:', error);
    }
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

      localStorage.setItem(
        'lg-preorder-draft',
        JSON.stringify(draft)
      );

      setAutosaveText(t('form.autosave.saved', lang));
    } catch (error) {
      console.error('[Preorder] No se pudo guardar el borrador:', error);
    }
  };

  const validateField = (name: string, value: unknown): string => {
    const str = String(value ?? '').trim();
    let error = '';

    switch (name) {
      case 'fullName':
        if (!str || str.length < 3) {
          error = t('validation.fullName.invalid', lang);
        }
        break;

      case 'email':
        if (
          !str ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str)
        ) {
          error = t('validation.email.invalid', lang);
        }
        break;

      case 'phone':
        if (!str || str.length < 7) {
          error = t('validation.phone.invalid', lang);
        }
        break;

      case 'age': {
        const age = Number(value);

        if (
          !str ||
          Number.isNaN(age) ||
          !Number.isInteger(age) ||
          age < 18 ||
          age > 120
        ) {
          error = t('validation.age.range', lang);
        }

        break;
      }

      case 'documentType':
        if (!str) {
          error = t('validation.documentType.invalid', lang);
        }
        break;

      case 'documentNumber':
        if (!str || str.length < 4) {
          error = t('validation.documentNumber.invalid', lang);
        }
        break;

      case 'termsAccepted':
        if (value !== true) {
          error = t('validation.terms.required', lang);
        }
        break;

      default:
        break;
    }

    setErrors((previous) => {
      const next = { ...previous };

      if (error) {
        next[name] = error;
      } else {
        delete next[name];
      }

      return next;
    });

    return error;
  };

  const handleBlur = (
    event: React.FocusEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = event.target;

    const checked =
      (event.target as HTMLInputElement).checked;

    setTouchedFields((previous) => ({
      ...previous,
      [name]: true,
    }));

    validateField(
      name,
      type === 'checkbox' ? checked : value
    );
  };

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = event.target;

    const checked =
      (event.target as HTMLInputElement).checked;

    const updated: PreorderFormData = {
      ...formData,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    };

    setFormData(updated);

    if (errors[name]) {
      validateField(
        name,
        type === 'checkbox' ? checked : value
      );
    }

    if (
      type !== 'checkbox' &&
      name !== 'documentNumber'
    ) {
      saveDraft(updated);
    }
  };

  const handleForgetDraft = () => {
    try {
      localStorage.removeItem('lg-preorder-draft');
    } catch (error) {
      console.error('[Preorder] No se pudo eliminar el borrador:', error);
    }

    setFormData(EMPTY_FORM);
    setErrors({});
    setTouchedFields({});
    setStatusMessage(null);
    setAutosaveText(t('form.autosave.cleared', lang));

    onClearSelection();
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};

    const fields: Array<keyof PreorderFormData> = [
      'fullName',
      'email',
      'phone',
      'age',
      'documentType',
      'documentNumber',
    ];

    for (const field of fields) {
      const error = validateField(
        field,
        formData[field]
      );

      if (error) {
        newErrors[field] = error;
      }
    }

    const termsError = validateField(
      'termsAccepted',
      formData.termsAccepted
    );

    if (termsError) {
      newErrors.terms = termsError;
    }

    if (selectedVehicleIds.length === 0) {
      newErrors.vehicles = t(
        'validation.vehicles.required',
        lang
      );
    }

    setErrors(newErrors);

    setTouchedFields({
      fullName: true,
      email: true,
      phone: true,
      age: true,
      documentType: true,
      documentNumber: true,
      termsAccepted: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  const insertPreorder = async (): Promise<string> => {
    const payload = {
      full_name: formData.fullName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      age: Number(formData.age),
      document_type: normalizeDocumentType(formData.documentType),
      document_number: formData.documentNumber.trim().toUpperCase(),
      selected_vehicle_ids: selectedVehicleIds,
      message: formData.message.trim(),
    };

    for (
      let attempt = 1;
      attempt <= MAX_TRACKING_ATTEMPTS;
      attempt++
    ) {
      const trackingCode = generateTrackingCode();

      const { error } = await supabase
        .from('preorders')
        .insert({
          ...payload,
          tracking_code: trackingCode,
        });

      if (!error) {
        return trackingCode;
      }

      /*
       * PostgreSQL 23505 = unique_violation.
       * Solamente reintentamos cuando el código generado
       * colisiona con otro registro.
       */
      if (error.code === '23505' && attempt < MAX_TRACKING_ATTEMPTS) {
        continue;
      }

      console.error(
        '[Preorder] Error al registrar la preventa:',
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
      'No fue posible generar un código de seguimiento único.'
    );
  };

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setStatusMessage(null);

    if (!validateAll()) {
      setStatusMessage({
        state: 'error',
        text:
          'Revisa los campos marcados en rojo antes de enviar.',
      });

      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      /*
       * IMPORTANTE:
       * Este formulario ya NO utiliza /api/preorder.
       *
       * Existe un único camino de persistencia:
       *
       * React → Supabase → PostgreSQL/RLS
       */
      const trackingCode = await insertPreorder();

      /*
       * SOLO después de que Supabase confirme
       * que el INSERT fue aceptado mostramos éxito.
       */
      setStatusMessage({
        state: 'success',
        text: `${formData.fullName.trim()}, solicitud de preventa recibida.`,
        code: trackingCode,
        subtext: 'Pronto tendrás respuestas.',
      });

      try {
        localStorage.removeItem('lg-preorder-draft');
      } catch (error) {
        console.error(
          '[Preorder] No se pudo eliminar el borrador:',
          error
        );
      }

      onClearSelection();

      setFormData(EMPTY_FORM);
      setErrors({});
      setTouchedFields({});
      setAutosaveText('');
    } catch (error) {
      console.error(
        '[Preorder] La solicitud NO pudo registrarse:',
        error
      );

      setStatusMessage({
        state: 'error',
        text:
          'No fue posible registrar la solicitud en este momento. Tus datos no se han borrado. Intenta nuevamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormLocked =
    selectedVehicleIds.length === 0;

  return (
    <section
      className="section section--form"
      id="preorder"
      aria-labelledby="preorder-title"
    >
      <div className="container form-layout">

        <header className="section__head section__head--form">
          <p className="eyebrow">
            {t('form.eyebrow', lang)}
          </p>

          <h2
            className="section__title"
            id="preorder-title"
          >
            {t('form.title', lang)}
          </h2>

          <p className="section__lede">
            {t('form.lede', lang)}
          </p>
        </header>

        <div className="form-aside">
          <h3 className="form-aside__title">
            {t('form.selection.title', lang)}
          </h3>

          {selectedVehicles.length > 0 ? (
            <ul
              className="selection-list"
              id="form-selection"
            >
              {selectedVehicles.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="selection-list__item"
                >
                  <span>{vehicle.name}</span>

                  <span className="selection-list__price">
                    {vehicle.internal_code}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p
              className="form-aside__empty"
              id="form-selection-empty"
            >
              {t('form.selection.empty', lang)}
            </p>
          )}

          <p className="form-aside__note">
            {t('form.selection.note', lang)}
          </p>
        </div>

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
              <span>
                Ir al Catálogo de Vehículos
              </span>

              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <form
            className="form"
            id="preorder-form"
            onSubmit={handleSubmit}
            noValidate
          >

            <fieldset className="form__group">
              <legend className="form__legend">
                {t('form.legend.identity', lang)}
              </legend>

              <div
                className={`field ${
                  errors.fullName ? 'has-error' : ''
                }`}
              >
                <label
                  className="field__label"
                  htmlFor="fullName"
                >
                  {t('form.fullName.label', lang)}
                </label>

                <input
                  className={`field__input ${
                    errors.fullName
                      ? 'is-invalid border-[hsl(var(--destructive))]'
                      : ''
                  }`}
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
                  aria-describedby={
                    errors.fullName
                      ? 'fullName-error'
                      : undefined
                  }
                />

                {errors.fullName && (
                  <p
                    className="field__error"
                    id="fullName-error"
                  >
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div
                className={`field ${
                  errors.email ? 'has-error' : ''
                }`}
              >
                <label
                  className="field__label"
                  htmlFor="email"
                >
                  {t('form.email.label', lang)}
                </label>

                <input
                  className={`field__input ${
                    errors.email
                      ? 'is-invalid border-[hsl(var(--destructive))]'
                      : ''
                  }`}
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
                  aria-describedby={
                    errors.email
                      ? 'email-error'
                      : undefined
                  }
                />

                {errors.email && (
                  <p
                    className="field__error"
                    id="email-error"
                  >
                    {errors.email}
                  </p>
                )}
              </div>

              <div
                className={`field ${
                  errors.phone ? 'has-error' : ''
                }`}
              >
                <label
                  className="field__label"
                  htmlFor="phone"
                >
                  {t('form.phone.label', lang)}
                </label>

                <input
                  className={`field__input ${
                    errors.phone
                      ? 'is-invalid border-[hsl(var(--destructive))]'
                      : ''
                  }`}
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
                  aria-describedby={
                    errors.phone
                      ? 'phone-error'
                      : undefined
                  }
                />

                {errors.phone && (
                  <p
                    className="field__error"
                    id="phone-error"
                  >
                    {errors.phone}
                  </p>
                )}
              </div>

              <div
                className={`field ${
                  errors.age ? 'has-error' : ''
                }`}
              >
                <label
                  className="field__label"
                  htmlFor="age"
                >
                  {t('form.age.label', lang)}
                </label>

                <input
                  className={`field__input ${
                    errors.age
                      ? 'is-invalid border-[hsl(var(--destructive))]'
                      : ''
                  }`}
                  id="age"
                  name="age"
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={120}
                  step={1}
                  required
                  value={formData.age}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(errors.age)}
                  aria-describedby={
                    errors.age
                      ? 'age-error'
                      : undefined
                  }
                />

                {errors.age && (
                  <p
                    className="field__error"
                    id="age-error"
                  >
                    {errors.age}
                  </p>
                )}
              </div>
            </fieldset>

            <fieldset className="form__group">
              <legend className="form__legend">
                {t('form.legend.document', lang)}
              </legend>

              <div className="field field--split">

                <div
                  className={`field__half ${
                    errors.documentType
                      ? 'has-error'
                      : ''
                  }`}
                >
                  <label
                    className="field__label"
                    htmlFor="documentType"
                  >
                    {t(
                      'form.documentType.label',
                      lang
                    )}
                  </label>

                  <select
                    className={`field__input ${
                      errors.documentType
                        ? 'is-invalid border-[hsl(var(--destructive))]'
                        : ''
                    }`}
                    id="documentType"
                    name="documentType"
                    required
                    value={formData.documentType}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    aria-invalid={Boolean(
                      errors.documentType
                    )}
                    aria-describedby={
                      errors.documentType
                        ? 'documentType-error'
                        : undefined
                    }
                  >
                    <option value="">
                      {t(
                        'form.documentType.placeholder',
                        lang
                      )}
                    </option>

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
                    <p
                      className="field__error"
                      id="documentType-error"
                    >
                      {errors.documentType}
                    </p>
                  )}
                </div>

                <div
                  className={`field__half ${
                    errors.documentNumber
                      ? 'has-error'
                      : ''
                  }`}
                >
                  <label
                    className="field__label"
                    htmlFor="documentNumber"
                  >
                    {t(
                      'form.documentNumber.label',
                      lang
                    )}
                  </label>

                  <input
                    className={`field__input ${
                      errors.documentNumber
                        ? 'is-invalid border-[hsl(var(--destructive))]'
                        : ''
                    }`}
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
                    aria-invalid={Boolean(
                      errors.documentNumber
                    )}
                    aria-describedby={
                      errors.documentNumber
                        ? 'documentNumber-error'
                        : undefined
                    }
                  />

                  <p
                    className="field__hint"
                    id="form-documentNote"
                  >
                    {t(
                      'form.documentNumber.hint',
                      lang
                    )}
                  </p>

                  {errors.documentNumber && (
                    <p
                      className="field__error"
                      id="documentNumber-error"
                    >
                      {errors.documentNumber}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className="form__group">
              <legend className="form__legend">
                {t('form.legend.request', lang)}
              </legend>

              <div className="field">
                <label
                  className="field__label"
                  htmlFor="message"
                >
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

                <p
                  className="field__hint"
                  id="message-counter"
                >
                  {t(
                    'form.message.hint',
                    lang
                  )}
                </p>
              </div>

              <div
                className={`field field--check ${
                  errors.terms ? 'has-error' : ''
                }`}
              >
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
                  aria-describedby={
                    errors.terms
                      ? 'terms-error'
                      : undefined
                  }
                />

                <label
                  className="check__label"
                  htmlFor="terms"
                >
                  {t(
                    'form.terms.label',
                    lang
                  )}
                </label>

                {errors.terms && (
                  <p
                    className="field__error"
                    id="terms-error"
                  >
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
                  {isSubmitting
                    ? t('form.submitting', lang)
                    : t('form.submit', lang)}
                </button>

                <button
                  className="btn btn--ghost btn--sm cursor-pointer"
                  type="button"
                  id="preorder-forget"
                  onClick={handleForgetDraft}
                  disabled={isSubmitting}
                >
                  {t('form.forget', lang)}
                </button>
              </div>

              {statusMessage && (
                <div
                  className={`form__status p-4 rounded-xl border mt-4 text-sm font-mono flex flex-col gap-1 ${
                    statusMessage.state === 'success'
                      ? 'bg-[hsl(var(--primary)/0.12)] border-[hsl(var(--primary)/0.4)] text-[hsl(var(--foreground))] shadow-[0_0_24px_hsl(var(--primary)/0.25)]'
                      : 'bg-[hsl(var(--destructive)/0.12)] border-[hsl(var(--destructive)/0.4)] text-[hsl(var(--destructive))]'
                  }`}
                  data-state={statusMessage.state}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {statusMessage.state === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-[hsl(var(--primary))]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[hsl(var(--destructive))]" />
                    )}

                    <span>
                      {statusMessage.text}
                    </span>
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
                <p
                  className="form__autosave"
                  id="preorder-autosave"
                  role="status"
                >
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

