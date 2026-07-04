// 설정 모달 — 모델(볼륨/설정 게터·세터) + 레이아웃 + 입력 처리.
// 그리기는 ui.js의 drawSettingsModal이 settingsView()로 받아 렌더.
import { LOGICAL_H } from './core/config.js';
import { hitButton, clamp } from './core/helpers.js';
import { getBgmVolume, setBgmVolume } from './audio.js';
import { getSfxVolume, setSfxVolume, playButton } from './sfx.js';
import {
	getOneTouchPlace, setOneTouchPlace,
	getIntermissionEnabled, setIntermissionEnabled,
} from './state.js';

// 게임 중 백 버튼 / 타이틀 설정 버튼 모두 동일 모달 사용.
// 호출자가 buttons 배열을 넘김 — 각 { label, action }. 버튼 위치/패널 높이는
// settingsLayout이 버튼 개수에 맞춰 계산 (draw·hit-test 공용).
const SETTINGS_PANEL = { x: 30, w: 300 };
const SETTINGS_BTN = { x: 80, w: 200, h: 50, gap: 12 };
// panel.y(상단) 기준 내부 세로 오프셋 — 콘텐츠를 모두 패널 상대 배치해 세로 중앙 정렬 가능.
const SETTINGS_DY = {
	title: 48,
	sliderTop: 90, sliderGap: 30,
	checkboxTop: 140, checkboxGap: 30,
	btnTop: 210, bottomPad: 40,
};

// 버튼 개수로 패널 높이를 정하고 화면 세로 중앙에 배치. 콘텐츠 좌표는 panel.y 기준 상대.
// 순수 함수(count만 의존) — draw와 hit-test가 각자 호출해 동일 좌표를 얻는다.
function settingsLayout(count) {
	const D = SETTINGS_DY;
	const lastBtnBottomDY = count
		? D.btnTop + (count - 1) * (SETTINGS_BTN.h + SETTINGS_BTN.gap) + SETTINGS_BTN.h
		: D.btnTop;
	const h = lastBtnBottomDY + D.bottomPad;
	const y = Math.round((LOGICAL_H - h) / 2);
	const panel = { x: SETTINGS_PANEL.x, y, w: SETTINGS_PANEL.w, h };
	const btns = [];
	for (let i = 0; i < count; i++) {
		btns.push({
			x: SETTINGS_BTN.x,
			y: y + D.btnTop + i * (SETTINGS_BTN.h + SETTINGS_BTN.gap),
			w: SETTINGS_BTN.w,
			h: SETTINGS_BTN.h,
		});
	}
	return {
		panel, btns,
		titleY: y + D.title,
		sliderCy: SLIDERS.map((_, i) => y + D.sliderTop + i * D.sliderGap),
		checkboxY: SETTINGS_CHECKBOXES.map((_, i) => y + D.checkboxTop + i * D.checkboxGap),
		guideY: y + h - 16,
	};
}

// ---- 볼륨 슬라이더 모델 (배경음 / 효과음 마스터 분리) ----
export const SLIDER_TRACK = { x: 108, w: 150, knobR: 9 };
const SLIDERS = [
	{ label: 'settings.bgm', get: getBgmVolume, set: setBgmVolume },
	{ label: 'settings.sfx', get: getSfxVolume, set: setSfxVolume },
];
let activeSlider = -1; // 드래그 중인 슬라이더 인덱스 (-1 = 없음)

function sliderValueFromX(px) {
	const s = SLIDER_TRACK;
	return clamp((px - s.x) / s.w, 0, 1);
}

// 포인터가 어느 슬라이더 트랙 위인지 반환 (없으면 -1)
function hitSlider(p, sliderCy) {
	const s = SLIDER_TRACK;
	if (p.x < s.x - 22 || p.x > s.x + s.w + 22) return -1;
	for (let i = 0; i < SLIDERS.length; i++) {
		if (Math.abs(p.y - sliderCy[i]) <= 14) return i;
	}
	return -1;
}

function volumePointerDown(p, sliderCy) {
	const i = hitSlider(p, sliderCy);
	if (i < 0) return false;
	activeSlider = i;
	SLIDERS[i].set(sliderValueFromX(p.x));
	return true;
}

// 슬라이더 드래그 — 설정 모달이 열린 씬에서 pointer 콜백이 위임. 소비 시 true.
export function volumePointerMove(p) {
	if (activeSlider < 0) return false;
	SLIDERS[activeSlider].set(sliderValueFromX(p.x));
	return true;
}
export function volumePointerUp() {
	const was = activeSlider >= 0;
	activeSlider = -1;
	return was;
}

// ---- 설정 체크박스 (볼륨 슬라이더 아래) ----
// 공통 x/폭/높이 + 줄마다 y. get/set로 각 선호값 연결 (체크=on).
export const CHECKBOX_X = 80, CHECKBOX_H = 26, CHECKBOX_BOX = 20;
const CHECKBOX_W = 200;
const SETTINGS_CHECKBOXES = [
	{ label: 'settings.oneTouch', get: getOneTouchPlace, set: setOneTouchPlace },
	{ label: 'settings.intermission', get: getIntermissionEnabled, set: setIntermissionEnabled },
];

// 체크박스 탭 처리 — 소비 시 true. checkboxY는 settingsLayout 산출값.
function settingsCheckboxTap(p, checkboxY) {
	for (let i = 0; i < SETTINGS_CHECKBOXES.length; i++) {
		const rect = { x: CHECKBOX_X, y: checkboxY[i], w: CHECKBOX_W, h: CHECKBOX_H };
		if (hitButton(rect, p)) {
			SETTINGS_CHECKBOXES[i].set(!SETTINGS_CHECKBOXES[i].get());
			return true;
		}
	}
	return false;
}

// 설정 모달이 열린 동안의 탭 처리 (title/playing 씬 공용). 모달이라 탭은 전부 소비됨.
// 슬라이더·체크박스는 자체 처리, 버튼은 action() 실행 — action()이 닫기를 원하면(truthy) true 반환.
export function settingsModalTap(p, buttons) {
	const { btns, sliderCy, checkboxY } = settingsLayout(buttons.length);
	if (volumePointerDown(p, sliderCy)) return false;
	if (settingsCheckboxTap(p, checkboxY)) { playButton(); return false; }
	for (let i = 0; i < buttons.length; i++) {
		if (hitButton(btns[i], p)) {
			return !!buttons[i].action();
		}
	}
	return false;
}

// 렌더러(ui.js)용 뷰 모델 — 레이아웃 + 현재 슬라이더 값/체크 상태.
// 라벨은 i18n 키 그대로 (렌더러가 t()로 변환).
export function settingsView(buttons) {
	const layout = settingsLayout(buttons.length);
	return {
		...layout,
		sliders: SLIDERS.map(s => ({ label: s.label, value: s.get() })),
		checkboxes: SETTINGS_CHECKBOXES.map(c => ({ label: c.label, on: c.get() })),
	};
}
