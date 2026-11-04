import { DE, ES, FR, RU } from './locales';
import { store } from './store';

/**
 * Idiomas: inglês (padrão e obrigatório no CrazyGames), português, espanhol, francês, alemão e russo.
 * Vale, nesta ordem: ?lang= no endereço, o idioma escolhido no menu, o do SDK do CrazyGames; senão, inglês.
 */
export type Lang = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'ru';

/** idiomas do menu: código, nome no próprio idioma e código do HTML */
export const LANGS: { code: Lang; name: string; html: string }[] = [
  { code: 'en', name: 'English', html: 'en' },
  { code: 'pt', name: 'Português', html: 'pt-BR' },
  { code: 'es', name: 'Español', html: 'es' },
  { code: 'fr', name: 'Français', html: 'fr' },
  { code: 'de', name: 'Deutsch', html: 'de' },
  { code: 'ru', name: 'Русский', html: 'ru' },
];

const EN = {
  // nomes das construções
  'name.cabana_soldado': 'Soldier Hut',
  'name.cabana_arqueiro': 'Archer Hut',
  'name.mina_ouro': 'Gold Mine',
  'name.mina_mana': 'Mana Mine',
  'name.cabana_mago': 'Wizard Hut',
  'name.casa_estudo': 'Study House',
  'name.cabana_gigante': 'Giant House',
  'name.cabana_bomba': 'Bomber House',
  'name.cabana_quicador': 'Bouncer House',
  // poderes
  'power.meteoros.name': 'Meteor Shower',
  'power.meteoros.desc': 'Meteors fall on the enemies closest to the city',
  'power.congelar.name': 'Freeze',
  'power.congelar.desc': 'Freezes all enemies for {n} seconds',
  'power.curar.name': 'Heal',
  'power.curar.desc': 'Heals soldiers and buildings and revives the fallen',
  'power.key': '{name} (key {k}): {desc}',
  // dicas
  'hint.build_first': 'Build a Soldier Hut in the bottom bar: the orcs are already on their way!',
  'hint.welcome_back': 'Welcome back! Your kingdom has been loaded.',
  'hint.mana_unlocked': 'Mana unlocked! Use it on the Mana Mine and on the powers next to the sword.',
  'hint.no_enemies': 'No enemies right now!',
  'hint.no_mana': 'Not enough mana!',
  'hint.no_coins': 'Not enough coins!',
  'hint.meteors': 'Meteor shower!',
  'hint.frozen': 'Enemies frozen for {n} seconds!',
  'hint.healed': 'Everyone healed!',
  'hint.limit': 'Limit of {n} buildings: {name}',
  'hint.needs_castle': 'Unlocks with Town Center level {n}',
  'hint.place_touch': 'Drag your finger and release where you want to build (tap the card again to cancel)',
  'hint.place_mouse': 'Click on the map to build (right-click cancels)',
  'hint.no_room': 'No room here!',
  'hint.built_troops': 'Click the hut to upgrade it! Orcs are coming: throw your little soldiers at them!',
  'hint.built_mana_mine': 'The mana mine earns mana! But it has no soldiers: protect it!',
  'hint.built_mine': 'The mine earns coins! But it has no soldiers: protect it!',
  'hint.needs_town': 'Upgrade the Town Center to level {n} to unlock level {l}!',
  'hint.survive_wave': 'Survive until wave {n} to upgrade the Town Center!',
  'hint.sword_coins': 'Not enough coins to upgrade the sword!',
  'hint.boss': 'WATCH OUT! Wave {w}: the Orc King has arrived!',
  'hint.wave': 'Wave {w}! {n} orcs incoming!',
  'hint.click_them': ' Click them to hit!',
  'hint.boss_dead': 'The Orc King has fallen! But dark mages are coming...',
  'hint.rebuilt': 'City rebuilt! You lost {p}% of your coins and went back {w} waves.',
  'hint.ad_reward': 'Thanks for watching! +{n} coins',
  'hint.ad_free_rebuild': 'City rebuilt for free!',
  'hint.ad_unavailable': 'No ad available right now. Try again later!',
  // textos que sobem
  'fl.mana_unlocked': 'Mana unlocked! +{n}',
  'fl.new_look': 'NEW LOOK!',
  'fl.upgraded': 'UPGRADED!',
  'fl.new_sword': 'NEW SWORD!',
  'fl.sword_lv': 'Sword Lv {n}',
  'fl.hut_destroyed': 'Hut destroyed!',
  // interface
  'ui.sword_upgrade': 'Upgrade the click sword',
  'ui.sword_info': 'Click sword: {n} damage',
  'ui.lock_castle': 'Town Center Lv {n}',
  'ui.lock_wave': 'Wave {n}',
  'ui.max': 'MAX',
  'ui.level': 'Lv {n}',
  'ui.wave_label': 'wave',
  'ui.music': 'Music',
  'ui.sfx': 'Sound effects',
  'ui.gift_title': 'Watch an ad for free coins',
  'ui.over_title': 'The city has fallen!',
  'ui.over_default': 'The orcs destroyed the Town Center.',
  'ui.over_txt': 'You reached wave {w}. If you rebuild, you keep your buildings, but lose {p}% of your coins and go back {n} waves.',
  'ui.rebuild': 'Rebuild the city',
  'ui.rebuild_free': 'Rebuild for free (watch an ad)',
  'ui.restart': 'Start over',
  'ui.pause': 'Pause',
  'ui.paused': 'PAUSED',
  'ui.resume': 'Resume',
  'ui.next_wave': 'next {n}s',
  'ui.over_stats': 'Orcs defeated: {k} · Best wave: {b}',
  'ui.forge': 'Royal Forge',
  'ui.forge_open': 'Royal Forge (spend stars)',
  'ui.forge_sub': 'Spend Royal Stars on upgrades that last forever, even in a brand-new city.',
  'ui.forge_earn': 'Earn stars: 1 per 10 orcs, new best waves, Orc King kills',
  'ui.close': 'Close',
  'ui.language': 'Language',
  'ui.evolve': 'Evolve into: {name}',
  'hint.evolve_level': 'The hut must reach level {n} to evolve!',
  'hint.evolve_study': 'Build the Study House first!',
  'hint.built_study': 'Study House built! Huts of level 10+ can now evolve into new warriors (costs mana).',
  'hint.evolved': 'Evolved! Grab the glowing soldiers and throw them!',
  'fl.evolved': 'EVOLVED!',
  'ui.power': 'Power: fills up as you defeat orcs',
  'ui.power_ready': 'Grab a soldier!',
  'banner.power': 'POWER READY!',
  'banner.power_sub': 'Grab a soldier and throw him!',
  'fl.special_bomb': 'BOMBER!',
  'fl.special_giant': 'GIANT!',
  'fl.special_bounce': 'BOUNCER!',
  'fl.chest': 'Chest! +{n}',
  'ui.move': 'Move',
  'ui.sell': 'Sell',
  'ui.sell_sure': 'Sell?',
  'hint.only_calm': 'You can only move or sell between waves!',
  'hint.sold': 'Hut sold for {n}!',
  'hint.moved': 'Moved!',
  'ui.over_stars': 'You have {n} Royal Stars to spend!',
  'perk.next': 'next {v}',
  'perk.treasure': 'Royal Treasure',
  'perk.treasure.desc': 'More coins from every orc',
  'perk.strong': 'Brave Soldiers',
  'perk.strong.desc': 'Soldiers have more health and hit harder',
  'perk.wall': 'Strong Walls',
  'perk.wall.desc': 'Town Center and huts have more health',
  'perk.sword': 'Sharp Sword',
  'perk.sword.desc': 'Your click sword deals more damage',
  'perk.start': 'Quick Start',
  'perk.start.desc': 'Extra coins when a new city begins',
  'banner.wave': 'WAVE {w}',
  'banner.orcs': '{n} orcs incoming!',
  'banner.boss': 'ORC KING!',
  'banner.boss_sub': 'Wave {w}: defend your kingdom!',
  'banner.combo': 'COMBO x{n}!',
  'tuto.skip': 'Skip tutorial',
  'tuto.build': 'Welcome! Tap the Soldier Hut card below to build your first hut.',
  'tuto.place_mouse': 'Now click on the grass to place it.',
  'tuto.place_touch': 'Drag your finger onto the grass and let go to place it.',
  'tuto.wait': 'Your little soldiers hop around to protect the hut. Here come the orcs!',
  'tuto.throw_mouse': 'Press and hold a soldier, drag, and release to THROW him at an orc!',
  'tuto.throw_touch': 'Touch and hold a soldier, drag, and let go to THROW him at an orc!',
  'tuto.hit_mouse': 'Click on the orcs to hit them with your sword!',
  'tuto.hit_touch': 'Tap on the orcs to hit them with your sword!',
  'tuto.upgrade': 'Collect coins from your kills, then click your hut and press the green arrow to upgrade it!',
  'tuto.done': 'Great job! Keep building, upgrading and defending your kingdom!',
} as const;

export type Key = keyof typeof EN;

const PT: Record<Key, string> = {
  'name.cabana_soldado': 'Cabana de Soldado',
  'name.cabana_arqueiro': 'Cabana de Arqueiros',
  'name.mina_ouro': 'Mina de Ouro',
  'name.mina_mana': 'Mina de Mana',
  'name.cabana_mago': 'Cabana do Mago',
  'name.casa_estudo': 'Casa de Estudo',
  'name.cabana_gigante': 'Casa do Gigante',
  'name.cabana_bomba': 'Casa do Bombardeiro',
  'name.cabana_quicador': 'Casa do Quicador',
  'power.meteoros.name': 'Chuva de Meteoros',
  'power.meteoros.desc': 'Meteoros caem sobre os inimigos mais perto da cidade',
  'power.congelar.name': 'Congelar',
  'power.congelar.desc': 'Congela todos os inimigos por {n} segundos',
  'power.curar.name': 'Cura',
  'power.curar.desc': 'Cura soldados e construções e levanta quem caiu',
  'power.key': '{name} (tecla {k}): {desc}',
  'hint.build_first': 'Construa uma cabana de soldado na barra de baixo: os orcs já estão a caminho!',
  'hint.welcome_back': 'Bem-vindo de volta! Seu reino foi carregado.',
  'hint.mana_unlocked': 'Mana liberada! Use na Mina de Mana e nos poderes ao lado da espada.',
  'hint.no_enemies': 'Não há inimigos agora!',
  'hint.no_mana': 'Falta mana!',
  'hint.no_coins': 'Faltam moedas!',
  'hint.meteors': 'Chuva de meteoros!',
  'hint.frozen': 'Inimigos congelados por {n} segundos!',
  'hint.healed': 'Todos curados!',
  'hint.limit': 'Limite de {n} construções: {name}',
  'hint.needs_castle': 'Libera com o Centro da Vila nível {n}',
  'hint.place_touch': 'Arraste o dedo e solte onde quer construir (toque na carta de novo cancela)',
  'hint.place_mouse': 'Clique no mapa para construir (botão direito cancela)',
  'hint.no_room': 'Aqui não cabe!',
  'hint.built_troops': 'Clique na cabana pra evoluir! Orcs vêm aí: arremesse os soldadinhos neles!',
  'hint.built_mana_mine': 'A mina de mana rende mana! Mas ela não tem soldados: proteja-a!',
  'hint.built_mine': 'A mina rende moedas! Mas ela não tem soldados: proteja-a!',
  'hint.needs_town': 'Evolua o Centro da Vila para o nível {n} para liberar o nível {l}!',
  'hint.survive_wave': 'Sobreviva até a onda {n} para evoluir o Centro da Vila!',
  'hint.sword_coins': 'Faltam moedas para evoluir a espada!',
  'hint.boss': 'CUIDADO! Onda {w}: o Rei Orc chegou!',
  'hint.wave': 'Onda {w}! {n} orcs a caminho!',
  'hint.click_them': ' Clique neles para bater!',
  'hint.boss_dead': 'O Rei Orc caiu! Mas magos sombrios estão chegando...',
  'hint.rebuilt': 'Cidade reerguida! Você perdeu {p}% das moedas e voltou {w} ondas.',
  'hint.ad_reward': 'Obrigado por assistir! +{n} moedas',
  'hint.ad_free_rebuild': 'Cidade reerguida de graça!',
  'hint.ad_unavailable': 'Nenhum anúncio disponível agora. Tente de novo mais tarde!',
  'fl.mana_unlocked': 'Mana liberada! +{n}',
  'fl.new_look': 'NOVO VISUAL!',
  'fl.upgraded': 'EVOLUIU!',
  'fl.new_sword': 'ESPADA NOVA!',
  'fl.sword_lv': 'Espada Nv {n}',
  'fl.hut_destroyed': 'Cabana destruída!',
  'ui.sword_upgrade': 'Evoluir a espada do clique',
  'ui.sword_info': 'Espada do clique: {n} de dano',
  'ui.lock_castle': 'Centro Nv {n}',
  'ui.lock_wave': 'Onda {n}',
  'ui.max': 'MAX',
  'ui.level': 'Nv {n}',
  'ui.wave_label': 'onda',
  'ui.music': 'Música',
  'ui.sfx': 'Efeitos sonoros',
  'ui.gift_title': 'Assista a um anúncio e ganhe moedas',
  'ui.over_title': 'A cidade caiu!',
  'ui.over_default': 'Os orcs destruíram o centro da cidade.',
  'ui.over_txt': 'Você chegou à onda {w}. Reerguendo, você mantém suas construções, mas perde {p}% das moedas e volta {n} ondas.',
  'ui.rebuild': 'Reerguer a cidade',
  'ui.rebuild_free': 'Reerguer de graça (assistir anúncio)',
  'ui.restart': 'Começar do zero',
  'ui.pause': 'Pausar',
  'ui.paused': 'PAUSADO',
  'ui.resume': 'Continuar',
  'ui.next_wave': 'próxima {n}s',
  'ui.over_stats': 'Orcs derrotados: {k} · Melhor onda: {b}',
  'ui.forge': 'Forja Real',
  'ui.forge_open': 'Forja Real (gastar estrelas)',
  'ui.forge_sub': 'Gaste Estrelas Reais em melhorias que duram para sempre, até numa cidade nova.',
  'ui.forge_earn': 'Ganhe estrelas: 1 a cada 10 orcs, ondas novas e o Rei Orc',
  'ui.close': 'Fechar',
  'ui.language': 'Idioma',
  'ui.evolve': 'Evoluir para: {name}',
  'hint.evolve_level': 'A cabana precisa chegar ao nível {n} para evoluir!',
  'hint.evolve_study': 'Construa a Casa de Estudo primeiro!',
  'hint.built_study': 'Casa de Estudo pronta! Cabanas de nível 10 ou mais já podem evoluir para novos guerreiros (custa mana).',
  'hint.evolved': 'Evoluiu! Pegue os soldados brilhando e arremesse!',
  'fl.evolved': 'EVOLUIU!',
  'ui.power': 'Poder: enche ao derrotar orcs',
  'ui.power_ready': 'Pegue um soldado!',
  'banner.power': 'PODER PRONTO!',
  'banner.power_sub': 'Pegue um soldado e arremesse!',
  'fl.special_bomb': 'BOMBARDEIRO!',
  'fl.special_giant': 'GIGANTE!',
  'fl.special_bounce': 'QUICADOR!',
  'fl.chest': 'Baú! +{n}',
  'ui.move': 'Mover',
  'ui.sell': 'Vender',
  'ui.sell_sure': 'Vender?',
  'hint.only_calm': 'Só dá para mover ou vender entre as ondas!',
  'hint.sold': 'Cabana vendida por {n}!',
  'hint.moved': 'Movida!',
  'ui.over_stars': 'Você tem {n} Estrelas Reais para gastar!',
  'perk.next': 'próximo {v}',
  'perk.treasure': 'Tesouro Real',
  'perk.treasure.desc': 'Mais moedas de cada orc',
  'perk.strong': 'Soldados Bravos',
  'perk.strong.desc': 'Soldados com mais vida e golpes mais fortes',
  'perk.wall': 'Muralhas Fortes',
  'perk.wall.desc': 'Centro da Vila e cabanas com mais vida',
  'perk.sword': 'Espada Afiada',
  'perk.sword.desc': 'A espada do clique causa mais dano',
  'perk.start': 'Começo Rápido',
  'perk.start.desc': 'Moedas extras quando uma cidade nova começa',
  'banner.wave': 'ONDA {w}',
  'banner.orcs': '{n} orcs a caminho!',
  'banner.boss': 'REI ORC!',
  'banner.boss_sub': 'Onda {w}: defenda o seu reino!',
  'banner.combo': 'COMBO x{n}!',
  'tuto.skip': 'Pular tutorial',
  'tuto.build': 'Bem-vindo! Toque na carta da Cabana de Soldado aqui embaixo para construir a primeira.',
  'tuto.place_mouse': 'Agora clique na grama para colocar.',
  'tuto.place_touch': 'Arraste o dedo até a grama e solte para colocar.',
  'tuto.wait': 'Seus soldadinhos pulam em volta da cabana para protegê-la. Lá vêm os orcs!',
  'tuto.throw_mouse': 'Segure um soldado, arraste e solte para ARREMESSAR ele num orc!',
  'tuto.throw_touch': 'Toque e segure um soldado, arraste e solte para ARREMESSAR ele num orc!',
  'tuto.hit_mouse': 'Clique nos orcs para bater neles com a sua espada!',
  'tuto.hit_touch': 'Toque nos orcs para bater neles com a sua espada!',
  'tuto.upgrade': 'Junte moedas com os orcs derrotados, clique na cabana e aperte a seta verde para evoluir!',
  'tuto.done': 'Muito bem! Continue construindo, evoluindo e defendendo o seu reino!',
};

const DICT: Record<Lang, Partial<Record<Key, string>>> = { en: EN, pt: PT, es: ES, fr: FR, de: DE, ru: RU };

export let lang: Lang = 'en';

const K_LANG = 'hhk_lang';

/** converte um código como "pt-BR" ou "en-US" num idioma que o jogo tem (ou undefined) */
function match(code: string | null | undefined): Lang | undefined {
  const c = (code ?? '').toLowerCase().slice(0, 2);
  return LANGS.find(l => l.code === c)?.code;
}

/** idioma que o jogador escolheu no menu, se houver */
export const savedLang = () => match(store.get(K_LANG));

/** Escolhe o idioma (código como "pt-BR"); sem código válido, inglês. */
export function setLocale(code: string | undefined) {
  lang = match(code) ?? 'en';
  document.documentElement.lang = LANGS.find(l => l.code === lang)!.html;
}

/** O jogador escolheu um idioma no menu: guarda e recarrega (o jogo salva o progresso ao sair da página). */
export function chooseLang(code: Lang) {
  store.set(K_LANG, code);
  // ?lang= na barra de endereço mandaria mais que a escolha: tira
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  history.replaceState(null, '', u.toString());
  location.reload();
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? DICT.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Troca os textos fixos do HTML (marcados com data-i18n e data-i18n-title). */
export function applyStaticTexts() {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n as Key); });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle as Key); });
  document.title = 'Hop Hop Kingdom';
}
