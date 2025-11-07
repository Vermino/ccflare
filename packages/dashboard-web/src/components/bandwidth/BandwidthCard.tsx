import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";

interface BandwidthCardProps {
	accountName: string;
	accountId: string;
	tier: number;
	status: "healthy" | "warning" | "critical" | "rate_limited";
	statusMessage: string;
	immediateCapacity: {
		requests: number;
		tokens: number;
	};
	nextResetTime?: number;
	secondsUntilReset?: number;
}

export function BandwidthCard({
	accountName,
	tier,
	status,
	statusMessage,
	immediateCapacity,
	secondsUntilReset,
}: BandwidthCardProps) {
	const _getStatusColor = (status: string) => {
		switch (status) {
			case "healthy":
				return "bg-green-500";
			case "warning":
				return "bg-yellow-500";
			case "critical":
				return "bg-orange-500";
			case "rate_limited":
				return "bg-red-500";
			default:
				return "bg-gray-500";
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "healthy":
				return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
			case "warning":
				return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
			case "critical":
				return (
					<Badge className="bg-orange-100 text-orange-800">Critical</Badge>
				);
			case "rate_limited":
				return <Badge className="bg-red-100 text-red-800">Rate Limited</Badge>;
			default:
				return <Badge>Unknown</Badge>;
		}
	};

	const formatTimeUntilReset = (seconds?: number) => {
		if (!seconds) return "Unknown";

		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m ${secs}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${secs}s`;
		} else {
			return `${secs}s`;
		}
	};

	// Calculate capacity percentages (rough estimates based on tier)
	const getTierLimits = (tier: number) => {
		// These are rough estimates - adjust based on actual Claude API limits
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
	const requestsPercentage =
		(immediateCapacity.requests / tierLimits.requests) * 100;
	const tokensPercentage =
		immediateCapacity.tokens > 0
			? (immediateCapacity.tokens / tierLimits.tokens) * 100
			: 0;

	return (
		<Card className="w-full">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg font-semibold">
						{accountName}
						<span className="ml-2 text-sm text-gray-500">Tier {tier}</span>
					</CardTitle>
					{getStatusBadge(status)}
				</div>
				<p className="text-sm text-gray-600">{statusMessage}</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Immediate Capacity */}
				<div className="space-y-3">
					<h4 className="text-sm font-medium text-gray-700">
						Immediate Capacity
					</h4>

					{/* Requests */}
					<div className="space-y-1">
						<div className="flex justify-between text-sm">
							<span>Requests</span>
							<span>
								{immediateCapacity.requests} / {tierLimits.requests}
							</span>
						</div>
						<Progress value={requestsPercentage} className="h-2" />
					</div>

					{/* Tokens */}
					<div className="space-y-1">
						<div className="flex justify-between text-sm">
							<span>Tokens</span>
							<span>
								{immediateCapacity.tokens.toLocaleString()} /{" "}
								{tierLimits.tokens.toLocaleString()}
							</span>
						</div>
						<Progress value={tokensPercentage} className="h-2" />
					</div>
				</div>

				{/* Reset Timer */}
				{secondsUntilReset !== undefined && (
					<div className="pt-2 border-t">
						<div className="flex justify-between text-sm">
							<span className="text-gray-600">Next Reset</span>
							<span className="font-mono">
								{formatTimeUntilReset(secondsUntilReset)}
							</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
