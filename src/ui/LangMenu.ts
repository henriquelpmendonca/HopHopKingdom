import { sfx } from '../audio';
import { chooseLang, lang, LANGS } from '../i18n';

/** Botão 🌐 com a lista de idiomas. Escolher um guarda a escolha e recarrega o jogo. */
export function setupLangMenu() {
  const btn = document.getElementById('langBtn') as HTMLElement;
  const menu = document.getElementById('langMenu') as HTMLElement;
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.textContent = l.name;
    b.lang = l.html;
    b.classList.toggle('on', l.code === lang);
    b.addEventListener('click', () => {
      sfx.ui();
      if (l.code === lang) { menu.hidden = true; return; }
      chooseLang(l.code);
    });
    menu.appendChild(b);
  }
  const toggle = (on: boolean) => { menu.hidden = !on; };
  btn.addEventListener('click', e => { e.stopPropagation(); sfx.ui(); toggle(menu.hidden !== false); });
  // clicar fora (ou Esc) fecha
  document.addEventListener('pointerdown', e => { if (menu.hidden === false && !menu.contains(e.target as Node)) toggle(false); });
  window.addEventListener('keydown', e => { if (e.code === 'Escape') toggle(false); });
  menu.addEventListener('pointerdown', e => e.stopPropagation());
}
