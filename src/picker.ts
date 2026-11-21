// The theme menu. Knows nothing about themes beyond their names, walls.ts decides what a choice means
export const AUTO = 'auto';

export interface PickerState {
  names: string[];
  chosen: string;
  // The theme actually showing, which for AUTO depends on the page
  shown: string;
}

// Plain text frame so it sits on the grid like the rest of the page
function decoration(text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.ariaHidden = 'true';
  span.textContent = text;
  return span;
}

function menu(state: PickerState, onChoose: (name: string) => void): HTMLDivElement {
  const options = [AUTO, ...state.names];
  const width = Math.max(...options.map(o => o.length));
  const border = '─'.repeat(width + 4);

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.append(decoration(`┌${border}┐\n`));

  for (const name of options) {
    const selected = name === state.chosen;
    const button = document.createElement('button');
    button.textContent = name.padEnd(width);
    button.setAttribute('aria-pressed', String(selected));
    button.addEventListener('click', () => onChoose(name));
    menu.append(decoration(`│ ${selected ? '►' : ' '} `), button, decoration(' │\n'));
  }

  menu.append(decoration(`└${border}┘`));
  return menu;
}

export function renderPicker(picker: HTMLDetailsElement, state: PickerState, onChoose: (name: string) => void) {
  const summary = document.createElement('summary');
  const label = state.chosen === AUTO ? `auto (${state.shown})` : state.chosen;
  summary.append(`theme: ${label} `, decoration('▼'));

  picker.replaceChildren(summary, menu(state, name => {
    picker.open = false;
    onChoose(name);
  }));
}

// <details> only closes from its own summary, a menu should also close from outside or with Escape
export function closeLikeAMenu(picker: HTMLDetailsElement) {
  document.addEventListener('click', e => {
    if (picker.open && !picker.contains(e.target as Node)) {
      picker.open = false;
    }
  });

  picker.addEventListener('keydown', e => {
    if (e.key === 'Escape' && picker.open) {
      picker.open = false;
      picker.querySelector('summary')!.focus();
    }
  });
}
