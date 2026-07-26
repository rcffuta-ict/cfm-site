"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    Plus,
    Trash2,
    Pencil,
    Check,
    X,
    ChevronUp,
    ChevronDown,
    EyeOff,
    Eye,
    ListPlus,
    AlertTriangle,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Chip } from "@/src/components/ui/chip";
import { Switch } from "@/src/components/ui/switch";
import { TextField } from "@/src/components/ui/text-field";
import { cn } from "@/src/lib/utils";
import type { HostQuestion } from "@/src/lib/games/questions";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/src/lib/games/questions";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

interface Draft {
    question: string;
    options: string[];
    correctIndex: number;
    points: number;
    durationSeconds: number;
}

const BLANK: Draft = {
    question: "",
    options: ["", ""],
    correctIndex: 0,
    points: 100,
    durationSeconds: 20,
};

function toDraft(q: HostQuestion): Draft {
    return {
        question: q.question,
        options: [...q.options],
        correctIndex: q.correctIndex,
        points: q.points,
        durationSeconds: q.durationSeconds,
    };
}

/** Add / edit form, shared between "new question" and inline editing. */
function QuestionForm({
    draft,
    setDraft,
    onSubmit,
    onCancel,
    submitting,
    submitLabel,
}: {
    draft: Draft;
    setDraft: (d: Draft) => void;
    onSubmit: () => void;
    onCancel: () => void;
    submitting: boolean;
    submitLabel: string;
}) {
    function setOption(index: number, value: string) {
        const options = [...draft.options];
        options[index] = value;
        setDraft({ ...draft, options });
    }

    function addOption() {
        if (draft.options.length >= MAX_OPTIONS) return;
        setDraft({ ...draft, options: [...draft.options, ""] });
    }

    function removeOption(index: number) {
        if (draft.options.length <= MIN_OPTIONS) return;
        const options = draft.options.filter((_, i) => i !== index);
        // Keep the correct answer pointing at the same option it did before.
        let correctIndex = draft.correctIndex;
        if (correctIndex === index) correctIndex = 0;
        else if (correctIndex > index) correctIndex -= 1;
        setDraft({ ...draft, options, correctIndex });
    }

    return (
        <div className="space-y-4 rounded-md bg-surface-container-highest p-4">
            <TextField
                label="Question"
                value={draft.question}
                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                disabled={submitting}
            />

            <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                    Options — tap the circle to mark the correct one
                </p>
                <div className="space-y-2">
                    {draft.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-label={`Mark option ${OPTION_LABELS[index]} correct`}
                                aria-pressed={draft.correctIndex === index}
                                disabled={submitting}
                                onClick={() =>
                                    setDraft({ ...draft, correctIndex: index })
                                }
                                className={cn(
                                    "state-layer flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-colors duration-200 ease-standard",
                                    draft.correctIndex === index
                                        ? "bg-success-container text-on-success-container"
                                        : "border border-outline text-on-surface-variant"
                                )}
                            >
                                {draft.correctIndex === index ? (
                                    <Check className="size-4" />
                                ) : (
                                    OPTION_LABELS[index]
                                )}
                            </button>
                            <TextField
                                label={`Option ${OPTION_LABELS[index]}`}
                                value={option}
                                onChange={(e) => setOption(index, e.target.value)}
                                disabled={submitting}
                            />
                            <Button
                                variant="text"
                                size="icon"
                                aria-label={`Remove option ${OPTION_LABELS[index]}`}
                                disabled={
                                    submitting || draft.options.length <= MIN_OPTIONS
                                }
                                onClick={() => removeOption(index)}
                            >
                                <X />
                            </Button>
                        </div>
                    ))}
                </div>
                <Button
                    variant="text"
                    size="sm"
                    className="mt-2"
                    disabled={submitting || draft.options.length >= MAX_OPTIONS}
                    onClick={addOption}
                >
                    <Plus /> Add option
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <TextField
                    label="Points"
                    type="number"
                    inputMode="numeric"
                    value={String(draft.points)}
                    onChange={(e) =>
                        setDraft({ ...draft, points: Number(e.target.value) })
                    }
                    disabled={submitting}
                />
                <TextField
                    label="Seconds"
                    type="number"
                    inputMode="numeric"
                    value={String(draft.durationSeconds)}
                    onChange={(e) =>
                        setDraft({
                            ...draft,
                            durationSeconds: Number(e.target.value),
                        })
                    }
                    disabled={submitting}
                />
            </div>

            <div className="flex gap-3">
                <Button
                    variant="filled"
                    className="flex-1"
                    onClick={onSubmit}
                    disabled={submitting}
                >
                    <Check /> {submitting ? "Saving…" : submitLabel}
                </Button>
                <Button variant="outlined" onClick={onCancel} disabled={submitting}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}

export default function QuestionEditor({
    onChanged,
}: {
    /** Lets the host panel refresh its run of show after an edit. */
    onChanged?: () => void;
}) {
    const [questions, setQuestions] = useState<HostQuestion[]>([]);
    const [session, setSession] = useState<{ id: string; title: string } | null>(
        null
    );
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft>(BLANK);

    async function load() {
        try {
            const res = await fetch("/api/games/host/questions", {
                cache: "no-store",
            });
            if (!res.ok) return;
            const json = await res.json();
            setSession(json.session);
            setQuestions(json.questions ?? []);
        } catch {
            toast.error("Couldn't load questions");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    function afterChange() {
        load();
        onChanged?.();
    }

    async function createSession() {
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: "CFM Games" }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't create session");
                return;
            }
            toast.success("Session created");
            afterChange();
        } finally {
            setBusy(false);
        }
    }

    async function addQuestion() {
        setBusy(true);
        try {
            const res = await fetch("/api/games/host/questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't add question");
                return;
            }
            toast.success("Question added");
            setDraft(BLANK);
            setAdding(false);
            afterChange();
        } finally {
            setBusy(false);
        }
    }

    async function saveEdit(roundId: string) {
        setBusy(true);
        try {
            const res = await fetch(`/api/games/host/questions/${roundId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't save", { duration: 6000 });
                return;
            }
            toast.success("Saved");
            setEditingId(null);
            afterChange();
        } finally {
            setBusy(false);
        }
    }

    async function toggleDisabled(q: HostQuestion) {
        setBusy(true);
        try {
            const res = await fetch(`/api/games/host/questions/${q.roundId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ disabled: !q.disabled }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't update");
                return;
            }
            toast.success(q.disabled ? "Question enabled" : "Question disabled");
            afterChange();
        } finally {
            setBusy(false);
        }
    }

    async function remove(q: HostQuestion) {
        const warning =
            q.answerCount > 0
                ? `Delete this question? ${q.answerCount} answer${q.answerCount === 1 ? "" : "s"} will be deleted with it, and those points will disappear from the leaderboard.`
                : "Delete this question?";
        if (!window.confirm(warning)) return;

        setBusy(true);
        try {
            const res = await fetch(`/api/games/host/questions/${q.roundId}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                toast.error(json.error || "Couldn't delete");
                return;
            }
            toast.success("Question deleted");
            afterChange();
        } finally {
            setBusy(false);
        }
    }

    async function move(index: number, direction: -1 | 1) {
        const next = [...questions];
        const target = index + direction;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setQuestions(next); // optimistic — the order is the whole point

        setBusy(true);
        try {
            const res = await fetch("/api/games/host/questions", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order: next.map((q) => q.roundId) }),
            });
            if (!res.ok) {
                toast.error("Couldn't reorder");
                load();
                return;
            }
            onChanged?.();
        } finally {
            setBusy(false);
        }
    }

    if (loading)
        return (
            <Card variant="elevated" className="p-5">
                <p className="text-sm text-on-surface-variant">Loading questions…</p>
            </Card>
        );

    if (!session)
        return (
            <Card variant="elevated" className="p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
                    <ListPlus className="size-5 text-primary" /> Questions
                </h2>
                <p className="mb-5 mt-1 text-sm leading-6 text-on-surface-variant">
                    No live session yet. Create one, then add your questions.
                </p>
                <Button variant="filled" onClick={createSession} disabled={busy}>
                    <Plus /> Create session
                </Button>
            </Card>
        );

    return (
        <Card variant="elevated" className="p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
                    <ListPlus className="size-5 text-primary" /> Questions
                    <Chip variant="neutral" size="sm">
                        {questions.filter((q) => !q.disabled).length} active
                    </Chip>
                </h2>
                {!adding && (
                    <Button
                        variant="tonal"
                        onClick={() => {
                            setDraft(BLANK);
                            setEditingId(null);
                            setAdding(true);
                        }}
                        disabled={busy}
                    >
                        <Plus /> Add question
                    </Button>
                )}
            </div>

            {adding && (
                <div className="mb-5">
                    <QuestionForm
                        draft={draft}
                        setDraft={setDraft}
                        onSubmit={addQuestion}
                        onCancel={() => {
                            setAdding(false);
                            setDraft(BLANK);
                        }}
                        submitting={busy}
                        submitLabel="Add question"
                    />
                </div>
            )}

            {questions.length === 0 && !adding && (
                <p className="text-sm text-on-surface-variant">
                    No questions yet — add your first one.
                </p>
            )}

            <div className="space-y-3">
                {questions.map((q, index) => {
                    const isEditing = editingId === q.roundId;
                    const played = q.answerCount > 0;

                    if (isEditing)
                        return (
                            <QuestionForm
                                key={q.roundId}
                                draft={draft}
                                setDraft={setDraft}
                                onSubmit={() => saveEdit(q.roundId)}
                                onCancel={() => setEditingId(null)}
                                submitting={busy}
                                submitLabel="Save changes"
                            />
                        );

                    return (
                        <div
                            key={q.roundId}
                            className={cn(
                                "rounded-md p-4 transition-colors duration-200 ease-standard",
                                q.disabled
                                    ? "bg-surface-container opacity-60"
                                    : "bg-surface-container-highest"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex shrink-0 flex-col">
                                    <Button
                                        variant="text"
                                        size="icon"
                                        aria-label="Move up"
                                        className="h-6 w-6"
                                        disabled={busy || index === 0}
                                        onClick={() => move(index, -1)}
                                    >
                                        <ChevronUp />
                                    </Button>
                                    <span className="text-center text-xs font-extrabold text-on-surface-variant">
                                        {index + 1}
                                    </span>
                                    <Button
                                        variant="text"
                                        size="icon"
                                        aria-label="Move down"
                                        className="h-6 w-6"
                                        disabled={busy || index === questions.length - 1}
                                        onClick={() => move(index, 1)}
                                    >
                                        <ChevronDown />
                                    </Button>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold leading-6 text-on-surface">
                                        {q.question || "(no text)"}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {q.options.map((option, i) => (
                                            <Chip
                                                key={i}
                                                variant={
                                                    i === q.correctIndex
                                                        ? "success"
                                                        : "outlined"
                                                }
                                                size="sm"
                                            >
                                                {OPTION_LABELS[i]}. {option}
                                            </Chip>
                                        ))}
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                                        <span>{q.points} pts</span>
                                        <span>·</span>
                                        <span>{q.durationSeconds}s</span>
                                        <span>·</span>
                                        <span>{q.status}</span>
                                        {played && (
                                            <Chip variant="tertiary" size="sm">
                                                {q.answerCount} answered
                                            </Chip>
                                        )}
                                        {q.disabled && (
                                            <Chip variant="error" size="sm">
                                                Disabled
                                            </Chip>
                                        )}
                                    </div>

                                    {played && (
                                        <p className="mt-2 flex items-start gap-1.5 text-xs text-on-surface-variant">
                                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-tertiary" />
                                            Locked for editing — people have already
                                            answered.
                                        </p>
                                    )}
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                    <Switch
                                        checked={!q.disabled}
                                        onCheckedChange={() => toggleDisabled(q)}
                                        disabled={busy || q.status === "active"}
                                        aria-label={
                                            q.disabled
                                                ? "Enable question"
                                                : "Disable question"
                                        }
                                    />
                                </div>
                            </div>

                            <div className="mt-3 flex justify-end gap-2">
                                <Button
                                    variant="text"
                                    size="sm"
                                    disabled={busy || played || q.status === "active"}
                                    onClick={() => {
                                        setAdding(false);
                                        setDraft(toDraft(q));
                                        setEditingId(q.roundId);
                                    }}
                                >
                                    <Pencil /> Edit
                                </Button>
                                <Button
                                    variant="text"
                                    size="sm"
                                    disabled={busy || q.status === "active"}
                                    onClick={() => toggleDisabled(q)}
                                >
                                    {q.disabled ? <Eye /> : <EyeOff />}
                                    {q.disabled ? "Enable" : "Disable"}
                                </Button>
                                <Button
                                    variant="text"
                                    size="sm"
                                    className="text-error"
                                    disabled={busy || q.status === "active"}
                                    onClick={() => remove(q)}
                                >
                                    <Trash2 /> Delete
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
