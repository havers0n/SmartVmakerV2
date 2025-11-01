"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useToast } from "@/shared/hooks/use-toast";
import { createStoryTemplate } from "@/shared/api/actions";
import { Plus, Trash2, MoveUp, MoveDown } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";

const beatSchema = z.object({
  order: z.number().int().min(0),
  phase: z.enum(["HOOK", "BUILD", "PAYOFF", "RESOLUTION"]),
  durationSeconds: z.coerce.number().positive("Duration must be positive"),
  description: z.string().min(1, "Description is required"),
  actionPrompt: z.string().optional(),
  emotion: z.enum([
    "joy",
    "sadness",
    "surprise",
    "anticipation",
    "tension",
    "relief",
    "empathy",
    "curiosity",
    "humor",
    "awe",
  ]),
  contrast: z
    .enum([
      "small_vs_big",
      "slow_vs_fast",
      "alone_vs_together",
      "sad_vs_happy",
      "problem_vs_solution",
      "before_vs_after",
    ])
    .optional(),
  intendedImpact: z.string().optional(),
});

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  tags: z.string().optional(),
  targetDurationSeconds: z.coerce.number().int().positive("Duration must be positive"),
  beats: z.array(beatSchema).min(1, "At least one beat is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateStoryTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStoryTemplateDialog({
  open,
  onOpenChange,
}: CreateStoryTemplateDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      tags: "",
      targetDurationSeconds: 60,
      beats: [
        {
          order: 0,
          phase: "HOOK",
          durationSeconds: 10,
          description: "",
          emotion: "curiosity",
        },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "beats",
  });

  const createMutation = useMutation({
    mutationFn: createStoryTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storyTemplates"] });
      toast({
        title: "Success",
        description: "Story template created successfully",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      // Parse tags from comma-separated string
      const tagsArray = values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;

      // Reorder beats to ensure order field is correct
      const orderedBeats = values.beats.map((beat, index) => ({
        ...beat,
        order: index,
      }));

      await createMutation.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        tags: tagsArray,
        targetDurationSeconds: values.targetDurationSeconds,
        beats: orderedBeats,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addBeat = () => {
    append({
      order: fields.length,
      phase: "BUILD",
      durationSeconds: 10,
      description: "",
      emotion: "curiosity",
    });
  };

  const moveBeatUp = (index: number) => {
    if (index > 0) {
      move(index, index - 1);
    }
  };

  const moveBeatDown = (index: number) => {
    if (index < fields.length - 1) {
      move(index, index + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Story Template</DialogTitle>
          <DialogDescription>
            Create a reusable narrative template with beats, emotions, and story structure
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Epic Journey" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetDurationSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Duration (seconds)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="60"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="A hero's journey template with emotional arc..."
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="adventure, hero, epic (comma-separated)"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>Comma-separated tags</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Beats</h3>
                  <p className="text-sm text-muted-foreground">
                    Define the narrative structure and emotional beats
                  </p>
                </div>
                <Button type="button" onClick={addBeat} size="sm" disabled={isSubmitting}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Beat
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-2">
                      <Badge variant="outline" className="w-fit">
                        Beat {index + 1}
                      </Badge>
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveBeatUp(index)}
                          disabled={index === 0 || isSubmitting}
                          className="h-7 w-7 p-0"
                        >
                          <MoveUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveBeatDown(index)}
                          disabled={index === fields.length - 1 || isSubmitting}
                          className="h-7 w-7 p-0"
                        >
                          <MoveDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`beats.${index}.phase`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phase</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                disabled={isSubmitting}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="HOOK">Hook</SelectItem>
                                  <SelectItem value="BUILD">Build</SelectItem>
                                  <SelectItem value="PAYOFF">Payoff</SelectItem>
                                  <SelectItem value="RESOLUTION">Resolution</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`beats.${index}.emotion`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Emotion</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                disabled={isSubmitting}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="joy">Joy</SelectItem>
                                  <SelectItem value="sadness">Sadness</SelectItem>
                                  <SelectItem value="surprise">Surprise</SelectItem>
                                  <SelectItem value="anticipation">Anticipation</SelectItem>
                                  <SelectItem value="tension">Tension</SelectItem>
                                  <SelectItem value="relief">Relief</SelectItem>
                                  <SelectItem value="empathy">Empathy</SelectItem>
                                  <SelectItem value="curiosity">Curiosity</SelectItem>
                                  <SelectItem value="humor">Humor</SelectItem>
                                  <SelectItem value="awe">Awe</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`beats.${index}.durationSeconds`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duration (s)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`beats.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe what happens in this beat..."
                                {...field}
                                disabled={isSubmitting}
                                rows={2}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`beats.${index}.contrast`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contrast (Optional)</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={isSubmitting}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select contrast..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="small_vs_big">Small vs Big</SelectItem>
                                  <SelectItem value="slow_vs_fast">Slow vs Fast</SelectItem>
                                  <SelectItem value="alone_vs_together">
                                    Alone vs Together
                                  </SelectItem>
                                  <SelectItem value="sad_vs_happy">Sad vs Happy</SelectItem>
                                  <SelectItem value="problem_vs_solution">
                                    Problem vs Solution
                                  </SelectItem>
                                  <SelectItem value="before_vs_after">
                                    Before vs After
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`beats.${index}.actionPrompt`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Action Prompt (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Show character struggling..."
                                  {...field}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`beats.${index}.intendedImpact`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Intended Impact (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Create suspense and anticipation..."
                                {...field}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1 || isSubmitting}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

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
                {isSubmitting ? "Creating..." : "Create Template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
