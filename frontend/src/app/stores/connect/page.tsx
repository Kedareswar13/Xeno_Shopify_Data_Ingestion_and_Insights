"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { shopifyService } from "@/lib/shopify";

export default function ConnectStorePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res: any = await shopifyService.connectStore({
        name: name?.trim() || undefined,
        domain: domain.trim(),
        accessToken: token.trim(),
      });
      const store = res?.data?.store ?? res?.store ?? res?.data ?? res;
      const storeId = store?.id as string | undefined;
      // Trigger manual sync once connected (per requirement)
      if (storeId) {
        try { await shopifyService.manualSync(storeId); } catch {}
      }
      router.replace("/stores");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to connect store";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Connect Shopify Store</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-blue-200 mb-1">Store Name (optional)</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Store"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1">MyShopify Domain</label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1">Admin Access Token</label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="shpat_..."
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : null}
            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Connecting..." : "Connect & Sync"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/stores")}>Cancel</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We’ll validate the domain and token, add the store to your account, and start a one-time sync. You can trigger manual syncs later from the Stores page or Dashboard.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
