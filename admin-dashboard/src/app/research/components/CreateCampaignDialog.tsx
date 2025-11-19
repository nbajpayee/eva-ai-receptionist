"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users, Sparkles, ArrowRight } from "lucide-react";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type SegmentCriteriaValue = string | number | boolean | null | (string | number | boolean)[];
type SegmentCriteria = Record<string, SegmentCriteriaValue>;

type SegmentSample = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type SegmentPreview = {
  total_count: number;
  sample: SegmentSample[];
};

interface SegmentTemplate {
  name: string;
  description: string;
  criteria: SegmentCriteria;
}

interface AgentTemplate {
  name: string;
  type: string;
  description: string;
  system_prompt: string;
  questions: string[];
  voice_settings: Record<string, unknown>;
}

type SegmentTemplatesResponse = {
  success: boolean;
  templates: Record<string, SegmentTemplate>;
};

type AgentTemplatesResponse = {
  success: boolean;
  templates: Record<string, AgentTemplate>;
};

type SegmentPreviewResponse = {
  success: boolean;
  total_count: number;
  sample: SegmentSample[];
};

export function CreateCampaignDialog({ open, onOpenChange, onSuccess }: CreateCampaignDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [campaignType, setCampaignType] = useState<"research" | "outbound_sales">("research");
  const [channel, setChannel] = useState<string>("sms");

  // Segment state
  const [segmentTemplates, setSegmentTemplates] = useState<Record<string, SegmentTemplate>>({});
  const [selectedSegmentTemplate, setSelectedSegmentTemplate] = useState<string>("");
  const [segmentCriteria, setSegmentCriteria] = useState<SegmentCriteria>({});
  const [segmentPreview, setSegmentPreview] = useState<SegmentPreview | null>(null);

  // Agent state
  const [agentTemplates, setAgentTemplates] = useState<Record<string, AgentTemplate>>({});
  const [selectedAgentTemplate, setSelectedAgentTemplate] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);

  const fetchSegmentTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/research/segments/templates");
      const data = (await response.json()) as SegmentTemplatesResponse;
      if (data.success) {
        setSegmentTemplates(data.templates);
      }
    } catch (error) {
      console.error("Failed to fetch segment templates:", error);
    }
  }, []);

  const fetchAgentTemplates = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/research/agent-templates?campaign_type=${campaignType}`);
      const data = (await response.json()) as AgentTemplatesResponse;
      if (data.success) {
        setAgentTemplates(data.templates);
      }
    } catch (error) {
      console.error("Failed to fetch agent templates:", error);
    }
  }, [campaignType]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void fetchSegmentTemplates();
    void fetchAgentTemplates();
  }, [open, fetchSegmentTemplates, fetchAgentTemplates]);

  const handleSegmentTemplateSelect = (templateId: string) => {
    setSelectedSegmentTemplate(templateId);
    const template = segmentTemplates[templateId];
    if (template) {
      setSegmentCriteria(template.criteria);
      void previewSegment(template.criteria);
    } else {
      setSegmentCriteria({});
      setSegmentPreview(null);
    }
  };

  const previewSegment = useCallback(async (criteria: SegmentCriteria) => {
    try {
      const response = await fetch("/api/admin/research/segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      const data = (await response.json()) as SegmentPreviewResponse;
      if (data.success) {
        setSegmentPreview({ total_count: data.total_count, sample: data.sample });
      }
    } catch (error) {
      console.error("Failed to preview segment:", error);
    }
  }, []);

  const handleAgentTemplateSelect = (templateId: string) => {
    setSelectedAgentTemplate(templateId);
    const template = agentTemplates[templateId];
    if (template) {
      setSystemPrompt(template.system_prompt);
      setQuestions(template.questions.length > 0 ? template.questions : [""]);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions.length > 0 ? newQuestions : [""]);
  };

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const handleCreate = async () => {
    const trimmedQuestions = questions
      .map((question) => question.trim())
      .filter((question): question is string => question.length > 0);

    if (!name || Object.keys(segmentCriteria).length === 0 || !systemPrompt || trimmedQuestions.length === 0) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/research/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          campaign_type: campaignType,
          segment_criteria: segmentCriteria,
          agent_config: {
            system_prompt: systemPrompt,
            questions: trimmedQuestions,
            voice_settings: {
              voice: "alloy",
              temperature: 0.7,
              max_response_tokens: 150,
            },
          },
          channel,
        }),
      });

      const data = await response.json();

      if (data.success) {
        resetForm();
        onSuccess();
      } else {
        alert("Failed to create campaign: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to create campaign:", error);
      alert("Failed to create campaign. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setName("");
    setCampaignType("research");
    setChannel("sms");
    setSelectedSegmentTemplate("");
    setSegmentCriteria({});
    setSegmentPreview(null);
    setSelectedAgentTemplate("");
    setSystemPrompt("");
    setQuestions([""]);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name && campaignType && channel;
      case 2:
        return Object.keys(segmentCriteria).length > 0;
      case 3:
        return systemPrompt && questions.some((question) => question.trim().length > 0);
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Set up a research or outbound sales campaign to engage with customers
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between py-4">
          {[
            { num: 1, label: "Campaign Info" },
            { num: 2, label: "Target Segment" },
            { num: 3, label: "AI Agent" },
            { num: 4, label: "Review" },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  step >= s.num
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-gray-300 text-gray-400"
                }`}
              >
                {s.num}
              </div>
              <span
                className={`ml-2 text-sm ${step >= s.num ? "text-foreground font-medium" : "text-muted-foreground"}`}
              >
                {s.label}
              </span>
              {idx < 3 && <ArrowRight className="mx-4 h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <Separator />

        {/* Step 1: Campaign Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Q1 Booking Abandonment Research"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Campaign Type *</Label>
              <div className="grid grid-cols-2 gap-4">
                <Card
                  className={`cursor-pointer transition-all ${campaignType === "research" ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setCampaignType("research")}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Research
                    </CardTitle>
                    <CardDescription>
                      Gather insights and feedback from customers. Focus on learning and understanding.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card
                  className={`cursor-pointer transition-all ${campaignType === "outbound_sales" ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setCampaignType("outbound_sales")}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Outbound Sales
                    </CardTitle>
                    <CardDescription>
                      Reach out to customers with offers or reminders. Focus on conversion and bookings.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel">Communication Channel *</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS (Text Messages)</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="voice">Voice (Phone Calls)</SelectItem>
                  <SelectItem value="multi">Multi-Channel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 2: Segment Builder */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label>Choose a Segment Template</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Select a pre-built segment or create your own custom segment
              </p>

              <div className="grid gap-3">
                {Object.entries(segmentTemplates).map(([key, template]) => (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-all ${selectedSegmentTemplate === key ? "ring-2 ring-primary" : ""}`}
                    onClick={() => handleSegmentTemplateSelect(key)}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            {segmentPreview && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Segment Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">{segmentPreview.total_count} customers</p>
                    <p className="text-sm text-muted-foreground">match this segment</p>

                    {segmentPreview.sample.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">Sample customers:</p>
                        <div className="space-y-1">
                          {segmentPreview.sample.map((customer) => (
                            <div key={customer.id} className="text-sm">
                              {customer.name} - {customer.phone || customer.email}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 3: Agent Configuration */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <Label>Choose an Agent Template (Optional)</Label>
              <p className="text-sm text-muted-foreground mb-4">Start with a template or create from scratch</p>

              <div className="grid gap-3">
                {Object.entries(agentTemplates).map(([key, template]) => (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-all ${selectedAgentTemplate === key ? "ring-2 ring-primary" : ""}`}
                    onClick={() => handleAgentTemplateSelect(key)}
                  >
                    <CardHeader>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Prompt *</Label>
              <Textarea
                id="system-prompt"
                placeholder="You are Ava, an AI assistant from..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
              />
              <p className="text-sm text-muted-foreground">Instructions for the AI agent&rsquo;s behavior and personality</p>
            </div>

            <div className="space-y-3">
              <Label>Questions to Ask *</Label>
              {questions.map((question, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Question ${index + 1}`}
                    value={question}
                    onChange={(e) => handleQuestionChange(index, e.target.value)}
                  />
                  {questions.length > 1 && (
                    <Button variant="outline" onClick={() => handleRemoveQuestion(index)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" onClick={handleAddQuestion} className="w-full">
                Add Question
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Name</Label>
                  <p className="font-medium">{name}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Type</Label>
                  <p className="font-medium capitalize">{campaignType.replace("_", " ")}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Channel</Label>
                  <p className="font-medium uppercase">{channel}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Target Customers</Label>
                  <p className="font-medium">{segmentPreview?.total_count || 0} customers</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Questions</Label>
                  <ul className="list-disc list-inside space-y-1">
                    {questions.filter((q) => q.trim()).map((q, i) => (
                      <li key={i} className="text-sm">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground">
              Your campaign will be created as a draft. You can review and edit it before launching.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => (step === 1 ? onOpenChange(false) : setStep(step - 1))}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Creating..." : "Create Campaign"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
