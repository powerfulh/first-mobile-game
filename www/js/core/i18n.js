// ============ i18n — 기기 언어 기반 (ko / en). 인앱 언어 설정 없음. ============
// 한국어 원문을 키로 사용. ko면 원문 그대로, en이면 EN 사전 값(없으면 원문 폴백).
// 동적 문자열은 {토큰} 자리표시자를 양쪽 동일하게 두고 t(key, params)로 치환.

function detectLang() {
	try {
		const l = (navigator.languages && navigator.languages[0]) || navigator.language || '';
		return /^ko/i.test(l) ? 'ko' : 'en';
	} catch (e) {
		return 'en';
	}
}

const LANG = detectLang();
// const LANG = 'en'

export function getLang() {
	return LANG;
}

// 한국어 원문 → 영어.
const EN = {
	// ---- 타워 이름 (config.js) ----
	'기본': 'Basic', '벙커': 'Bunker', '스카웃': 'Scout', '탱크': 'Tank',
	'웨일': 'Whale', '트랩': 'Trap', '배이스': 'Base', '비콘': 'Beacon',
	'데몬': 'Demon', '이글': 'Eagle', '스카이둠': 'Skydoom', '인터셉터': 'Interceptor',
	'필더': 'Fielder', '마스터': 'Master', '딜맨': 'Dealman', '래이다르': 'Radar',
	'어쌔신': 'Assassin', '사일로': 'Silo', '개틀링': 'Gatling',

	// ---- 타워 태그라인 (config.js) ----
	'균형형 · 지상 단일': 'Balanced · Ground single',
	'단발 고화력 · 지상 전담': 'Single-shot heavy · Ground only',
	'원거리 다목적 · 지상/공중': 'Long-range versatile · Ground/Air',
	'범위 공격 · 지상 (반경 50)': 'Splash · Ground (radius 50)',
	'광역 폭발 · 지상 (반경 80)': 'Area blast · Ground (radius 80)',
	'사거리 내 일제 타격 · 지상 / 공중': 'In-range volley · Ground / Air',
	'주변 아군 사거리·XP 강화': "Boosts nearby allies' range·XP",
	'사거리·공격력·XP 버프 · 지상': 'Range·DMG·XP buff · Ground',
	'버프 + 적 슬로우 · 비공격': 'Buff + slow · Non-attacking',
	'공중 전담 · 빠른 사격': 'Air only · Rapid fire',
	'광역 공중 폭격 · 반경 50': 'Air area bombard · radius 50',
	'7발 부채꼴 · 공중 (직선 비유도)': '7-shot fan · Air (straight, unguided)',
	'즉발 빔 · 지상 / 공중': 'Instant beam · Ground / Air',
	'강화 즉발 빔 · 지상 / 공중': 'Enhanced beam · Ground / Air',
	'관통 빔 · 고HP 우선 · 지상 / 공중': 'Piercing beam · High-HP first · Ground / Air',
	'사거리 내 일제 + 마킹 · 지상 / 공중': 'In-range volley + marking · Ground / Air',
	'관통 빔 + 방어막 무력화 · 지상 / 공중': 'Piercing beam + shield break · Ground / Air',
	'비유도 광역 폭격 · 지상 (반경 160)': 'Unguided area bombard · Ground (radius 160)',
	'비유도 연사 탄막 · 공중': 'Unguided barrage · Air',

	// ---- 타워 상세 설명 (config.js description) ----
	'적을 감지하여 사거리와 상관없이 공격할 수 있게 합니다': 'Detects enemies, enabling attacks regardless of range',
	'비콘의 버프 능력을 잃습니다': "Loses Beacon's buff ability",
	'피해를 입은 적의 방어막을 영구 무력화합니다': 'Permanently disables shields of hit enemies',
	'데몬의 버프 능력을 잃습니다': "Loses Demon's buff ability",
	'유도 없이 발사 시점의 착탄 지점에 광역 폭격': 'Area-bombards the aim point at fire time, no homing',
	'최소 사거리 존재': 'Has a minimum range',
	'스카이둠의 공중 공격 능력은 잃습니다': "Loses Skydoom's air attack",
	'약간 부정확하지만 폭발적인 공세를 퍼붓습니다': 'Slightly inaccurate but pours on explosive volume',
	'지상 공격 능력을 잃습니다': 'Loses ground attack',

	// ---- 타워 정보/설정 패널 (tower.js) ----
	'지상': 'Ground', '공중': 'Air', '없음': 'None',
	'보스': 'Boss', '장벽': 'Barrier',
	'타입: {type}': 'Type: {type}',
	'체력: {hp} / {max}': 'HP: {hp} / {max}',
	'이동 속도: {spd}': 'Speed: {spd}',
	'이동 속도: {spd} (둔화 {pct}%)': 'Speed: {spd} (slowed {pct}%)',
	'초당 회복: {pct}%': 'Heal: {pct}%/s',
	'장벽 체력: {hp}': 'Barrier HP: {hp}',
	'방어력: {n}': 'Armor: {n}',
	'데미지: {dmg} (+{pct}%, {dps}/초)': 'DMG: {dmg} (+{pct}%, {dps}/s)',
	'데미지: {dmg} ({dps}/초)': 'DMG: {dmg} ({dps}/s)',
	'데미지: —': 'DMG: —',
	'발사속도: {rate}/초': 'Fire rate: {rate}/s',
	'발사속도: —': 'Fire rate: —',
	'사거리: {range} (+{pct}%)': 'Range: {range} (+{pct}%)',
	'사거리: {range}': 'Range: {range}',
	'공격 대상: {types}': 'Targets: {types}',
	'웨이브 누적 데미지: {dmg}': 'Wave damage: {dmg}',
	'누적 데미지: {dmg}': 'Total damage: {dmg}',
	'{name} 설정': '{name} settings',
	'우선순위': 'Priority',
	'공격하지 않는 타워': 'Non-attacking tower',
	'표적: {p}': 'Target: {p}',
	'가장 가까움': 'Closest', '가장 멈': 'Farthest', '가장 강함': 'Strongest', '가장 약함': 'Weakest',
	'사거리 {range}  ·  데미지 {dmg}  ·  속도 {rate}/s': 'Range {range}  ·  DMG {dmg}  ·  Speed {rate}/s',
	'전직 가능!': 'Promotion available!',
	'{from} 타워가 {to} 타워로 전직됩니다': '{from} promotes into {to}',
	'역할을 선택하세요': 'Choose a role',
	'전직 (XP {xp} / {max})': 'Promote (XP {xp} / {max})',
	'전직 ({cost}G)': 'Promote ({cost}G)',
	'전직 ({cost}G · 골드 부족)': 'Promote ({cost}G · not enough)',
	'대상 취소': 'Cancel target',
	'4티어 대상 지정': 'Set Tier-4 target',

	// ---- 설정 모달 / 일시정지 (ui.js) ----
	'배경음': 'Music', '효과음': 'SFX',
	'원터치 배치': 'One-touch place', '웨이브 간 인터미션': 'Wave intermission',
	'설정': 'Settings', '이전 버튼을 눌러 닫습니다': 'Press Back to close',
	'⏸  일시정지': '⏸  Paused',
	'확인': 'OK',

	// ---- 인트로 모달 (ui.js) ----
	'공중 적 등장!': 'Air enemies!',
	'보라색 삼각형은 공중 적입니다.': 'Purple triangles are air enemies.',
	'지상 전담 타워는 공격할 수 없으니': 'Ground-only towers cannot hit them,',
	'스카웃을 활용해 대비하세요.': 'so prepare with Scout-line towers.',
	'티어별 버프율': 'Buff rate by tier',
	'버프를 받는 타워의 티어에 따라': 'The effect varies with the tier',
	'효과가 달라집니다.': 'of the buffed tower.',
	'보스 등장!': 'Boss incoming!',
	'20 웨이브마다 보스가 등장합니다.': 'A boss appears every 20 waves.',
	'일반 적보다 훨씬 단단하지만 느리게 이동합니다.': 'Far tankier than normal enemies, but slower.',
	'방어막 적 등장!': 'Shielded enemies!',
	'일부 적이 방어막을 두르고 등장합니다.': 'Some enemies arrive with a shield.',
	'받는 데미지가 감소합니다.': 'They take reduced damage.',
	'합체 전직 가능!': 'Fusion promotion!',
	'XP를 모두 채운 3티어 타워 두 개로': 'Two fully-XP’d Tier-3 towers can',
	'레시피 조합 4티어 전직이 가능합니다.': 'fuse into a Tier-4 tower by recipe.',
	'① 한 타워의 "4티어 대상 지정"': '① On one tower, "Set Tier-4 target"',
	'② 레시피 짝 타워에서 "전직"': '② On the recipe partner, "Promote"',
	'③ 대상 타워는 소모, 짝 타워가 4티어로 전직': '③ Target is consumed; partner becomes Tier-4',
	'장벽 적 등장!': 'Barrier enemies!',
	'장벽 적이 등장합니다.': 'Barrier enemies appear.',
	'처치한 자리에 장벽이 생성되어': 'Killing one spawns a barrier there',
	'공중 공격을 차단합니다.': 'that blocks air attacks.',
	'재생 적 등장!': 'Regen enemies!',
	'초록색 사각형은 재생 적입니다.': 'Green squares are regen enemies.',
	'이동 속도가 절반이지만': 'They move at half speed but',
	'피해를 입어도 매초 체력을 회복합니다.': 'heal HP every second when damaged.',
	'추가 웨이브 (병렬 호출)': 'Extra Wave (parallel)',
	'현재 웨이브가 끝나기 전에': 'Before the current wave ends,',
	'다음 웨이브를 즉시 병렬로 진행합니다.': 'run the next wave in parallel at once.',
	'• 병렬로 부른 웨이브는 저장되지 않습니다.': '• Parallel-called waves are not saved.',
	'• 적이 겹쳐 방어 부담이 큽니다. 신중히!': '• Enemies stack up — defend carefully!',

	// ---- 씬: 타이틀 / 설정 버튼 / 게임오버 / 힌트 (scenes.js) ----
	'저장 정보 초기화': 'Reset save data',
	'저장 정보를 초기화할까요?': 'Reset all save data?',
	'위키': 'Wiki',
	'메인으로 나가기': 'Exit to menu',
	'이어서 하기': 'Continue',
	'게임 시작': 'Start',
	'다음 웨이브까지 {n}초': 'Next wave in {n}s',
	'빈 곳을 탭하여 배치 취소': 'Tap empty space to cancel',
	'빈 곳을 탭하여 타워 배치 ({cost}G)': 'Tap empty space to place tower ({cost}G)',
	'타워를 꾹 눌러 삭제': 'Hold a tower to delete',
	'다시 시작': 'Restart',
	'타이틀로': 'To title',
	'Wave {n}에서 패배': 'Defeated at Wave {n}',
	'이동할 웨이브?': 'Jump to wave?',
	'방어막 적 {s}': 'Shield enemies {s}',
	'보스 웨이브는 병렬로 호출할 수 없습니다': 'Boss waves cannot be called in parallel',

	// ---- 위키 (wiki.js) ----
	'타워': 'Towers', '적': 'Enemies', '적 명단': 'Enemy List',
	'벙커 계열': 'Bunker line', '스카웃 계열': 'Scout line', '4티어 합체': 'Tier-4 fusion',
	'사거리 {range}': 'Range {range}',
	'  (최소 {min})': '  (min {min})',
	'데미지 {dmg}  ·  공속 {rate}/s': 'DMG {dmg}  ·  Rate {rate}/s',
	'데미지 — · 공속 —': 'DMG — · Rate —',
	'  (광역 {n})': '  (splash {n})',
	'합체 레시피: {a} + {b}': 'Fusion recipe: {a} + {b}',
	'전직 전: {names}': 'Promotes from: {names}',
	'전직 후보: {names}': 'Promotes to: {names}',
	'4티어 합체: + {p} → {r}': 'Tier-4 fusion: + {p} → {r}',

	// 적 명단 — 이름 / 태그라인 / 설명
	'일반 적': 'Normal', '공중 적': 'Air', '재생 적': 'Regen', '장벽 적': 'Barrier',
	'Wave 1부터 등장하는 기본 지상 유닛': 'Basic ground unit from Wave 1',
	'HP는 기본 곡선 (Wave 50: 31 / Wave 100: 66 / Wave 200: 151)': 'HP base curve (Wave 50: 31 / 100: 66 / 200: 151)',
	'이동 속도: 50 + (wave-1) × 2, Wave 100+ 고정 248': 'Speed: 50 + (wave-1) × 2, fixed 248 at Wave 100+',
	'지상 공격이 가능한 모든 타워의 표적': 'Targetable by any ground-capable tower',
	'Wave 6+ · 공중 공격 가능 타워만 처리': 'Wave 6+ · only air-capable towers can hit',
	'출현 확률: (wave - 5) × 2%, Wave 30에 상한 50% 도달': 'Spawn rate: (wave-5) × 2%, caps at 50% by Wave 30',
	'HP는 지상의 0.6배 시작, Wave 31~50에 걸쳐 1.0배까지 상승': 'HP starts at 0.6× ground, rising to 1.0× over Wave 31–50',
	'지상 전담 타워는 공격 불가, 스카웃 계열로 대비': 'Ground-only towers cannot hit; use Scout line',
	'Wave 111+ · 자가 회복, 느린 지상': 'Wave 111+ · self-healing, slow ground',
	'출현 확률: Wave 111~130 +0.2%/wave (4%), Wave 191~200 +0.4%/wave (8%)': 'Spawn: Wave 111–130 +0.2%/wave (4%), 191–200 +0.4%/wave (8%)',
	'HP는 일반 지상과 동일, 이동 속도는 절반': 'Same HP as normal ground, half move speed',
	'HP가 가득 차지 않을 때 매초 hpMax × 12% 회복': 'Heals hpMax × 12% per second while not full',
	'Wave 161~170 회복률 +1%/wave (22%) → Wave 191~200 추가 +1%/wave (32%)': 'Heal rate +1%/wave over 161–170 (22%) → +1%/wave over 191–200 (32%)',
	'Wave 151+ · 처치 시 장벽 생성': 'Wave 151+ · spawns a barrier on death',
	'출현 확률: Wave 151 0.4%부터 +0.4%/wave, Wave 160에 4% 상한': 'Spawn: from 0.4% at Wave 151, +0.4%/wave, caps 4% at Wave 160',
	'공중 타입, HP/속도는 일반 적과 동일': 'Air type; HP/speed same as normal enemies',
	'처치 시 그 자리에 반경 60 장벽 생성 (HP는 일반 적의 2배)': 'On death spawns a radius-60 barrier (2× normal HP)',
	'장벽은 공중 공격을 막아 대신 데미지를 받으며, 웨이브 종료까지 유지': 'The barrier blocks air attacks (taking the damage) until the wave ends',
	'지상 전용 공격은 장벽 영향 없음': 'Ground-only attacks ignore barriers',
};

// 번역 — params의 {key} 자리표시자 치환. ko면 원문, en이면 사전값(없으면 원문).
export function t(ko, params) {
	let s = (LANG === 'en' && Object.prototype.hasOwnProperty.call(EN, ko)) ? EN[ko] : ko;
	if (params) {
		for (const k in params) {
			s = s.split(`{${k}}`).join(String(params[k]));
		}
	}
	return s;
}
