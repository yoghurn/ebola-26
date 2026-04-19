'use client';

interface SettingsPanelProps {
  isOpen: boolean;
  color: string;
  onColorChange: (color: string) => void;
  onExport: () => void;
  onImportClick: () => void;
  onFileImport: (file: File) => void;
  showHomeButton: boolean;
  onHomeButtonToggle: (showHomeButton: boolean) => void;
  openGameAsAboutBlank?: boolean;
  onOpenGameAsAboutBlankToggle?: (openGameAsAboutBlank: boolean) => void;
  showFlashGames: boolean;
  onShowFlashGamesToggle: (showFlashGames: boolean) => void;
  showPortGames: boolean;
  onShowPortGamesToggle: (showPortGames: boolean) => void;
  showEmulatorGames: boolean;
  onShowEmulatorGamesToggle: (showEmulatorGames: boolean) => void;
}

export default function SettingsPanel({
  isOpen,
  color,
  onColorChange,
  onExport,
  onImportClick,
  onFileImport,
  showHomeButton,
  onHomeButtonToggle,
  openGameAsAboutBlank,
  onOpenGameAsAboutBlankToggle,
  showFlashGames,
  onShowFlashGamesToggle,
  showPortGames,
  onShowPortGamesToggle,
  showEmulatorGames,
  onShowEmulatorGamesToggle,
}: SettingsPanelProps) {
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onColorChange(value);
    }
  };

  return (
    <>
      <div className={`settings-panel ${isOpen ? 'show' : ''}`}>
        <div className="settings-header">
          <h3>settings</h3>
        </div>
        <section className="settings-section">
          <div className="settings-section-title">appearance</div>
          <label htmlFor="colorPicker" className="settings-label">theme color</label>
          <div className="settings-color-row">
            <input
              id="colorPicker"
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="settings-color-picker"
              aria-label="Theme color picker"
            />
            <input
              id="hexInput"
              type="text"
              value={color.toUpperCase()}
              onChange={handleHexChange}
              placeholder="#FFFFFF"
              maxLength={7}
              className="settings-text-input"
              aria-label="Theme hex code"
            />
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-title">navigation</div>
          <label htmlFor="homeButtonToggle" className="settings-switch">
            <div>
              <div className="settings-switch-title">show home button</div>
            </div>
            <input
              id="homeButtonToggle"
              type="checkbox"
              className="settings-toggle-checkbox"
              checked={showHomeButton}
              onChange={(e) => onHomeButtonToggle(e.target.checked)}
            />
          </label>
          
          <label htmlFor="showFlashGamesToggle" className="settings-switch">
            <div>
              <div className="settings-switch-title">show flash games</div>
            </div>
            <input
              id="showFlashGamesToggle"
              type="checkbox"
              className="settings-toggle-checkbox"
              checked={showFlashGames}
              onChange={(e) => onShowFlashGamesToggle(e.target.checked)}
            />
          </label>
          <label htmlFor="showPortGamesToggle" className="settings-switch">
            <div>
              <div className="settings-switch-title">show ported games</div>
            </div>
            <input
              id="showPortGamesToggle"
              type="checkbox"
              className="settings-toggle-checkbox"
              checked={showPortGames}
              onChange={(e) => onShowPortGamesToggle(e.target.checked)}
            />
          </label>
          <label htmlFor="showEmulatorGamesToggle" className="settings-switch">
            <div>
              <div className="settings-switch-title">show emulator games</div>
            </div>
            <input
              id="showEmulatorGamesToggle"
              type="checkbox"
              className="settings-toggle-checkbox"
              checked={showEmulatorGames}
              onChange={(e) => onShowEmulatorGamesToggle(e.target.checked)}
            />
          </label>
          {typeof openGameAsAboutBlank === 'boolean' && onOpenGameAsAboutBlankToggle && (
            <label htmlFor="openGameAsAboutBlankToggle" className="settings-switch">
              <div>
                <div className="settings-switch-title">open game as an about:blank (experimental)</div>
              </div>
              <input
                id="openGameAsAboutBlankToggle"
                type="checkbox"
                className="settings-toggle-checkbox"
                checked={openGameAsAboutBlank}
                onChange={(e) => onOpenGameAsAboutBlankToggle(e.target.checked)}
              />
            </label>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section-title">data</div>
          <div className="settings-actions">
            <button id="exportProgress" onClick={onExport} className="settings-action">
              download my data
            </button>
            <button id="importProgress" onClick={onImportClick} className="settings-action">
              upload my data
            </button>
          </div>
        </section>
      </div>
      <input
        type="file"
        id="importFile"
        accept=".json"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) onFileImport(file);
          e.currentTarget.value = '';
        }}
        style={{ display: 'none' }}
        suppressHydrationWarning={true}
      />
    </>
  );
}
