import { Key, Plus, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";

interface ApiKey {
	id: string;
	name: string;
	prefix_last_8: string;
	created_at: number;
	last_used: number | null;
	usage_count: number;
	is_active: boolean;
	total_requests: number;
	total_tokens: number;
	total_cost_usd: number;
	rate_limit_rpm: number | null;
	rate_limit_tpm: number | null;
	rate_limit_requests_per_day: number | null;
}

export function ApiKeysTab() {
	const queryClient = useQueryClient();
	const [isCreating, setIsCreating] = useState(false);
	const [newKeyResult, setNewKeyResult] = useState<{
		key: string;
		name: string;
	} | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		dailyLimit: "",
	});

	// Fetch API keys
	const { data: apiKeys, isLoading } = useQuery({
		queryKey: ["api-keys"],
		queryFn: async () => {
			const response = await fetch(`${api.baseUrl}/api/api-keys`);
			if (!response.ok) throw new Error("Failed to fetch API keys");
			const data = await response.json();
			return data.apiKeys as ApiKey[];
		},
	});

	// Create API key mutation
	const createMutation = useMutation({
		mutationFn: async (data: { name: string; rate_limit_requests_per_day?: number }) => {
			const response = await fetch(`${api.baseUrl}/api/api-keys`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (!response.ok) throw new Error("Failed to create API key");
			return response.json();
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["api-keys"] });
			setNewKeyResult({ key: data.plainTextKey, name: data.apiKey.name });
			setIsCreating(false);
			setFormData({ name: "", dailyLimit: "" });
		},
	});

	// Delete API key mutation
	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const response = await fetch(`${api.baseUrl}/api/api-keys/${id}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error("Failed to delete API key");
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["api-keys"] });
		},
	});

	// Toggle API key status mutation
	const toggleMutation = useMutation({
		mutationFn: async ({ id, enable }: { id: string; enable: boolean }) => {
			const action = enable ? "enable" : "disable";
			const response = await fetch(`${api.baseUrl}/api/api-keys/${id}/${action}`, {
				method: "POST",
			});
			if (!response.ok) throw new Error(`Failed to ${action} API key`);
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["api-keys"] });
		},
	});

	const handleCreate = () => {
		const data: { name: string; rate_limit_requests_per_day?: number } = {
			name: formData.name,
		};
		if (formData.dailyLimit) {
			data.rate_limit_requests_per_day = parseInt(formData.dailyLimit);
		}
		createMutation.mutate(data);
	};

	return (
		<div className="space-y-6">
			{/* Header Card */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Key className="h-5 w-5" />
								API Keys
							</CardTitle>
							<CardDescription>
								Manage API keys for multi-user access and token pooling
							</CardDescription>
						</div>
						<Button onClick={() => setIsCreating(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Create API Key
						</Button>
					</div>
				</CardHeader>
			</Card>

			{/* API Keys List */}
			<Card>
				<CardContent className="pt-6">
					{isLoading ? (
						<div className="text-center py-8 text-muted-foreground">
							Loading API keys...
						</div>
					) : !apiKeys || apiKeys.length === 0 ? (
						<div className="text-center py-12">
							<Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
							<h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
							<p className="text-muted-foreground mb-4">
								Create your first API key to enable multi-user access
							</p>
							<Button onClick={() => setIsCreating(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Create API Key
							</Button>
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Key</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Requests</TableHead>
										<TableHead>Tokens</TableHead>
										<TableHead>Cost</TableHead>
										<TableHead>Daily Limit</TableHead>
										<TableHead>Created</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{apiKeys.map((apiKey) => (
										<TableRow key={apiKey.id}>
											<TableCell className="font-medium">{apiKey.name}</TableCell>
											<TableCell className="font-mono text-sm">
												...{apiKey.prefix_last_8}
											</TableCell>
											<TableCell>
												{apiKey.is_active ? (
													<Badge variant="default">Active</Badge>
												) : (
													<Badge variant="secondary">Inactive</Badge>
												)}
											</TableCell>
											<TableCell>{apiKey.total_requests.toLocaleString()}</TableCell>
											<TableCell>{apiKey.total_tokens.toLocaleString()}</TableCell>
											<TableCell>${apiKey.total_cost_usd.toFixed(4)}</TableCell>
											<TableCell>
												{apiKey.rate_limit_requests_per_day
													? `${apiKey.rate_limit_requests_per_day.toLocaleString()}/day`
													: "Unlimited"}
											</TableCell>
											<TableCell>
												{new Date(apiKey.created_at).toLocaleDateString()}
											</TableCell>
											<TableCell>
												<div className="flex gap-2">
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															toggleMutation.mutate({
																id: apiKey.id,
																enable: !apiKey.is_active,
															})
														}
													>
														{apiKey.is_active ? "Disable" : "Enable"}
													</Button>
													<Button
														size="sm"
														variant="destructive"
														onClick={() => {
															if (
																window.confirm(
																	`Delete API key "${apiKey.name}"? This cannot be undone.`,
																)
															) {
																deleteMutation.mutate(apiKey.id);
															}
														}}
													>
														Delete
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Create API Key Dialog */}
			<Dialog open={isCreating} onOpenChange={setIsCreating}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create API Key</DialogTitle>
						<DialogDescription>
							Generate a new API key for accessing the proxy
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								placeholder="My Application"
								value={formData.name}
								onChange={(e) =>
									setFormData({ ...formData, name: e.target.value })
								}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="dailyLimit">Daily Request Limit (optional)</Label>
							<Input
								id="dailyLimit"
								type="number"
								placeholder="1000"
								value={formData.dailyLimit}
								onChange={(e) =>
									setFormData({ ...formData, dailyLimit: e.target.value })
								}
							/>
							<p className="text-sm text-muted-foreground">
								Leave empty for unlimited requests
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsCreating(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleCreate}
							disabled={!formData.name || createMutation.isPending}
						>
							{createMutation.isPending ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* New Key Display Dialog */}
			<Dialog open={!!newKeyResult} onOpenChange={() => setNewKeyResult(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>API Key Created!</DialogTitle>
						<DialogDescription>
							Save this key now - you won't be able to see it again
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>API Key</Label>
							<div className="flex gap-2">
								<Input
									value={newKeyResult?.key || ""}
									readOnly
									className="font-mono text-sm"
								/>
								<Button
									size="sm"
									onClick={() => {
										if (newKeyResult?.key) {
											navigator.clipboard.writeText(newKeyResult.key);
										}
									}}
								>
									Copy
								</Button>
							</div>
						</div>
						<div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
							<div className="flex gap-2">
								<AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
								<div className="space-y-1">
									<p className="text-sm font-medium">Important</p>
									<p className="text-sm text-muted-foreground">
										Make sure to copy your API key now. You won't be able to see it again!
									</p>
								</div>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={() => setNewKeyResult(null)}>Done</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
