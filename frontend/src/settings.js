import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '' : 'http://localhost:5000');
const API = import.meta.env.VITE_API_URL || `${API_BASE}/api/v1`;

export const MAX_LOGO_BYTES = 4 * 1024 * 1024;
export const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
export const resolveLogoUrl = value => value ? (value.startsWith('http') ? value : `${API_BASE}${value}`) : null;

export async function fetchLogo(options) {
  const { data } = await axios.get(`${API}/settings/logo`, options);
  if (!data || !Object.hasOwn(data, 'logo_url') || (data.logo_url !== null && typeof data.logo_url !== 'string')) {
    throw new Error('Respons logo tidak valid. Silakan muat ulang.');
  }
  return data;
}

export async function fetchKop(options) {
  const { data } = await axios.get(`${API}/settings/kop`, options);
  if (!data || typeof data.APP_TITLE !== 'string') {
    throw new Error('Respons kop surat tidak valid. Silakan muat ulang.');
  }
  return data;
}

export async function fetchLembar(options) {
  const { data } = await axios.get(`${API}/settings/lembar`, options);
  if (!data || typeof data.LEMBAR1_PENGANTAR !== 'string') {
    throw new Error('Respons pengaturan lembar tidak valid. Silakan muat ulang.');
  }
  return data;
}
