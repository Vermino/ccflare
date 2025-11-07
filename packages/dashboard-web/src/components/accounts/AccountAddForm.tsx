import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

interface AccountAddFormProps {
	onAddAccount: (params: {
		name: string;
		mode: "max" | "console";
		tier: number;
	}) => Promise<{ authUrl: string; sessionId: string }>;
	onCompleteAccount: (params: {
		sessionId: string;
		code: string;
	}) => Promise<void>;
	onAddOpenAIAccount: (params: {
		name: string;
		apiKey: string;
	}) => Promise<void>;
	onCancel: () => void;
	onSuccess: () => void;
	onError: (error: string) => void;
}

export function AccountAddForm({
	onAddAccount,
	onCompleteAccount,
	onAddOpenAIAccount,
	onCancel,
	onSuccess,
	onError,
}: AccountAddFormProps) {
	const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
	const [authStep, setAuthStep] = useState<"form" | "code">("form");
	const [authCode, setAuthCode] = useState("");
	const [sessionId, setSessionId] = useState("");
	const [newAccount, setNewAccount] = useState({
		name: "",
		mode: "max" as "max" | "console",
		tier: 1,
		apiKey: "",
	});

	const handleAddClaudeAccount = async () => {
		if (!newAccount.name) {
			onError("Account name is required");
			return;
		}
		// Step 1: Initialize OAuth flow
		const { authUrl, sessionId } = await onAddAccount(newAccount);
		setSessionId(sessionId);

		// Open auth URL in new tab
		if (typeof window !== "undefined") {
			window.open(authUrl, "_blank");
		}

		// Move to code entry step
		setAuthStep("code");
	};

	const handleAddOpenAIAccountSubmit = async () => {
		if (!newAccount.name) {
			onError("Account name is required");
			return;
		}
		if (!newAccount.apiKey) {
			onError("API key is required");
			return;
		}

		// Add OpenAI account
		await onAddOpenAIAccount({
			name: newAccount.name,
			apiKey: newAccount.apiKey,
		});

		// Success! Reset form
		setNewAccount({ name: "", mode: "max", tier: 1, apiKey: "" });
		onSuccess();
	};

	const handleCodeSubmit = async () => {
		if (!authCode) {
			onError("Authorization code is required");
			return;
		}
		// Step 2: Complete OAuth flow
		await onCompleteAccount({
			sessionId,
			code: authCode,
		});

		// Success! Reset form
		setAuthStep("form");
		setAuthCode("");
		setSessionId("");
		setNewAccount({ name: "", mode: "max", tier: 1, apiKey: "" });
		onSuccess();
	};

	const handleCancel = () => {
		setAuthStep("form");
		setAuthCode("");
		setSessionId("");
		setNewAccount({ name: "", mode: "max", tier: 1, apiKey: "" });
		onCancel();
	};

	return (
		<div className="space-y-4 mb-6 p-4 border rounded-lg">
			<h4 className="font-medium">
				{authStep === "form" ? "Add New Account" : "Enter Authorization Code"}
			</h4>
			{authStep === "form" && (
				<>
					<div className="space-y-2">
						<Label htmlFor="provider">Provider</Label>
						<Select
							value={provider}
							onValueChange={(value: "anthropic" | "openai") =>
								setProvider(value)
							}
						>
							<SelectTrigger id="provider">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
								<SelectItem value="openai">OpenAI</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="name">Account Name</Label>
						<Input
							id="name"
							value={newAccount.name}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								setNewAccount({
									...newAccount,
									name: (e.target as HTMLInputElement).value,
								})
							}
							placeholder="e.g., work-account or user@example.com"
						/>
					</div>

					{provider === "anthropic" && (
						<>
							<div className="space-y-2">
								<Label htmlFor="mode">Mode</Label>
								<Select
									value={newAccount.mode}
									onValueChange={(value: "max" | "console") =>
										setNewAccount({ ...newAccount, mode: value })
									}
								>
									<SelectTrigger id="mode">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="max">Max (Recommended)</SelectItem>
										<SelectItem value="console">Console</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="tier">Tier</Label>
								<Select
									value={String(newAccount.tier)}
									onValueChange={(value: string) =>
										setNewAccount({ ...newAccount, tier: parseInt(value) })
									}
								>
									<SelectTrigger id="tier">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="1">Tier 1 (Default)</SelectItem>
										<SelectItem value="5">Tier 5</SelectItem>
										<SelectItem value="20">Tier 20</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</>
					)}

					{provider === "openai" && (
						<div className="space-y-2">
							<Label htmlFor="apiKey">API Key</Label>
							<Input
								id="apiKey"
								type="password"
								value={newAccount.apiKey}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setNewAccount({
										...newAccount,
										apiKey: (e.target as HTMLInputElement).value,
									})
								}
								placeholder="sk-..."
							/>
							<p className="text-xs text-muted-foreground">
								Your OpenAI API key (starts with sk-)
							</p>
						</div>
					)}
				</>
			)}
			{authStep === "form" ? (
				<div className="flex gap-2">
					{provider === "anthropic" ? (
						<Button onClick={handleAddClaudeAccount}>Continue</Button>
					) : (
						<Button onClick={handleAddOpenAIAccountSubmit}>Add Account</Button>
					)}
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
				</div>
			) : (
				<>
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							A new browser tab has opened for authentication. After
							authorizing, copy the code and paste it below.
						</p>
						<Label htmlFor="code">Authorization Code</Label>
						<Input
							id="code"
							value={authCode}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								setAuthCode((e.target as HTMLInputElement).value)
							}
							placeholder="Paste authorization code here"
						/>
					</div>
					<div className="flex gap-2">
						<Button onClick={handleCodeSubmit}>Complete Setup</Button>
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
