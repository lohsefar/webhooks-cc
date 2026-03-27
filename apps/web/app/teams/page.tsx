"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  role: "owner" | "member";
}

interface Invite {
  id: string;
  teamId: string;
  teamName: string;
  inviterEmail: string;
  createdAt: string;
}

export default function TeamsPage() {
  const { session, isLoading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const authHeader: Record<string, string> = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const fetchData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const [teamsRes, invitesRes] = await Promise.all([
        fetch("/api/teams", { headers: authHeader }),
        fetch("/api/invites", { headers: authHeader }),
      ]);
      if (teamsRes.ok) {
        const data: Team[] = await teamsRes.json();
        setTeams(data);
      }
      if (invitesRes.ok) {
        const data: Invite[] = await invitesRes.json();
        setInvites(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && session) {
      void fetchData();
    } else if (!authLoading && !session) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      if (res.ok) {
        setNewTeamName("");
        setCreateOpen(false);
        await fetchData();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAccept = async (inviteId: string) => {
    setAcceptingId(inviteId);
    try {
      const res = await fetch(`/api/invites/${inviteId}/accept`, {
        method: "POST",
        headers: authHeader,
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = async (inviteId: string) => {
    setDecliningId(inviteId);
    try {
      const res = await fetch(`/api/invites/${inviteId}/decline`, {
        method: "POST",
        headers: authHeader,
      });
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      }
    } finally {
      setDecliningId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </main>
    );
  }

  const ownedTeams = teams.filter((t) => t.role === "owner");
  const memberTeams = teams.filter((t) => t.role === "member");

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new team</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                placeholder="e.g. Acme Corp"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateTeam();
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreateTeam()}
                disabled={creating || !newTeamName.trim()}
              >
                {creating ? "Creating..." : "Create team"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pending Invites
          </h2>
          <div className="border rounded-lg bg-card divide-y">
            {invites.map((invite) => (
              <div key={invite.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{invite.teamName}</p>
                  <p className="text-sm text-muted-foreground">
                    Invited by {invite.inviterEmail}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleAccept(invite.id)}
                    disabled={acceptingId === invite.id || decliningId === invite.id}
                  >
                    {acceptingId === invite.id ? "Accepting..." : "Accept"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDecline(invite.id)}
                    disabled={acceptingId === invite.id || decliningId === invite.id}
                  >
                    {decliningId === invite.id ? "Declining..." : "Decline"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My Teams */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          My Teams
        </h2>
        {ownedTeams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have not created any teams yet.
          </p>
        ) : (
          <div className="border rounded-lg bg-card divide-y">
            {ownedTeams.map((team) => (
              <div key={team.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{team.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/teams/${team.id}`}>Manage</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Teams I'm In */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Teams I&apos;m In
        </h2>
        {memberTeams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You are not a member of any teams.
          </p>
        ) : (
          <div className="border rounded-lg bg-card divide-y">
            {memberTeams.map((team) => (
              <div key={team.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{team.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/teams/${team.id}`}>View</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {teams.length === 0 && invites.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No teams yet. Create one or ask a team owner to invite you.
        </p>
      )}
    </main>
  );
}
