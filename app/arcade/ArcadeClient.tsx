"use client";

import { useEffect, useState, useCallback } from "react";
import Script from "next/script";
import Topbar from "@/components/Topbar";
import Bottombar from "@/components/Bottombar";
import SettingsPanel from "@/components/SettingsPanel";
import { generatePaletteFromHex } from "@/lib/colorUtils";

const defaultColor = "#FFFFFF";

export default function ArcadeClient() {
  const [customColor, setCustomColor] = useState(defaultColor);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showHomeButton, setShowHomeButton] = useState(true);
  const [hideFlashGames, setHideFlashGames] = useState(true);
  const [hidePortGames, setHidePortGames] = useState(false);
  const [hideEmulatorGames, setHideEmulatorGames] = useState(false);

  const getCookie = useCallback((name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop()!.split(";").shift() : null;
  }, []);

  const setCookie = useCallback((name: string, value: string, days?: number) => {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = `${name}=${value}${expires}; path=/`;
  }, []);

  const applyTheme = useCallback(
    (hexColor: string) => {
      const c = generatePaletteFromHex(hexColor);
      const root = document.documentElement;
      root.style.setProperty("--bg-color", c.bg);
      root.style.setProperty("--text-color", c.text);
      root.style.setProperty("--link-color", c.link);
      root.style.setProperty("--link-hover-color", c.hover);
      root.style.setProperty("--card-border-color", c.border);
      root.style.setProperty("--card-overlay-color", c.overlay);
      root.style.setProperty("--bottombar-border-color", c.bottomBorder);
      root.style.setProperty("--bottombar-opacity", String(c.opacity));

      document.querySelectorAll(".tos-button").forEach((btn) => {
        (btn as HTMLElement).style.backgroundColor = c.bg;
        (btn as HTMLElement).style.color = c.text;
        (btn as HTMLElement).style.borderColor = c.border;
      });

      const svg = document.querySelector(".topbar .logo svg");
      if (svg) svg.querySelectorAll("path").forEach((p) => p.setAttribute("fill", c.svgColor));

      setCustomColor(hexColor);
      setCookie("customColor", hexColor, 30);
    },
    [setCookie],
  );

  const toggleSettings = useCallback(() => {
    setSettingsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const savedColor = getCookie("customColor") || defaultColor;
    if (!getCookie("customColor")) setCookie("customColor", defaultColor, 30);
    applyTheme(savedColor);

    const savedShowHomeButton = getCookie("showHomeButton");
    if (savedShowHomeButton === null) {
      setCookie("showHomeButton", "true", 30);
      setShowHomeButton(true);
    } else {
      setShowHomeButton(savedShowHomeButton !== "false");
    }

    const savedHideFlashGames = getCookie("hideFlashGames");
    if (savedHideFlashGames === null) {
      setCookie("hideFlashGames", "true", 30);
      setHideFlashGames(true);
    } else {
      setHideFlashGames(savedHideFlashGames !== "false");
    }

    const savedHidePortGames = getCookie("hidePortGames");
    if (savedHidePortGames === null) {
      setCookie("hidePortGames", "false", 30);
      setHidePortGames(false);
    } else {
      setHidePortGames(savedHidePortGames === "true");
    }

    const savedHideEmulatorGames = getCookie("hideEmulatorGames");
    if (savedHideEmulatorGames === null) {
      setCookie("hideEmulatorGames", "false", 30);
      setHideEmulatorGames(false);
    } else {
      setHideEmulatorGames(savedHideEmulatorGames === "true");
    }
  }, [applyTheme, getCookie, setCookie]);

  useEffect(() => {
    applyTheme(customColor);
  }, [applyTheme, customColor]);

  useEffect(() => {
    const settingsButton = document.getElementById("settingsButton");
    settingsButton?.classList.toggle("settings-open", settingsOpen);
  }, [settingsOpen]);

  const exportProgress = useCallback(() => {
    const allStorage: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allStorage[key] = localStorage.getItem(key) || "";
    }
    const blob = new Blob([JSON.stringify(allStorage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "localStorage_backup.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const importProgress = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem("gameProgress", JSON.stringify(JSON.parse(reader.result as string)));
        alert("Game progress imported successfully!");
      } catch {
        alert("Invalid JSON file. Please select a valid game progress file.");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleImportClick = useCallback(() => {
    const input = document.getElementById("importFile") as HTMLInputElement | null;
    input?.click();
  }, []);

  return (
    <>
      <Script src="/js/themes.js" strategy="beforeInteractive" />

      {/* Now Topbar receives required props */}
      <Topbar color={customColor} onSettingsClick={toggleSettings} />

      <div className="main-content">
        {/* ... unchanged ... */}
      </div>

      <Bottombar />
      <SettingsPanel
        isOpen={settingsOpen}
        color={customColor}
        onColorChange={applyTheme}
        onExport={exportProgress}
        onImportClick={handleImportClick}
        onFileImport={importProgress}
        showHomeButton={showHomeButton}
        onHomeButtonToggle={(nextValue) => {
          setShowHomeButton(nextValue);
          setCookie("showHomeButton", String(nextValue), 30);
        }}
        hideFlashGames={hideFlashGames}
        onHideFlashGamesToggle={(nextValue) => {
          setHideFlashGames(nextValue);
          setCookie("hideFlashGames", String(nextValue), 30);
        }}
        hidePortGames={hidePortGames}
        onHidePortGamesToggle={(nextValue) => {
          setHidePortGames(nextValue);
          setCookie("hidePortGames", String(nextValue), 30);
        }}
        hideEmulatorGames={hideEmulatorGames}
        onHideEmulatorGamesToggle={(nextValue) => {
          setHideEmulatorGames(nextValue);
          setCookie("hideEmulatorGames", String(nextValue), 30);
        }}
      />
    </>
  );
}
