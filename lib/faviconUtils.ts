/**
 * Utility function to update the favicon with theme colors
 */
export async function updateFaviconWithTheme(bgColor: string, textColor: string) {
  try {
    // Fetch the base flaticon.svg
    const response = await fetch('/assets/flaticon.svg');
    let svg = await response.text();

    // Replace background color (#333333) with theme background
    svg = svg.replace(/#333333/g, bgColor);

    // Replace text/icon color (white) with theme text color
    svg = svg.replace(/fill="white"/g, `fill="${textColor}"`);

    // Create a data URI from the modified SVG
    const dataUri = 'data:image/svg+xml;base64,' + btoa(svg);

    // Find or create the favicon link element
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }

    // Update the href with the new data URI
    faviconLink.href = dataUri;
  } catch (error) {
    console.error('Could not update favicon with theme:', error);
  }
}
