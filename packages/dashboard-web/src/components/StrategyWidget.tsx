import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Settings } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Skeleton } from "./ui/skeleton";

const STRATEGY_OPTIONS = [
	{
		value: "round-robin",
		label: "Round Robin",
		description: "Cycles through accounts evenly",
	},
	{
		value: "least-used",
		label: "Least Used",
		description: "Uses account with fewest requests",
	},
	{
		value: "session",
		label: "Session",
		description: "Sticky sessions per account",
	},
	{
		value: "weighted",
		label: "Weighted",
		description: "Based on account tier weights",
	},
	{
		value: "model-aware",
		label: "Model Aware",
		description: "Optimized for specific models",
	},
];

export function StrategyWidget() {
	const queryClient = useQueryClient();
	const [isChanging, setIsChanging] = useState(false);

	const {
		data: currentStrategy,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["strategy"],
		queryFn: () => api.getStrategy(),
		refetchInterval: 30000, // Poll every 30 seconds
	});

	const setStrategyMutation = useMutation({
		mutationFn: (strategy: string) => api.setStrategy(strategy),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["strategy"] });
			setIsChanging(false);
		},
		onError: () => {
			setIsChanging(false);
		},
	});

	const handleStrategyChange = (newStrategy: string) => {
		if (newStrategy !== currentStrategy) {
			setIsChanging(true);
			setStrategyMutation.mutate(newStrategy);
		}
	};

	if (isLoading) {
		return (
			<div className="rounded-lg bg-muted/50 p-3">
				<div className="flex items-center gap-2 text-sm mb-2">
					<Settings className="h-4 w-4 text-primary" />
					<span className="font-medium">Load Balancer</span>
				</div>
				<Skeleton className="h-8 w-full" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-lg bg-muted/50 p-3">
				<div className="flex items-center gap-2 text-sm">
					<AlertCircle className="h-4 w-4 text-destructive" />
					<span className="font-medium">Load Balancer</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					Failed to load strategy
				</p>
			</div>
		);
	}

	const currentStrategyOption = STRATEGY_OPTIONS.find(
		(option) => option.value === currentStrategy,
	);

	return (
		<div className="rounded-lg bg-muted/50 p-3">
			<div className="flex items-center gap-2 text-sm mb-2">
				<Settings className="h-4 w-4 text-primary" />
				<span className="font-medium">Load Balancer</span>
			</div>

			<Select
				value={currentStrategy}
				onValueChange={handleStrategyChange}
				disabled={isChanging || setStrategyMutation.isPending}
			>
				<SelectTrigger className="h-8 text-xs">
					<SelectValue placeholder="Select strategy">
						{currentStrategyOption?.label || currentStrategy}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{STRATEGY_OPTIONS.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							<div className="flex flex-col">
								<span className="font-medium">{option.label}</span>
								<span className="text-xs text-muted-foreground">
									{option.description}
								</span>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{currentStrategyOption && (
				<p className="mt-1 text-xs text-muted-foreground">
					{currentStrategyOption.description}
				</p>
			)}
		</div>
	);
}
