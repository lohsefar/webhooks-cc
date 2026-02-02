"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApiKeyDialog } from "@/components/account/api-key-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import { Trash2, Github } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function UsageResetCountdown({ periodEnd }: { periodEnd: number }) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const remaining = periodEnd - Date.now();
      if (remaining <= 0) {
        setTimeRemaining("Resets on next request");
        return;
      }
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`Resets in ${hours}h ${minutes}m`);
    };
    update();
    const interval = setInterval(update, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [periodEnd]);

  return <span>{timeRemaining}</span>;
}

export default function AccountPage() {
  const user = useQuery(api.users.current);
  const apiKeys = useQuery(api.apiKeys.list);
  const authProviders = useQuery(api.users.getAuthProviders);
  const revokeApiKey = useMutation(api.apiKeys.revoke);
  const deleteAccountMutation = useMutation(api.users.deleteAccount);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<Id<"apiKeys"> | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (user === undefined) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (user === null) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <p className="text-muted-foreground">User not found</p>
      </main>
    );
  }

  const usagePercent =
    user.requestLimit > 0 ? Math.min((user.requestsUsed / user.requestLimit) * 100, 100) : 0;

  const handleRevoke = async () => {
    if (!revokeKeyId) return;
    setRevokeError(null);
    try {
      await revokeApiKey({ id: revokeKeyId });
      setRevokeKeyId(null);
    } catch (error) {
      console.error("Failed to revoke API key:", error);
      setRevokeError("Failed to revoke API key. Please try again.");
    }
  };

  const handleFirstDeleteConfirm = () => {
    setDeleteDialogOpen(false);
    setConfirmDialogOpen(true);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    // Keep dialog open during operation so user can see errors
    try {
      await deleteAccountMutation({});
      setConfirmDialogOpen(false);
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Failed to delete account:", error);
      setDeleteError("Failed to delete account. Please try again.");
      setIsDeleting(false);
      // Dialog remains open so user can see the error
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
      {/* Account Info */}
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Account</h1>

        <div className="border rounded-lg p-6 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{user.name || user.email}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={user.plan === "pro" ? "default" : "secondary"}>
                {user.plan === "pro" ? "Pro" : "Free"}
              </Badge>
              {authProviders?.map((provider) => (
                <Badge key={provider} variant="outline" className="capitalize">
                  {provider === "github" ? (
                    <span className="flex items-center gap-1">
                      <Github className="h-3 w-3" />
                      GitHub
                    </span>
                  ) : provider === "google" ? (
                    <span className="flex items-center gap-1">
                      <svg className="h-3 w-3" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </span>
                  ) : (
                    provider
                  )}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Usage */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Usage</h2>

        <div className="border rounded-lg p-6 space-y-4 bg-card">
          <div className="flex justify-between text-sm">
            <span>{user.plan === "free" ? "Requests today" : "Requests this period"}</span>
            <span className="font-medium">
              {user.requestsUsed.toLocaleString()} / {user.requestLimit.toLocaleString()}
            </span>
          </div>

          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${usagePercent}%` }}
            />
          </div>

          {user.plan === "free" && (
            <>
              <div className="text-sm text-muted-foreground">
                {user.periodEnd ? (
                  <UsageResetCountdown periodEnd={user.periodEnd} />
                ) : (
                  "Resets on first request"
                )}
              </div>
              <div className="pt-2">
                <Button asChild>
                  <Link href="/upgrade">Upgrade to Pro</Link>
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Get 500,000 requests/month and 30-day data retention
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* API Keys */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">API Keys</h2>
          <ApiKeyDialog />
        </div>

        <div className="border rounded-lg divide-y bg-card">
          {apiKeys === undefined ? (
            <div className="p-4 text-muted-foreground">Loading...</div>
          ) : apiKeys.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <p>No API keys yet</p>
              <p className="text-sm mt-1">
                Create an API key to access webhooks.cc programmatically
              </p>
            </div>
          ) : (
            apiKeys.map((key) => (
              <div key={key._id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{key.keyPrefix}...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && (
                      <> &middot; Last used {new Date(key.lastUsedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRevokeKeyId(key._id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Revoke API key ${key.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Delete Account */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-destructive">Delete Account</h2>

        <div className="border border-destructive/20 rounded-lg p-6 bg-card">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data including endpoints, requests,
            and API keys. This action cannot be undone.
          </p>
          <Button
            variant="destructive"
            className="mt-4"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Account"}
          </Button>
          {deleteError && <p className="text-sm text-destructive mt-2">{deleteError}</p>}
        </div>
      </section>

      {/* Revoke API Key Dialog */}
      <AlertDialog
        open={revokeKeyId !== null}
        onOpenChange={(open) => !open && setRevokeKeyId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this API key? Any applications using this key will no
              longer be able to access webhooks.cc.
            </AlertDialogDescription>
            {revokeError && <p className="text-sm text-destructive mt-2">{revokeError}</p>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRevokeError(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account - First Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? This action cannot be undone. All your
              endpoints, requests, and API keys will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFirstDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account - Final Confirmation */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Final Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              This is your last chance. Are you ABSOLUTELY sure you want to delete your account?
              This action is irreversible.
            </AlertDialogDescription>
            {deleteError && <p className="text-sm text-destructive mt-2">{deleteError}</p>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete My Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
