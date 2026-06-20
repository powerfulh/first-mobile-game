// ESLint flat config (dev 전용 — 앱 번들/AAB에는 포함되지 않음).
// www/js의 ES 모듈을 정적 검증: 미정의 참조(no-undef)·미사용 변수(no-unused-vars)·
// 문법 오류 등 "컴파일 검증"용. 실행: npm run lint
// package.json이 "type": "commonjs"라 설정은 .mjs(ESM)로 둔다.
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['www/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        Capacitor: 'readonly', // Capacitor가 런타임에 주입하는 전역
      },
    },
    rules: {
      // 미사용 변수/import는 잡되, 함수 인자·catch 변수는 콜백 패턴상 제외
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      // localStorage 등 의도적 빈 catch 허용
      'no-empty': ['error', { allowEmptyCatch: true }],
      // 들여쓰기 탭 강제
      'indent': ['error', 'tab', { SwitchCase: 1 }],
    },
  },
];
