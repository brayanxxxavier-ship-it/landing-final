import React from 'react';
import { Language } from '../types';
import { t } from '../i18n/translations';

interface ProcessProps {
  lang: Language;
}

export const Process: React.FC<ProcessProps> = ({ lang }) => {
  const steps = [
    { index: '01', title: t('process.browse.title', lang), text: t('process.browse.text', lang) },
    { index: '02', title: t('process.select.title', lang), text: t('process.select.text', lang) },
    { index: '03', title: t('process.submit.title', lang), text: t('process.submit.text', lang) },
    { index: '04', title: t('process.code.title', lang), text: t('process.code.text', lang) },
    { index: '05', title: t('process.advisor.title', lang), text: t('process.advisor.text', lang) },
  ];

  return (
    <section className="section" id="process" aria-labelledby="process-title">
      <div className="container">
        <header className="section__head">
          <p className="eyebrow">{t('process.eyebrow', lang)}</p>
          <h2 className="section__title" id="process-title">
            {t('process.title', lang)}
          </h2>
          <p className="section__lede">{t('process.lede', lang)}</p>
        </header>

        <ol className="process">
          {steps.map((step, idx) => (
            <li key={idx} className="process__step">
              <span className="process__index" aria-hidden="true">{step.index}</span>
              <h3 className="process__title">{step.title}</h3>
              <p className="process__text">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
