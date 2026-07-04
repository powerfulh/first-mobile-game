// ============ i18n — 기기 언어 기반 (ko / en). 인앱 언어 설정 없음. ============
// 키 하나에 모든 언어를 담는 사전 방식. t(key)가 STRINGS[key][LANG]을 반환하고,
// 해당 언어가 없으면 en → 키 문자열 순으로 폴백 (누락 키가 화면에서 바로 보이도록).
// 동적 문자열은 {토큰} 자리표시자를 모든 언어에 동일하게 두고 t(key, params)로 치환.

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

const STRINGS = {
	// ---- 공용 ----
	'map.map1.name': { ko: '맵 1', en: 'Map 1' },
	'map.map2.name': { ko: '맵 2', en: 'Map 2' },
	'common.ground': { ko: '지상', en: 'Ground' },
	'common.air': { ko: '공중', en: 'Air' },
	'common.none': { ko: '없음', en: 'None' },
	'common.confirm': { ko: '확인', en: 'OK' },
	'common.wiki': { ko: '위키', en: 'Wiki' },

	// ---- 타워 이름/태그라인/설명 (config.js가 키를 참조) ----
	'tower.novice.name': { ko: '기본', en: 'Basic' },
	'tower.novice.tagline': { ko: '균형형 · 지상 단일', en: 'Balanced · Ground single' },
	'tower.bunker.name': { ko: '벙커', en: 'Bunker' },
	'tower.bunker.tagline': { ko: '단발 고화력 · 지상 전담', en: 'Single-shot heavy · Ground only' },
	'tower.scout.name': { ko: '스카웃', en: 'Scout' },
	'tower.scout.tagline': { ko: '원거리 다목적 · 지상/공중', en: 'Long-range versatile · Ground/Air' },
	'tower.tank.name': { ko: '탱크', en: 'Tank' },
	'tower.tank.tagline': { ko: '범위 공격 · 지상 (반경 50)', en: 'Splash · Ground (radius 50)' },
	'tower.whale.name': { ko: '웨일', en: 'Whale' },
	'tower.whale.tagline': { ko: '광역 폭발 · 지상 (반경 80)', en: 'Area blast · Ground (radius 80)' },
	'tower.trap.name': { ko: '트랩', en: 'Trap' },
	'tower.trap.tagline': { ko: '사거리 내 일제 타격 · 지상 / 공중', en: 'In-range volley · Ground / Air' },
	'tower.base.name': { ko: '배이스', en: 'Base' },
	'tower.base.tagline': { ko: '주변 아군 사거리·XP 강화', en: "Boosts nearby allies' range·XP" },
	'tower.beacon.name': { ko: '비콘', en: 'Beacon' },
	'tower.beacon.tagline': { ko: '사거리·공격력·XP 버프 · 지상', en: 'Range·DMG·XP buff · Ground' },
	'tower.demon.name': { ko: '데몬', en: 'Demon' },
	'tower.demon.tagline': { ko: '버프 + 적 슬로우 · 비공격', en: 'Buff + slow · Non-attacking' },
	'tower.eagle.name': { ko: '이글', en: 'Eagle' },
	'tower.eagle.tagline': { ko: '공중 전담 · 빠른 사격', en: 'Air only · Rapid fire' },
	'tower.skydoom.name': { ko: '스카이둠', en: 'Skydoom' },
	'tower.skydoom.tagline': { ko: '광역 공중 폭격 · 반경 50', en: 'Air area bombard · radius 50' },
	'tower.interceptor.name': { ko: '인터셉터', en: 'Interceptor' },
	'tower.interceptor.tagline': { ko: '7발 부채꼴 · 공중 (직선 비유도)', en: '7-shot fan · Air (straight, unguided)' },
	'tower.filder.name': { ko: '필더', en: 'Fielder' },
	'tower.filder.tagline': { ko: '즉발 빔 · 지상 / 공중', en: 'Instant beam · Ground / Air' },
	'tower.master.name': { ko: '마스터', en: 'Master' },
	'tower.master.tagline': { ko: '강화 즉발 빔 · 지상 / 공중', en: 'Enhanced beam · Ground / Air' },
	'tower.dealman.name': { ko: '딜맨', en: 'Dealman' },
	'tower.dealman.tagline': { ko: '관통 빔 · 고HP 우선 · 지상 / 공중', en: 'Piercing beam · High-HP first · Ground / Air' },
	'tower.radar.name': { ko: '래이다르', en: 'Radar' },
	'tower.radar.tagline': { ko: '사거리 내 일제 + 마킹 · 지상 / 공중', en: 'In-range volley + marking · Ground / Air' },
	'tower.radar.desc1': { ko: '적을 감지하여 사거리와 상관없이 공격할 수 있게 합니다', en: 'Detects enemies, enabling attacks regardless of range' },
	'tower.radar.desc2': { ko: '비콘의 버프 능력을 잃습니다', en: "Loses Beacon's buff ability" },
	'tower.assassin.name': { ko: '어쌔신', en: 'Assassin' },
	'tower.assassin.tagline': { ko: '관통 빔 + 방어막 무력화 · 지상 / 공중', en: 'Piercing beam + shield break · Ground / Air' },
	'tower.assassin.desc1': { ko: '피해를 입은 적의 방어막을 영구 무력화합니다', en: 'Permanently disables shields of hit enemies' },
	'tower.assassin.desc2': { ko: '데몬의 버프 능력을 잃습니다', en: "Loses Demon's buff ability" },
	'tower.silo.name': { ko: '사일로', en: 'Silo' },
	'tower.silo.tagline': { ko: '비유도 광역 폭격 · 지상 (반경 160)', en: 'Unguided area bombard · Ground (radius 160)' },
	'tower.silo.desc1': { ko: '유도 없이 발사 시점의 착탄 지점에 광역 폭격', en: 'Area-bombards the aim point at fire time, no homing' },
	'tower.silo.desc2': { ko: '최소 사거리 존재', en: 'Has a minimum range' },
	'tower.silo.desc3': { ko: '스카이둠의 공중 공격 능력은 잃습니다', en: "Loses Skydoom's air attack" },
	'tower.gatling.name': { ko: '개틀링', en: 'Gatling' },
	'tower.gatling.tagline': { ko: '비유도 연사 탄막 · 공중', en: 'Unguided barrage · Air' },
	'tower.gatling.desc1': { ko: '약간 부정확하지만 폭발적인 공세를 퍼붓습니다', en: 'Slightly inaccurate but pours on explosive volume' },
	'tower.gatling.desc2': { ko: '지상 공격 능력을 잃습니다', en: 'Loses ground attack' },

	// ---- 적 이름 (enemy.js) / 적 명단 (wiki.js가 키를 참조) ----
	'enemy.boss': { ko: '보스', en: 'Boss' },
	'enemy.barrier': { ko: '장벽', en: 'Barrier' },
	'enemy.common.spawnRises': { ko: '웨이브가 오를수록 출현 확률 상승', en: 'Spawn rate rises with the wave' },
	'enemy.ground.name': { ko: '일반 적', en: 'Normal' },
	'enemy.ground.tagline': { ko: '처음부터 등장하는 기본 지상 유닛', en: 'Basic ground unit from the start' },
	'enemy.ground.desc1': { ko: 'HP는 웨이브가 오를수록 증가', en: 'HP grows with the wave' },
	'enemy.ground.desc2': { ko: '이동 속도는 웨이브가 오를수록 빨라지며 후반 고정', en: 'Speed grows with the wave, capped late' },
	'enemy.ground.desc3': { ko: '지상 공격이 가능한 모든 타워의 표적', en: 'Targetable by any ground-capable tower' },
	'enemy.air.name': { ko: '공중 적', en: 'Air' },
	'enemy.air.tagline': { ko: '일정 웨이브부터 등장 · 공중 공격 가능 타워만 처리', en: 'Appears from a certain wave · only air-capable towers can hit' },
	'enemy.air.desc1': { ko: 'HP는 지상보다 낮게 시작해 후반에 지상과 같아짐', en: 'HP starts below ground, reaching parity later' },
	'enemy.air.desc2': { ko: '지상 전담 타워는 공격 불가, 스카웃 계열로 대비', en: 'Ground-only towers cannot hit; use Scout line' },
	'enemy.regen.name': { ko: '재생 적', en: 'Regen' },
	'enemy.regen.tagline': { ko: '후반 등장 · 자가 회복, 느린 지상', en: 'Appears late · self-healing, slow ground' },
	'enemy.regen.desc1': { ko: 'HP는 일반 지상과 같고 이동 속도가 느림', en: 'Same HP as normal ground, slower movement' },
	'enemy.regen.desc2': { ko: 'HP가 가득 차지 않으면 매초 스스로 회복', en: 'Heals itself each second while not full' },
	'enemy.regen.desc3': { ko: '후반으로 갈수록 회복량 증가', en: 'Heal rate increases in later waves' },
	'enemy.barrierSpawner.name': { ko: '장벽 적', en: 'Barrier' },
	'enemy.barrierSpawner.tagline': { ko: '후반 등장 · 처치 시 장벽 생성', en: 'Appears late · spawns a barrier on death' },
	'enemy.barrierSpawner.desc1': { ko: '공중 타입, HP/속도는 일반 적과 동일', en: 'Air type; HP/speed same as normal enemies' },
	'enemy.barrierSpawner.desc2': { ko: '처치 시 그 자리에 튼튼한 장벽 생성', en: 'On death spawns a tough barrier in place' },
	'enemy.barrierSpawner.desc3': { ko: '장벽은 공중 공격을 막아 대신 데미지를 받으며, 웨이브 종료까지 유지', en: 'The barrier blocks air attacks (taking the damage) until the wave ends' },
	'enemy.barrierSpawner.desc4': { ko: '지상 전용 공격은 장벽 영향 없음', en: 'Ground-only attacks ignore barriers' },

	// ---- 타워/적 정보·설정·전직 패널 (ui/panel.js) ----
	'panel.type': { ko: '타입: {type}', en: 'Type: {type}' },
	'panel.hp': { ko: '체력: {hp} / {max}', en: 'HP: {hp} / {max}' },
	'panel.speed': { ko: '이동 속도: {spd}', en: 'Speed: {spd}' },
	'panel.speedSlowed': { ko: '이동 속도: {spd} (둔화 {pct}%)', en: 'Speed: {spd} (slowed {pct}%)' },
	'panel.heal': { ko: '초당 회복: {pct}%', en: 'Heal: {pct}%/s' },
	'panel.barrierHp': { ko: '장벽 체력: {hp}', en: 'Barrier HP: {hp}' },
	'panel.armor': { ko: '방어력: {n}', en: 'Armor: {n}' },
	'panel.dmgBuffed': { ko: '데미지: {dmg} (+{pct}%, {dps}/초)', en: 'DMG: {dmg} (+{pct}%, {dps}/s)' },
	'panel.dmg': { ko: '데미지: {dmg} ({dps}/초)', en: 'DMG: {dmg} ({dps}/s)' },
	'panel.dmgNone': { ko: '데미지: —', en: 'DMG: —' },
	'panel.fireRate': { ko: '발사속도: {rate}/초', en: 'Fire rate: {rate}/s' },
	'panel.fireRateNone': { ko: '발사속도: —', en: 'Fire rate: —' },
	'panel.rangeBuffed': { ko: '사거리: {range} (+{pct}%)', en: 'Range: {range} (+{pct}%)' },
	'panel.range': { ko: '사거리: {range}', en: 'Range: {range}' },
	'panel.targets': { ko: '공격 대상: {types}', en: 'Targets: {types}' },
	'panel.waveDamage': { ko: '웨이브 누적 데미지: {dmg}', en: 'Wave damage: {dmg}' },
	'panel.totalDamage': { ko: '누적 데미지: {dmg}', en: 'Total damage: {dmg}' },
	'panel.settingsTitle': { ko: '{name} 설정', en: '{name} settings' },
	'panel.priority': { ko: '우선순위', en: 'Priority' },
	'panel.nonAttacking': { ko: '공격하지 않는 타워', en: 'Non-attacking tower' },
	'panel.target': { ko: '표적: {p}', en: 'Target: {p}' },
	'panel.priority.closest': { ko: '가장 가까움', en: 'Closest' },
	'panel.priority.farthest': { ko: '가장 멈', en: 'Farthest' },
	'panel.priority.strongest': { ko: '가장 강함', en: 'Strongest' },
	'panel.priority.weakest': { ko: '가장 약함', en: 'Weakest' },
	'panel.cardStats': { ko: '사거리 {range}  ·  데미지 {dmg}  ·  속도 {rate}/s', en: 'Range {range}  ·  DMG {dmg}  ·  Speed {rate}/s' },
	'panel.promote.title': { ko: '전직 가능!', en: 'Promotion available!' },
	'panel.promote.tier4Info': { ko: '{from} 타워가 {to} 타워로 전직됩니다', en: '{from} promotes into {to}' },
	'panel.promote.choose': { ko: '역할을 선택하세요', en: 'Choose a role' },
	'panel.promote.notReady': { ko: '전직 (XP {xp} / {max})', en: 'Promote (XP {xp} / {max})' },
	'panel.promote.cost': { ko: '전직 ({cost}G)', en: 'Promote ({cost}G)' },
	'panel.promote.noGold': { ko: '전직 ({cost}G · 골드 부족)', en: 'Promote ({cost}G · not enough)' },
	'panel.promote.cancelTarget': { ko: '대상 취소', en: 'Cancel target' },
	'panel.promote.setTarget': { ko: '4티어 대상 지정', en: 'Set Tier-4 target' },

	// ---- 설정 모달 / 일시정지 ----
	'settings.title': { ko: '설정', en: 'Settings' },
	'settings.bgm': { ko: '배경음', en: 'Music' },
	'settings.sfx': { ko: '효과음', en: 'SFX' },
	'settings.oneTouch': { ko: '원터치 배치', en: 'One-touch place' },
	'settings.intermission': { ko: '웨이브 간 인터미션', en: 'Wave intermission' },
	'settings.closeGuide': { ko: '이전 버튼을 눌러 닫습니다', en: 'Press Back to close' },
	'settings.resetSave': { ko: '저장 정보 초기화', en: 'Reset save data' },
	'settings.resetConfirm': { ko: '저장 정보를 초기화할까요?', en: 'Reset all save data?' },
	'settings.exitToTitle': { ko: '메인으로 나가기', en: 'Exit to menu' },
	'hud.paused': { ko: '⏸  일시정지', en: '⏸  Paused' },

	// ---- 인트로 모달 (ui/intro-modals.js) ----
	'intro.air.title': { ko: '공중 적 등장!', en: 'Air enemies!' },
	'intro.air.line1': { ko: '보라색 삼각형은 공중 적입니다.', en: 'Purple triangles are air enemies.' },
	'intro.air.line2': { ko: '지상 전담 타워는 공격할 수 없으니', en: 'Ground-only towers cannot hit them,' },
	'intro.air.line3': { ko: '스카웃을 활용해 대비하세요.', en: 'so prepare with Scout-line towers.' },
	'intro.buff.title': { ko: '티어별 버프율', en: 'Buff rate by tier' },
	'intro.buff.line1': { ko: '버프를 받는 타워의 티어에 따라', en: 'The effect varies with the tier' },
	'intro.buff.line2': { ko: '효과가 달라집니다.', en: 'of the buffed tower.' },
	'intro.boss.title': { ko: '보스 등장!', en: 'Boss incoming!' },
	'intro.boss.line1': { ko: '20 웨이브마다 보스가 등장합니다.', en: 'A boss appears every 20 waves.' },
	'intro.boss.line2': { ko: '일반 적보다 훨씬 단단하지만 느리게 이동합니다.', en: 'Far tankier than normal enemies, but slower.' },
	'intro.shield.title': { ko: '방어막 적 등장!', en: 'Shielded enemies!' },
	'intro.shield.line1': { ko: '일부 적이 방어막을 두르고 등장합니다.', en: 'Some enemies arrive with a shield.' },
	'intro.shield.line2': { ko: '받는 데미지가 감소합니다.', en: 'They take reduced damage.' },
	'intro.tier4.title': { ko: '합체 전직 가능!', en: 'Fusion promotion!' },
	'intro.tier4.line1': { ko: 'XP를 모두 채운 3티어 타워 두 개로', en: 'Two fully-XP’d Tier-3 towers can' },
	'intro.tier4.line2': { ko: '레시피 조합 4티어 전직이 가능합니다.', en: 'fuse into a Tier-4 tower by recipe.' },
	'intro.tier4.step1': { ko: '① 한 타워의 "4티어 대상 지정"', en: '① On one tower, "Set Tier-4 target"' },
	'intro.tier4.step2': { ko: '② 레시피 짝 타워에서 "전직"', en: '② On the recipe partner, "Promote"' },
	'intro.tier4.step3': { ko: '③ 대상 타워는 소모, 짝 타워가 4티어로 전직', en: '③ Target is consumed; partner becomes Tier-4' },
	'intro.barrier.title': { ko: '장벽 적 등장!', en: 'Barrier enemies!' },
	'intro.barrier.line1': { ko: '장벽 적이 등장합니다.', en: 'Barrier enemies appear.' },
	'intro.barrier.line2': { ko: '처치한 자리에 장벽이 생성되어', en: 'Killing one spawns a barrier there' },
	'intro.barrier.line3': { ko: '공중 공격을 차단합니다.', en: 'that blocks air attacks.' },
	'intro.regen.title': { ko: '재생 적 등장!', en: 'Regen enemies!' },
	'intro.regen.line1': { ko: '초록색 사각형은 재생 적입니다.', en: 'Green squares are regen enemies.' },
	'intro.regen.line2': { ko: '이동 속도가 절반이지만', en: 'They move at half speed but' },
	'intro.regen.line3': { ko: '피해를 입어도 매초 체력을 회복합니다.', en: 'heal HP every second when damaged.' },
	'intro.parallel.title': { ko: '추가 웨이브 (병렬 호출)', en: 'Extra Wave (parallel)' },
	'intro.parallel.line1': { ko: '현재 웨이브가 끝나기 전에', en: 'Before the current wave ends,' },
	'intro.parallel.line2': { ko: '다음 웨이브를 즉시 병렬로 진행합니다.', en: 'run the next wave in parallel at once.' },
	'intro.parallel.warn1': { ko: '• 병렬로 부른 웨이브는 저장되지 않습니다.', en: '• Parallel-called waves are not saved.' },
	'intro.parallel.warn2': { ko: '• 적이 겹쳐 방어 부담이 큽니다. 신중히!', en: '• Enemies stack up — defend carefully!' },
	'intro.mapUnlock.title': { ko: '새로운 맵 해금!', en: 'New Map Unlocked!' },
	'intro.mapUnlock.line1': { ko: '1번 맵을 깊이 진행했습니다!', en: 'You pushed deep into Map 1!' },
	'intro.mapUnlock.line2': { ko: '새로운 맵이 해금되었습니다.', en: 'A new map is now available.' },
	'intro.mapUnlock.line3': { ko: '게임 시작에서 선택하세요.', en: 'Choose it from Start.' },
	'intro.shortcut.title': { ko: '공중 지름길', en: 'Air Shortcut' },
	'intro.shortcut.line1': { ko: '이 맵에는 공중 타입이 이용할 수 있는 지름길이 있습니다', en: 'This map has an air-only shortcut.' },
	'intro.shortcut.line2': { ko: '정규 경로와 번갈아 이용합니다', en: 'Used alternately with the regular route.' },

	// ---- 씬: 타이틀 / 게임오버 / 힌트 / 토스트 (scenes.js) ----
	'title.continue': { ko: '이어서 하기', en: 'Continue' },
	'title.start': { ko: '게임 시작', en: 'Start' },
	'hint.nextWave': { ko: '다음 웨이브까지 {n}초', en: 'Next wave in {n}s' },
	'hint.cancelPlace': { ko: '빈 곳을 탭하여 배치 취소', en: 'Tap empty space to cancel' },
	'hint.placeTower': { ko: '빈 곳을 탭하여 타워 배치 ({cost}G)', en: 'Tap empty space to place tower ({cost}G)' },
	'hint.holdDelete': { ko: '타워를 꾹 눌러 삭제', en: 'Hold a tower to delete' },
	'toast.bossParallel': { ko: '보스 웨이브는 병렬로 호출할 수 없습니다', en: 'Boss waves cannot be called in parallel' },
	'toast.sandboxShields': { ko: '방어막 적 {s}', en: 'Shield enemies {s}' },
	'sandbox.jumpPrompt': { ko: '이동할 웨이브?', en: 'Jump to wave?' },
	'gameover.defeat': { ko: 'Wave {n}에서 패배', en: 'Defeated at Wave {n}' },
	'gameover.restart': { ko: '다시 시작', en: 'Restart' },
	'gameover.toTitle': { ko: '타이틀로', en: 'To title' },

	// ---- 위키 (wiki.js) ----
	'wiki.tab.tower': { ko: '타워', en: 'Towers' },
	'wiki.tab.enemy': { ko: '적', en: 'Enemies' },
	'wiki.enemyList': { ko: '적 명단', en: 'Enemy List' },
	'wiki.groupLine': { ko: '{name} 계열', en: '{name} line' },
	'wiki.groupTier4': { ko: '4티어 합체', en: 'Tier-4 fusion' },
	'wiki.range': { ko: '사거리 {range}', en: 'Range {range}' },
	'wiki.rangeMin': { ko: '  (최소 {min})', en: '  (min {min})' },
	'wiki.dmgRate': { ko: '데미지 {dmg}  ·  공속 {rate}/s', en: 'DMG {dmg}  ·  Rate {rate}/s' },
	'wiki.dmgRateNone': { ko: '데미지 — · 공속 —', en: 'DMG — · Rate —' },
	'wiki.splash': { ko: '  (광역 {n})', en: '  (splash {n})' },
	'wiki.recipe': { ko: '합체 레시피: {a} + {b}', en: 'Fusion recipe: {a} + {b}' },
	'wiki.promoFrom': { ko: '전직 전: {names}', en: 'Promotes from: {names}' },
	'wiki.promoTo': { ko: '전직 후보: {names}', en: 'Promotes to: {names}' },
	'wiki.tier4Fusion': { ko: '4티어 합체: + {p} → {r}', en: 'Tier-4 fusion: + {p} → {r}' },
};

// 번역 — params의 {key} 자리표시자 치환. 폴백: LANG → en → 키 문자열.
export function t(key, params) {
	const entry = STRINGS[key];
	let s = (entry && (entry[LANG] ?? entry.en)) ?? key;
	if (params) {
		for (const k in params) {
			s = s.split(`{${k}}`).join(String(params[k]));
		}
	}
	return s;
}
