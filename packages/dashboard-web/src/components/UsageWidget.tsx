import { BarChart3, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";

function formatResetTime(resetDate: string | null): string {
	if (!resetDate) return "Unknown";

	const now = Date.now();
	const resetMs = new Date(resetDate).getTime();
	const diffMs = resetMs - now;

	if (diffMs <= 0) return "Resetting soon";

	const hours = Math.floor(diffMs / (1000 * 60 * 60));
	const days = Math.floor(hours / 24);

	if (days > 0) {
		const remainingHours = hours % 24;
		if (remainingHours > 0) {
			return `${days}d ${remainingHours}h`;
		}
		return `${days} day${days !== 1 ? "s" : ""}`;
	}

	if (hours > 0) {
		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
		if (minutes > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${hours} hour${hours !== 1 ? "s" : ""}`;
	}

	const minutes = Math.floor(diffMs / (1000 * 60));
	return `${minutes} min${minutes !== 1 ? "s" : ""}`;
}

export function UsageWidget() {
	const [claudeUsageData, setClaudeUsageData] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchClaudeUsage = async () => {
			try {
				setIsLoading(true);
				const response = await fetch("http://localhost:8081/api/claude/usage");
				const data = await response.json();
				if (data.success) {
					setClaudeUsageData(data.data || []);
					setError(null);
				} else {
					setError("Failed to load usage");
				}
			} catch (err) {
				console.error("Failed to fetch Claude usage data:", err);
				setError("Failed to load usage");
			} finally {
				setIsLoading(false);
			}
		};

		fetchClaudeUsage();
		// Refresh every 30 seconds
		const interval = setInterval(fetchClaudeUsage, 30000);
		return () => clearInterval(interval);
	}, []);

	if (isLoading) {
		return (
			<div className="rounded-lg bg-muted/50 p-3">
				<div className="flex items-center gap-2 text-sm mb-2">
					<BarChart3 className="h-4 w-4 text-primary" />
					<span className="font-medium">Usage Limits</span>
				</div>
				<div className="space-y-2">
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-2/3" />
				</div>
			</div>
		);
	}

	if (error || !claudeUsageData || claudeUsageData.length === 0) {
		return (
			<div className="rounded-lg bg-muted/50 p-3">
				<div className="flex items-center gap-2 text-sm">
					<BarChart3 className="h-4 w-4 text-primary" />
					<span className="font-medium">Usage Limits</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					{error || "No accounts configured"}
				</p>
			</div>
		);
	}

	// Calculate average usage across all accounts
	let totalSessionPercentage = 0;
	let totalWeeklyPercentage = 0;
	let earliestSessionReset: string | null = null;
	let earliestWeeklyReset: string | null = null;

	for (const accountData of claudeUsageData) {
		if (accountData.usage) {
			totalSessionPercentage += accountData.usage.session.percentage || 0;
			totalWeeklyPercentage += accountData.usage.weekly.percentage || 0;

			// Track earliest resets
			const sessionReset = accountData.usage.session.resetAt;
			if (sessionReset) {
				if (
					!earliestSessionReset ||
					new Date(sessionReset) < new Date(earliestSessionReset)
				) {
					earliestSessionReset = sessionReset;
				}
			}

			const weeklyReset = accountData.usage.weekly.resetAt;
			if (weeklyReset) {
				if (
					!earliestWeeklyReset ||
					new Date(weeklyReset) < new Date(earliestWeeklyReset)
				) {
					earliestWeeklyReset = weeklyReset;
				}
			}
		}
	}

	// Average the percentages
	const avgSessionPercentage =
		claudeUsageData.length > 0
			? totalSessionPercentage / claudeUsageData.length
			: 0;
	const avgWeeklyPercentage =
		claudeUsageData.length > 0
			? totalWeeklyPercentage / claudeUsageData.length
			: 0;

	// Color coding based on usage
	const getColorClass = (percentage: number) => {
		if (percentage >= 90) return "bg-red-500";
		if (percentage >= 70) return "bg-yellow-500";
		return "bg-primary";
	};

	const hasData =
		claudeUsageData.length > 0 &&
		(avgSessionPercentage > 0 || avgWeeklyPercentage > 0);

	return (
		<div className="rounded-lg bg-muted/50 p-3">
			<div className="flex items-center gap-2 text-sm mb-3">
				<BarChart3 className="h-4 w-4 text-primary" />
				<span className="font-medium">Usage Limits</span>
			</div>

			{!hasData ? (
				<p className="text-xs text-muted-foreground">
					No usage data available yet
				</p>
			) : (
				<div className="space-y-3">
					{/* Current Session */}
					{avgSessionPercentage > 0 && (
						<div className="space-y-1">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Current session</span>
								<span className="font-medium">
									{avgSessionPercentage.toFixed(0)}%
								</span>
							</div>
							<div className="relative">
								<Progress value={avgSessionPercentage} className="h-1.5" />
								<div
									className={cn(
										"absolute top-0 left-0 h-1.5 rounded-full transition-all duration-700 ease-out",
										getColorClass(avgSessionPercentage),
									)}
									style={{ width: `${Math.min(100, avgSessionPercentage)}%` }}
								/>
							</div>
							{earliestSessionReset && (
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Clock className="h-3 w-3" />
									<span>Resets in {formatResetTime(earliestSessionReset)}</span>
								</div>
							)}
						</div>
					)}

					{/* Weekly */}
					{avgWeeklyPercentage > 0 && (
						<div className="space-y-1">
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Weekly</span>
								<span className="font-medium">
									{avgWeeklyPercentage.toFixed(0)}%
								</span>
							</div>
							<div className="relative">
								<Progress value={avgWeeklyPercentage} className="h-1.5" />
								<div
									className={cn(
										"absolute top-0 left-0 h-1.5 rounded-full transition-all duration-700 ease-out",
										getColorClass(avgWeeklyPercentage),
									)}
									style={{ width: `${Math.min(100, avgWeeklyPercentage)}%` }}
								/>
							</div>
							{earliestWeeklyReset && (
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Clock className="h-3 w-3" />
									<span>Resets in {formatResetTime(earliestWeeklyReset)}</span>
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
