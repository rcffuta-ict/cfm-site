"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { manualRegisterAction } from "./actions";
import Image from "next/image";

export default function ManualRegisterPage() {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [successData, setSuccessData] = useState<{
        raffleId: number;
        message: string;
    } | null>(null);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setSuccessData(null);

        const formData = new FormData(e.currentTarget);
        const formElement = e.currentTarget;

        startTransition(() => {
            (async () => {
                const toastId = toast.loading("Processing registration…");
                const result = await manualRegisterAction(formData);

                if (!result.success || !result.data) {
                    toast.error(result.error ?? "Registration failed", {
                        id: toastId,
                    });
                    setError(result.error ?? "Registration failed");
                    return;
                }

                toast.success(
                    result.data.message || "Registration Successful! 🎉",
                    { id: toastId },
                );
                setSuccessData(result.data);
                formElement.reset();
            })();
        });
    }

    return (
        <div className="login-page">
            <div className="login-glow login-glow--purple" />
            <div className="login-glow login-glow--blue" />

            <div className="login-card w-full max-w-lg">
                <div className="login-logo flex justify-center mb-6">
                    <Image
                        src="/images/Logo/logo.png"
                        alt="RCF FUTA"
                        width={100}
                        height={100}
                        className="w-20 h-20"
                    />
                </div>

                <h1 className="login-title">Manual Registration</h1>
                <p className="login-subtitle mb-6 text-center">
                    Register a user to generate their Oracle ID
                </p>

                {successData && (
                    <div className="mb-6 p-6 rounded-xl bg-green-500/20 border border-green-500/30 text-center backdrop-blur-md">
                        <p className="text-green-200 mb-2 font-medium">
                            {successData.message}
                        </p>
                        <p className="text-5xl font-black text-white tracking-widest drop-shadow-lg">
                            {successData.raffleId}
                        </p>
                        <p className="text-sm text-green-200/80 mt-2">
                            This is their Raffle ID
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form space-y-4">
                    <div className="flex flex-col gap-4">
                        <div className="login-field flex-1">
                            <label htmlFor="firstName">First Name</label>
                            <input
                                id="firstName"
                                name="firstName"
                                type="text"
                                placeholder="e.g. John"
                                required
                                disabled={isPending}
                            />
                        </div>

                        <div className="login-field flex-1">
                            <label htmlFor="lastName">Last Name</label>
                            <input
                                id="lastName"
                                name="lastName"
                                type="text"
                                placeholder="e.g. Doe"
                                required
                                disabled={isPending}
                            />
                        </div>
                    </div>

                    <div className="login-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="e.g. user@example.com (Optional)"
                            disabled={isPending}
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="phone">Phone Number</label>
                        <input
                            id="phone"
                            name="phone"
                            type="text"
                            placeholder="e.g. 08012345678 (Optional)"
                            disabled={isPending}
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="login-field flex-1">
                            <label htmlFor="level">Level</label>
                            <select
                                id="level"
                                name="level"
                                disabled={isPending}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
                            >
                                <option value="N/A" className="text-black">
                                    Select Level
                                </option>
                                <option value="100L" className="text-black">
                                    100L
                                </option>
                                <option value="200L" className="text-black">
                                    200L
                                </option>
                                <option value="300L" className="text-black">
                                    300L
                                </option>
                                <option value="400L" className="text-black">
                                    400L
                                </option>
                                <option value="500L" className="text-black">
                                    500L
                                </option>
                            </select>
                        </div>

                        <div className="login-field flex-1">
                            <label htmlFor="gender">Gender</label>
                            <select
                                id="gender"
                                name="gender"
                                disabled={isPending}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
                            >
                                <option value="N/A" className="text-black">
                                    Select Gender
                                </option>
                                <option value="M" className="text-black">
                                    Male
                                </option>
                                <option value="F" className="text-black">
                                    Female
                                </option>
                            </select>
                        </div>
                    </div>

                    {error && (
                        <p className="login-error text-[#ff4d4d] text-sm text-center font-medium bg-[#ff4d4d]/10 px-4 py-2 rounded-lg border border-[#ff4d4d]/20">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="login-btn mt-6 w-full py-4 text-base"
                        disabled={isPending}
                    >
                        {isPending ? (
                            <span className="login-btn__spinner" />
                        ) : (
                            "Register & Generate ID"
                        )}
                    </button>

                    <p className="login-footer text-center mt-4 text-white/50 text-xs">
                        This registry directly provisions raffle IDs for the
                        Oracle.
                    </p>
                </form>
            </div>
        </div>
    );
}
