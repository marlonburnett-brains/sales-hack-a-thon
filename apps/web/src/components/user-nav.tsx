"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link2, LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { GoogleTokenBadge } from "./google-token-badge";

interface UserNavProps {
  user: {
    name: string;
    email: string;
    avatarUrl: string;
  };
  collapsed?: boolean;
}

export function UserNav({ user, collapsed }: UserNavProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-3 rounded-md px-1 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${collapsed ? "" : "w-full hover:bg-slate-50"}`}
          aria-label="User menu"
        >
          <div className="relative shrink-0">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback>
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </AvatarFallback>
            </Avatar>
            <GoogleTokenBadge />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-slate-900">
                {user.name}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                scopes:
                  "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/documents",
                queryParams: {
                  hd: "lumenalta.com",
                  access_type: "offline",
                  prompt: "consent",
                },
                redirectTo: `${window.location.origin}/auth/callback`,
              },
            });
          }}
        >
          <Link2 className="mr-2 h-4 w-4" />
          <span>Connect Google</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
