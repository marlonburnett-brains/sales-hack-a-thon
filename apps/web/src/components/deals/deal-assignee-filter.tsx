"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { KnownUser } from "@/lib/api-client";

interface DealAssigneeFilterProps {
  currentAssignee: string;
  knownUsers: KnownUser[];
}

export function DealAssigneeFilter({
  currentAssignee,
  knownUsers,
}: DealAssigneeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("assignee");
    } else {
      params.set("assignee", value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select value={currentAssignee} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-[160px] text-xs">
        <SelectValue placeholder="All deals" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-xs">
          All deals
        </SelectItem>
        <SelectItem value="me" className="text-xs">
          Assigned to me
        </SelectItem>
        <Separator className="my-1" />
        {knownUsers.map((user) => (
          <SelectItem key={user.id} value={user.id} className="text-xs">
            {user.name || user.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
