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
  hideFlashGames: boolean;
  onHideFlashGamesToggle: (hideFlashGames: boolean) => void;
  hidePortGames: boolean;
  onHidePortGamesToggle: (hidePortGames: boolean) => void;
  hideEmulatorGames: boolean;
  onHideEmulatorGamesToggle: (hideEmulatorGames: boolean) => void;
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
  hideFlashGames,
  onHideFlashGamesToggle,
  hidePortGames,
  onHidePortGamesToggle,
  hideEmulatorGames,
  onHideEmulatorGamesToggle,
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
          <p>Adjust the look of the arcade and manage saved data.</p>
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
          <label htmlFor="hideFlashGamesToggle" className="settings-switch">
            <div>
              <div className="settings-switch-title">hide flash games</div>
            </div>
            <input
              id="hideFlashGamesToggle"
              type="checkbox"
              className="settings-toggle-checkbox"
              checked={hideFlashGames}
              onChange={(e) => onHideFlashGamesToggle(e.target.checked)}
            />
          </label>
          <label htmlFor="hidePortGamesToggle" className="settings-switch">
            <div>
              <div className="settings-switch-title">hide ported games</div>
            </div>
            <input
              id="hidePortGamesToggle"
              type="checkbox"
              className="settings-toggle-checkbox"
              checked={hidePortGames}
              onChange={(e) => onHidePortGamesToggle(e.target.checked)}
            />
          </label>
          <label htmlFor="hideEmulatorGamesToggle" className="settings-switch">
            <div>
              <div className="settings-switch-title">hide emulator games</div>
            </div>
            <input
              id="hideEmulatorGamesToggle"
              type="checkbox"
              className="settings-toggle-checkbox"
              checked={hideEmulatorGames}
              onChange={(e) => onHideEmulatorGamesToggle(e.target.checked)}
            />
          </label>
        </section>

        <section className="settings-section">
          <div className="settings-section-title">data</div>
          <div className="settings-actions">
            <button id="exportProgress" onClick={onExport} className="settings-action">
              export website data
            </button>
            <button id="importProgress" onClick={onImportClick} className="settings-action">
              import website data
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
