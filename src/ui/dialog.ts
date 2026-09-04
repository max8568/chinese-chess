function bigButton(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn big ${cls}`;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** Kid-friendly yes/no dialog. Resolves true for 是. */
export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    const box = document.createElement('div');
    box.className = 'dialog';
    const text = document.createElement('p');
    text.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const done = (v: boolean) => {
      backdrop.remove();
      resolve(v);
    };
    actions.append(bigButton('是', 'yes', () => done(true)), bigButton('否', 'no', () => done(false)));
    box.append(text, actions);
    backdrop.append(box);
    document.body.append(backdrop);
  });
}

/** Game-over banner laid over the board. */
export class Banner {
  private root = document.createElement('div');
  private title = document.createElement('div');
  private subtitle = document.createElement('div');

  constructor(container: HTMLElement, h: { onAgain(): void; onClose(): void }) {
    this.root.className = 'banner';
    this.root.hidden = true;
    this.title.className = 'banner-title';
    this.subtitle.className = 'banner-subtitle';
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(bigButton('再來一局', 'yes', h.onAgain), bigButton('關閉', 'no', h.onClose));
    this.root.append(this.title, this.subtitle, actions);
    container.append(this.root);
  }

  show(title: string, subtitle: string): void {
    this.title.textContent = title;
    this.subtitle.textContent = subtitle;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
