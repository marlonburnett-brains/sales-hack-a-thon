"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { UserCircle, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { updateDealAssignmentAction } from "@/lib/actions/deal-actions";
import type { KnownUser } from "@/lib/api-client";

interface DealAssignmentPickerProps {
  dealId: string;
  currentOwnerId?: string | null;
  currentOwnerEmail?: string | null;
  currentOwnerName?: string | null;
  currentCollaborators: Array<{ id?: string; email: string; name?: string }>;
  knownUsers: KnownUser[];
  onAssignmentChange?: () => void;
}

export function DealAssignmentPicker({
  dealId,
  currentOwnerId,
  currentOwnerEmail,
  currentOwnerName,
  currentCollaborators,
  knownUsers,
  onAssignmentChange,
}: DealAssignmentPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [collabSearch, setCollabSearch] = useState("");
  const [updating, setUpdating] = useState(false);

  const ownerLabel = currentOwnerName || currentOwnerEmail || "Assign owner";

  const filteredOwnersUsers = useMemo(() => {
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

  const collabEmails = new Set(currentCollaborators.map((c) => c.email));

  function isValidEmail(email: string) {
    return email.endsWith("@lumenalta.com") && email.includes("@");
  }

  async function saveAssignment(data: {
    ownerId?: string;
    ownerEmail?: string;
    ownerName?: string;
    collaborators?: Array<{ id?: string; email: string; name?: string }>;
  }) {
    setUpdating(true);
    try {
      await updateDealAssignmentAction(dealId, data);
      toast.success("Assignment updated");
      onAssignmentChange?.();
      router.refresh();
    } catch (err) {
      toast.error("Failed to update assignment");
      console.error(err);
    } finally {
      setUpdating(false);
    }
  }

  function handleSetOwner(user: KnownUser) {
    saveAssignment({
      ownerId: user.id,
      ownerEmail: user.email,
      ownerName: user.name,
    });
  }

  function handleFreeformOwner() {
    const email = ownerSearch.trim();
    if (!isValidEmail(email)) {
      toast.error("Email must end with @lumenalta.com");
      return;
    }
    const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    saveAssignment({ ownerEmail: email, ownerName: name });
    setOwnerSearch("");
  }

  function handleToggleCollaborator(user: KnownUser) {
    let newCollabs: Array<{ id?: string; email: string; name?: string }>;
    if (collabEmails.has(user.email)) {
      newCollabs = currentCollaborators.filter((c) => c.email !== user.email);
    } else {
      newCollabs = [
        ...currentCollaborators,
        { id: user.id, email: user.email, name: user.name },
      ];
    }
    saveAssignment({ collaborators: newCollabs });
  }

  function handleRemoveCollaborator(email: string) {
    const newCollabs = currentCollaborators.filter((c) => c.email !== email);
    saveAssignment({ collaborators: newCollabs });
  }

  function handleFreeformCollaborator() {
    const email = collabSearch.trim();
    if (!isValidEmail(email)) {
      toast.error("Email must end with @lumenalta.com");
      return;
    }
    if (collabEmails.has(email)) {
      toast.error("Already a collaborator");
      return;
    }
    const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const newCollabs = [
      ...currentCollaborators,
      { email, name },
    ];
    saveAssignment({ collaborators: newCollabs });
    setCollabSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <UserCircle className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">{ownerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Owner section */}
        <div className="p-3">
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Owner
          </p>
          <Input
            placeholder="Search or type email..."
            value={ownerSearch}
            onChange={(e) => setOwnerSearch(e.target.value)}
            className="mb-2 h-8 text-xs"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {filteredOwnersUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                disabled={updating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetOwner(user);
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-slate-100 ${
                  user.email === currentOwnerEmail
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700"
                }`}
              >
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-slate-400">{user.email}</span>
              </button>
            ))}
            {filteredOwnersUsers.length === 0 && ownerSearch.trim() && (
              <button
                type="button"
                disabled={updating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFreeformOwner();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-3 w-3" />
                Use &quot;{ownerSearch.trim()}&quot;
              </button>
            )}
          </div>
        </div>

        <Separator />

        {/* Collaborators section */}
        <div className="p-3">
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Collaborators
          </p>

          {/* Current collaborators */}
          {currentCollaborators.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {currentCollaborators.map((c) => (
                <span
                  key={c.email}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                >
                  {c.name || c.email}
                  <button
                    type="button"
                    disabled={updating}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCollaborator(c.email);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <Input
            placeholder="Search or type email..."
            value={collabSearch}
            onChange={(e) => setCollabSearch(e.target.value)}
            className="mb-2 h-8 text-xs"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {filteredCollabUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                disabled={updating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCollaborator(user);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                <Checkbox
                  checked={collabEmails.has(user.email)}
                  className="h-3.5 w-3.5 pointer-events-none"
                />
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-slate-400">{user.email}</span>
              </button>
            ))}
            {filteredCollabUsers.length === 0 && collabSearch.trim() && (
              <button
                type="button"
                disabled={updating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFreeformCollaborator();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-3 w-3" />
                Add &quot;{collabSearch.trim()}&quot;
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
