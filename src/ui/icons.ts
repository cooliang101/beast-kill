// 器官/被动基因 SVG 图标（原 getOrganSvg 原样移植）。

export function getOrganSvg(id: string, color: string): string {
  const icons: Record<string, string> = {
    claw: `<path d="M4 20C8 14 14 8 21 4M8 22C12 16 16 11 22 8M2 16C6 11 11 6 17 3" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`,
    venom: `<path d="M12 3C12 3 6 10 6 15C6 18.3 8.7 21 12 21C15.3 21 18 18.3 18 15C18 10 12 3 12 3Z" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2"/><circle cx="10" cy="15" r="1.5" fill="#fff"/>`,
    horn: `<path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`,
    spikes: `<circle cx="12" cy="12" r="5" stroke="${color}" stroke-width="2" fill="none"/><path d="M12 2V6M12 18V22M2 12H6M18 12H22M4.9 4.9L7.8 7.8M16.2 16.2L19.1 19.1M19.1 4.9L16.2 7.8M7.8 16.2L4.9 19.1" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`,
    firesac: `<path d="M12 2C9 7 5 9 5 14C5 18 8 21 12 21C16 21 19 18 19 14C19 11 17 8 15 6C15 9 13 10 12 10C10 10 11 6 12 2Z" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="2"/>`,
    frost_b: `<path d="M12 2V22M2 12H22M5 5L19 19M19 5L5 19" stroke="${color}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="${color}"/>`,
    eye: `<path d="M2 12C5 7 9 5 12 5C15 5 19 7 22 12C19 17 15 19 12 19C9 19 5 17 2 12Z" stroke="${color}" stroke-width="2" fill="none"/><circle cx="10" cy="12" r="2.5" fill="${color}"/><circle cx="14" cy="12" r="2.5" fill="#fff"/>`,
    tentacle: `<path d="M6 21C6 15 10 14 10 9C10 5 14 3 17 5C19 7 16 11 14 13C12 15 15 19 18 21" stroke="${color}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
    wing_b: `<path d="M3 17C6 9 13 5 21 4C18 10 15 14 9 16C13 17 16 17 19 16" stroke="${color}" stroke-width="2.2" fill="${color}" fill-opacity="0.25" stroke-linecap="round"/>`,
    tail_h: `<path d="M4 18C8 18 10 14 13 10" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/><polygon points="13,5 20,7 18,14 11,12" fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="2"/>`,
    spore: `<circle cx="8" cy="9" r="3" fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="1.8"/><circle cx="16" cy="8" r="2.5" fill="${color}"/><circle cx="13" cy="16" r="3.5" fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="1.8"/>`,
    sonic: `<path d="M8 9C10 11 10 13 8 15M12 6C16 10 16 14 12 18M16 3C22 9 22 15 16 21" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="5" cy="12" r="2" fill="${color}"/>`,
  };
  const fallback = `<polygon points="12,3 20,8 20,16 12,21 4,16 4,8" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#fff"/>`;
  return `<svg viewBox="0 0 24 24" class="w-full h-full">${icons[id] || fallback}</svg>`;
}
