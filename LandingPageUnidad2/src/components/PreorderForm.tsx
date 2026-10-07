
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

const INITIAL_FORM_DATA: PreorderFormData = {
  fullName: '',
  email: '',
  phone: '',
  age: '',
  documentType: '',
  documentNumber: '',
  message: '',
  termsAccepted: false,
};

const generateTrackingCode = (): string => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);

  const code = 100000 + (array[0] % 900000);

  return String(code);
};

const normalizeDocumentType = (value: string): string => {
  const normalized = value.trim().toUpperCase();

  if (normalized === 'PASSPORT') {
    return 'PAS';
  }

  return normalized;
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

  const [formData, setFormData] =
    useState<PreorderFormData>(INITIAL_FORM_DATA);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] =
    useState<Record<string, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [statusMessage, setStatusMessage] =
    useState<StatusMessage | null>(null);

  const [submitted, setSubmitted] = useState(false);

  const [autosaveText, setAutosaveText] = useState<string>('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lg-preorder-draft');

      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved);

      setFormData((previous) => ({
        ...previous,
        fullName: parsed.fullName || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        age: parsed.age || '',
        documentType: parsed.documentType || '',
        documentNumber: parsed.documentNumber || '',
        message: parsed.message || '',
      }));

      setAutosaveText(
        t('form.autosave.restored', lang)
      );
    } catch {
      // El borrador local no debe impedir que el formulario funcione.
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
        documentNumber: data.documentNumber,
        message: data.message,
      };

      localStorage.setItem(
        'lg-preorder-draft',
        JSON.stringify(draft)
      );

      setAutosaveText(
        t('form.autosave.saved', lang)
      );
    } catch {
      // localStorage no debe romper el flujo principal.
    }
  };

  const validateField = (
    name: string,
    value: unknown
  ): string => {
    let error = '';

    const str = String(value || '').trim();

    if (name === 'fullName') {
      if (!str || str.length < 3) {
        error = t(
          'validation.fullName.invalid',
          lang
        );
      }
    } else if (name === 'email') {
      if (
        !str ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str)
      ) {
        error = t(
          'validation.email.invalid',
          lang
        );
      }
    } else if (name === 'phone') {
      if (!str || str.length < 7) {
        error = t(
          'validation.phone.invalid',
          lang
        );
      }
    } else if (name === 'age') {
      const numericAge = Number(value);

      if (
        !value ||
        Number.isNaN(numericAge) ||
        numericAge < 18 ||
        numericAge > 120
      ) {
        error = t(
          'validation.age.range',
          lang
        );
      }
    } else if (name === 'documentType') {
      if (!str) {
        error = t(
          'validation.documentType.invalid',
          lang
        );
      }
    } else if (name === 'documentNumber') {
      if (!str || str.length < 4) {
        error = t(
          'validation.documentNumber.invalid',
          lang
        );
      }
    } else if (name === 'termsAccepted') {
      if (!value) {
        error = t(
          'validation.terms.required',
          lang
        );
      }
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
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) => {
    const {
      name,
      value,
      type,
    } = event.target;

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
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) => {
    const {
      name,
      value,
      type,
    } = event.target;

    const checked =
      (event.target as HTMLInputElement).checked;

    const updatedData = {
      ...formData,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    };

    setFormData(updatedData);

    if (errors[name]) {
      validateField(
        name,
        type === 'checkbox'
          ? checked
          : value
      );
    }

    if (
      type !== 'checkbox' &&
      name !== 'documentNumber'
    ) {
      saveDraft(updatedData);
    }
  };

  const handleForgetDraft = () => {
    try {
      localStorage.removeItem(
        'lg-preorder-draft'
      );
    } catch {
      // No bloquear la limpieza del formulario.
    }

    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setTouchedFields({});
    setAutosaveText(
      t('form.autosave.cleared', lang)
    );
    setStatusMessage(null);
    setSubmitted(false);

    onClearSelection();
  };

  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {};

    const errName = validateField(
      'fullName',
      formData.fullName
    );

    if (errName) {
      newErrors.fullName = errName;
    }

    const errEmail = validateField(
      'email',
      formData.email
    );

    if (errEmail) {
      newErrors.email = errEmail;
    }

    const errPhone = validateField(
      'phone',
      formData.phone
    );

    if (errPhone) {
      newErrors.phone = errPhone;
    }

    const errAge = validateField(
      'age',
      formData.age
    );

    if (errAge) {
      newErrors.age = errAge;
    }

    const errDocumentType = validateField(
      'documentType',
      formData.documentType
    );

    if (errDocumentType) {
      newErrors.documentType =
        errDocumentType;
    }

    const errDocumentNumber = validateField(
      'documentNumber',
      formData.documentNumber
    );

    if (errDocumentNumber) {
      newErrors.documentNumber =
        errDocumentNumber;
    }

    const errTerms = validateField(
      'termsAccepted',
      formData.termsAccepted
    );

    if (errTerms) {
      newErrors.terms = errTerms;
    }

    if (selectedVehicleIds.length === 0) {
      newErrors.vehicles = t(
        'validation.vehicles.required',
        lang
      );
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
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

    setIsSubmitting(true);

    const email =
      formData.email
        .trim()
        .toLowerCase();

    const fullName =
      formData.fullName.trim();

    const phone =
      formData.phone.trim();

    const documentType =
      normalizeDocumentType(
        formData.documentType
      );

    const documentNumber =
      formData.documentNumber
        .trim()
        .toUpperCase();

    const message =
      formData.message.trim();

    const age =
      Number(formData.age);

    let trackingCode = '';

    try {
      let inserted = false;

      /*
       * Se permiten varios intentos únicamente
       * para resolver una posible colisión del
       * código de seguimiento UNIQUE.
       */
      for (let attempt = 0; attempt < 5; attempt += 1) {
        trackingCode =
          generateTrackingCode();

        const { error } =
          await supabase
            .from('preorders')
            .insert({
              full_name: fullName,
              email,
              phone,
              age,
              document_type: documentType,
              document_number: documentNumber,
              selected_vehicle_ids:
                selectedVehicleIds,
              message,
              tracking_code:
                trackingCode,
            });

        if (!error) {
          inserted = true;
          break;
        }

        /*
         * PostgreSQL 23505 = unique_violation.
         * Si el problema no es una colisión,
         * no debemos repetir la operación.
         */
        if (error.code !== '23505') {
          console.error(
            'Luxury Galaxy - Error registrando preventa:',
            {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            }
          );

          throw error;
        }
      }

      if (!inserted) {
        throw new Error(
          'No fue posible generar un código de seguimiento único.'
        );
      }

      /*
       * IMPORTANTE:
       * El éxito solamente ocurre DESPUÉS de que
       * Supabase confirma el INSERT.
       */
      setStatusMessage({
        state: 'success',
        text: 'Solicitud de preventa enviada',
        code: trackingCode,
        subtext:
          'Tendrás noticias de este vehículo pronto.',
      });

      setSubmitted(true);

      try {
        localStorage.removeItem(
          'lg-preorder-draft'
        );
      } catch {
        // No afecta el envío ya confirmado.
      }

      setFormData(INITIAL_FORM_DATA);
      setErrors({});
      setTouchedFields({});
      setAutosaveText('');

      /*
       * Se limpia la selección después de guardar.
       * La pantalla de éxito no depende de la selección,
       * por lo que permanece visible.
       */
      onClearSelection();
    } catch (error) {
      console.error(
        'Luxury Galaxy - Fallo definitivo en preventa:',
        error
      );

      setStatusMessage({
        state: 'error',
        text:
          'No fue posible registrar tu solicitud de preventa. Verifica tu conexión e inténtalo nuevamente.',
      });

      /*
       * NO limpiamos:
       * - formulario
       * - vehículos
       * - localStorage
       *
       * porque la solicitud NO fue confirmada.
       */
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormLocked =
    selectedVehicleIds.length === 0;

  /*
   * ============================================
   * PANTALLA DE ÉXITO
   * ============================================
   *
   * Se evalúa antes del estado bloqueado para que
   * onClearSelection() no haga desaparecer el mensaje.
   */
  if (submitted && statusMessage?.state === 'success') {
    return (
      <section
        className="section section--form"
        id="preorder"
        aria-labelledby="preorder-success-title"
      >
        <div className="container form-layout">
          <div className="form p-8 md:p-12 rounded-2xl border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--card))] shadow-lg flex flex-col items-center text-center justify-center min-h-[420px]">

            <div className="w-20 h-20 rounded-full bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.4)] text-[hsl(var(--primary))] flex items-center justify-center mb-6 shadow-[0_0_32px_hsl(var(--primary)/0.25)]">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <p className="eyebrow mb-3">
              LUXURY GALAXY
            </p>

            <h2
              className="section__title mb-4"
              id="preorder-success-title"
            >
              Solicitud de preventa enviada
            </h2>

            <p className="text-sm md:text-base text-[hsl(var(--muted-foreground))] max-w-lg leading-relaxed">
              Tu solicitud de preventa fue
              registrada correctamente.
            </p>

            <p className="text-sm md:text-base text-[hsl(var(--foreground))] max-w-lg leading-relaxed mt-2">
              Tendrás noticias de este vehículo
              pronto.
            </p>

            {statusMessage.code && (
              <div className="mt-8 px-6 py-4 rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)]">
                <p className="text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-1">
                  Código de seguimiento
                </p>

                <p className="font-mono font-bold text-xl tracking-[0.2em] text-[hsl(var(--primary))]">
                  {statusMessage.code}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

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

        {/* Selected Vehicles List */}
        <div className="form-aside">
          <h3 className="form-aside__title">
            {t('form.selection.title', lang)}
          </h3>

          {selectedVehicles.length > 0 ? (
            <ul
              className="selection-list"
              id="form-selection"
            >
              {selectedVehicles.map(
                (vehicle) => (
                  <li
                    key={vehicle.id}
                    className="selection-list__item"
                  >
                    <span>
                      {vehicle.name}
                    </span>

                    <span className="selection-list__price">
                      {vehicle.internal_code}
                    </span>
                  </li>
                )
              )}
            </ul>
          ) : (
            <p
              className="form-aside__empty"
              id="form-selection-empty"
            >
              {t(
                'form.selection.empty',
                lang
              )}
            </p>
          )}

          <p className="form-aside__note">
            {t(
              'form.selection.note',
              lang
            )}
          </p>
        </div>

        {/* Locked state */}
        {isFormLocked ? (
          <div className="form p-8 rounded-2xl border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--card))] shadow-lg flex flex-col items-center text-center justify-center my-auto min-h-[360px]">

            <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))] flex items-center justify-center mb-4">
              <Car className="w-7 h-7" />
            </div>

            <h3 className="font-display font-bold text-xl text-[hsl(var(--foreground))] mb-2">
              Selecciona tus vehículos para
              activar la preventa
            </h3>

            <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mb-6 leading-relaxed">
              El formulario se activa
              automáticamente cuando marcas
              al menos una unidad del catálogo.
              Explora las unidades disponibles
              y resérvalas con trazabilidad
              directa.
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
                {t(
                  'form.legend.identity',
                  lang
                )}
              </legend>

              {/* Full Name */}
              <div
                className={`field ${
                  errors.fullName
                    ? 'has-error'
                    : ''
                }`}
              >
                <label
                  className="field__label"
                  htmlFor="fullName"
                >
                  {t(
                    'form.fullName.label',
                    lang
                  )}
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
                  onChange={
                    handleInputChange
                  }
                  onBlur={handleBlur}
                  aria-invalid={Boolean(
                    errors.fullName
                  )}
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

              {/* Email */}
              <div
                className={`field ${
                  errors.email
                    ? 'has-error'
                    : ''
                }`}
              >
                <label
                  className="field__label"
                  htmlFor="email"
                >
                  {t(
                    'form.email.label',
                    lang
                  )}
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
                  onChange={
                    handleInputChange
                  }
                  onBlur={handleBlur}
                  aria-invalid={Boolean(
                    errors.email
                  )}
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

              {/* Phone */}
              <div
                className={`field ${
                  errors.phone
                    ? 'has-error'
                    : ''
                }`}
              >
                <label
                  className="field__label"
                  htmlFor="phone"
                >
                  {t(
                    'form.phone.label',
                    lang
                  )}
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
                  onChange={
                    handleInputChange
                  }
                  onBlur={handleBlur}
                  aria-invalid={Boolean(
                    errors.phone
                  )}
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

              {/* Age */}
              <div
                className={`field ${
                  errors.age
                    ? 'has-error'
                    : ''
                }`}
              >
                <label
                  className="field__label"
                  htmlFor="age"
                >
                  {t(
                    'form.age.label',
                    lang
                  )}
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
                  onChange={
                    handleInputChange
                  }
                  onBlur={handleBlur}
                  aria-invalid={Boolean(
                    errors.age
                  )}
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

            {/* Document */}
            <fieldset className="form__group">
              <legend className="form__legend">
                {t(
                  'form.legend.document',
                  lang
                )}
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
                    value={
                      formData.documentType
                    }
                    onChange={
                      handleInputChange
                    }
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
                      {
                        errors.documentType
                      }
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
                    value={
                      formData.documentNumber
                    }
                    onChange={
                      handleInputChange
                    }
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
                      {
                        errors.documentNumber
                      }
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* Request */}
            <fieldset className="form__group">
              <legend className="form__legend">
                {t(
                  'form.legend.request',
                  lang
                )}
              </legend>

              <div className="field">
                <label
                  className="field__label"
                  htmlFor="message"
                >
                  {t(
                    'form.message.label',
                    lang
                  )}
                </label>

                <textarea
                  className="field__input field__input--area"
                  id="message"
                  name="message"
                  rows={4}
                  maxLength={600}
                  value={formData.message}
                  onChange={
                    handleInputChange
                  }
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

              {/* Terms */}
              <div
                className={`field field--check ${
                  errors.terms
                    ? 'has-error'
                    : ''
                }`}
              >
                <input
                  className="check__input"
                  id="terms"
                  name="termsAccepted"
                  type="checkbox"
                  required
                  checked={
                    formData.termsAccepted
                  }
                  onChange={
                    handleInputChange
                  }
                  onBlur={handleBlur}
                  aria-invalid={Boolean(
                    errors.terms
                  )}
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
                    ? t(
                        'form.submitting',
                        lang
                      )
                    : t(
                        'form.submit',
                        lang
                      )}
                </button>

                <button
                  className="btn btn--ghost btn--sm cursor-pointer"
                  type="button"
                  id="preorder-forget"
                  onClick={
                    handleForgetDraft
                  }
                  disabled={isSubmitting}
                >
                  {t(
                    'form.forget',
                    lang
                  )}
                </button>
              </div>

              {/* Error status */}
              {statusMessage &&
                statusMessage.state ===
                  'error' && (
                  <div
                    className="form__status p-4 rounded-xl border mt-4 text-sm font-mono flex flex-col gap-1 bg-[hsl(var(--destructive)/0.12)] border-[hsl(var(--destructive)/0.4)] text-[hsl(var(--destructive))]"
                    data-state="error"
                    role="alert"
                    aria-live="assertive"
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4 h-4 text-[hsl(var(--destructive))]" />

                      <span>
                        {statusMessage.text}
                      </span>
                    </div>
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
