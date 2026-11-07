/* Tailwind ビルド設定。色・角丸・影は tokens.css の CSS 変数を参照し、値を二重管理しない。
   色は RGB トリプレットを <alpha-value> 付きで参照する。単純な var() を渡すと
   bg-primary/90 のような不透明度修飾子が CSS を生成しないため。 */
const bbColor = (name) => `rgb(var(--bb-${name}-rgb) / <alpha-value>)`;

module.exports = {
  content: ['./*.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: bbColor('primary'),
        'primary-hover': bbColor('primary-hover'),
        'on-primary': bbColor('on-primary'),
        alert: bbColor('alert'),
        'on-alert': bbColor('on-alert'),
        success: bbColor('success'),
        'success-surface': bbColor('success-surface'),
        'alert-surface': bbColor('alert-surface'),
        canvas: bbColor('canvas'),
        surface: bbColor('surface'),
        'surface-subtle': bbColor('surface-subtle'),
        'surface-sunken': bbColor('surface-sunken'),
        border: bbColor('border'),
        'border-subtle': bbColor('border-subtle'),
        ink: bbColor('text'),
        body: bbColor('text-body'),
        muted: bbColor('text-muted'),
        placeholder: bbColor('text-placeholder')
      },
      borderRadius: {
        card: 'var(--bb-radius-card)',
        control: 'var(--bb-radius-control)'
      },
      boxShadow: {
        rest: 'var(--bb-shadow-rest)',
        hover: 'var(--bb-shadow-hover)',
        float: 'var(--bb-shadow-float)'
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif']
      },
      fontSize: {
        display: ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.03em', fontWeight: '700' }],
        'headline-lg': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.025em', fontWeight: '600' }],
        'headline-md': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-sm': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em', fontWeight: '600' }],
        'title-md': ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'body-md': ['0.9375rem', { lineHeight: '1.5rem' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'label-md': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        'label-sm': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.04em', fontWeight: '600' }],
        caption: ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.02em', fontWeight: '500' }]
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
