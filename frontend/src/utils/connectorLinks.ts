export function buildConnectorPath(stationId: number, chargerId: number, connectorId: number): string {
  return `/station/${stationId}/charger/${chargerId}/connector/${connectorId}`;
}

export function buildConnectorUrl(stationId: number, chargerId: number, connectorId: number): string {
  const path = buildConnectorPath(stationId, chargerId, connectorId);
  return `${window.location.origin}${path}`;
}

export async function downloadConnectorQr(url: string, fileNameBase: string): Promise<void> {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}`;

  try {
    const response = await fetch(qrUrl);
    if (!response.ok) {
      throw new Error(`Failed to generate QR (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${fileNameBase}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(qrUrl, '_blank', 'noopener,noreferrer');
  }
}
