import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";

interface BandwidthIndicatorProps {
	accountId: string;
	status?: "healthy" | "warning" | "critical" | "rate_limited";
	statusMessage?: string;
	immediateCapacity?: {
		requests: number;
		tokens: number;
	};
	tier?: number;
	secondsUntilReset?: number;
}

export function BandwidthIndicator({
	status = "healthy",
	statusMessage = "Status unknown",
	immediateCapacity = { requests: 0, tokens: 0 },
	tier = 1,
	secondsUntilReset,
}: BandwidthIndicatorProps) {
	const getStatusBadge = (status: string) => {
		switch (status) {
			case "healthy":
				return (
					<Badge className="bg-green-100 text-green-800 text-xs">Healthy</Badge>
				);
			case "warning":
				return (
					<Badge className="bg-yellow-100 text-yellow-800 text-xs">
						Warning
					</Badge>
				);
			case "critical":
				return (
					<Badge className="bg-orange-100 text-orange-800 text-xs">
						Critical
					</Badge>
				);
			case "rate_limited":
				return (
					<Badge className="bg-red-100 text-red-800 text-xs">
						Rate Limited
					</Badge>
				);
			default:
				return <Badge className="text-xs">Unknown</Badge>;
		}
	};

	const formatTimeUntilReset = (seconds?: number) => {
		if (!seconds) return "Unknown";

		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${secs}s`;
		} else {
			return `${secs}s`;
		}
	};

	// Rough tier-based limits for progress bars
	const getTierLimits = (tier: number) => {
		const limits = {
			1: { requests: 50, tokens: 40000 }, // Pro
			2: { requests: 100, tokens: 80000 },
			3: { requests: 200, tokens: 160000 },
			4: { requests: 500, tokens: 400000 },
			5: { requests: 1000, tokens: 800000 }, // Max
		};
		return limits[tier as keyof typeof limits] || limits[1];
	};

	const tierLimits = getTierLimits(tier);
	const requestsPercentage = Math.min(
		(immediateCapacity.requests / tierLimits.requests) * 100,
		100,
	);

	return (
		<div className="space-y-2 bg-muted/30 p-3 rounded-md">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{getStatusBadge(status)}
					<span className="text-xs text-muted-foreground">{statusMessage}</span>
				</div>
				{secondsUntilReset !== undefined && (
					<span className="text-xs font-mono text-muted-foreground">
						Reset: {formatTimeUntilReset(secondsUntilReset)}
					</span>
				)}
			</div>

			{/* Capacity indicators */}
			<div className="space-y-1">
				<div className="flex justify-between text-xs">
					<span>Available Requests</span>
					<span className="font-mono">
						{immediateCapacity.requests} / {tierLimits.requests}
					</span>
				</div>
				<Progress value={requestsPercentage} className="h-1.5" />

				{immediateCapacity.tokens > 0 && (
					<div className="flex justify-between text-xs">
						<span>Available Tokens</span>
						<span className="font-mono">
							{immediateCapacity.tokens.toLocaleString()}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
