import { useState, useCallback, useEffect } from "react";
import { connect as stacksConnect } from "@stacks/connect";
import { formatAddress } from "@/lib/format";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  displayAddress: string;
  connect: () => void;
  disconnect: () => void;
}

const STORAGE_KEY = "cashflow_wallet";

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); }
    catch { return null; }
  });

  const isConnected = !!address;
  const displayAddress = address ? formatAddress(address) : "";

  useEffect(() => {
    if (address) localStorage.setItem(STORAGE_KEY, address);
    else localStorage.removeItem(STORAGE_KEY);
  }, [address]);

  const connect = useCallback(async () => {
    try {
      console.log("[CashFlow] Requesting wallet connection...");
      const response = await stacksConnect();
      console.log("[CashFlow] Wallet response:", JSON.stringify(response, null, 2));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const addresses = response.addresses.filter((a: any) =>
        a.purpose === "stacks" || a.addressType === "stacks" || a.symbol === "STX"
      );

      // Prefer testnet (ST) address over mainnet (SP)
      const testnetAddr = addresses.find((a: any) => a.address?.startsWith("ST"));
      const stxAddress = testnetAddr || addresses[0];

      if (stxAddress) {
        setAddress(stxAddress.address);
      }
    } catch (err) {
      console.error("[CashFlow] Wallet connection failed:", err);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { address, isConnected, displayAddress, connect, disconnect };
}
