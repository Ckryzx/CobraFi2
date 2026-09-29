import { getNetworkDetails, isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";

export async function connectFreighter(): Promise<string> {
  const conn = await isConnected();
  if (!conn.isConnected) throw new Error("No se detectó Freighter. Instala la extensión desde freighter.app");
  const access = await requestAccess();
  if (access.error) throw new Error(access.error.message ?? "No se pudo conectar con Freighter");
  return access.address;
}

export async function assertNetwork(expectedPassphrase: string): Promise<void> {
  const net = await getNetworkDetails();
  if (net.error) return; // versiones antiguas: la firma fallará si la red no coincide
  if (net.networkPassphrase !== expectedPassphrase) {
    throw new Error(`Freighter está en la red "${net.network}". Cámbiala a Testnet.`);
  }
}

export async function signWithFreighter(xdr: string, networkPassphrase: string, address?: string): Promise<string> {
  await assertNetwork(networkPassphrase);
  const res = await signTransaction(xdr, { networkPassphrase, address });
  if (res.error) throw new Error(res.error.message ?? "Firma cancelada");
  return res.signedTxXdr;
}
