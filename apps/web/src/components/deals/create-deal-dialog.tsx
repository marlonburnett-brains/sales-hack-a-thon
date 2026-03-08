"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES } from "@lumenalta/schemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDealAction, listKnownUsersAction } from "@/lib/actions/deal-actions";
import { Loader2, Plus, X } from "lucide-react";
import type { KnownUser } from "@/lib/api-client";

interface CreateDealDialogProps {
  children: ReactNode;
}

export function CreateDealDialog({ children }: CreateDealDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [dealName, setDealName] = useState("");
  const [salespersonName, setSalespersonName] = useState("");
  const [salespersonPhoto, setSalespersonPhoto] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Owner & collaborator state
  const [knownUsers, setKnownUsers] = useState<KnownUser[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<{
    id?: string;
    email: string;
    name?: string;
  } | null>(null);
  const [collaborators, setCollaborators] = useState<
    Array<{ id?: string; email: string; name?: string }>
  >([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [collabSearch, setCollabSearch] = useState("");

  useEffect(() => {
    if (open) {
      listKnownUsersAction()
        .then(setKnownUsers)
        .catch(() => {});
    }
  }, [open]);

  const filteredOwnerUsers = useMemo(() => {
    const q = ownerSearch.toLowerCase().trim();
    if (!q) return knownUsers;
    return knownUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [knownUsers, ownerSearch]);

  const filteredCollabUsers = useMemo(() => {
    const q = collabSearch.toLowerCase().trim();
    if (!q) return knownUsers;
    return knownUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [knownUsers, collabSearch]);

  const collabEmails = new Set(collaborators.map((c) => c.email));

  function isValidEmail(email: string) {
    return email.endsWith("@lumenalta.com") && email.includes("@");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !industry || !dealName) return;

    setLoading(true);
    try {
      const deal = await createDealAction({
        companyName,
        industry,
        dealName,
        salespersonName: salespersonName || undefined,
        salespersonPhoto: salespersonPhoto || undefined,
        logoUrl: logoUrl || undefined,
        ownerId: selectedOwner?.id,
        ownerEmail: selectedOwner?.email,
        ownerName: selectedOwner?.name,
        collaborators: collaborators.length > 0 ? collaborators : undefined,
      });

      setOpen(false);
      resetForm();
      router.push(`/deals/${deal.id}`);
    } catch (err) {
      console.error("Failed to create deal:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCompanyName("");
    setIndustry("");
    setDealName("");
    setSalespersonName("");
    setSalespersonPhoto("");
    setLogoUrl("");
    setSelectedOwner(null);
    setCollaborators([]);
    setOwnerSearch("");
    setCollabSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
          <DialogDescription>
            Set up a new deal to start generating GTM assets.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select value={industry} onValueChange={setIndustry} required>
              <SelectTrigger id="industry" className="cursor-pointer">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((ind) => (
                  <SelectItem
                    key={ind}
                    value={ind}
                    className="cursor-pointer"
                  >
                    {ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dealName">Deal Name</Label>
            <Input
              id="dealName"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              placeholder="e.g. Q1 2026 Enterprise Pitch"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salesperson">Salesperson Name</Label>
            <Input
              id="salesperson"
              value={salespersonName}
              onChange={(e) => setSalespersonName(e.target.value)}
              placeholder="e.g. Jane Smith (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salespersonPhoto">Salesperson Photo URL</Label>
            <Input
              id="salespersonPhoto"
              value={salespersonPhoto}
              onChange={(e) => setSalespersonPhoto(e.target.value)}
              placeholder="https://... (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Customer Logo URL</Label>
            <Input
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://... (optional)"
            />
          </div>

          <Separator />

          {/* Owner section */}
          <div className="space-y-2">
            <Label>Owner (optional)</Label>
            {selectedOwner ? (
              <div className="flex items-center gap-2 rounded border border-slate-200 px-3 py-1.5 text-sm">
                <span className="flex-1 truncate">
                  {selectedOwner.name || selectedOwner.email}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOwner(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search users or type email..."
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                {ownerSearch.trim() && (
                  <div className="max-h-28 overflow-y-auto rounded border border-slate-200 bg-white">
                    {filteredOwnerUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedOwner({
                            id: user.id,
                            email: user.email,
                            name: user.name,
                          });
                          setOwnerSearch("");
                        }}
                        className="flex w-full items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        <span className="font-medium">{user.name}</span>
                        <span className="text-slate-400">{user.email}</span>
                      </button>
                    ))}
                    {filteredOwnerUsers.length === 0 &&
                      isValidEmail(ownerSearch.trim()) && (
                        <button
                          type="button"
                          onClick={() => {
                            const email = ownerSearch.trim();
                            const name = email
                              .split("@")[0]
                              .replace(/[._-]/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                            setSelectedOwner({ email, name });
                            setOwnerSearch("");
                          }}
                          className="flex w-full items-center gap-2 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                        >
                          <Plus className="h-3 w-3" />
                          Use &quot;{ownerSearch.trim()}&quot;
                        </button>
                      )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Collaborators section */}
          <div className="space-y-2">
            <Label>Collaborators (optional)</Label>
            {collaborators.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {collaborators.map((c) => (
                  <span
                    key={c.email}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                  >
                    {c.name || c.email}
                    <button
                      type="button"
                      onClick={() =>
                        setCollaborators((prev) =>
                          prev.filter((p) => p.email !== c.email)
                        )
                      }
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              placeholder="Search users or type email..."
              value={collabSearch}
              onChange={(e) => setCollabSearch(e.target.value)}
              className="h-8 text-xs"
            />
            {collabSearch.trim() && (
              <div className="max-h-28 overflow-y-auto rounded border border-slate-200 bg-white">
                {filteredCollabUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      if (!collabEmails.has(user.email)) {
                        setCollaborators((prev) => [
                          ...prev,
                          { id: user.id, email: user.email, name: user.name },
                        ]);
                      }
                      setCollabSearch("");
                    }}
                    className="flex w-full items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <Checkbox
                      checked={collabEmails.has(user.email)}
                      className="h-3.5 w-3.5 pointer-events-none"
                    />
                    <span className="font-medium">{user.name}</span>
                    <span className="text-slate-400">{user.email}</span>
                  </button>
                ))}
                {filteredCollabUsers.length === 0 &&
                  isValidEmail(collabSearch.trim()) &&
                  !collabEmails.has(collabSearch.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        const email = collabSearch.trim();
                        const name = email
                          .split("@")[0]
                          .replace(/[._-]/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase());
                        setCollaborators((prev) => [...prev, { email, name }]);
                        setCollabSearch("");
                      }}
                      className="flex w-full items-center gap-2 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      <Plus className="h-3 w-3" />
                      Add &quot;{collabSearch.trim()}&quot;
                    </button>
                  )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !companyName || !industry || !dealName}
              className="cursor-pointer min-w-[120px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Deal"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
