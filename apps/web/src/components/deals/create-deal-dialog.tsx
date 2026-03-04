"use client";

import { useState, type ReactNode } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDealAction } from "@/lib/actions/deal-actions";
import { Loader2 } from "lucide-react";

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
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
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
