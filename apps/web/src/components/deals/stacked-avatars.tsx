"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Person {
  id?: string;
  email: string;
  name?: string;
}

interface StackedAvatarsProps {
  people: Person[];
  max?: number;
}

function getInitials(person: Person): string {
  if (person.name) {
    const parts = person.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
  return person.email[0].toUpperCase();
}

function getDisplayName(person: Person): string {
  return person.name || person.email;
}

export function StackedAvatars({ people, max = 3 }: StackedAvatarsProps) {
  if (people.length === 0) return null;

  const visible = people.slice(0, max);
  const overflow = people.length - max;

  return (
    <div className="flex -space-x-2">
      {visible.map((person, idx) => (
        <Avatar
          key={person.id || person.email || idx}
          className="h-7 w-7 border-2 border-white"
          title={getDisplayName(person)}
        >
          <AvatarFallback className="bg-blue-100 text-xs text-blue-800">
            {getInitials(person)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-600"
          title={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
