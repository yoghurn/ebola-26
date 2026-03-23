"use client";

import { useEffect, useState, useCallback } from "react";
import Script from "next/script";
import Topbar from "@/components/Topbar";
import Bottombar from "@/components/Bottombar";
import SettingsPanel from "@/components/SettingsPanel";

const themeNames: ThemeName[] = ["orange", "purple", "green", "teal", "rose", "blue"];

export default function ArcadeClient() {
  const [theme, setThemeState] = useState<ThemeName>("orange");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showHomeButton, setShowHomeButton] = useState(true);

  const isThemeName = useCallback(
    (value: string): value is ThemeName => themeNames.includes(value as ThemeName),
    [],
  );

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
    (themeName: ThemeName) => {
      // @ts-expect-error global from themes.js
      const c = window.colors?.[themeName];
      if (!c) return;

      const root = document.documentElement;
      root.style.setProperty("--bg-color", c.bg);
      root.style.setProperty("--text-color", c.text);
      root.style.setProperty("--link-color", c.link);
      root.style.setProperty("--link-hover-color", c.hover);
      root.style.setProperty("--card-border-color", c.border);
      root.style.setProperty("--card-overlay-color", c.overlay);
      root.style.setProperty("--bottombar-border-color", c.bottomBorder);
      root.style.setProperty("--bottombar-opacity", c.opacity);

      document.querySelectorAll(".tos-button").forEach((btn) => {
        (btn as HTMLElement).style.backgroundColor = c.bg;
        (btn as HTMLElement).style.color = c.text;
        (btn as HTMLElement).style.borderColor = c.border;
      });

      const svg = document.querySelector(".topbar .logo svg");
      if (svg) svg.querySelectorAll("path").forEach((p) => p.setAttribute("fill", c.svgColor));

      setCookie("theme", themeName, 30);
    },
    [setCookie],
  );

  const toggleSettings = useCallback(() => {
    setSettingsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const savedTheme = getCookie("theme");
    const initialTheme = savedTheme && isThemeName(savedTheme) ? savedTheme : "orange";
    if (!savedTheme) setCookie("theme", "orange", 30);

    setThemeState(initialTheme);
    const savedShowHomeButton = getCookie("showHomeButton");
    if (savedShowHomeButton === null) {
      setCookie("showHomeButton", "true", 30);
      setShowHomeButton(true);
    } else {
      setShowHomeButton(savedShowHomeButton !== "false");
    }
  }, [getCookie, isThemeName, setCookie]);

  useEffect(() => {
    applyTheme(theme);
  }, [applyTheme, theme]);

  useEffect(() => {
    const settingsButton = document.getElementById("settingsButton");
    settingsButton?.classList.toggle("settings-open", settingsOpen);
  }, [settingsOpen]);

  const handleThemeChange = useCallback(
    (themeName: string) => {
      if (!isThemeName(themeName)) return;
      setThemeState(themeName);
    },
    [isThemeName],
  );

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
      <Topbar color={theme} onSettingsClick={toggleSettings} />

      <div className="main-content">
        {/* ... unchanged ... */}
      </div>

      <Bottombar />
      <SettingsPanel
        isOpen={settingsOpen}
        theme={theme}
        onThemeChange={handleThemeChange}
        onExport={exportProgress}
        onImportClick={handleImportClick}
        onFileImport={importProgress}
        showHomeButton={showHomeButton}
        onHomeButtonToggle={(nextValue) => {
          setShowHomeButton(nextValue);
          setCookie("showHomeButton", String(nextValue), 30);
        }}
      />
    </>
  );
}
