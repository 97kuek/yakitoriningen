// Revoking right after click() can cancel the download in some browsers.
const REVOKE_DELAY_MS = 1000;

export function download(
  text: string,
  name: string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
