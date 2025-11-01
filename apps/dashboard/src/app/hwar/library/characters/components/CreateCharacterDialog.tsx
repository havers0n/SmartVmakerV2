"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/shared/components/ui/form";
import { useToast } from "@/shared/hooks/use-toast";
import { createCharacter } from "@/shared/api/actions";
import { Plus, X } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  basePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  referenceImageUrls: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateCharacterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCharacterDialog({
  open,
  onOpenChange,
}: CreateCharacterDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      basePrompt: "",
      negativePrompt: "",
      referenceImageUrls: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createCharacter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast({
        title: "Success",
        description: "Character created successfully",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create character",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      // Parse reference image URLs from newline/comma-separated string
      const referenceImageUrls = values.referenceImageUrls
        ? values.referenceImageUrls
            .split(/[\n,]/)
            .map((url) => url.trim())
            .filter(Boolean)
        : undefined;

      // Build style presets object
      const stylePresets: Record<string, string> = {};
      if (values.basePrompt) stylePresets.base_prompt = values.basePrompt;
      if (values.negativePrompt) stylePresets.negative_prompt = values.negativePrompt;

      await createMutation.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        stylePresets: Object.keys(stylePresets).length > 0 ? stylePresets : undefined,
        referenceImageUrls,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Character</DialogTitle>
          <DialogDescription>
            Create a character profile with reference images and style presets
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Fluffy Corgi" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="A cute, fluffy corgi puppy with big ears and a friendly smile..."
                      {...field}
                      disabled={isSubmitting}
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe the character's appearance and personality
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Style Presets</h3>

              <FormField
                control={form.control}
                name="basePrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="cute puppy, corgi, fluffy, big ears, photorealistic"
                        {...field}
                        disabled={isSubmitting}
                        rows={2}
                      />
                    </FormControl>
                    <FormDescription>
                      Keywords and styles for AI image generation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="negativePrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Negative Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="blurry, low quality, ugly, deformed"
                        {...field}
                        disabled={isSubmitting}
                        rows={2}
                      />
                    </FormControl>
                    <FormDescription>
                      What to avoid in image generation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="referenceImageUrls"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Image URLs</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                      {...field}
                      disabled={isSubmitting}
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>
                    One URL per line or comma-separated
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Character"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
