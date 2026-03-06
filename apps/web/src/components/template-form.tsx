"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, X, Loader2, AlertTriangle, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  SLIDES_URL_REGEX,
  extractPresentationId,
  TOUCH_TYPES,
} from "@/lib/template-utils";
import { createTemplateAction } from "@/lib/actions/template-actions";

const templateFormSchema = z.object({
  name: z.string().min(1, "Display name is required"),
  googleSlidesUrl: z
    .string()
    .min(1, "Google Slides URL is required")
    .regex(SLIDES_URL_REGEX, "Must be a valid Google Slides URL"),
  touchTypes: z.array(z.string()),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

interface TemplateFormProps {
  children: React.ReactNode;
  onSuccess?: (result?: { template: { id: string; accessStatus: string } }) => void;
}

export function TemplateForm({ children, onSuccess }: TemplateFormProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessAlert, setAccessAlert] = useState<string | null>(null);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      googleSlidesUrl: "",
      touchTypes: [],
    },
  });

  const urlValue = form.watch("googleSlidesUrl");
  const urlValid = SLIDES_URL_REGEX.test(urlValue);
  const urlTouched = urlValue.length > 0;

  const handleToggleTouchType = useCallback(
    (value: string, currentValues: string[]) => {
      if (currentValues.includes(value)) {
        return currentValues.filter((v) => v !== value);
      }
      return [...currentValues, value];
    },
    []
  );

  async function onSubmit(values: TemplateFormValues) {
    setIsSubmitting(true);
    setAccessAlert(null);

    try {
      const presentationId = extractPresentationId(values.googleSlidesUrl);
      if (!presentationId) {
        toast.error("Could not extract presentation ID from URL");
        return;
      }

      const result = await createTemplateAction({
        name: values.name,
        googleSlidesUrl: values.googleSlidesUrl,
        presentationId,
        touchTypes: values.touchTypes,
      });

      if (result.serviceAccountEmail) {
        setAccessAlert(result.serviceAccountEmail);
        toast.warning("Template created but file is not shared");
      } else {
        toast.success("Template added successfully");
        form.reset();
        setOpen(false);
        onSuccess?.({ template: result.template });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add template"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopyEmail() {
    if (accessAlert) {
      navigator.clipboard.writeText(accessAlert);
      toast.success("Email copied to clipboard");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          form.reset();
          setAccessAlert(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Template</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Q1 Proposal Deck" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="googleSlidesUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Slides URL</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="https://docs.google.com/presentation/d/..."
                        {...field}
                        className="pr-8"
                      />
                      {urlTouched && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2">
                          {urlValid ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </span>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="touchTypes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Touch Types <span className="text-sm font-normal text-slate-400">(optional)</span></FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {TOUCH_TYPES.map((type) => {
                      const selected = field.value.includes(type.value);
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() =>
                            field.onChange(
                              handleToggleTouchType(type.value, field.value)
                            )
                          }
                          className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-200 ${
                            selected
                              ? "border-blue-300 bg-blue-100 text-blue-800"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {accessAlert && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800">
                    File not shared with service account
                  </p>
                  <p className="mt-1 text-amber-700">
                    Share this file with:
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                      {accessAlert}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="cursor-pointer rounded p-1 text-amber-600 transition-colors hover:bg-amber-100"
                      aria-label="Copy service account email"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Template
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
