// display/ui/petMenu.js
// Pet command menu (opened via right-click on Pet button)

export function initPetMenu() {
  let modal = null;

  window.addEventListener('ui:openPetMenu', () => {
    if (modal) return; // Already open

    modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      padding: '16px',
      borderRadius: '8px',
      background: '#0a0e16',
      border: '2px solid #2d3b52',
      zIndex: '1100',
      minWidth: '240px',
      fontFamily: 'monospace'
    });

    const title = document.createElement('div');
    title.textContent = 'Pet Commands';
    Object.assign(title.style, {
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#cfe8ff',
      marginBottom: '12px',
      textAlign: 'center'
    });
    modal.appendChild(title);

    const commands = [
      { cmd: 'follow', label: 'Follow Me', desc: 'Autonomous mode' },
      { cmd: 'stay', label: 'Stay Here', desc: 'Hold position' },
      { cmd: 'guard', label: 'Guard Position', desc: 'Attack nearby enemies' },
      { cmd: 'fetch', label: 'Fetch Item', desc: 'Retrieve item' },
      { cmd: 'idle', label: 'Wait', desc: 'Do nothing' }
    ];

    for (const { cmd, label, desc } of commands) {
      const btn = document.createElement('button');
      btn.textContent = `${label} - ${desc}`;
      Object.assign(btn.style, {
        display: 'block',
        width: '100%',
        padding: '8px',
        marginBottom: '4px',
        background: '#101626',
        border: '1px solid #2d3b52',
        borderRadius: '4px',
        color: '#cfe8ff',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'monospace',
        fontSize: '12px'
      });
      btn.addEventListener('mouseenter', () => { btn.style.background = '#1a2636'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = '#101626'; });
      btn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('ui:petCommand', {
          detail: { command: cmd }
        }));
        closeModal();
      });
      modal.appendChild(btn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      display: 'block',
      width: '100%',
      padding: '8px',
      marginTop: '8px',
      background: '#1a0e16',
      border: '1px solid #3d2d52',
      borderRadius: '4px',
      color: '#cfe8ff',
      cursor: 'pointer',
      fontFamily: 'monospace',
      fontSize: '12px'
    });
    cancelBtn.addEventListener('click', closeModal);
    modal.appendChild(cancelBtn);

    document.body.appendChild(modal);

    // Close on escape
    const escapeHandler = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escapeHandler);
    modal._escapeHandler = escapeHandler;
  });

  function closeModal() {
    if (!modal) return;
    if (modal._escapeHandler) {
      document.removeEventListener('keydown', modal._escapeHandler);
    }
    modal.remove();
    modal = null;
  }
}
